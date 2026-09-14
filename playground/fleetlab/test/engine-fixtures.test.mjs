// Hand-derived single-car and few-car engine fixtures (design 3.5, 5.3, 5.4, 5.7, 9.5; contract 6.4).
//
// Every expected number is derived by hand in the comments from the design and the contract, never copied from a run.
// Sigma is 0 everywhere, so every traffic and ride factor is exactly 1,000,000 and realized = planned.
//
// ---------------------------------------------------------------------------------------------------------------
// The fixture option (added to createRun for these tests; the contract has no such hook yet)
// ---------------------------------------------------------------------------------------------------------------
//
//   createRun(scenario, world, { seed, fixture })
//
//   fixture = {
//     cars: [
//       { id, home_area, home_depot, state, location, trips_since_visit, visits },
//     ],
//     requests: [ { id, time_s, origin, dest } ],
//     depotOccupancy: { "<depot id>": { stalls: [until_s, ...], cleaning: [until_s, ...], service: [until_s, ...] } },
//   }
//
// Semantics, exactly:
// - When `fixture` is present, `fixture.cars` replaces the fleet built from SUP-1 and `fixture.requests` replaces
//   acceptedRequests(world, scenario). The world is still built and still supplies trafficPpm and ridePpm.
// - cars: `id` follows `<AREA>-<nnn>` with the prefix equal to `home_area`. `home_depot` is declared (a depot id of the
//   scenario) instead of computed. `state` is "IDLE" with `location: {area}` (a car at an area centre, which need not be
//   its home area) or "READY_AT_DEPOT" with `location: {depot}` (it holds one stall there from window.start_s, has no
//   visit record, and is dispatchable). `trips_since_visit` and `visits` are the car's counters at window.start_s
//   (non-negative integers): the next trip completion adds 1 to `trips_since_visit`, and the next visit started is
//   visit number `visits + 1`. Cars are processed in sorted-id order like any fleet.
// - requests: sorted by (time_s, id) like accepted requests; each gets REQUEST_CREATED at time_s and WAIT_DEADLINE at
//   time_s + patience_s. `time_s` lies inside the window.
// - depotOccupancy: placeholder holds that are not cars, visits or requests. Each entry of `stalls` holds one parking
//   stall, each entry of `cleaning` one cleaning bay, each entry of `service` one service bay, from window.start_s until
//   its `until_s` (integer seconds, greater than window.start_s). Holds count toward parking (P13) and bay occupancy
//   (invariant 5) and toward stalls held in snapshots. At run creation, before any other push, the engine pushes one
//   heap event per hold, kind FIXTURE_HOLD_ENDED, class 0, at `until_s`, in the order: depots by id, then stalls,
//   cleaning, service, each in list order. Its handler logs `{kind: "FIXTURE_HOLD_ENDED", depot, detail: {resource}}`
//   with resource "STALL", "CLEANING" or "SERVICE", releases the resource, and then applies the ordinary freed-stall or
//   freed-bay rule of design 5.3 and contract 6.4 at that second. Holds whose until_s is after T_d are discarded with
//   every other later heap event. A hold whose until_s is beyond the window (these tests use 200,000) never ends.
//
// Other result details these tests rely on where contract 6.4 is silent:
// - `result.intervals` is a plain object keyed by car id. Zero-length intervals (t0 === t1) may or may not be recorded;
//   these tests ignore them. The last interval of every car ends at `drain_end_s`.
// - A TO_DEPOT interval carries `purpose` ("SERVICE_DUE" or "RECALL") and `depot` (its target; a diversion starts a new
//   TO_DEPOT interval whose `depot` is the new target). Driving intervals carry `segments` with contract 6.4's
//   `{kind, key, dir, cls, t0, t1, loaded}`.
// - `result.requests` is an array of `{id, state, pickup_s, dropoff_s, ...}`; `result.visits` an array of contract 6.4
//   visit records; a field of a stage the visit never reached is null. A visit's `depot` is the depot the car entered
//   (or whose gate it waits at), and `arrival_s` its arrival there.
// - Events that concern a car carry `car`; DEPOT_ARRIVED and DEPOT_DIVERTED carry `depot` (for a diversion, the depot
//   that turned the car away).
//
// Clock seconds used below: D1 05:00 = 18,000 (window start); D1 10:00 = 36,000; D1 17:00 = 61,200;
// D1 18:00 = 64,800; D1 19:00 = 68,400; D1 20:00 = 72,000; D2 00:00 = 86,400; D2 00:30 = 88,200 (recall);
// D2 05:00 = 104,400; D2 05:45 = 107,100 (release); D2 06:00 = 108,000; D2 10:00 = 122,400 (window end).
// Hours 24 to 29 (D2 00:00 to 06:00) and hours 9 to 15 and 33 to 35 carry multiplier 1000 in every row.
// Default times: pull_out 120, depot access 300, intake 180, clean 1200, service 2700, patience 600,
// in-area SF 360, PEN 480, SJ 480, EB 420. Free flow: H1 1500, L1 3300, H2 3300, L2 6600, H3 1200, L3 2700,
// H5 2400, L5 4800, H6 3000, L6 5700. Planned-time integration: see routes.test.mjs.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createRun } from "../src/model/engine.js";
import { computeMetric } from "../src/model/metrics.js";
import { applyAxis, defaultScenario, validateScenario } from "../src/model/schema.js";
import { buildWorld } from "../src/model/world.js";

const FAR = 200000;
const WINDOW_END = 122400;

/** The design 3.5 traffic ("Evening depot visit in San Jose") with a depot-assignment policy. */
function workedExampleScenario(depotAssignment) {
  let s = defaultScenario();
  s.name = "l3_evening_depot_visit_sj";
  s = applyAxis(s, "parameter:RD-3.highway.evening", 1600);
  s = applyAxis(s, "parameter:RD-3.highway.late", 1300);
  s = applyAxis(s, "parameter:RD-3.local.evening", 1300);
  s = applyAxis(s, "parameter:RD-3.in_area.evening", 1300);
  return applyAxis(s, "policy:depot_assignment", depotAssignment);
}

/** Runs a fixture to the end with step(), checks the run is valid, and returns result(). */
function runFixture(scenario, fixture, seed = 1001) {
  // validateScenario returns {ok, errors, warnings} (schema.test.mjs pins that shape), so ok and errors are checked.
  const verdict = validateScenario(scenario);
  assert.deepEqual({ ok: verdict.ok, errors: verdict.errors }, { ok: true, errors: [] });
  const world = buildWorld(scenario, { seed });
  const run = createRun(scenario, world, { seed, fixture });
  let slices = 0;
  while (!run.step(100000)) {
    slices += 1;
    assert.ok(slices < 100000, "the run did not finish");
  }
  const result = run.result();
  assert.deepEqual(result.invariant_violations, []);
  return result;
}

const car = (id, home_area, home_depot, location, extra = {}) => ({
  id, home_area, home_depot, state: "IDLE", location, trips_since_visit: 0, visits: 0, ...extra,
});
const readyCar = (id, home_area, home_depot, depot) =>
  car(id, home_area, home_depot, { depot }, { state: "READY_AT_DEPOT" });
const holds = (n, until_s) => Array.from({ length: n }, () => until_s);

/** Non-zero-length intervals of one car as [label, t0, t1]; the label adds the task and a blocked mark. */
function spans(result, carId) {
  const list = result.intervals[carId];
  assert.ok(Array.isArray(list), `no interval list for ${carId}`);
  return list
    .filter((i) => i.t1 > i.t0)
    .map((i) => [`${i.state}${i.task ? `:${i.task}` : ""}${i.blocked ? ":blocked" : ""}`, i.t0, i.t1]);
}

function intervalAt(result, carId, state, t0) {
  const found = result.intervals[carId].find((i) => i.state === state && i.t0 === t0 && i.t1 > i.t0);
  assert.ok(found, `${carId} has no ${state} interval starting at ${t0}`);
  return found;
}

/** Asserts that `expected` partial events occur in the log in this order (other entries may sit between them). */
function expectInOrder(events, expected) {
  let from = 0;
  for (const want of expected) {
    const index = events.findIndex((e, i) => i >= from && Object.entries(want).every(([k, v]) => e[k] === v));
    assert.ok(index >= 0, `missing event after position ${from}: ${JSON.stringify(want)}`);
    from = index + 1;
  }
}

const eventsOf = (result, pred) => result.events.filter(pred);
const visitsOf = (result, carId) => result.visits.filter((v) => v.car === carId);
const requestOf = (result, id) => result.requests.find((r) => r.id === id);

const segText = (s) => [s.kind, s.key ?? null, s.dir ?? null, s.t0, s.t1, s.loaded];

/**
 * Congested seconds by the exposure rule (design 5.7, contract 6.4): a second of a ROUTE, ACCESS or IN_AREA segment
 * counts when the declared multiplier of the hour containing it is at least the threshold; ROUTE reads its class and
 * direction row, ACCESS and IN_AREA read the IN_AREA row; PULL_OUT never counts. Clipped to [warmup_end_s, end_s).
 */
function congestedSeconds(result, scenario, { loaded, area = null }) {
  const lo = scenario.warmup_end_s;
  const hi = scenario.window.end_s;
  let total = 0;
  for (const list of Object.values(result.intervals)) {
    for (const interval of list) {
      for (const seg of interval.segments ?? []) {
        if (seg.loaded !== loaded || seg.kind === "PULL_OUT") continue;
        if (area !== null && segmentArea(seg, scenario) !== area) continue;
        const row = seg.kind === "ROUTE" ? scenario.congestion[seg.cls][seg.dir] : scenario.congestion.IN_AREA;
        for (let t = Math.max(seg.t0, lo); t < Math.min(seg.t1, hi); ) {
          const hour = Math.floor(t / 3600);
          const end = Math.min((hour + 1) * 3600, seg.t1, hi);
          if (row[Math.min(hour, 47)] >= scenario.congestion_threshold_permille) total += end - t;
          t = end;
        }
      }
    }
  }
  return total;
}

/** The area a segment's seconds belong to: a route to its origin, access and in-area legs to their own area. */
function segmentArea(seg, scenario) {
  if (seg.kind === "ROUTE") return seg.dir.split(">")[0];
  if (seg.kind === "IN_AREA") return seg.key.slice(3);
  return scenario.depots.find((d) => `ACC-${d.id}` === seg.key).area;
}

// ---------------------------------------------------------------------------------------------------------------
// 1. Design 3.5 worked example, both arms (and 6. the intake interval)
// ---------------------------------------------------------------------------------------------------------------
//
// SF-017 (home SF, home depot SF-1) stands IDLE at the SJ centre with 9 trips since its last visit and 0 visits.
// Its tenth trip is rider r-SJ-0, created at 65,352 inside SJ, so the drop-off falls at 66,600 (D1 18:30):
//   65,352 REQUEST_CREATED, REQUEST_ASSIGNED (the only car). Pickup leg IN_AREA SJ, hour 18 (IN_AREA 1300):
//          S = 68,400 - 65,352 = 3048, covered = floor(3048 x 10^9 / 1300) = 2,344,615,384 >= 480,000,000;
//          480 x 1.3 = 624 s. PICKUP_COMPLETED 65,976.
//   65,976 trip leg IN_AREA SJ, still hour 18: 624 s. TRIP_COMPLETED 66,600. trips_since_visit 10 >= 10: visit due,
//          visit number 1, 1 % 3 != 0, so clean only; purpose SERVICE_DUE. Wait 65,976 - 65,352 = 624.
// Declared occupancy (the same in both arms):
//   SF-1: 4 cleaning bays held until 73,808, so a car finishing intake at 71,708 waits 2100 s (35 min).
//   SJ-1: 3 cleaning bays held until 68,370, so a car finishing intake at 67,170 waits 1200 s (20 min);
//         24 stalls held for the whole run (24 held at 19:00, when SF-017 is in a bay).
// Only one request exists, terminal at 66,600 < window end, so T_d = 122,400 (design 5.7).
//
// Arm A, home_depot -> SF-1. Leg from {area SJ} to {depot SF-1} at 66,600:
//   ROUTE: chooseRoute at 66,600: H2 4628 (routes.test.mjs), L2 7015, so H2; 66,600 to 71,228.
//   ACCESS IN SF-1 at 71,228: hour 19, IN_AREA 1000 in this preset, 300 s; to 71,528. DEPOT_ARRIVED 71,528.
//   60 free stalls: INTAKE 71,528 to 71,708. INTAKE_COMPLETED 71,708: every cleaning bay held: QUEUED_SERVICE.
//   73,808: the holds end (FIXTURE_HOLD_ENDED x4); the freed-bay rule takes SF-017: SERVICE_STARTED CLEAN.
//   73,808 + 1200 = 75,008 SERVICE_COMPLETED; a stall is free: READY_AT_DEPOT until the window end.
//   Recall 88,200: a ready car keeps its course. Release 107,100: SF-1 is in the home area: no move.
//   Out of service 75,008 - 66,600 = 8408 s (2 h 20 min 8 s). Depot leg congested: hour 18 at 1600 >= 1300,
//   1800 s; hour 19 at 1300 >= 1300, 2828 s; access at 1000, 0 s: 4628 s (77.1 min).
//
// Arm B, nearest_depot. planPath arrivals from {area SJ} at 66,600: SJ-1 66,600 + 390 = 66,990; SF-1 and SF-2
// 71,528; EB-1 via H6 SJ>EB (hour 18 at 1600: covered 1,125,000,000, R = 1,875,000,000; hour 19 at 1300:
// 2437.5 -> 2438; total 4238, L6 6115) then access 300: 71,138. Nearest SJ-1.
//   ACCESS IN SJ-1 at 66,600 (hour 18, 1300): 390 s. DEPOT_ARRIVED 66,990; 24 + 1 = 25 <= 30 stalls: INTAKE.
//   INTAKE_COMPLETED 67,170: bays held: QUEUED_SERVICE. 68,370 holds end: SERVICE_STARTED CLEAN.
//   69,570 SERVICE_COMPLETED: READY_AT_DEPOT (25 stalls held, 5 free).
//   Release 107,100: SJ-1 is outside SF: MORNING_RELEASE, REPOSITIONING. Leg from {depot SJ-1} to {area SF}:
//   PULL_OUT 107,100 to 107,220; ACCESS OUT SJ-1 hour 29 (1000) 300 s to 107,520; H2 SJ>SF chosen at 107,520
//   (3300 against L2 6600), hours 29 and 30 at 1000: 3300 s to 110,820 (D2 06:47). REPOSITION_COMPLETED 110,820,
//   IDLE in SF until the window end (the recall stopped pending at 107,100).
//   Out of service 69,570 - 66,600 = 2970 s (49.5 min). Depot leg congested: 390 s. Release leg: 0 s.
//
// Congested empty seconds over [21,600, 122,400): the pickup leg adds 624 s in both arms (IN_AREA 1300, empty).
//   A: 624 + 4628 = 5252.  B: 624 + 390 + 0 = 1014.  Congested loaded: the trip, 624 s in both arms.

const WORKED_FIXTURE = {
  cars: [car("SF-017", "SF", "SF-1", { area: "SJ" }, { trips_since_visit: 9 })],
  requests: [{ id: "r-SJ-0", time_s: 65352, origin: "SJ", dest: "SJ" }],
  depotOccupancy: {
    "SF-1": { stalls: [], cleaning: holds(4, 73808), service: [] },
    "SJ-1": { stalls: holds(24, FAR), cleaning: holds(3, 68370), service: [] },
  },
};

describe("1. design 3.5 worked example, arm A (home_depot)", () => {
  const scenario = workedExampleScenario("home_depot");
  const result = runFixture(scenario, WORKED_FIXTURE);

  test("drain end is the window end", () => {
    assert.equal(result.drain_end_s, WINDOW_END);
  });

  test("the rider is served with a 624 s wait", () => {
    const r = requestOf(result, "r-SJ-0");
    assert.equal(r.state, "COMPLETED");
    assert.equal(r.pickup_s, 65976);
    assert.equal(r.dropoff_s, 66600);
  });

  test("events in order", () => {
    expectInOrder(result.events, [
      { t: 65352, kind: "REQUEST_CREATED", req: "r-SJ-0" },
      { t: 65352, kind: "REQUEST_ASSIGNED", car: "SF-017", req: "r-SJ-0" },
      { t: 65976, kind: "PICKUP_COMPLETED", car: "SF-017" },
      { t: 66600, kind: "TRIP_COMPLETED", car: "SF-017" },
      { t: 71528, kind: "DEPOT_ARRIVED", car: "SF-017", depot: "SF-1" },
      { t: 71708, kind: "INTAKE_COMPLETED", car: "SF-017" },
      { t: 73808, kind: "FIXTURE_HOLD_ENDED", depot: "SF-1" },
      { t: 73808, kind: "SERVICE_STARTED", car: "SF-017" },
      { t: 75008, kind: "SERVICE_COMPLETED", car: "SF-017" },
    ]);
    assert.equal(eventsOf(result, (e) => e.kind === "DEPOT_DIVERTED").length, 0);
    assert.equal(eventsOf(result, (e) => e.kind === "REPOSITION_COMPLETED").length, 0);
  });

  test("state intervals", () => {
    assert.deepEqual(spans(result, "SF-017"), [
      ["IDLE", 18000, 65352],
      ["ENROUTE_PICKUP", 65352, 65976],
      ["ON_TRIP", 65976, 66600],
      ["TO_DEPOT", 66600, 71528],
      ["INTAKE", 71528, 71708],
      ["QUEUED_SERVICE", 71708, 73808],
      ["IN_SERVICE:CLEAN", 73808, 75008],
      ["READY_AT_DEPOT", 75008, 122400],
    ]);
    const leg = intervalAt(result, "SF-017", "TO_DEPOT", 66600);
    assert.equal(leg.purpose, "SERVICE_DUE");
    assert.equal(leg.depot, "SF-1");
    assert.deepEqual(leg.segments.map(segText), [
      ["ROUTE", "H2", "SJ>SF", 66600, 71228, false],
      ["ACCESS", "ACC-SF-1", "IN", 71228, 71528, false],
    ]);
    assert.equal(leg.segments[0].cls, "HIGHWAY");
  });

  test("visit record", () => {
    assert.deepEqual(visitsOf(result, "SF-017").map((v) => ({ ...v })), [{
      car: "SF-017", depot: "SF-1", arrival_s: 71528, intake_end_s: 71708, first_task_s: 73808,
      clean_start_s: 73808, clean_end_s: 75008, service_start_s: null, service_end_s: null, ready_s: 75008,
      censored: false,
    }]);
    // Out of service from the drop-off: 75,008 - 66,600 = 8408 s.
    assert.equal(visitsOf(result, "SF-017")[0].ready_s - 66600, 8408);
  });

  test("congested seconds by the exposure rule", () => {
    assert.equal(congestedSeconds(result, scenario, { loaded: false }), 5252);
    assert.equal(congestedSeconds(result, scenario, { loaded: true }), 624);
    assert.deepEqual(computeMetric(result, { metric: "exposure.congested_empty_s", scope: {} }), { value: 5252 });
    assert.deepEqual(computeMetric(result, { metric: "exposure.congested_loaded_s", scope: {} }), { value: 624 });
  });

  test("placement gap at the day 2 06:00 snapshot", () => {
    // CLK-4 snapshot 108,000. SF-017 starts at the SJ centre, so its start area is SJ. At 108,000 it is READY_AT_DEPOT
    // at SF-1 (75,008 to 122,400), which counts in SF. Gap = (|SF 1 - 0| + |SJ 0 - 1|) / 2 = 1. Arm B gives the same 1
    // (see there): the gap is equal in both arms, and it is 1 rather than 0 only because the fixture car starts in SJ.
    assert.deepEqual(computeMetric(result, { metric: "fleet.placement_gap", scope: {} }), { value: 1 });
  });
});

describe("1. design 3.5 worked example, arm B (nearest_depot)", () => {
  const scenario = workedExampleScenario("nearest_depot");
  const result = runFixture(scenario, WORKED_FIXTURE);

  test("drain end is the window end", () => {
    assert.equal(result.drain_end_s, WINDOW_END);
  });

  test("events in order, including the morning release", () => {
    expectInOrder(result.events, [
      { t: 65352, kind: "REQUEST_ASSIGNED", car: "SF-017", req: "r-SJ-0" },
      { t: 65976, kind: "PICKUP_COMPLETED", car: "SF-017" },
      { t: 66600, kind: "TRIP_COMPLETED", car: "SF-017" },
      { t: 66990, kind: "DEPOT_ARRIVED", car: "SF-017", depot: "SJ-1" },
      { t: 67170, kind: "INTAKE_COMPLETED", car: "SF-017" },
      { t: 68370, kind: "FIXTURE_HOLD_ENDED", depot: "SJ-1" },
      { t: 68370, kind: "SERVICE_STARTED", car: "SF-017" },
      { t: 69570, kind: "SERVICE_COMPLETED", car: "SF-017" },
      { t: 88200, kind: "RECALL_ORDERED" },
      { t: 107100, kind: "MORNING_RELEASE" },
      { t: 110820, kind: "REPOSITION_COMPLETED", car: "SF-017" },
    ]);
  });

  test("state intervals, with the intake interval accounted as INTAKE (case 6 on the worked example)", () => {
    assert.deepEqual(spans(result, "SF-017"), [
      ["IDLE", 18000, 65352],
      ["ENROUTE_PICKUP", 65352, 65976],
      ["ON_TRIP", 65976, 66600],
      ["TO_DEPOT", 66600, 66990],
      ["INTAKE", 66990, 67170],
      ["QUEUED_SERVICE", 67170, 68370],
      ["IN_SERVICE:CLEAN", 68370, 69570],
      ["READY_AT_DEPOT", 69570, 107100],
      ["REPOSITIONING", 107100, 110820],
      ["IDLE", 110820, 122400],
    ]);
    const leg = intervalAt(result, "SF-017", "TO_DEPOT", 66600);
    assert.equal(leg.purpose, "SERVICE_DUE");
    assert.equal(leg.depot, "SJ-1");
    assert.deepEqual(leg.segments.map(segText), [["ACCESS", "ACC-SJ-1", "IN", 66600, 66990, false]]);
    const release = intervalAt(result, "SF-017", "REPOSITIONING", 107100);
    assert.deepEqual(release.segments.map(segText), [
      ["PULL_OUT", release.segments[0].key ?? null, release.segments[0].dir ?? null, 107100, 107220, false],
      ["ACCESS", "ACC-SJ-1", "OUT", 107220, 107520, false],
      ["ROUTE", "H2", "SJ>SF", 107520, 110820, false],
    ]);
    const pickup = intervalAt(result, "SF-017", "ENROUTE_PICKUP", 65352);
    assert.deepEqual(pickup.segments.map(segText), [["IN_AREA", "IN-SJ", "-", 65352, 65976, false]]);
    const trip = intervalAt(result, "SF-017", "ON_TRIP", 65976);
    assert.deepEqual(trip.segments.map(segText), [["IN_AREA", "IN-SJ", "-", 65976, 66600, true]]);
  });

  test("visit record", () => {
    assert.deepEqual(visitsOf(result, "SF-017").map((v) => ({ ...v })), [{
      car: "SF-017", depot: "SJ-1", arrival_s: 66990, intake_end_s: 67170, first_task_s: 68370,
      clean_start_s: 68370, clean_end_s: 69570, service_start_s: null, service_end_s: null, ready_s: 69570,
      censored: false,
    }]);
    // Out of service from the drop-off: 69,570 - 66,600 = 2970 s, against 8408 s in arm A.
    assert.equal(visitsOf(result, "SF-017")[0].ready_s - 66600, 2970);
  });

  test("case 6: the intake seconds sit in INTAKE, not in QUEUED_SERVICE", () => {
    const intake = intervalAt(result, "SF-017", "INTAKE", 66990);
    assert.equal(intake.t1 - intake.t0, 180);
    assert.equal(intake.location?.depot, "SJ-1");
    const queued = result.intervals["SF-017"].filter((i) => i.state === "QUEUED_SERVICE");
    // 67,170 to 68,370: exactly the declared 20-minute queue, 1200 s.
    assert.equal(queued.reduce((sum, i) => sum + (i.t1 - i.t0), 0), 1200);
  });

  test("congested seconds by the exposure rule", () => {
    assert.equal(congestedSeconds(result, scenario, { loaded: false }), 1014);
    assert.equal(congestedSeconds(result, scenario, { loaded: true }), 624);
    assert.deepEqual(computeMetric(result, { metric: "exposure.congested_empty_s", scope: {} }), { value: 1014 });
  });

  test("placement gap at the day 2 06:00 snapshot equals arm A's", () => {
    // CLK-4 snapshot 108,000. The release leg runs 107,100 to 110,820, so at 108,000 SF-017 is REPOSITIONING to
    // {area SF}; a car on a leg counts in its destination area (design 5.7), so SF. Start area SJ, as in arm A:
    // gap = (|SF 1 - 0| + |SJ 0 - 1|) / 2 = 1. Equal to arm A, not higher: the morning cost of arm B shows in the
    // release leg's empty driving and day 2 exposure, not in the gap.
    assert.deepEqual(computeMetric(result, { metric: "fleet.placement_gap", scope: {} }), { value: 1 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 2. The morning release: a Peninsula car ready at SF-1 repositions to PEN; an SF car ready at SF-1 stays
// ---------------------------------------------------------------------------------------------------------------
//
// Default scenario (home_depot). PEN has no depot; PEN's free-flow nearest set is {SF-1, SF-2} (H1 1500 + 300 each),
// and PEN-001 is index 0, so its home depot is SF-1 (declared). No requests, so T_d = 122,400.
// 88,200 RECALL_ORDERED (hour 24, every multiplier 1000). IDLE cars in sorted-id order: PEN-001, SF-001.
//   PEN-001 {area PEN} -> {depot SF-1}: H1 PEN>SF (1500 against L1 3300) 88,200 to 89,700; ACCESS IN 300 to 90,000.
//     Visit 1 (clean only). INTAKE 90,000 to 90,180; a cleaning bay is free: CLEAN 90,180 to 91,380; READY 91,380.
//   SF-001 {area SF} -> {depot SF-1}: ACCESS IN 88,200 to 88,500; INTAKE to 88,680; CLEAN 88,680 to 89,880;
//     READY 89,880 to the window end.
// 107,100 MORNING_RELEASE: PEN-001's depot SF-1 is outside PEN: REPOSITIONING. SF-001 is home: no move (P20).
//   PULL_OUT 107,100 to 107,220; ACCESS OUT SF-1 hour 29 300 s to 107,520; H1 SF>PEN at 107,520: hour 29 S = 480,
//   covered 480,000,000, R = 1,020,000,000; hour 30 at 1000: 1020; total 1500 (L1 3300); arrival 109,020.
//   REPOSITION_COMPLETED 109,020; IDLE in PEN until 122,400.

describe("2. morning release of a Peninsula car whose home depot is in SF", () => {
  const scenario = defaultScenario();
  const result = runFixture(scenario, {
    cars: [car("PEN-001", "PEN", "SF-1", { area: "PEN" }), car("SF-001", "SF", "SF-1", { area: "SF" })],
    requests: [],
    depotOccupancy: {},
  });

  test("intervals of both cars", () => {
    assert.equal(result.drain_end_s, WINDOW_END);
    assert.deepEqual(spans(result, "PEN-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90000],
      ["INTAKE", 90000, 90180],
      ["IN_SERVICE:CLEAN", 90180, 91380],
      ["READY_AT_DEPOT", 91380, 107100],
      ["REPOSITIONING", 107100, 109020],
      ["IDLE", 109020, 122400],
    ]);
    assert.deepEqual(spans(result, "SF-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["READY_AT_DEPOT", 89880, 122400],
    ]);
    assert.equal(intervalAt(result, "PEN-001", "TO_DEPOT", 88200).purpose, "RECALL");
    assert.equal(intervalAt(result, "SF-001", "TO_DEPOT", 88200).purpose, "RECALL");
  });

  test("the release leg segments and events", () => {
    const leg = intervalAt(result, "PEN-001", "REPOSITIONING", 107100);
    assert.deepEqual(leg.segments.map((s) => [s.kind, s.t0, s.t1]), [
      ["PULL_OUT", 107100, 107220],
      ["ACCESS", 107220, 107520],
      ["ROUTE", 107520, 109020],
    ]);
    assert.equal(leg.segments[2].key, "H1");
    assert.equal(leg.segments[2].dir, "SF>PEN");
    expectInOrder(result.events, [
      { t: 107100, kind: "MORNING_RELEASE" },
      { t: 109020, kind: "REPOSITION_COMPLETED", car: "PEN-001" },
    ]);
    assert.equal(eventsOf(result, (e) => e.kind === "REPOSITION_COMPLETED").length, 1);
  });

  test("visit records", () => {
    assert.deepEqual(visitsOf(result, "PEN-001").map((v) => [v.depot, v.arrival_s, v.intake_end_s, v.clean_start_s, v.ready_s, v.censored]),
      [["SF-1", 90000, 90180, 90180, 91380, false]]);
    assert.deepEqual(visitsOf(result, "SF-001").map((v) => [v.depot, v.arrival_s, v.intake_end_s, v.clean_start_s, v.ready_s, v.censored]),
      [["SF-1", 88500, 88680, 88680, 89880, false]]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 3. A service visit at a one-service-bay depot re-queues after cleaning, then starts service when the bay frees
// ---------------------------------------------------------------------------------------------------------------
//
// SF-2 has 2 cleaning bays and 1 service bay. SF-002 (home depot SF-2) is IDLE in SF with visits 2, so its next
// visit is number 3 and 3 % 3 === 0: clean, then service. SF-2's service bay is held until 90,500.
// 88,200 recall: ACCESS IN SF-2 to 88,500; INTAKE to 88,680; a cleaning bay is free: CLEAN 88,680 to 89,880.
// 89,880 SERVICE_COMPLETED (clean): service due, the service bay is held, a stall is free (30 stalls, none held):
//   QUEUED_SERVICE (design 5.3, IN_SERVICE CLEAN -> QUEUED_SERVICE).
// 90,500 FIXTURE_HOLD_ENDED (service bay): the freed-bay rule takes the only queued car: SERVICE_STARTED SERVICE.
// 90,500 + 2700 = 93,200 SERVICE_COMPLETED: READY_AT_DEPOT until 122,400.
// Control run without the hold: at 89,880 the service bay is free, so the car moves bays directly
// (IN_SERVICE CLEAN -> IN_SERVICE SERVICE): service 89,880 to 92,580, ready 92,580.

describe("3. service visit re-queued at a one-service-bay depot", () => {
  const scenario = defaultScenario();
  const fixture = (serviceHolds) => ({
    cars: [car("SF-002", "SF", "SF-2", { area: "SF" }, { visits: 2 })],
    requests: [],
    depotOccupancy: { "SF-2": { stalls: [], cleaning: [], service: serviceHolds } },
  });

  test("with the service bay busy: clean, re-queue, service", () => {
    const result = runFixture(scenario, fixture([90500]));
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["QUEUED_SERVICE", 89880, 90500],
      ["IN_SERVICE:SERVICE", 90500, 93200],
      ["READY_AT_DEPOT", 93200, 122400],
    ]);
    expectInOrder(result.events, [
      { t: 88680, kind: "SERVICE_STARTED", car: "SF-002" },
      { t: 89880, kind: "SERVICE_COMPLETED", car: "SF-002" },
      { t: 90500, kind: "FIXTURE_HOLD_ENDED", depot: "SF-2" },
      { t: 90500, kind: "SERVICE_STARTED", car: "SF-002" },
      { t: 93200, kind: "SERVICE_COMPLETED", car: "SF-002" },
    ]);
    assert.deepEqual(visitsOf(result, "SF-002").map((v) => ({ ...v })), [{
      car: "SF-002", depot: "SF-2", arrival_s: 88500, intake_end_s: 88680, first_task_s: 88680,
      clean_start_s: 88680, clean_end_s: 89880, service_start_s: 90500, service_end_s: 93200, ready_s: 93200,
      censored: false,
    }]);
  });

  test("control: with the service bay free the car moves bays directly", () => {
    const result = runFixture(scenario, fixture([]));
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["IN_SERVICE:SERVICE", 89880, 92580],
      ["READY_AT_DEPOT", 92580, 122400],
    ]);
    const [v] = visitsOf(result, "SF-002");
    assert.deepEqual([v.service_start_s, v.service_end_s, v.ready_s], [89880, 92580, 92580]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 4. The recall catches a car on a trip
// ---------------------------------------------------------------------------------------------------------------
//
// SF-003 (home depot SF-1) IDLE in SF, 0 trips, 0 visits. Rider r-SF-0 at 88,000 (hour 24, all 1000), SF to PEN.
// 88,000 REQUEST_ASSIGNED; pickup IN_AREA SF 360 s; PICKUP_COMPLETED 88,360.
// 88,200 RECALL_ORDERED: SF-003 is ENROUTE_PICKUP, so it is not moved.
// 88,360 trip: H1 SF>PEN (1500 against 3300) to 89,860. TRIP_COMPLETED 89,860: trips 1 < 10, no visit due, the recall
//   is pending (88,200 to 107,100): TO_DEPOT, purpose RECALL, home depot SF-1.
//   H1 PEN>SF 89,860 to 91,360; ACCESS IN SF-1 to 91,660; INTAKE to 91,840; CLEAN 91,840 to 93,040; READY 93,040.
// The request is terminal at 89,860 < window end: T_d = 122,400.

describe("4. the recall catches a car on a trip", () => {
  const result = runFixture(defaultScenario(), {
    cars: [car("SF-003", "SF", "SF-1", { area: "SF" })],
    requests: [{ id: "r-SF-0", time_s: 88000, origin: "SF", dest: "PEN" }],
    depotOccupancy: {},
  });

  test("timeline", () => {
    assert.deepEqual(spans(result, "SF-003"), [
      ["IDLE", 18000, 88000],
      ["ENROUTE_PICKUP", 88000, 88360],
      ["ON_TRIP", 88360, 89860],
      ["TO_DEPOT", 89860, 91660],
      ["INTAKE", 91660, 91840],
      ["IN_SERVICE:CLEAN", 91840, 93040],
      ["READY_AT_DEPOT", 93040, 122400],
    ]);
    const leg = intervalAt(result, "SF-003", "TO_DEPOT", 89860);
    assert.equal(leg.purpose, "RECALL");
    assert.equal(leg.depot, "SF-1");
    assert.deepEqual(leg.segments.map(segText), [
      ["ROUTE", "H1", "PEN>SF", 89860, 91360, false],
      ["ACCESS", "ACC-SF-1", "IN", 91360, 91660, false],
    ]);
    const trip = intervalAt(result, "SF-003", "ON_TRIP", 88360);
    assert.deepEqual(trip.segments.map(segText), [["ROUTE", "H1", "SF>PEN", 88360, 89860, true]]);
  });

  test("events and records", () => {
    expectInOrder(result.events, [
      { t: 88000, kind: "REQUEST_ASSIGNED", car: "SF-003", req: "r-SF-0" },
      { t: 88200, kind: "RECALL_ORDERED" },
      { t: 88360, kind: "PICKUP_COMPLETED", car: "SF-003" },
      { t: 89860, kind: "TRIP_COMPLETED", car: "SF-003" },
      { t: 91660, kind: "DEPOT_ARRIVED", car: "SF-003", depot: "SF-1" },
    ]);
    const r = requestOf(result, "r-SF-0");
    assert.deepEqual([r.state, r.pickup_s, r.dropoff_s], ["COMPLETED", 88360, 89860]);
    assert.deepEqual(visitsOf(result, "SF-003").map((v) => [v.depot, v.arrival_s, v.ready_s, v.service_start_s, v.censored]),
      [["SF-1", 91660, 93040, null, false]]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 5. A gate wait
// ---------------------------------------------------------------------------------------------------------------
//
// Every lot is full: SF-1 holds 59 stalls for the whole run plus 1 until 89,000; SF-2, SJ-1 and EB-1 hold all 30.
// SF-004 (home depot SF-1) IDLE in SF. 88,200 recall: ACCESS IN SF-1 to 88,500. DEPOT_ARRIVED 88,500: SF-1 is full
// and no depot that can serve the visit has a free stall: GATE_WAIT, holding no stall.
// 89,000 FIXTURE_HOLD_ENDED (stall): the freed-stall rule (no blocked car, SF-004 first at the gate): STALL_CLAIMED,
//   INTAKE 89,000 to 89,180; a cleaning bay is free: CLEAN 89,180 to 90,380 (the car's stall frees at 89,180).
// 90,380 SERVICE_COMPLETED: 59 held of 60, a stall is free: READY_AT_DEPOT until 122,400.
// Visit: arrival 88,500, intake end 89,180, first task 89,180: bay wait 0 s (the gate wait is not bay wait);
// time to ready 90,380 - 88,500 = 1880 s (the gate wait counts toward it). Percentiles over one visit equal it.

describe("5. gate wait when every lot that can serve the visit is full", () => {
  const scenario = defaultScenario();
  const result = runFixture(scenario, {
    cars: [car("SF-004", "SF", "SF-1", { area: "SF" })],
    requests: [],
    depotOccupancy: {
      "EB-1": { stalls: holds(30, FAR), cleaning: [], service: [] },
      "SF-1": { stalls: [...holds(59, FAR), 89000], cleaning: [], service: [] },
      "SF-2": { stalls: holds(30, FAR), cleaning: [], service: [] },
      "SJ-1": { stalls: holds(30, FAR), cleaning: [], service: [] },
    },
  });

  test("timeline and events", () => {
    assert.deepEqual(spans(result, "SF-004"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["GATE_WAIT", 88500, 89000],
      ["INTAKE", 89000, 89180],
      ["IN_SERVICE:CLEAN", 89180, 90380],
      ["READY_AT_DEPOT", 90380, 122400],
    ]);
    expectInOrder(result.events, [
      { t: 88500, kind: "DEPOT_ARRIVED", car: "SF-004", depot: "SF-1" },
      { t: 89000, kind: "FIXTURE_HOLD_ENDED", depot: "SF-1" },
      { t: 89000, kind: "STALL_CLAIMED", car: "SF-004" },
      { t: 89180, kind: "INTAKE_COMPLETED", car: "SF-004" },
      { t: 89180, kind: "SERVICE_STARTED", car: "SF-004" },
      { t: 90380, kind: "SERVICE_COMPLETED", car: "SF-004" },
    ]);
    assert.equal(eventsOf(result, (e) => e.kind === "DEPOT_DIVERTED").length, 0);
  });

  test("visit record and depot metrics", () => {
    assert.deepEqual(visitsOf(result, "SF-004").map((v) => ({ ...v })), [{
      car: "SF-004", depot: "SF-1", arrival_s: 88500, intake_end_s: 89180, first_task_s: 89180,
      clean_start_s: 89180, clean_end_s: 90380, service_start_s: null, service_end_s: null, ready_s: 90380,
      censored: false,
    }]);
    const ref = (metric) => ({ metric, scope: { depot: "SF-1" } });
    assert.deepEqual(computeMetric(result, ref("depot.bay_wait_p90_s")), { value: 0 });
    assert.deepEqual(computeMetric(result, ref("depot.turnaround_p90_s")), { value: 1880 });
    assert.deepEqual(computeMetric(result, ref("depot.diversions")), { value: 0 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 6. The intake interval as INTAKE: asserted inside cases 1 (arm B, its own test), 2, 3, 4, 5 and 9.
// ---------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------
// 7. Drain: ready cars fill a lot, so a blocked visit and a gate visit cannot progress; both censored at T_d
// ---------------------------------------------------------------------------------------------------------------
//
// EB-1 parking set to 5 (DEP-2.EB-1), 2 cleaning bays. Other lots full for the whole run: SF-1 59 holds plus SF-001
// ready there (60), SF-2 30 holds, SJ-1 30 holds. Cars (home EB and home depot EB-1 unless stated):
//   EB-001 to EB-004 READY_AT_DEPOT at EB-1 (4 stalls held); EB-005 IDLE at PEN; EB-006 IDLE at SJ; EB-007 IDLE at EB;
//   SF-001 (home SF, SF-1) READY_AT_DEPOT at SF-1.
// Requests: r-EB-0 at 88,000 EB to SJ; r-SF-0 at 122,000 SF to SJ. Hours 24 to 35 carry 1000 in every row.
//
// 88,000 r-EB-0: planned arrival at the EB centre: EB-007 in-area 420; EB-001..EB-004 120 + 300 + 420 = 840;
//   SF-001 120 + 300 + H3 1200 = 1620; EB-005 H5 2400; EB-006 H6 3000. EB-007 assigned. Pickup to 88,420.
//   Trip EB>SJ: H6 3000 (L6 5700) to 91,420.
// 88,200 recall: IDLE EB-005, EB-006 (EB-007 is on a pickup).
//   EB-005: H5 PEN>EB (2400 against 4800) to 90,600, ACCESS IN to 90,900.
//   EB-006: H6 SJ>EB to 91,200, ACCESS IN to 91,500.
// EB-1 stalls held: 4.
//   90,900 EB-005 arrives, a stall is free: INTAKE (5). 91,080 intake done, bay 1 free: CLEAN (4).
//   91,420 EB-007 TRIP_COMPLETED: 1 trip, recall pending: TO_DEPOT RECALL EB-1: H6 SJ>EB to 94,420, ACCESS IN 94,720.
//   91,500 EB-006 arrives: INTAKE (5). 91,680 intake done, bay 2 free: CLEAN (4).
//   92,280 EB-005 clean done, a stall is free: READY_AT_DEPOT (5). No waiting rider.
//   92,880 EB-006 clean done, no stall free, no service due: IN_SERVICE blocked; it keeps bay 2.
//   94,720 EB-007 arrives: EB-1 full and every depot that can serve the visit is full: GATE_WAIT.
//   No stall at EB-1 frees again: no ready car there is dispatched (below) and no car enters a bay.
// 107,100 release: every ready car is at a depot in its home area: no move.
// 122,000 r-SF-0: SF-001 from SF-1: 120 + 300 + in-area 360 = 780; EB-1 cars 120 + 300 + H3 1200 = 1620. SF-001.
//   PULL_OUT 122,000 to 122,120; ACCESS OUT SF-1 to 122,420; IN_AREA SF to 122,780 (PICKUP_COMPLETED).
//   The stall SF-001 leaves at SF-1 has no blocked car or gate car at SF-1.
// 122,400 WINDOW_END: drain. 122,780 trip SF>SJ: H2 3300 (L2 6600) to 126,080 (TRIP_COMPLETED); recall no longer
//   pending, 1 trip: IDLE. r-SF-0 is the last request to become terminal: T_d = 126,080.
// At T_d: VISIT_CENSORED for EB-006 (blocked) and EB-007 (gate), in sorted-id order; no leg is open.
// Depot metrics at EB-1 over arrivals in [21,600, 122,400): visits EB-005 (completed, 92,280 - 90,900 = 1380 s),
// EB-006 and EB-007 (censored): censored_visits 2; turnaround_p90 absent; completed-only p90 1380;
// blocked_s clipped to the window: 122,400 - 92,880 = 29,520; parking peak 5 of 5.

describe("7. drain with a blocked visit and a gate visit censored at T_d", () => {
  const scenario = applyAxis(defaultScenario(), "parameter:DEP-2.EB-1", 5);
  const result = runFixture(scenario, {
    cars: [
      readyCar("EB-001", "EB", "EB-1", "EB-1"),
      readyCar("EB-002", "EB", "EB-1", "EB-1"),
      readyCar("EB-003", "EB", "EB-1", "EB-1"),
      readyCar("EB-004", "EB", "EB-1", "EB-1"),
      car("EB-005", "EB", "EB-1", { area: "PEN" }),
      car("EB-006", "EB", "EB-1", { area: "SJ" }),
      car("EB-007", "EB", "EB-1", { area: "EB" }),
      readyCar("SF-001", "SF", "SF-1", "SF-1"),
    ],
    requests: [
      { id: "r-EB-0", time_s: 88000, origin: "EB", dest: "SJ" },
      { id: "r-SF-0", time_s: 122000, origin: "SF", dest: "SJ" },
    ],
    depotOccupancy: {
      "SF-1": { stalls: holds(59, FAR), cleaning: [], service: [] },
      "SF-2": { stalls: holds(30, FAR), cleaning: [], service: [] },
      "SJ-1": { stalls: holds(30, FAR), cleaning: [], service: [] },
    },
  });

  test("T_d is the second the last request became terminal", () => {
    const r = requestOf(result, "r-SF-0");
    assert.deepEqual([r.state, r.pickup_s, r.dropoff_s], ["COMPLETED", 122780, 126080]);
    assert.equal(result.drain_end_s, 126080);
    assert.equal(result.drain_end_s, Math.max(...result.requests.map((q) => q.dropoff_s ?? q.time_s)));
  });

  test("intervals", () => {
    assert.deepEqual(spans(result, "EB-001"), [["READY_AT_DEPOT", 18000, 126080]]);
    assert.deepEqual(spans(result, "EB-005"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90900],
      ["INTAKE", 90900, 91080],
      ["IN_SERVICE:CLEAN", 91080, 92280],
      ["READY_AT_DEPOT", 92280, 126080],
    ]);
    assert.deepEqual(spans(result, "EB-006").slice(0, 4), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 91500],
      ["INTAKE", 91500, 91680],
      ["IN_SERVICE:CLEAN", 91680, 92880],
    ]);
    const blocked = result.intervals["EB-006"].filter((i) => i.t1 > i.t0).at(-1);
    assert.deepEqual([blocked.state, blocked.blocked, blocked.t0, blocked.t1], ["IN_SERVICE", true, 92880, 126080]);
    assert.deepEqual(spans(result, "EB-007"), [
      ["IDLE", 18000, 88000],
      ["ENROUTE_PICKUP", 88000, 88420],
      ["ON_TRIP", 88420, 91420],
      ["TO_DEPOT", 91420, 94720],
      ["GATE_WAIT", 94720, 126080],
    ]);
    assert.equal(intervalAt(result, "EB-007", "TO_DEPOT", 91420).purpose, "RECALL");
    assert.deepEqual(spans(result, "SF-001"), [
      ["READY_AT_DEPOT", 18000, 122000],
      ["ENROUTE_PICKUP", 122000, 122780],
      ["ON_TRIP", 122780, 126080],
    ]);
  });

  test("visit records and censoring events", () => {
    const pick = (v) => [v.depot, v.arrival_s, v.intake_end_s, v.first_task_s, v.clean_start_s, v.clean_end_s, v.ready_s, v.censored];
    assert.deepEqual(visitsOf(result, "EB-005").map(pick), [["EB-1", 90900, 91080, 91080, 91080, 92280, 92280, false]]);
    assert.deepEqual(visitsOf(result, "EB-006").map(pick), [["EB-1", 91500, 91680, 91680, 91680, 92880, null, true]]);
    assert.deepEqual(visitsOf(result, "EB-007").map(pick), [["EB-1", 94720, null, null, null, null, null, true]]);
    const censored = eventsOf(result, (e) => e.kind === "VISIT_CENSORED").map((e) => [e.t, e.car]);
    assert.deepEqual(censored, [[126080, "EB-006"], [126080, "EB-007"]]);
    assert.equal(eventsOf(result, (e) => e.kind === "LEG_CENSORED").length, 0);
    assert.equal(eventsOf(result, (e) => e.t > 126080).length, 0);
    expectInOrder(result.events, [
      { t: 92880, kind: "SERVICE_COMPLETED", car: "EB-006" },
      { t: 94720, kind: "DEPOT_ARRIVED", car: "EB-007", depot: "EB-1" },
      { t: 122400, kind: "WINDOW_END" },
      { t: 126080, kind: "TRIP_COMPLETED", car: "SF-001" },
      { t: 126080, kind: "VISIT_CENSORED", car: "EB-006" },
    ]);
  });

  test("depot metrics at EB-1", () => {
    const ref = (metric) => ({ metric, scope: { depot: "EB-1" } });
    assert.deepEqual(computeMetric(result, ref("depot.censored_visits")), { value: 2 });
    assert.ok("absent" in computeMetric(result, ref("depot.turnaround_p90_s")));
    assert.deepEqual(computeMetric(result, ref("depot.turnaround_completed_p90_s")), { value: 1380 });
    assert.deepEqual(computeMetric(result, ref("depot.blocked_s")), { value: 29520 });
    assert.deepEqual(computeMetric(result, ref("depot.parking_peak_fraction")), { value: 1 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 8. Empty-drive seconds and exposure attribution
// ---------------------------------------------------------------------------------------------------------------
//
// Default scenario. SF-001 (home SF-1) READY_AT_DEPOT at SF-1. Rider r-PEN-0 at 61,200 (D1 17:00), PEN to PEN.
// 61,200 assigned (the only car). Pickup leg {depot SF-1} -> {area PEN} (routes.test.mjs planPath):
//   PULL_OUT 61,200 to 61,320 (no multiplier, empty, never congested).
//   ACCESS OUT SF-1 61,320 to 61,710: 300 x 1.3 = 390 (IN_AREA hour 17 is 1300 >= 1300: congested, area SF).
//   ROUTE H1 SF>PEN 61,710 to 64,110: 1500 x 1.6 = 2400 (away from SF, hour 17: congested, area SF, HIGHWAY).
// 64,110 PICKUP_COMPLETED; trip IN_AREA PEN, hour 17, S = 690, covered 530,769,230 >= 480,000,000:
//   480 x 1.3 = 624, loaded, congested, area PEN. TRIP_COMPLETED 64,734. IDLE at PEN.
// 88,200 recall: H1 PEN>SF 88,200 to 89,700 (1000, area PEN, not congested); ACCESS IN SF-1 89,700 to 90,000 (1000,
//   area SF). INTAKE 90,000 to 90,180; CLEAN 90,180 to 91,380; READY 91,380 until 122,400.
// Driving seconds over [21,600, 122,400): empty 120 + 390 + 2400 + 1500 + 300 = 4710; loaded 624.
//   vehicle.empty_drive_fraction = 4710 / 5334.
// exposure.congested_empty_s: 390 + 2400 = 2790, all in area SF; PEN 0. congested_loaded_s: 624 in PEN; SF 0.
// Window [61,200, 62,000): congested empty = access 390 + route 61,710 to 62,000 = 290: 680.
// Window [61,200, 64,800): empty 2910, loaded 624: fraction 2910 / 3534.

describe("8. empty-drive seconds and exposure attribution", () => {
  const scenario = defaultScenario();
  const result = runFixture(scenario, {
    cars: [readyCar("SF-001", "SF", "SF-1", "SF-1")],
    requests: [{ id: "r-PEN-0", time_s: 61200, origin: "PEN", dest: "PEN" }],
    depotOccupancy: {},
  });

  test("legs and segments", () => {
    assert.deepEqual(spans(result, "SF-001"), [
      ["READY_AT_DEPOT", 18000, 61200],
      ["ENROUTE_PICKUP", 61200, 64110],
      ["ON_TRIP", 64110, 64734],
      ["IDLE", 64734, 88200],
      ["TO_DEPOT", 88200, 90000],
      ["INTAKE", 90000, 90180],
      ["IN_SERVICE:CLEAN", 90180, 91380],
      ["READY_AT_DEPOT", 91380, 122400],
    ]);
    const pickup = intervalAt(result, "SF-001", "ENROUTE_PICKUP", 61200);
    assert.deepEqual(pickup.segments.map((s) => [s.kind, s.t0, s.t1, s.loaded]), [
      ["PULL_OUT", 61200, 61320, false],
      ["ACCESS", 61320, 61710, false],
      ["ROUTE", 61710, 64110, false],
    ]);
    assert.deepEqual([pickup.segments[1].key, pickup.segments[1].dir], ["ACC-SF-1", "OUT"]);
    assert.deepEqual([pickup.segments[2].key, pickup.segments[2].dir, pickup.segments[2].cls], ["H1", "SF>PEN", "HIGHWAY"]);
    const trip = intervalAt(result, "SF-001", "ON_TRIP", 64110);
    assert.deepEqual(trip.segments.map(segText), [["IN_AREA", "IN-PEN", "-", 64110, 64734, true]]);
    const r = requestOf(result, "r-PEN-0");
    assert.deepEqual([r.state, r.pickup_s, r.dropoff_s], ["COMPLETED", 64110, 64734]);
  });

  test("exposure by area and window", () => {
    assert.equal(congestedSeconds(result, scenario, { loaded: false }), 2790);
    assert.equal(congestedSeconds(result, scenario, { loaded: false, area: "SF" }), 2790);
    assert.equal(congestedSeconds(result, scenario, { loaded: true, area: "PEN" }), 624);
    const m = (metric, scope) => computeMetric(result, { metric, scope });
    assert.deepEqual(m("exposure.congested_empty_s", {}), { value: 2790 });
    assert.deepEqual(m("exposure.congested_empty_s", { area: "SF" }), { value: 2790 });
    assert.deepEqual(m("exposure.congested_empty_s", { area: "PEN" }), { value: 0 });
    assert.deepEqual(m("exposure.congested_loaded_s", { area: "PEN" }), { value: 624 });
    assert.deepEqual(m("exposure.congested_loaded_s", { area: "SF" }), { value: 0 });
    assert.deepEqual(m("exposure.congested_empty_s", { window: { start_s: 61200, end_s: 62000 } }), { value: 680 });
  });

  test("empty-drive fraction", () => {
    const m = (scope) => computeMetric(result, { metric: "vehicle.empty_drive_fraction", scope });
    assert.deepEqual(m({}), { value: 4710 / 5334 });
    assert.deepEqual(m({ window: { start_s: 61200, end_s: 64800 } }), { value: 2910 / 3534 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 9. A diversion when the target lot is full; a depot with no service bay never receives a service visit
// ---------------------------------------------------------------------------------------------------------------
//
// 9a. SF-1 holds all 60 stalls. SF-005 (home SF-1) IDLE in SF. 88,200 recall: ACCESS IN SF-1 to 88,500.
//   DEPOT_ARRIVED 88,500: full; depots that can serve a clean-only visit with a free stall: SF-2, SJ-1, EB-1.
//   Planned arrival from SF-1 at 88,500: SF-2 by ACCESS OUT + ACCESS IN = 600 (89,100); SJ-1 and EB-1 need a route
//   of at least H3 1200, so SF-2. DEPOT_DIVERTED (counted at SF-1); new TO_DEPOT leg: ACCESS OUT SF-1 88,500 to
//   88,800, ACCESS IN SF-2 88,800 to 89,100. DEPOT_ARRIVED SF-2 89,100: INTAKE to 89,280; CLEAN 89,280 to 90,480;
//   READY 90,480.
// 9b. SF-2 service bays set to 0 (DEP-5.SF-2). SF-002 (home SF-2, visits 2: visit 3 includes service) and SF-003
//   (home SF-2, visits 0: clean only) IDLE in SF.
//   SF-002: home_depot cannot serve a service visit: falls back to nearest_depot among depots with a service bay:
//     SF-1 (300) before EB-1 and SJ-1. ACCESS IN SF-1 88,200 to 88,500; INTAKE to 88,680; CLEAN 88,680 to 89,880;
//     a service bay is free (2 at SF-1): SERVICE 89,880 to 92,580; READY 92,580.
//   SF-003: SF-2 serves a clean: ACCESS IN SF-2 88,200 to 88,500; INTAKE to 88,680; CLEAN to 89,880; READY 89,880.
// 9c. As 9b for SF-002 alone, with SF-1's 60 stalls held: at 88,500 SF-1 is full; SF-2 has free stalls but no service
//   bay, so the diversion goes to the nearest of SJ-1 and EB-1: EB-1 (H3 SF>EB 1200) before SJ-1 (H2 3300) under any
//   pull-out rule. At EB-1 (free stalls, 2 cleaning bays, 1 free service bay): intake 180, clean 1200 at once,
//   service 2700 at once.

describe("9. diversion and depots without a service bay", () => {
  test("9a: diversion to the nearest depot with a free stall", () => {
    const result = runFixture(defaultScenario(), {
      cars: [car("SF-005", "SF", "SF-1", { area: "SF" })],
      requests: [],
      depotOccupancy: { "SF-1": { stalls: holds(60, FAR), cleaning: [], service: [] } },
    });
    assert.deepEqual(spans(result, "SF-005"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["TO_DEPOT", 88500, 89100],
      ["INTAKE", 89100, 89280],
      ["IN_SERVICE:CLEAN", 89280, 90480],
      ["READY_AT_DEPOT", 90480, 122400],
    ]);
    assert.equal(intervalAt(result, "SF-005", "TO_DEPOT", 88200).depot, "SF-1");
    // SF-2 is also the nearest depot with a free stall when service bays are ignored, so no service-bay suffix.
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_DIVERTED").map((e) => e.detail), [{ to: "SF-2", cause: "nearest_free_stall" }]);
    const diverted = intervalAt(result, "SF-005", "TO_DEPOT", 88500);
    assert.deepEqual([diverted.depot, diverted.purpose], ["SF-2", "RECALL"]);
    assert.deepEqual(diverted.segments.map(segText), [
      ["ACCESS", "ACC-SF-1", "OUT", 88500, 88800, false],
      ["ACCESS", "ACC-SF-2", "IN", 88800, 89100, false],
    ]);
    expectInOrder(result.events, [
      { t: 88500, kind: "DEPOT_ARRIVED", car: "SF-005", depot: "SF-1" },
      { t: 88500, kind: "DEPOT_DIVERTED", car: "SF-005", depot: "SF-1" },
      { t: 89100, kind: "DEPOT_ARRIVED", car: "SF-005", depot: "SF-2" },
    ]);
    assert.deepEqual(visitsOf(result, "SF-005").map((v) => ({ ...v })), [{
      car: "SF-005", depot: "SF-2", arrival_s: 89100, intake_end_s: 89280, first_task_s: 89280,
      clean_start_s: 89280, clean_end_s: 90480, service_start_s: null, service_end_s: null, ready_s: 90480,
      censored: false,
    }]);
    const d = (depot) => computeMetric(result, { metric: "depot.diversions", scope: depot ? { depot } : {} });
    assert.deepEqual([d("SF-1"), d("SF-2"), d(null)], [{ value: 1 }, { value: 0 }, { value: 1 }]);
  });

  const noServiceAtSf2 = () => applyAxis(defaultScenario(), "parameter:DEP-5.SF-2", 0);

  test("9b: home_depot without a service bay falls back; the same depot still takes clean-only visits", () => {
    const result = runFixture(noServiceAtSf2(), {
      cars: [car("SF-002", "SF", "SF-2", { area: "SF" }, { visits: 2 }), car("SF-003", "SF", "SF-2", { area: "SF" })],
      requests: [],
      depotOccupancy: {},
    });
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["IN_SERVICE:SERVICE", 89880, 92580],
      ["READY_AT_DEPOT", 92580, 122400],
    ]);
    assert.equal(intervalAt(result, "SF-002", "TO_DEPOT", 88200).depot, "SF-1");
    const pick = (v) => [v.depot, v.arrival_s, v.clean_start_s, v.clean_end_s, v.service_start_s, v.service_end_s, v.ready_s];
    assert.deepEqual(visitsOf(result, "SF-002").map(pick), [["SF-1", 88500, 88680, 89880, 89880, 92580, 92580]]);
    assert.deepEqual(visitsOf(result, "SF-003").map(pick), [["SF-2", 88500, 88680, 89880, null, null, 89880]]);
    for (const v of result.visits.filter((x) => x.depot === "SF-2")) assert.equal(v.service_start_s, null);
  });

  test("9c: a diversion skips a depot with free stalls but no service bay", () => {
    const result = runFixture(noServiceAtSf2(), {
      cars: [car("SF-002", "SF", "SF-2", { area: "SF" }, { visits: 2 })],
      requests: [],
      depotOccupancy: { "SF-1": { stalls: holds(60, FAR), cleaning: [], service: [] } },
    });
    expectInOrder(result.events, [
      { t: 88500, kind: "DEPOT_ARRIVED", car: "SF-002", depot: "SF-1" },
      { t: 88500, kind: "DEPOT_DIVERTED", car: "SF-002", depot: "SF-1" },
    ]);
    assert.equal(intervalAt(result, "SF-002", "TO_DEPOT", 88500).depot, "EB-1");
    // Both decisions say why (design 5.3): home SF-2 has no service bay, and the diversion skipped SF-2's free stalls.
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_ASSIGNED").map((e) => [e.depot, e.detail.cause]),
      [["SF-1", "home_depot_without_service_bay_nearest_depot"]]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_DIVERTED").map((e) => [e.depot, e.detail]),
      [["SF-1", { to: "EB-1", cause: "nearest_free_stall_service_bays_only" }]]);
    assert.equal(eventsOf(result, (e) => e.kind === "DEPOT_ARRIVED" && e.depot === "SF-2").length, 0);
    const [v] = visitsOf(result, "SF-002");
    assert.equal(v.depot, "EB-1");
    assert.equal(v.intake_end_s, v.arrival_s + 180);
    assert.deepEqual([v.first_task_s, v.clean_start_s], [v.intake_end_s, v.intake_end_s]);
    assert.equal(v.clean_end_s, v.clean_start_s + 1200);
    assert.deepEqual([v.service_start_s, v.service_end_s, v.ready_s], [v.clean_end_s, v.clean_end_s + 2700, v.clean_end_s + 2700]);
    assert.equal(v.censored, false);
  });

  // 9d. SF-1 service bays set to 0 (DEP-5.SF-1), nearest_depot. SF-002 (visits 2: service) and SF-003 (visits 0) IDLE
  //   in SF. 88,200 recall: planned arrivals from SF: SF-1 and SF-2 88,500 (access 300), EB-1 89,700, SJ-1 91,800.
  //   SF-002: among depots with a service bay, SF-2; over every depot SF-1 ties SF-2 and wins on id, so the filter
  //     changed the answer: cause nearest_depot_service_bays_only. INTAKE 88,500 to 88,680; CLEAN to 89,880; SF-2's
  //     service bay is free: SERVICE 89,880 to 92,580; READY 92,580.
  //   SF-003: clean only, every depot counts: SF-1, cause nearest_depot. CLEAN 88,680 to 89,880; READY 89,880.
  test("9d: nearest_depot logs when skipping a depot without a service bay changed the depot", () => {
    const scenario = applyAxis(applyAxis(defaultScenario(), "parameter:DEP-5.SF-1", 0), "policy:depot_assignment", "nearest_depot");
    const result = runFixture(scenario, {
      cars: [car("SF-002", "SF", "SF-2", { area: "SF" }, { visits: 2 }), car("SF-003", "SF", "SF-2", { area: "SF" })],
      requests: [],
      depotOccupancy: {},
    });
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_ASSIGNED").map((e) => [e.t, e.car, e.depot, e.detail.cause]), [
      [88200, "SF-002", "SF-2", "nearest_depot_service_bays_only"],
      [88200, "SF-003", "SF-1", "nearest_depot"],
    ]);
    assert.equal(intervalAt(result, "SF-002", "TO_DEPOT", 88200).cause, "nearest_depot_service_bays_only");
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["IN_SERVICE:SERVICE", 89880, 92580],
      ["READY_AT_DEPOT", 92580, 122400],
    ]);
    assert.deepEqual(spans(result, "SF-003").slice(-2), [["IN_SERVICE:CLEAN", 88680, 89880], ["READY_AT_DEPOT", 89880, 122400]]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 10. Same-second ordering: a car freed at second t serves a rider whose deadline is t (design 5.4 item 3)
// ---------------------------------------------------------------------------------------------------------------
//
// Default scenario, hour 10 (every multiplier 1000), patience 600. SF-001 IDLE in SF.
// 36,000 r-SF-0 (SF to SF): assigned; pickup 360 to 36,360; trip 360 to 36,720.
// 36,120 r-SF-1 created, no free car: waiting; deadline 36,720.
// 36,200 r-SF-2 created: waiting; deadline 36,800.
// 36,720: TRIP_COMPLETED (class 0) pops before WAIT_DEADLINE r-SF-1 (class 2). SF-001 becomes IDLE; dispatch serves
//   the oldest waiting rider first: r-SF-1 (36,120) before r-SF-2 (36,200): REQUEST_ASSIGNED r-SF-1 at 36,720.
//   The deadline then finds r-SF-1 assigned: no REQUEST_UNSERVED.
//   Pickup 36,720 to 37,080 (wait 960); trip to 37,440.
// 36,800 WAIT_DEADLINE r-SF-2: still waiting: REQUEST_UNSERVED.
// Waits of completed rides [360, 960]: p90 position 0.9: 360 + 600 x 0.9 = 900 (600 x 0.9 rounds to 540 exactly in
// doubles). unserved.fraction 1 / 3.

describe("10. same-second ordering: completion before deadline", () => {
  const result = runFixture(defaultScenario(), {
    cars: [car("SF-001", "SF", "SF-1", { area: "SF" })],
    requests: [
      { id: "r-SF-0", time_s: 36000, origin: "SF", dest: "SF" },
      { id: "r-SF-1", time_s: 36120, origin: "SF", dest: "SF" },
      { id: "r-SF-2", time_s: 36200, origin: "SF", dest: "SF" },
    ],
    depotOccupancy: {},
  });

  test("the freed car takes the rider whose deadline is that second", () => {
    expectInOrder(result.events, [
      { t: 36000, kind: "REQUEST_ASSIGNED", car: "SF-001", req: "r-SF-0" },
      { t: 36720, kind: "TRIP_COMPLETED", car: "SF-001" },
      { t: 36720, kind: "REQUEST_ASSIGNED", car: "SF-001", req: "r-SF-1" },
      { t: 36800, kind: "REQUEST_UNSERVED", req: "r-SF-2" },
    ]);
    const assigned = result.events.find((e) => e.kind === "REQUEST_ASSIGNED" && e.req === "r-SF-1");
    const deadline = result.events.find((e) => e.kind === "WAIT_DEADLINE" && e.req === "r-SF-1");
    if (deadline) assert.ok(deadline.ord > assigned.ord, "the deadline pops after the completion's dispatch");
    assert.equal(eventsOf(result, (e) => e.kind === "REQUEST_UNSERVED" && e.req === "r-SF-1").length, 0);
    for (let i = 1; i < result.events.length; i += 1) {
      assert.ok(result.events[i].ord > result.events[i - 1].ord);
      assert.ok(result.events[i].t >= result.events[i - 1].t);
    }
  });

  test("request records, intervals and metrics", () => {
    const rec = (id) => {
      const r = requestOf(result, id);
      return [r.state, r.pickup_s ?? null, r.dropoff_s ?? null];
    };
    assert.deepEqual(rec("r-SF-0"), ["COMPLETED", 36360, 36720]);
    assert.deepEqual(rec("r-SF-1"), ["COMPLETED", 37080, 37440]);
    assert.deepEqual(rec("r-SF-2"), ["UNSERVED", null, null]);
    assert.deepEqual(spans(result, "SF-001").slice(0, 6), [
      ["IDLE", 18000, 36000],
      ["ENROUTE_PICKUP", 36000, 36360],
      ["ON_TRIP", 36360, 36720],
      ["ENROUTE_PICKUP", 36720, 37080],
      ["ON_TRIP", 37080, 37440],
      ["IDLE", 37440, 88200],
    ]);
    assert.equal(result.drain_end_s, WINDOW_END);
    assert.deepEqual(computeMetric(result, { metric: "wait.p90_s", scope: {} }), { value: 900 });
    assert.deepEqual(computeMetric(result, { metric: "unserved.fraction", scope: {} }), { value: 1 / 3 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 11. Hand-off: a full lot of queued cars and a blocked car in the only bay of their task never lock the depot
// ---------------------------------------------------------------------------------------------------------------
//
// Without the hand-off (engine.js settleDepot), every stall held by a car queued for a task whose bays all hold blocked
// cars can never free: no car leaves a stall and no bay frees. Both arms below are default hours 24 to 29 (every
// multiplier 1000). EB-1 parking 5 (DEP-2.EB-1) with 4 stall holds, 3 for the whole run and 1 until 100,000.
// Recall 88,200: from PEN H5 2400 + access 300 = 90,900; from SJ H6 3000 + access 300 = 91,500.
//
// 11a. Cleaning bays 1 (DEP-3.EB-1). EB-001 (PEN) and EB-002 (SJ), clean-only visits (visits 0).
//   90,900 EB-001 arrives: 4 + 1 = 5 stalls. INTAKE to 91,080; the bay is free: CLEAN 91,080 to 92,280 (4 held).
//   91,500 EB-002 arrives (5 held). INTAKE to 91,680; the bay is busy: QUEUED_SERVICE, holding its stall.
//   92,280 EB-001's clean is done; 5 of 5 stalls held: IN_SERVICE blocked. The lot is full, the only cleaning bay holds
//     a blocked car and EB-002 is queued for cleaning: hand-off at 92,280. STALL_CLAIMED EB-001 (READY_AT_DEPOT, no
//     service due), then SERVICE_STARTED EB-002: CLEAN 92,280 to 93,480. Stalls held stay 5.
//   93,480 EB-002 done; 5 held (EB-001 ready): blocked. Nothing is queued, so no hand-off.
//   100,000 a stall hold ends: the freed-stall rule gives it to blocked EB-002: READY_AT_DEPOT until 122,400.
//   depot.blocked_s at EB-1: 100,000 - 93,480 = 6520 (EB-001's blocked interval has zero length).
// 11b. Default bays (2 cleaning, 1 service); both cars visits 2 (visit 3 includes service).
//   EB-001: INTAKE 90,900 to 91,080; CLEAN 91,080 to 92,280; the service bay is free: SERVICE 92,280 to 94,980.
//   EB-002: INTAKE 91,500 to 91,680; cleaning bay 2 is free: CLEAN 91,680 to 92,880 (4 held). 92,880: service due, the
//     service bay is busy, a stall is free: QUEUED_SERVICE (5 held).
//   94,980 EB-001's service is done; 5 held: blocked in the only service bay, with EB-002 queued for service: hand-off.
//     STALL_CLAIMED EB-001 (READY_AT_DEPOT), then SERVICE_STARTED EB-002: SERVICE 94,980 to 97,680.
//   97,680 EB-002 done, 5 held: blocked. 100,000 the hold ends: STALL_CLAIMED EB-002, READY_AT_DEPOT.
//   depot.blocked_s at EB-1: 100,000 - 97,680 = 2320.

describe("11. hand-off between a queued car and a blocked car", () => {
  const holdsAtEb1 = { "EB-1": { stalls: [FAR, FAR, FAR, 100000], cleaning: [], service: [] } };
  const blockedS = (result) => computeMetric(result, { metric: "depot.blocked_s", scope: { depot: "EB-1" } });

  test("11a: cleaning bay", () => {
    const scenario = applyAxis(applyAxis(defaultScenario(), "parameter:DEP-2.EB-1", 5), "parameter:DEP-3.EB-1", 1);
    const result = runFixture(scenario, {
      cars: [car("EB-001", "EB", "EB-1", { area: "PEN" }), car("EB-002", "EB", "EB-1", { area: "SJ" })],
      requests: [],
      depotOccupancy: holdsAtEb1,
    });
    assert.deepEqual(spans(result, "EB-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90900],
      ["INTAKE", 90900, 91080],
      ["IN_SERVICE:CLEAN", 91080, 92280],
      ["READY_AT_DEPOT", 92280, 122400],
    ]);
    // The blocked state lasts zero seconds but is logged, so the change reads CLEAN, blocked, READY_AT_DEPOT.
    assert.deepEqual(result.intervals["EB-001"].slice(-2).map((i) => [i.state, i.blocked === true, i.t0]), [["IN_SERVICE", true, 92280], ["READY_AT_DEPOT", false, 92280]]);
    assert.deepEqual(spans(result, "EB-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 91500],
      ["INTAKE", 91500, 91680],
      ["QUEUED_SERVICE", 91680, 92280],
      ["IN_SERVICE:CLEAN", 92280, 93480],
      ["IN_SERVICE:CLEAN:blocked", 93480, 100000],
      ["READY_AT_DEPOT", 100000, 122400],
    ]);
    expectInOrder(result.events, [
      { t: 92280, kind: "SERVICE_COMPLETED", car: "EB-001" },
      { t: 92280, kind: "STALL_CLAIMED", car: "EB-001" },
      { t: 92280, kind: "SERVICE_STARTED", car: "EB-002" },
      { t: 93480, kind: "SERVICE_COMPLETED", car: "EB-002" },
      { t: 100000, kind: "FIXTURE_HOLD_ENDED", depot: "EB-1" },
      { t: 100000, kind: "STALL_CLAIMED", car: "EB-002" },
    ]);
    const pick = (v) => [v.arrival_s, v.intake_end_s, v.first_task_s, v.clean_start_s, v.clean_end_s, v.ready_s, v.censored];
    assert.deepEqual(visitsOf(result, "EB-001").map(pick), [[90900, 91080, 91080, 91080, 92280, 92280, false]]);
    assert.deepEqual(visitsOf(result, "EB-002").map(pick), [[91500, 91680, 92280, 92280, 93480, 100000, false]]);
    assert.deepEqual(blockedS(result), { value: 6520 });
    // Stalls held stay 5 through the hand-off: the series row at 92,280 reads 5 held, 0 queued, 1 cleaning, 1 ready.
    const row = result.depots.find((d) => d.id === "EB-1").series.find((x) => x[0] === 92280);
    assert.deepEqual(row, [92280, 5, 0, 0, 1, 0, 0, 1]);
  });

  test("11b: service bay", () => {
    const scenario = applyAxis(defaultScenario(), "parameter:DEP-2.EB-1", 5);
    const result = runFixture(scenario, {
      cars: [car("EB-001", "EB", "EB-1", { area: "PEN" }, { visits: 2 }), car("EB-002", "EB", "EB-1", { area: "SJ" }, { visits: 2 })],
      requests: [],
      depotOccupancy: holdsAtEb1,
    });
    assert.deepEqual(spans(result, "EB-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90900],
      ["INTAKE", 90900, 91080],
      ["IN_SERVICE:CLEAN", 91080, 92280],
      ["IN_SERVICE:SERVICE", 92280, 94980],
      ["READY_AT_DEPOT", 94980, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 91500],
      ["INTAKE", 91500, 91680],
      ["IN_SERVICE:CLEAN", 91680, 92880],
      ["QUEUED_SERVICE", 92880, 94980],
      ["IN_SERVICE:SERVICE", 94980, 97680],
      ["IN_SERVICE:SERVICE:blocked", 97680, 100000],
      ["READY_AT_DEPOT", 100000, 122400],
    ]);
    expectInOrder(result.events, [
      { t: 94980, kind: "SERVICE_COMPLETED", car: "EB-001" },
      { t: 94980, kind: "STALL_CLAIMED", car: "EB-001" },
      { t: 94980, kind: "SERVICE_STARTED", car: "EB-002" },
      { t: 100000, kind: "STALL_CLAIMED", car: "EB-002" },
    ]);
    const [v] = visitsOf(result, "EB-002");
    assert.deepEqual([v.clean_end_s, v.service_start_s, v.service_end_s, v.ready_s], [92880, 94980, 97680, 100000]);
    assert.deepEqual(blockedS(result), { value: 2320 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 12. Leaving the blocked state: to a service bay, to a stall into QUEUED_SERVICE, and to READY_AT_DEPOT
// ---------------------------------------------------------------------------------------------------------------
//
// EB-1 parking 5 with 4 stall holds (3 for the whole run, 1 until 96,000); default bays (2 cleaning, 1 service), and
// the service bay held until S. EB-001 IDLE at PEN, visits 2 (visit 3: clean then service). EB-002 READY_AT_DEPOT at
// SF-1 (visits 0), which fills the fifth stall at EB-1 while EB-001's clean ends.
//   88,200 recall: EB-001 H5 PEN>EB 2400 + access 300: DEPOT_ARRIVED 90,900 (5 held), INTAKE to 91,080, CLEAN 91,080 to
//     92,280 (4 held). EB-002 is ready at a depot and keeps its course.
//   89,900 r-SF-0 (SF to EB): EB-002 is the only dispatchable car. Pickup PULL_OUT 89,900 to 90,020, ACCESS OUT SF-1 to
//     90,320, IN_AREA SF 360 to 90,680. Trip H3 SF>EB 1200 (L3 2700) to 91,880; 1 trip, recall pending: TO_DEPOT
//     (home_depot EB-1), ACCESS IN to 92,180. DEPOT_ARRIVED 92,180: 5 held; INTAKE to 92,360.
//   92,280 EB-001's clean is done: service due, the service bay is held, no stall free: IN_SERVICE CLEAN blocked. Only
//     one of 2 cleaning bays is busy, so no hand-off.
// 12a (S = 92,300). 92,300 the service hold ends: the freed-bay rule takes first the car blocked in a cleaning bay whose
//     service is due: SERVICE_STARTED EB-001, SERVICE 92,300 to 95,000 (blocked CLEAN -> SERVICE).
//   92,360 EB-002's intake is done: a cleaning bay is free: CLEAN 92,360 to 93,560 (4 held). 93,560: READY (5 held).
//   95,000 EB-001's service is done, no stall free: IN_SERVICE SERVICE blocked.
//   96,000 the stall hold ends: STALL_CLAIMED EB-001, READY_AT_DEPOT (blocked SERVICE -> READY_AT_DEPOT).
//   Visit: clean 91,080 to 92,280, service 92,300 to 95,000, ready 96,000. depot.blocked_s: 20 + 1000 = 1020.
// 12b (S = 100,000). 92,360 EB-002's intake is done: CLEAN 92,360 to 93,560, freeing its stall (4 held). The freed stall
//     goes to blocked EB-001 (no gate car): STALL_CLAIMED, QUEUED_SERVICE (blocked CLEAN -> QUEUED_SERVICE), 5 held.
//   93,560 EB-002 done, no stall free, no service due: IN_SERVICE CLEAN blocked.
//   96,000 the stall hold ends: STALL_CLAIMED EB-002, READY_AT_DEPOT (blocked CLEAN -> READY_AT_DEPOT).
//   100,000 the service hold ends: queued EB-001 starts SERVICE 100,000 to 102,700 (4 held); READY 102,700 (5 held).
//   depot.blocked_s: EB-001 92,280 to 92,360 (80) + EB-002 93,560 to 96,000 (2440) = 2520.

describe("12. leaving the blocked state", () => {
  const scenario = applyAxis(defaultScenario(), "parameter:DEP-2.EB-1", 5);
  const fixture = (serviceUntil) => ({
    cars: [car("EB-001", "EB", "EB-1", { area: "PEN" }, { visits: 2 }), readyCar("EB-002", "EB", "EB-1", "SF-1")],
    requests: [{ id: "r-SF-0", time_s: 89900, origin: "SF", dest: "EB" }],
    depotOccupancy: { "EB-1": { stalls: [FAR, FAR, FAR, 96000], cleaning: [], service: [serviceUntil] } },
  });
  const shared = [
    ["IDLE", 18000, 88200],
    ["TO_DEPOT", 88200, 90900],
    ["INTAKE", 90900, 91080],
    ["IN_SERVICE:CLEAN", 91080, 92280],
  ];
  const secondCar = [
    ["READY_AT_DEPOT", 18000, 89900],
    ["ENROUTE_PICKUP", 89900, 90680],
    ["ON_TRIP", 90680, 91880],
    ["TO_DEPOT", 91880, 92180],
    ["INTAKE", 92180, 92360],
    ["IN_SERVICE:CLEAN", 92360, 93560],
  ];
  const blockedS = (result) => computeMetric(result, { metric: "depot.blocked_s", scope: { depot: "EB-1" } });

  test("12a: a service bay frees for a car blocked in a cleaning bay, then a stall frees for it blocked in service", () => {
    const result = runFixture(scenario, fixture(92300));
    assert.deepEqual(spans(result, "EB-001"), [
      ...shared,
      ["IN_SERVICE:CLEAN:blocked", 92280, 92300],
      ["IN_SERVICE:SERVICE", 92300, 95000],
      ["IN_SERVICE:SERVICE:blocked", 95000, 96000],
      ["READY_AT_DEPOT", 96000, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-002"), [...secondCar, ["READY_AT_DEPOT", 93560, 122400]]);
    expectInOrder(result.events, [
      { t: 92180, kind: "DEPOT_ARRIVED", car: "EB-002", depot: "EB-1" },
      { t: 92280, kind: "SERVICE_COMPLETED", car: "EB-001" },
      { t: 92300, kind: "FIXTURE_HOLD_ENDED", depot: "EB-1" },
      { t: 92300, kind: "SERVICE_STARTED", car: "EB-001" },
      { t: 95000, kind: "SERVICE_COMPLETED", car: "EB-001" },
      { t: 96000, kind: "STALL_CLAIMED", car: "EB-001" },
    ]);
    const pick = (v) => [v.arrival_s, v.clean_start_s, v.clean_end_s, v.service_start_s, v.service_end_s, v.ready_s];
    assert.deepEqual(visitsOf(result, "EB-001").map(pick), [[90900, 91080, 92280, 92300, 95000, 96000]]);
    assert.deepEqual(blockedS(result), { value: 1020 });
  });

  test("12b: a freed stall takes a car blocked in a cleaning bay into QUEUED_SERVICE, and another to READY_AT_DEPOT", () => {
    const result = runFixture(scenario, fixture(100000));
    assert.deepEqual(spans(result, "EB-001"), [
      ...shared,
      ["IN_SERVICE:CLEAN:blocked", 92280, 92360],
      ["QUEUED_SERVICE", 92360, 100000],
      ["IN_SERVICE:SERVICE", 100000, 102700],
      ["READY_AT_DEPOT", 102700, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-002"), [...secondCar, ["IN_SERVICE:CLEAN:blocked", 93560, 96000], ["READY_AT_DEPOT", 96000, 122400]]);
    expectInOrder(result.events, [
      { t: 92360, kind: "INTAKE_COMPLETED", car: "EB-002" },
      { t: 92360, kind: "SERVICE_STARTED", car: "EB-002" },
      { t: 92360, kind: "STALL_CLAIMED", car: "EB-001" },
      { t: 96000, kind: "STALL_CLAIMED", car: "EB-002" },
      { t: 100000, kind: "SERVICE_STARTED", car: "EB-001" },
    ]);
    assert.deepEqual(blockedS(result), { value: 2520 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 13. A freed stall goes to blocked cars before a gate car, and among blocked cars finished at one second by vehicle id
// ---------------------------------------------------------------------------------------------------------------
//
// EB-1 parking 5 (DEP-2.EB-1), cleaning bays 4 (DEP-3.EB-1): stall holds until 95,000, 96,000 and 97,000; cleaning holds
// two until 90,600 and two until 91,700. SF-1, SF-2 and SJ-1 full for the whole run. Clean-only visits (visits 0).
// Cars: EB-001 IDLE at SJ, EB-002 at PEN, EB-003 and EB-004 at EB, EB-005 at SF. Rider r-SF-0 at 87,500, SF to PEN.
//   87,500 r-SF-0: EB-005 is nearest (in-area 360; EB 1200, PEN 1500, SJ 3300 by route). Pickup to 87,860; trip H1
//     SF>PEN 1500 to 89,360; recall pending: TO_DEPOT EB-1 by H5 PEN>EB 2400 + access 300: DEPOT_ARRIVED 92,060.
//   88,200 recall: EB-001 H6 3000 + 300: 91,500. EB-002 H5 2400 + 300: 90,900. EB-003, EB-004 access 300: 88,500.
//   88,500 EB-003, EB-004 claim stalls (3 + 2 = 5); INTAKE to 88,680; every cleaning bay held: QUEUED_SERVICE.
//   90,600 two cleaning holds end: EB-003 then EB-004 start CLEAN 90,600 to 91,800 (3 held).
//   90,900 EB-002 arrives (4 held): INTAKE to 91,080; queued (bays: 2 held, 2 busy). 91,500 EB-001 arrives (5 held):
//     INTAKE to 91,680; queued behind EB-002 (FIFO by intake end 91,080 < 91,680).
//   91,700 the other two cleaning holds end: the first takes EB-002, the second EB-001: CLEAN 91,700 to 92,900, in that
//     order, so EB-002's completion is pushed, and pops, first (3 held).
//   91,800 EB-003 and EB-004 are ready (5 held). 92,060 EB-005 arrives: EB-1 full and every other lot full: GATE_WAIT.
//   92,900 EB-002 then EB-001 finish, no stall free: both blocked, finished at 92,900. Nothing queued: no hand-off.
//   95,000 a stall frees: blocked cars first, earliest finished then vehicle id: EB-001 (not the gate car EB-005, which
//     arrived at 92,060, and not EB-002, whose completion popped first). STALL_CLAIMED EB-001, READY_AT_DEPOT.
//   96,000: EB-002 READY_AT_DEPOT. 97,000: the gate car EB-005: INTAKE 97,000 to 97,180; CLEAN to 98,380; READY.
//   depot.blocked_s at EB-1: 2100 + 3100 = 5200.

describe("13. freed-stall priority: blocked before gate, then vehicle id", () => {
  const scenario = applyAxis(applyAxis(defaultScenario(), "parameter:DEP-2.EB-1", 5), "parameter:DEP-3.EB-1", 4);
  const result = runFixture(scenario, {
    cars: [
      car("EB-001", "EB", "EB-1", { area: "SJ" }),
      car("EB-002", "EB", "EB-1", { area: "PEN" }),
      car("EB-003", "EB", "EB-1", { area: "EB" }),
      car("EB-004", "EB", "EB-1", { area: "EB" }),
      car("EB-005", "EB", "EB-1", { area: "SF" }),
    ],
    requests: [{ id: "r-SF-0", time_s: 87500, origin: "SF", dest: "PEN" }],
    depotOccupancy: {
      "EB-1": { stalls: [95000, 96000, 97000], cleaning: [90600, 90600, 91700, 91700], service: [] },
      "SF-1": { stalls: holds(60, FAR), cleaning: [], service: [] },
      "SF-2": { stalls: holds(30, FAR), cleaning: [], service: [] },
      "SJ-1": { stalls: holds(30, FAR), cleaning: [], service: [] },
    },
  });

  test("timelines", () => {
    assert.deepEqual(spans(result, "EB-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 91500],
      ["INTAKE", 91500, 91680],
      ["QUEUED_SERVICE", 91680, 91700],
      ["IN_SERVICE:CLEAN", 91700, 92900],
      ["IN_SERVICE:CLEAN:blocked", 92900, 95000],
      ["READY_AT_DEPOT", 95000, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90900],
      ["INTAKE", 90900, 91080],
      ["QUEUED_SERVICE", 91080, 91700],
      ["IN_SERVICE:CLEAN", 91700, 92900],
      ["IN_SERVICE:CLEAN:blocked", 92900, 96000],
      ["READY_AT_DEPOT", 96000, 122400],
    ]);
    for (const id of ["EB-003", "EB-004"]) {
      assert.deepEqual(spans(result, id).slice(1), [
        ["TO_DEPOT", 88200, 88500],
        ["INTAKE", 88500, 88680],
        ["QUEUED_SERVICE", 88680, 90600],
        ["IN_SERVICE:CLEAN", 90600, 91800],
        ["READY_AT_DEPOT", 91800, 122400],
      ]);
    }
    assert.deepEqual(spans(result, "EB-005"), [
      ["IDLE", 18000, 87500],
      ["ENROUTE_PICKUP", 87500, 87860],
      ["ON_TRIP", 87860, 89360],
      ["TO_DEPOT", 89360, 92060],
      ["GATE_WAIT", 92060, 97000],
      ["INTAKE", 97000, 97180],
      ["IN_SERVICE:CLEAN", 97180, 98380],
      ["READY_AT_DEPOT", 98380, 122400],
    ]);
  });

  test("completion order, stall claims and the blocked seconds", () => {
    const at92900 = eventsOf(result, (e) => e.t === 92900 && e.kind === "SERVICE_COMPLETED").map((e) => e.car);
    assert.deepEqual(at92900, ["EB-002", "EB-001"]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "STALL_CLAIMED").map((e) => [e.t, e.car]), [[95000, "EB-001"], [96000, "EB-002"], [97000, "EB-005"]]);
    const v = visitsOf(result, "EB-005")[0];
    assert.deepEqual([v.arrival_s, v.intake_end_s, v.ready_s], [92060, 97180, 98380]);
    assert.deepEqual(computeMetric(result, { metric: "depot.blocked_s", scope: { depot: "EB-1" } }), { value: 5200 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 13b. Among blocked cars finished at different seconds, a freed stall goes to the earliest finished (design 5.3)
// ---------------------------------------------------------------------------------------------------------------
//
// EB-1 parking 6 (DEP-2.EB-1), 2 cleaning bays; stall holds two for the whole run, one until 95,000 and one until
// 89,930 (4 held). Clean-only visits (visits 0). Hours 24 and 25 carry 1000 in every row. Stalls held in brackets.
// Cars: EB-001 and EB-002 IDLE at EB, EB-003 and EB-004 IDLE at SF. Riders: r-EB-0 at 87,400 EB to EB; r-SF-0 at
// 87,900 and r-SF-1 at 87,960, SF to EB.
//   87,400 r-EB-0: EB-001 and EB-002 at EB plan 420, the SF cars H3 1200: EB-001 by id. Pickup to 87,820; trip IN_AREA
//     EB 420 to 88,240.
//   87,900 r-SF-0: EB-003 and EB-004 at SF plan 360: EB-003. Pickup to 88,260; trip H3 SF>EB 1200 (L3 2700) to 89,460.
//   87,960 r-SF-1: EB-004 at SF 360 (EB-002 at EB plans H3 1200): EB-004. Pickup to 88,320; trip to 89,520.
//   88,200 recall: only EB-002 is IDLE: ACCESS IN to 88,500. The others finish their trips while it is pending and
//     go to their home depot EB-1: EB-001 88,240 to 88,540; EB-003 89,460 to 89,760; EB-004 89,520 to 89,820.
//   88,500 EB-002 arrives [5]; INTAKE to 88,680; CLEAN 88,680 to 89,880 [4 after EB-001 below].
//   88,540 EB-001 arrives [6]; INTAKE to 88,720; CLEAN 88,720 to 89,920 [4].
//   89,760 EB-003 arrives [5], INTAKE to 89,940. 89,820 EB-004 arrives [6], INTAKE to 90,000.
//   89,880 EB-002's clean ends, no stall free: blocked. 89,920 EB-001's clean ends: blocked. Nobody is queued for a
//     clean (both others are in intake), so no hand-off.
//   89,930 a stall hold ends [5]: the earliest finished blocked car, EB-002 (89,880), not EB-001 (89,920, the lower
//     id): STALL_CLAIMED EB-002, READY_AT_DEPOT [6].
//   89,940 EB-003's intake ends: a cleaning bay is free: CLEAN 89,940 to 91,140 [5]; the freed stall goes to blocked
//     EB-001: STALL_CLAIMED, READY [6]. 90,000 EB-004: CLEAN 90,000 to 91,200 [5].
//   91,140 EB-003 ready [6]. 91,200 EB-004's clean ends, no stall free: blocked. 95,000 the hold ends: EB-004 READY.
//   depot.blocked_s at EB-1: 50 + 20 + 3800 = 3870.

describe("13b. freed-stall priority: the earliest finished blocked car, then vehicle id", () => {
  const scenario = applyAxis(defaultScenario(), "parameter:DEP-2.EB-1", 6);
  const result = runFixture(scenario, {
    cars: [
      car("EB-001", "EB", "EB-1", { area: "EB" }),
      car("EB-002", "EB", "EB-1", { area: "EB" }),
      car("EB-003", "EB", "EB-1", { area: "SF" }),
      car("EB-004", "EB", "EB-1", { area: "SF" }),
    ],
    requests: [
      { id: "r-EB-0", time_s: 87400, origin: "EB", dest: "EB" },
      { id: "r-SF-0", time_s: 87900, origin: "SF", dest: "EB" },
      { id: "r-SF-1", time_s: 87960, origin: "SF", dest: "EB" },
    ],
    depotOccupancy: { "EB-1": { stalls: [FAR, FAR, 95000, 89930], cleaning: [], service: [] } },
  });

  test("timelines", () => {
    assert.deepEqual(spans(result, "EB-001"), [
      ["IDLE", 18000, 87400],
      ["ENROUTE_PICKUP", 87400, 87820],
      ["ON_TRIP", 87820, 88240],
      ["TO_DEPOT", 88240, 88540],
      ["INTAKE", 88540, 88720],
      ["IN_SERVICE:CLEAN", 88720, 89920],
      ["IN_SERVICE:CLEAN:blocked", 89920, 89940],
      ["READY_AT_DEPOT", 89940, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["IN_SERVICE:CLEAN:blocked", 89880, 89930],
      ["READY_AT_DEPOT", 89930, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-003"), [
      ["IDLE", 18000, 87900],
      ["ENROUTE_PICKUP", 87900, 88260],
      ["ON_TRIP", 88260, 89460],
      ["TO_DEPOT", 89460, 89760],
      ["INTAKE", 89760, 89940],
      ["IN_SERVICE:CLEAN", 89940, 91140],
      ["READY_AT_DEPOT", 91140, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-004"), [
      ["IDLE", 18000, 87960],
      ["ENROUTE_PICKUP", 87960, 88320],
      ["ON_TRIP", 88320, 89520],
      ["TO_DEPOT", 89520, 89820],
      ["INTAKE", 89820, 90000],
      ["IN_SERVICE:CLEAN", 90000, 91200],
      ["IN_SERVICE:CLEAN:blocked", 91200, 95000],
      ["READY_AT_DEPOT", 95000, 122400],
    ]);
  });

  test("stall claims and blocked seconds", () => {
    assert.deepEqual(eventsOf(result, (e) => e.kind === "STALL_CLAIMED").map((e) => [e.t, e.car]), [[89930, "EB-002"], [89940, "EB-001"], [95000, "EB-004"]]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "REQUEST_ASSIGNED").map((e) => [e.t, e.car, e.req]), [
      [87400, "EB-001", "r-EB-0"], [87900, "EB-003", "r-SF-0"], [87960, "EB-004", "r-SF-1"],
    ]);
    assert.deepEqual(computeMetric(result, { metric: "depot.blocked_s", scope: { depot: "EB-1" } }), { value: 3870 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 14. Exposure when a segment crosses between a congested hour and an uncongested one (contract 6.4 Legs)
// ---------------------------------------------------------------------------------------------------------------
//
// "The congested test uses the declared multiplier of the hour containing each realized second." Default scenario,
// threshold 1300; IN_AREA row: hour 15 1000, hours 16 to 18 1300, hour 19 1000. SJ-001 (home SJ-1) IDLE at the SJ
// centre; riders r-SJ-0 at 57,500 and r-SJ-1 at 68,100, both SJ to SJ; in-area SJ 480 s. Planned-time integration in
// micro-units (routes.test.mjs):
//   57,500 pickup, hour 15 into hour 16 (uncongested into congested): S = 57,600 - 57,500 = 100,
//     covered = floor(100 x 10^9 / 1000) = 100,000,000 < 480,000,000; R = 380,000,000 at 1300: 380,000,000 x 1300 /
//     10^9 = 494 exactly. 100 + 494 = 594: 57,500 to 58,094. Congested: 57,600 to 58,094 = 494 s, empty.
//   58,094 trip, hour 16: S = 61,200 - 58,094 = 3106, covered 2,389,230,769 >= 480,000,000: 480 x 1.3 = 624:
//     58,094 to 58,718, all congested, loaded. 1 trip: IDLE at SJ.
//   68,100 pickup, hour 18 into hour 19 (congested into uncongested): S = 68,400 - 68,100 = 300,
//     covered = floor(300 x 10^9 / 1300) = 230,769,230 < 480,000,000; R = 249,230,770 at 1000: 249.23077 rounds to
//     249. 300 + 249 = 549: 68,100 to 68,649. Congested: 68,100 to 68,400 = 300 s; the 249 s in hour 19 are not.
//   68,649 trip, hour 19 at 1000: 480: 68,649 to 69,129, not congested. IDLE at SJ.
//   88,200 recall: ACCESS IN SJ-1 (hour 24, 1000) to 88,500; INTAKE to 88,680; CLEAN to 89,880; READY to 122,400.
// Congested empty 494 + 300 = 794, loaded 624, all in area SJ. By window: [54,000, 61,200) empty 494 and loaded 624;
// [64,800, 72,000) empty 300 and loaded 0. Classifying a whole segment by its departure hour would give empty 0 in the
// first window (hour 15) and 549 in the second (hour 18): 549 in total.

describe("14. congested seconds follow each second's hour, not the segment's departure hour", () => {
  const scenario = defaultScenario();
  const result = runFixture(scenario, {
    cars: [car("SJ-001", "SJ", "SJ-1", { area: "SJ" })],
    requests: [
      { id: "r-SJ-0", time_s: 57500, origin: "SJ", dest: "SJ" },
      { id: "r-SJ-1", time_s: 68100, origin: "SJ", dest: "SJ" },
    ],
    depotOccupancy: {},
  });

  test("segments", () => {
    assert.equal(scenario.congestion.IN_AREA[15], 1000);
    assert.equal(scenario.congestion.IN_AREA[16], 1300);
    assert.equal(scenario.congestion.IN_AREA[18], 1300);
    assert.equal(scenario.congestion.IN_AREA[19], 1000);
    assert.deepEqual(spans(result, "SJ-001"), [
      ["IDLE", 18000, 57500],
      ["ENROUTE_PICKUP", 57500, 58094],
      ["ON_TRIP", 58094, 58718],
      ["IDLE", 58718, 68100],
      ["ENROUTE_PICKUP", 68100, 68649],
      ["ON_TRIP", 68649, 69129],
      ["IDLE", 69129, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["READY_AT_DEPOT", 89880, 122400],
    ]);
    const seg = (state, t0) => intervalAt(result, "SJ-001", state, t0).segments.map(segText);
    assert.deepEqual(seg("ENROUTE_PICKUP", 57500), [["IN_AREA", "IN-SJ", "-", 57500, 58094, false]]);
    assert.deepEqual(seg("ON_TRIP", 58094), [["IN_AREA", "IN-SJ", "-", 58094, 58718, true]]);
    assert.deepEqual(seg("ENROUTE_PICKUP", 68100), [["IN_AREA", "IN-SJ", "-", 68100, 68649, false]]);
    assert.deepEqual(seg("ON_TRIP", 68649), [["IN_AREA", "IN-SJ", "-", 68649, 69129, true]]);
  });

  test("exposure metrics, whole window and per hour window", () => {
    assert.equal(congestedSeconds(result, scenario, { loaded: false }), 794);
    assert.equal(congestedSeconds(result, scenario, { loaded: true }), 624);
    const m = (metric, scope) => computeMetric(result, { metric, scope });
    assert.deepEqual(m("exposure.congested_empty_s", {}), { value: 794 });
    assert.deepEqual(m("exposure.congested_empty_s", { area: "SJ" }), { value: 794 });
    assert.deepEqual(m("exposure.congested_empty_s", { area: "SF" }), { value: 0 });
    assert.deepEqual(m("exposure.congested_loaded_s", {}), { value: 624 });
    const early = { start_s: 54000, end_s: 61200 };
    const late = { start_s: 64800, end_s: 72000 };
    assert.deepEqual(m("exposure.congested_empty_s", { window: early }), { value: 494 });
    assert.deepEqual(m("exposure.congested_loaded_s", { window: early }), { value: 624 });
    assert.deepEqual(m("exposure.congested_empty_s", { window: late }), { value: 300 });
    assert.deepEqual(m("exposure.congested_loaded_s", { window: late }), { value: 0 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 15. POL-5 FIFO by INTAKE_COMPLETED time, and the bay priority rule (contract 6.4)
// ---------------------------------------------------------------------------------------------------------------
//
// "When a bay frees, candidates in order: first a car blocked in a cleaning bay at that depot whose service is due (for
// a service bay), then queued cars in FIFO order of INTAKE_COMPLETED time, then vehicle id." Default scenario; hours 24
// to 29 carry 1000 in every row. Recall 88,200: from SF to an SF depot ACCESS IN 300 (88,500); from PEN H1 PEN>SF 1500
// (L1 3300) + 300 (90,000); from EB to EB-1 300 (88,500).
//
// 15a. SF-1 cleaning holds: one until 91,000, three for the whole run. SF-001 (at PEN) and SF-002 (at SF), home SF-1,
//   clean-only visits. The higher id finishes intake first, so FIFO and vehicle-id order disagree.
//   SF-002: arrives 88,500, INTAKE to 88,680, every cleaning bay held: QUEUED_SERVICE (FIFO key 88,680).
//   SF-001: arrives 90,000, INTAKE to 90,180, QUEUED_SERVICE behind SF-002 (90,180 > 88,680).
//   91,000 one bay frees: SF-002 (FIFO), CLEAN 91,000 to 92,200; READY 92,200 (stalls free).
//   92,200 its bay frees: SF-001, CLEAN 92,200 to 93,400; READY 93,400.
// 15b. SF-2 (2 cleaning bays, 1 service bay): cleaning holds two until 91,000, the service bay held until 95,000.
//   SF-001 (PEN) and SF-002 (SF), home SF-2, visits 2 (visit 3: clean, then service).
//   SF-002 INTAKE 88,500 to 88,680, SF-001 INTAKE 90,000 to 90,180: both QUEUED_SERVICE, SF-002 first.
//   91,000 the two holds end in push order: the first takes SF-002, the second SF-001: both CLEAN 91,000 to 92,200.
//     SF-002's completion was pushed first, so it pops first.
//   92,200 both cleans end at the same second: service due, the service bay is held, stalls free: both re-queue for
//     service, keyed by their INTAKE_COMPLETED times, 88,680 (SF-002) before 90,180 (SF-001). Keyed by the clean end
//     both would be 92,200 and the vehicle id would put SF-001 first.
//   95,000 the service hold ends: SF-002 SERVICE 95,000 to 97,700; READY 97,700 frees the bay: SF-001 SERVICE 97,700 to
//     100,400; READY 100,400.
// 15c. EB-1 parking 5 (DEP-2.EB-1), 2 cleaning bays and 1 service bay. Holds: stalls two for the whole run and one until
//   100,000; one cleaning bay for the whole run; the service bay until 92,300. EB-001 IDLE at EB and EB-002 IDLE at PEN,
//   both visits 2 (service due); EB-003 READY_AT_DEPOT at SF-1, visits 0. Rider r-EB-0 at 89,860, EB to EB.
//   Stalls held at EB-1 in brackets.
//   88,200 recall: EB-001 ACCESS IN to 88,500; EB-002 H5 PEN>EB 2400 (L5 4800) + 300 to 90,900.
//   88,500 EB-001 arrives [4]; INTAKE to 88,680; the free cleaning bay: CLEAN 88,680 to 89,880 [3].
//   89,860 r-EB-0: EB-003 is the only dispatchable car: PULL_OUT to 89,980, ACCESS OUT SF-1 to 90,280, H3 SF>EB 1200
//     (L3 2700) to 91,480; trip IN_AREA EB 420 to 91,900; 1 trip, recall pending: TO_DEPOT EB-1 (home), ACCESS IN to
//     92,200. Visit 1, clean only.
//   89,880 EB-001's clean ends: service due, the service bay is held, a stall is free: QUEUED_SERVICE [4].
//   90,900 EB-002 arrives [5]; INTAKE to 91,080; the free cleaning bay: CLEAN 91,080 to 92,280 [4].
//   92,200 EB-003 arrives [5]; INTAKE to 92,380.
//   92,280 EB-002's clean ends: service due, the service bay is held, no stall free: IN_SERVICE CLEAN blocked. No car is
//     queued for cleaning, so no hand-off.
//   92,300 the service hold ends. Both EB-002 (blocked in a cleaning bay, service due) and EB-001 (queued, clean done,
//     service due) wait for it: the blocked car goes first: EB-002 SERVICE 92,300 to 95,000.
//   92,380 EB-003's intake ends: the freed cleaning bay: CLEAN 92,380 to 93,580 [4]; 93,580 READY [5].
//   95,000 EB-002's service ends, no stall free: blocked in the only service bay while EB-001 is queued for service:
//     hand-off (engine.js): STALL_CLAIMED EB-002, READY_AT_DEPOT; EB-001 SERVICE 95,000 to 97,700 [5].
//   97,700 EB-001's service ends, no stall free: blocked. 100,000 the stall hold ends: STALL_CLAIMED EB-001, READY.
//   depot.blocked_s at EB-1: EB-002 92,280 to 92,300 (20) + EB-001 97,700 to 100,000 (2300) = 2320.
//   Serving the queued car first instead would start EB-001's service at 92,300 and free its stall for blocked EB-002.

describe("15. queue order and bay priority", () => {
  test("15a: a freed cleaning bay goes to the earliest INTAKE_COMPLETED, not the lowest vehicle id", () => {
    const result = runFixture(defaultScenario(), {
      cars: [car("SF-001", "SF", "SF-1", { area: "PEN" }), car("SF-002", "SF", "SF-1", { area: "SF" })],
      requests: [],
      depotOccupancy: { "SF-1": { stalls: [], cleaning: [91000, FAR, FAR, FAR], service: [] } },
    });
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["QUEUED_SERVICE", 88680, 91000],
      ["IN_SERVICE:CLEAN", 91000, 92200],
      ["READY_AT_DEPOT", 92200, 122400],
    ]);
    assert.deepEqual(spans(result, "SF-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90000],
      ["INTAKE", 90000, 90180],
      ["QUEUED_SERVICE", 90180, 92200],
      ["IN_SERVICE:CLEAN", 92200, 93400],
      ["READY_AT_DEPOT", 93400, 122400],
    ]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "SERVICE_STARTED").map((e) => [e.t, e.car]), [[91000, "SF-002"], [92200, "SF-001"]]);
  });

  test("15b: re-queued for service after a clean, the key stays the INTAKE_COMPLETED time", () => {
    const result = runFixture(defaultScenario(), {
      cars: [car("SF-001", "SF", "SF-2", { area: "PEN" }, { visits: 2 }), car("SF-002", "SF", "SF-2", { area: "SF" }, { visits: 2 })],
      requests: [],
      depotOccupancy: { "SF-2": { stalls: [], cleaning: [91000, 91000], service: [95000] } },
    });
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["QUEUED_SERVICE", 88680, 91000],
      ["IN_SERVICE:CLEAN", 91000, 92200],
      ["QUEUED_SERVICE", 92200, 95000],
      ["IN_SERVICE:SERVICE", 95000, 97700],
      ["READY_AT_DEPOT", 97700, 122400],
    ]);
    assert.deepEqual(spans(result, "SF-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90000],
      ["INTAKE", 90000, 90180],
      ["QUEUED_SERVICE", 90180, 91000],
      ["IN_SERVICE:CLEAN", 91000, 92200],
      ["QUEUED_SERVICE", 92200, 97700],
      ["IN_SERVICE:SERVICE", 97700, 100400],
      ["READY_AT_DEPOT", 100400, 122400],
    ]);
    const at92200 = eventsOf(result, (e) => e.t === 92200 && e.kind === "SERVICE_COMPLETED").map((e) => e.car);
    assert.deepEqual(at92200, ["SF-002", "SF-001"]);
    const pick = (v) => [v.intake_end_s, v.clean_end_s, v.service_start_s, v.ready_s];
    assert.deepEqual(visitsOf(result, "SF-002").map(pick), [[88680, 92200, 95000, 97700]]);
    assert.deepEqual(visitsOf(result, "SF-001").map(pick), [[90180, 92200, 97700, 100400]]);
  });

  test("15c: a freed service bay goes to the car blocked in a cleaning bay before a queued car", () => {
    const scenario = applyAxis(defaultScenario(), "parameter:DEP-2.EB-1", 5);
    const result = runFixture(scenario, {
      cars: [
        car("EB-001", "EB", "EB-1", { area: "EB" }, { visits: 2 }),
        car("EB-002", "EB", "EB-1", { area: "PEN" }, { visits: 2 }),
        readyCar("EB-003", "EB", "EB-1", "SF-1"),
      ],
      requests: [{ id: "r-EB-0", time_s: 89860, origin: "EB", dest: "EB" }],
      depotOccupancy: { "EB-1": { stalls: [FAR, FAR, 100000], cleaning: [FAR], service: [92300] } },
    });
    assert.deepEqual(spans(result, "EB-001"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 88500],
      ["INTAKE", 88500, 88680],
      ["IN_SERVICE:CLEAN", 88680, 89880],
      ["QUEUED_SERVICE", 89880, 95000],
      ["IN_SERVICE:SERVICE", 95000, 97700],
      ["IN_SERVICE:SERVICE:blocked", 97700, 100000],
      ["READY_AT_DEPOT", 100000, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-002"), [
      ["IDLE", 18000, 88200],
      ["TO_DEPOT", 88200, 90900],
      ["INTAKE", 90900, 91080],
      ["IN_SERVICE:CLEAN", 91080, 92280],
      ["IN_SERVICE:CLEAN:blocked", 92280, 92300],
      ["IN_SERVICE:SERVICE", 92300, 95000],
      ["READY_AT_DEPOT", 95000, 122400],
    ]);
    assert.deepEqual(spans(result, "EB-003"), [
      ["READY_AT_DEPOT", 18000, 89860],
      ["ENROUTE_PICKUP", 89860, 91480],
      ["ON_TRIP", 91480, 91900],
      ["TO_DEPOT", 91900, 92200],
      ["INTAKE", 92200, 92380],
      ["IN_SERVICE:CLEAN", 92380, 93580],
      ["READY_AT_DEPOT", 93580, 122400],
    ]);
    expectInOrder(result.events, [
      { t: 92280, kind: "SERVICE_COMPLETED", car: "EB-002" },
      { t: 92300, kind: "FIXTURE_HOLD_ENDED", depot: "EB-1" },
      { t: 92300, kind: "SERVICE_STARTED", car: "EB-002" },
      { t: 95000, kind: "STALL_CLAIMED", car: "EB-002" },
      { t: 95000, kind: "SERVICE_STARTED", car: "EB-001" },
      { t: 100000, kind: "STALL_CLAIMED", car: "EB-001" },
    ]);
    const pick = (v) => [v.arrival_s, v.intake_end_s, v.clean_start_s, v.clean_end_s, v.service_start_s, v.service_end_s, v.ready_s];
    assert.deepEqual(visitsOf(result, "EB-001").map(pick), [[88500, 88680, 88680, 89880, 95000, 97700, 100000]]);
    assert.deepEqual(visitsOf(result, "EB-002").map(pick), [[90900, 91080, 91080, 92280, 92300, 95000, 95000]]);
    assert.deepEqual(computeMetric(result, { metric: "depot.blocked_s", scope: { depot: "EB-1" } }), { value: 2320 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 16. nearest_depot_with_capacity counts cars inbound, and a car stops counting once it arrives
// ---------------------------------------------------------------------------------------------------------------
//
// Policy nearest_depot_with_capacity (POL-2): the nearest depot whose parking - stalls held - cars inbound >= 1 when
// the car leaves. Hours 10 and 11 carry 1000 in every row. SF-1: 60 stall holds for the whole run. SF-2: 28 for the
// whole run plus one until 39,000 (16a) or for the whole run (16b). SF-001 and SF-002 (home SF-1) IDLE in SF with 9
// trips since their last visit, 0 visits. Riders r-SF-0 at 36,000 and r-SF-1 at 40,000, both SF to SF. Planned arrival
// from the SF centre: SF-1 and SF-2 300; EB-1 H3 1200 + 300 = 1500; SJ-1 H2 3300 + 300 = 3600.
// 16a. 36,000 r-SF-0: both cars IDLE at SF, SF-001 by id. Pickup 360 to 36,360; trip 360 to 36,720. 10 trips: visit 1
//   (clean only). Room: SF-1 60 - 60 - 0 = 0; SF-2 30 - 29 - 0 = 1; EB-1 and SJ-1 30. Nearest with room: SF-2.
//   ACCESS IN to 37,020 (SF-2 inbound back to 0); 30 held; INTAKE to 37,200; CLEAN 37,200 to 38,400 (29); READY (30).
//   39,000 the hold ends (29).
//   40,000 r-SF-1: SF-002 IDLE at SF plans 360, SF-001 at SF-2 plans 120 + 300 + 360 = 780: SF-002. Pickup to 40,360;
//   trip to 40,720; 10 trips. Room at SF-2: 30 - 29 - 0 = 1 (SF-001 arrived at 37,020 and is no longer inbound): SF-2.
//   ACCESS IN 40,720 to 41,020; INTAKE to 41,200; CLEAN to 42,400; READY. A counter still holding SF-001 as inbound would
//   give 30 - 29 - 1 = 0 and send SF-002 to EB-1.
//   Recall 88,200: no IDLE car. Release 107,100: both cars wait at SF-2, in their home area: no move.
// 16b. The SF-2 hold never ends: at 40,720 SF-2 has 30 - 30 - 0 = 0, so SF-002 goes to EB-1: H3 SF>EB 40,720 to 41,920,
//   ACCESS IN EB-1 to 42,220; INTAKE to 42,400; CLEAN to 43,600; READY. Release 107,100: EB-1 is outside SF:
//   PULL_OUT to 107,220, ACCESS OUT EB-1 (hour 29) to 107,520, H3 EB>SF (hours 29 and 30 at 1000) 1200 to 108,720; IDLE.
// 16c. As 16b with both riders at 36,000: while SF-001 is still inbound to SF-2, SF-002 leaves and finds no room there
//   (derivation in the test).

describe("16. nearest_depot_with_capacity with a car inbound and then arrived", () => {
  const scenario = applyAxis(defaultScenario(), "policy:depot_assignment", "nearest_depot_with_capacity");
  const fixture = (lastSf2Hold, secondRiderAt = 40000) => ({
    cars: [car("SF-001", "SF", "SF-1", { area: "SF" }, { trips_since_visit: 9 }), car("SF-002", "SF", "SF-1", { area: "SF" }, { trips_since_visit: 9 })],
    requests: [
      { id: "r-SF-0", time_s: 36000, origin: "SF", dest: "SF" },
      { id: "r-SF-1", time_s: secondRiderAt, origin: "SF", dest: "SF" },
    ],
    depotOccupancy: {
      "SF-1": { stalls: holds(60, FAR), cleaning: [], service: [] },
      "SF-2": { stalls: [...holds(28, FAR), lastSf2Hold], cleaning: [], service: [] },
    },
  });
  const firstCar = [
    ["IDLE", 18000, 36000],
    ["ENROUTE_PICKUP", 36000, 36360],
    ["ON_TRIP", 36360, 36720],
    ["TO_DEPOT", 36720, 37020],
    ["INTAKE", 37020, 37200],
    ["IN_SERVICE:CLEAN", 37200, 38400],
    ["READY_AT_DEPOT", 38400, 122400],
  ];

  test("16a: the freed stall at SF-2 counts once SF-001 has arrived", () => {
    const result = runFixture(scenario, fixture(39000));
    assert.deepEqual(spans(result, "SF-001"), firstCar);
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 40000],
      ["ENROUTE_PICKUP", 40000, 40360],
      ["ON_TRIP", 40360, 40720],
      ["TO_DEPOT", 40720, 41020],
      ["INTAKE", 41020, 41200],
      ["IN_SERVICE:CLEAN", 41200, 42400],
      ["READY_AT_DEPOT", 42400, 122400],
    ]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_ASSIGNED").map((e) => [e.t, e.car, e.depot, e.detail.cause]), [
      [36720, "SF-001", "SF-2", "nearest_depot_with_capacity"],
      [40720, "SF-002", "SF-2", "nearest_depot_with_capacity"],
    ]);
    const leg = intervalAt(result, "SF-002", "TO_DEPOT", 40720);
    assert.deepEqual([leg.depot, leg.cause, leg.purpose], ["SF-2", "nearest_depot_with_capacity", "SERVICE_DUE"]);
    assert.deepEqual(leg.segments.map(segText), [["ACCESS", "ACC-SF-2", "IN", 40720, 41020, false]]);
  });

  test("16b: with that stall still held, SF-2 has no room and SF-002 goes to EB-1", () => {
    const result = runFixture(scenario, fixture(FAR));
    assert.deepEqual(spans(result, "SF-001"), firstCar);
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 40000],
      ["ENROUTE_PICKUP", 40000, 40360],
      ["ON_TRIP", 40360, 40720],
      ["TO_DEPOT", 40720, 42220],
      ["INTAKE", 42220, 42400],
      ["IN_SERVICE:CLEAN", 42400, 43600],
      ["READY_AT_DEPOT", 43600, 107100],
      ["REPOSITIONING", 107100, 108720],
      ["IDLE", 108720, 122400],
    ]);
    const leg = intervalAt(result, "SF-002", "TO_DEPOT", 40720);
    assert.deepEqual([leg.depot, leg.cause], ["EB-1", "nearest_depot_with_capacity"]);
    assert.deepEqual(leg.segments.map(segText), [
      ["ROUTE", "H3", "SF>EB", 40720, 41920, false],
      ["ACCESS", "ACC-EB-1", "IN", 41920, 42220, false],
    ]);
  });

  test("16c: a car still inbound to SF-2 takes its last free stall, so the next car goes to EB-1", () => {
    // As 16b (SF-2 29 held for the whole run), with r-SF-1 also at 36,000. r-SF-0 takes SF-001 and r-SF-1 SF-002 (by
    // request id, then vehicle id); both pickups 36,000 to 36,360 and trips to 36,720. SF-001's completion was pushed
    // first and pops first: SF-2 room 30 - 29 - 0 = 1: SF-2, inbound 1, ACCESS IN to 37,020. SF-002 at the same second:
    // SF-2 room 30 - 29 - 1 = 0 (SF-001 is inbound), SF-1 0: EB-1 by H3 36,720 to 37,920 and ACCESS IN to 38,220;
    // INTAKE to 38,400; CLEAN to 39,600; READY. Release 107,100: EB-1 is outside SF: 107,100 to 108,720 as in 16b.
    // SF-001: arrival 37,020 (30 held), INTAKE to 37,200, CLEAN to 38,400, READY. Ignoring inbound would send SF-002
    // to SF-2 too, where it would find the lot full at 37,020.
    const result = runFixture(scenario, fixture(FAR, 36000));
    assert.deepEqual(spans(result, "SF-001"), firstCar);
    assert.deepEqual(spans(result, "SF-002"), [
      ["IDLE", 18000, 36000],
      ["ENROUTE_PICKUP", 36000, 36360],
      ["ON_TRIP", 36360, 36720],
      ["TO_DEPOT", 36720, 38220],
      ["INTAKE", 38220, 38400],
      ["IN_SERVICE:CLEAN", 38400, 39600],
      ["READY_AT_DEPOT", 39600, 107100],
      ["REPOSITIONING", 107100, 108720],
      ["IDLE", 108720, 122400],
    ]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_ASSIGNED").map((e) => [e.t, e.car, e.depot, e.detail.cause]), [
      [36720, "SF-001", "SF-2", "nearest_depot_with_capacity"],
      [36720, "SF-002", "EB-1", "nearest_depot_with_capacity"],
    ]);
    assert.equal(eventsOf(result, (e) => e.kind === "DEPOT_DIVERTED").length, 0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 17. The recall stops pending at the release time: a trip that ends then or later ends IDLE (design 5.3)
// ---------------------------------------------------------------------------------------------------------------
//
// "A recall is pending from POL-3's time until POL-4's time." Default scenario: recall 88,200, release 107,100. SF-001
// (home SF-1) IDLE in SF, 0 trips, 0 visits. Hours 24 to 30 carry 1000 in every row (hour 30 is D2 06:00).
// Both arms: 88,200 recall: ACCESS IN SF-1 to 88,500; INTAKE to 88,680; CLEAN to 89,880; READY (visit 1). 107,100
// release: SF-1 is in SF: no move. A dispatch from SF-1 to the SF centre: PULL_OUT 120 + ACCESS OUT 300 + IN_AREA 360 =
// 780; the trip SF to SF: 360.
// 17a. r-SF-0 at 108,000: pickup 108,000 to 108,780; trip to 109,140. 109,140 >= 107,100: the recall is no longer
//   pending and 1 trip < 10: IDLE in SF until 122,400. One visit (arrival 88,500); no depot assignment after 88,200.
// 17b. r-SF-0 at 105,960: pickup 105,960 to 106,740; trip to 107,100. TRIP_COMPLETED (class 0) pops before
//   MORNING_RELEASE (class 3) at 107,100. The pending window is [88,200, 107,100): it has ended, so IDLE in SF.

describe("17. the recall no longer applies from the release time", () => {
  const scenario = defaultScenario();
  const runWith = (time_s) => runFixture(scenario, {
    cars: [car("SF-001", "SF", "SF-1", { area: "SF" })],
    requests: [{ id: "r-SF-0", time_s, origin: "SF", dest: "SF" }],
    depotOccupancy: {},
  });
  const night = [
    ["IDLE", 18000, 88200],
    ["TO_DEPOT", 88200, 88500],
    ["INTAKE", 88500, 88680],
    ["IN_SERVICE:CLEAN", 88680, 89880],
  ];

  test("17a: a trip ending after the release leaves the car IDLE", () => {
    const result = runWith(108000);
    assert.deepEqual(spans(result, "SF-001"), [
      ...night,
      ["READY_AT_DEPOT", 89880, 108000],
      ["ENROUTE_PICKUP", 108000, 108780],
      ["ON_TRIP", 108780, 109140],
      ["IDLE", 109140, 122400],
    ]);
    assert.deepEqual(intervalAt(result, "SF-001", "IDLE", 109140).location, { area: "SF" });
    assert.deepEqual(visitsOf(result, "SF-001").map((v) => v.arrival_s), [88500]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_ASSIGNED").map((e) => e.t), [88200]);
    assert.equal(eventsOf(result, (e) => e.t >= 107100 && (e.kind === "DEPOT_ASSIGNED" || e.kind === "DEPOT_ARRIVED")).length, 0);
  });

  test("17b: a trip ending at the release second leaves the car IDLE", () => {
    const result = runWith(105960);
    assert.deepEqual(spans(result, "SF-001"), [
      ...night,
      ["READY_AT_DEPOT", 89880, 105960],
      ["ENROUTE_PICKUP", 105960, 106740],
      ["ON_TRIP", 106740, 107100],
      ["IDLE", 107100, 122400],
    ]);
    expectInOrder(result.events, [
      { t: 107100, kind: "TRIP_COMPLETED", car: "SF-001" },
      { t: 107100, kind: "MORNING_RELEASE" },
    ]);
    assert.deepEqual(visitsOf(result, "SF-001").map((v) => v.arrival_s), [88500]);
    assert.deepEqual(eventsOf(result, (e) => e.kind === "DEPOT_ASSIGNED").map((e) => e.t), [88200]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 18. A dispatch tie across two locations goes to the lower vehicle id (design 5.5, contract 6.4)
// ---------------------------------------------------------------------------------------------------------------
//
// Default scenario, hour 10 (every multiplier 1000). SF-002 (home SF-1) READY_AT_DEPOT at SF-1 and SF-001 (home SF-2)
// READY_AT_DEPOT at SF-2. Rider r-SF-0 at 36,000, SF to SF. Planned arrival from either depot: PULL_OUT 120 + ACCESS OUT
// 300 + IN_AREA SF 360 = 780, so 36,780 for both: the tie goes to SF-001. Pickup from SF-2 36,000 to 36,780; trip 360 to
// 37,140; IDLE in SF. SF-002 stays ready at SF-1 through the recall and the release (SF-1 is in SF) to 122,400.

describe("18. dispatch tie across locations", () => {
  const result = runFixture(defaultScenario(), {
    cars: [readyCar("SF-001", "SF", "SF-2", "SF-2"), readyCar("SF-002", "SF", "SF-1", "SF-1")],
    requests: [{ id: "r-SF-0", time_s: 36000, origin: "SF", dest: "SF" }],
    depotOccupancy: {},
  });

  test("the lower vehicle id wins the tie", () => {
    const assigned = eventsOf(result, (e) => e.kind === "REQUEST_ASSIGNED");
    assert.deepEqual(assigned.map((e) => [e.t, e.car, e.req, e.detail.planned_arrive_s]), [[36000, "SF-001", "r-SF-0", 36780]]);
    assert.deepEqual(spans(result, "SF-001").slice(0, 4), [
      ["READY_AT_DEPOT", 18000, 36000],
      ["ENROUTE_PICKUP", 36000, 36780],
      ["ON_TRIP", 36780, 37140],
      ["IDLE", 37140, 88200],
    ]);
    const pickup = intervalAt(result, "SF-001", "ENROUTE_PICKUP", 36000);
    assert.deepEqual(pickup.segments.map((s) => [s.kind, s.t0, s.t1]), [["PULL_OUT", 36000, 36120], ["ACCESS", 36120, 36420], ["IN_AREA", 36420, 36780]]);
    assert.equal(pickup.segments[1].key, "ACC-SF-2");
    assert.deepEqual(spans(result, "SF-002"), [["READY_AT_DEPOT", 18000, 122400]]);
  });
});
