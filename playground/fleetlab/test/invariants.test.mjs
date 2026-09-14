// Invariant checks of the teaching model (design 5.6, 9.5; contract 6.5).
//
// 1. The per-change hooks the engine calls hold on valid input and fail on a constructed violation.
// 2. checkRun holds on hand-derived fixture runs, and every whole-run check fails on a constructed violation of its own,
//    reported under its own id and no other (Conservation is the one check whose violation also leaves a request
//    without a terminal state, so check 3 fires beside it).
// 3. Each seeded defect (double_assign, bay_overfill, lot_overfill, teleport, illegal_transition) is caught by its own
//    named check and by no unrelated check, with and without the event log.
// 4. Every check of design 5.6 holds on every preset for 5 seeds, both arms on one shared world where a preset has an
//    experiment, with replay (12) and the world checks (P18).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createRun, DEFECTS, runToEnd } from "../src/model/engine.js";
import {
  checkArms, checkAssignment, checkBayStart, checkLegStart, checkPopOrder, checkReplay, checkRun, checkScenario,
  checkStallClaim, checkTransition, checkWorld, CHECK_IDS, partitionViolations, runDigest, runViolations, TRANSITIONS,
  violationId,
} from "../src/model/invariants.js";
import { computeMetric } from "../src/model/metrics.js";
import { PRESETS } from "../src/model/presets.js";
import { applyAxis, defaultScenario, validateScenario } from "../src/model/schema.js";
import { buildWorld, sharedLambdaMaxPermille } from "../src/model/world.js";

const ids = (violations) => [...new Set(violations.map(violationId))];

function runFixture(scenario, fixture, seed = 1001) {
  assert.equal(validateScenario(scenario).ok, true);
  const run = createRun(scenario, buildWorld(scenario, { seed }), { seed, fixture });
  while (!run.step(100000));
  return run.result();
}

const car = (id, home_area, home_depot, location, extra = {}) => ({
  id, home_area, home_depot, state: "IDLE", location, trips_since_visit: 0, visits: 0, ...extra,
});

// Fixture A of metrics.test.mjs (derivation there): two cars, five requests (one unserved), a clean visit for SF-001
// and a clean-and-service visit for PEN-001 at SF-1, and PEN-001's morning release to PEN.
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
const A_CARS = ["PEN-001", "SF-001"];

// Fixture B (engine-fixtures case 8): SF-001 ready at SF-1 is dispatched to a PEN rider at 61,200.
const FIXTURE_B = {
  cars: [car("SF-001", "SF", "SF-1", { depot: "SF-1" }, { state: "READY_AT_DEPOT" })],
  requests: [{ id: "r-PEN-0", time_s: 61200, origin: "PEN", dest: "PEN" }],
  depotOccupancy: {},
};

describe("per-change hooks the engine calls", () => {
  test("9: the transition table", () => {
    assert.equal(TRANSITIONS.length, 25);
    for (const [from, to, event] of TRANSITIONS) assert.deepEqual(checkTransition({ car: "SF-001", from, to, event, t: 1 }), []);
    assert.deepEqual(checkTransition({ car: "SF-001", from: "ON_TRIP", to: "IDLE", event: "PICKUP_COMPLETED", t: 40000 }),
      ["9: SF-001 changed from ON_TRIP to IDLE on PICKUP_COMPLETED at 40000, which the transition table does not allow"]);
    assert.deepEqual(ids(checkTransition({ car: "SF-001", from: "IDLE", to: "IN_SERVICE:CLEAN", event: "SERVICE_STARTED", t: 1 })), ["9"]);
  });

  test("P14: a leg starts where the car stands", () => {
    assert.deepEqual(checkLegStart({ car: "SF-001", at: { depot: "SF-1" }, from: { depot: "SF-1" }, t: 5 }), []);
    assert.deepEqual(ids(checkLegStart({ car: "SF-001", at: { area: "SF" }, from: { area: "PEN" }, t: 5 })), ["P14"]);
    assert.deepEqual(ids(checkLegStart({ car: "SF-001", at: { area: "SF" }, from: { depot: "SF-1" }, t: 5 })), ["P14"]);
    assert.deepEqual(ids(checkLegStart({ car: "SF-001", at: null, from: { area: "SF" }, t: 5 })), ["P14"]);
  });

  test("2: a car never holds two requests", () => {
    assert.deepEqual(checkAssignment({ car: "SF-001", held: null, request: "r-SF-1", t: 7 }), []);
    assert.deepEqual(checkAssignment({ car: "SF-001", held: "r-SF-0", request: "r-SF-1", t: 7 }), ["2: SF-001 is assigned r-SF-1 at 7 while it still holds r-SF-0"]);
  });

  test("P13: stalls held within parking at every claim", () => {
    assert.deepEqual(checkStallClaim({ depot: "SJ-1", held: 30, parking: 30, t: 9 }), []);
    assert.deepEqual(checkStallClaim({ depot: "SJ-1", held: 31, parking: 30, t: 9 }), ["P13: SJ-1 holds 31 stalls at 9, above its parking of 30"]);
  });

  test("5: bays in use within capacity at every start", () => {
    assert.deepEqual(checkBayStart({ depot: "EB-1", task: "CLEAN", busy: 2, bays: 2, t: 3 }), []);
    assert.deepEqual(checkBayStart({ depot: "EB-1", task: "CLEAN", busy: 3, bays: 2, t: 3 }), ["5: EB-1 has 3 cleaning bays in use at 3, above its 2"]);
    assert.deepEqual(checkBayStart({ depot: "EB-1", task: "SERVICE", busy: 2, bays: 1, t: 3 }), ["5: EB-1 has 2 service bays in use at 3, above its 1"]);
  });

  test("11: heap pops strictly increase in (time, class, seq)", () => {
    assert.deepEqual(checkPopOrder(null, [5, 0, 0]), []);
    assert.deepEqual(checkPopOrder([5, 0, 9], [5, 1, 2]), []);
    assert.deepEqual(checkPopOrder([5, 1, 2], [5, 1, 3]), []);
    assert.deepEqual(checkPopOrder([5, 1, 3], [5, 1, 3]), ["11: heap popped (5, 1, 3) after (5, 1, 3)"]);
    assert.deepEqual(ids(checkPopOrder([6, 0, 0], [5, 4, 99])), ["11"]);
    assert.deepEqual(ids(checkPopOrder([5, 2, 0], [5, 1, 99])), ["11"]);
  });
});

describe("checkRun holds on hand-derived fixture runs", () => {
  test("fixtures A and B, with and without the event log", () => {
    const a = runFixture(defaultScenario(), FIXTURE_A);
    assert.deepEqual(runViolations(a, { configuredCars: A_CARS }), []);
    const b = runFixture(defaultScenario(), FIXTURE_B);
    assert.deepEqual(runViolations(b, { configuredCars: ["SF-001"] }), []);
    const lean = { ...a, events: [], snapshots: [] };
    assert.deepEqual(checkRun(lean, { configuredCars: A_CARS }), []);
  });

  test("a censored visit and a censored leg at the drain end", () => {
    // Fixture C of metrics.test.mjs: EB-002's visit is censored in its bay at 122,400.
    let s = applyAxis(defaultScenario(), "parameter:POL-4", "off");
    s = applyAxis(s, "parameter:POL-3", 121000);
    const c = runFixture(s, {
      cars: [car("EB-001", "EB", "EB-1", { area: "EB" }, { trips_since_visit: 9 }), car("EB-002", "EB", "EB-1", { area: "EB" })],
      requests: [{ id: "r-EB-0", time_s: 36000, origin: "EB", dest: "EB" }],
      depotOccupancy: {},
    });
    assert.deepEqual(runViolations(c, { configuredCars: ["EB-001", "EB-002"] }), []);
    // A recall at 122,000 leaves PEN-001 on H1 (1500 s) at the drain end 122,400: its TO_DEPOT leg is censored.
    let late = applyAxis(defaultScenario(), "parameter:POL-4", "off");
    late = applyAxis(late, "parameter:POL-3", 122000);
    const d = runFixture(late, { cars: [car("PEN-001", "PEN", "SF-1", { area: "PEN" })], requests: [], depotOccupancy: {} });
    const last = d.intervals["PEN-001"].at(-1);
    assert.deepEqual([last.state, last.censored, last.t1, d.visits.length], ["TO_DEPOT", true, 122400, 0]);
    assert.deepEqual(runViolations(d, { configuredCars: ["PEN-001"] }), []);
  });

  test("check 1 by default compares with SUP-1, which a fixture fleet does not match", () => {
    const a = runFixture(defaultScenario(), FIXTURE_A);
    assert.deepEqual(ids(checkRun(a)), ["1"]);
  });
});

describe("every whole-run check fails on a constructed violation of its own", () => {
  const scenario = defaultScenario();
  const A = runFixture(scenario, FIXTURE_A);
  const B = runFixture(scenario, FIXTURE_B);
  const clone = (r) => structuredClone(r);
  const only = (result, id, options = { configuredCars: A_CARS }) => {
    const found = checkRun(result, options);
    assert.deepEqual(ids(found), [id], found.join(" | "));
    return found;
  };
  const iv = (r, carId, state, t0) => r.intervals[carId].find((x) => x.state === state && x.t0 === t0);
  const req = (r, id) => r.requests.find((q) => q.id === id);

  test("1: a configured car is not tracked, or a snapshot loses a car", () => {
    only(A, "1", { configuredCars: ["SF-001"] });
    only(A, "1", { configuredCars: ["PEN-001", "SF-001", "SJ-001"] });
    const r = clone(A);
    r.snapshots[10].cars.pop();
    only(r, "1");
  });

  test("2: two assignment spans overlap", () => {
    const r = clone(A);
    // r-SF-0 is held by SF-001 until 36,720; move r-SF-1's assignment to 36,500.
    req(r, "r-SF-1").assigned_s = 36500;
    assert.match(only(r, "2")[0], /^2: SF-001 holds r-SF-0 until 36720 and is assigned r-SF-1 at 36500$/);
  });

  test("3: a request with no terminal state, or with two", () => {
    const r = clone(A);
    req(r, "r-SF-2").state = "WAITING";
    only(r, "3");
    const both = clone(A);
    req(both, "r-SF-2").dropoff_s = 36900;
    only(both, "3");
    const twice = clone(A);
    const unserved = twice.events.find((e) => e.kind === "REQUEST_UNSERVED");
    const deadline = twice.events.find((e) => e.kind === "WAIT_DEADLINE" && e.req === "r-SF-1");
    Object.assign(deadline, { kind: "REQUEST_UNSERVED", req: unserved.req });
    only(twice, "3");
  });

  test("5: a depot series row with more cleaning bays busy than exist", () => {
    // The counter reads 5 while no car is in a bay, so the series also disagrees with the interval log (P16).
    const r = clone(A);
    r.depots.find((d) => d.id === "SF-1").series[0][4] = 5;
    assert.deepEqual(ids(checkRun(r, { configuredCars: A_CARS })), ["5", "P16"]);
  });

  test("5: cars in bays rebuilt from the interval log above the bay count", () => {
    // Fixture A cleans SF-001 and PEN-001 at SF-1 (4 cleaning bays); with 0 bays both the counter and the cars exceed it.
    const r = clone(A);
    r.depots.find((d) => d.id === "SF-1").cleaning_bays = 0;
    assert.ok(only(r, "5").some((text) => /cars in cleaning bays at \d+ by the interval log, above its cleaning bays of 0$/.test(text)));
    // A counter that under-reads hides nothing: the rebuilt count still fires 5, and the mismatch fires P16.
    const hidden = clone(A);
    const sf1 = hidden.depots.find((d) => d.id === "SF-1");
    sf1.cleaning_bays = 0;
    for (const row of sf1.series) row[4] = 0;
    assert.deepEqual(ids(checkRun(hidden, { configuredCars: A_CARS })), ["5", "P16"]);
  });

  test("8: a completed request without a pickup event, or picked up before it was created", () => {
    const r = clone(A);
    r.events = r.events.filter((e) => !(e.kind === "PICKUP_COMPLETED" && e.req === "r-SF-0"));
    only(r, "8");
    const lean = clone(A);
    lean.events = [];
    req(lean, "r-SF-0").pickup_s = 35999;
    only(lean, "8");
  });

  test("9: consecutive states outside the transition table", () => {
    const r = clone(A);
    // IDLE -> ON_TRIP -> ON_TRIP: neither pair is in the table.
    iv(r, "SF-001", "ENROUTE_PICKUP", 36000).state = "ON_TRIP";
    only(r, "9");
    const start = clone(A);
    start.intervals["SF-001"][0].state = "QUEUED_SERVICE";
    // The first interval keeps its area location, so only the start-state rule and the pair rule fire.
    assert.deepEqual(ids(checkRun(start, { configuredCars: A_CARS })), ["9"]);
  });

  test("10: an event or a visit names an entity that does not exist", () => {
    const r = clone(A);
    r.events.find((e) => e.kind === "DEPOT_ARRIVED").car = "SF-999";
    only(r, "10");
    const v = clone(A);
    v.visits[0].depot = "XX-1";
    only(v, "10");
  });

  test("11: log ordinals that do not strictly increase", () => {
    const r = clone(A);
    r.events[5].ord = r.events[4].ord;
    only(r, "11");
  });

  test("Conservation: a request outside every request state", () => {
    const r = clone(A);
    req(r, "r-SF-2").state = "LOST";
    const found = ids(checkRun(r, { configuredCars: A_CARS }));
    assert.ok(found.includes("Conservation"), found.join());
    assert.deepEqual(found, ["3", "Conservation"]);
  });

  test("P13: a depot series row above parking", () => {
    // The counter reads 61 while no car holds a stall at the window start, so P16 fires beside it.
    const r = clone(A);
    r.depots.find((d) => d.id === "SF-1").series[0][1] = 61;
    assert.deepEqual(ids(checkRun(r, { configuredCars: A_CARS })), ["P13", "P16"]);
  });

  test("P13: cars holding stalls, rebuilt from the interval log, above parking", () => {
    // At 90,100 PEN-001 is in INTAKE and SF-001 is READY_AT_DEPOT at SF-1 (metrics.test.mjs fixture A): two stall holders.
    const r = clone(A);
    const holders = Object.entries(r.intervals)
      .filter(([, list]) => list.some((x) => x.location?.depot === "SF-1" && ["INTAKE", "QUEUED_SERVICE", "READY_AT_DEPOT"].includes(x.state) && x.t0 <= 90100 && 90100 < x.t1))
      .map(([id]) => id);
    assert.deepEqual(holders, ["PEN-001", "SF-001"]);
    r.depots.find((d) => d.id === "SF-1").parking = 1;
    assert.ok(only(r, "P13").some((text) => /^P13: SF-1 has 2 cars holding stalls at \d+ by the interval log, above its parking of 1$/.test(text)));
    // The engine counter capped at 1 (a missed stall claim) no longer hides the second car: P13 and P16 both fire.
    const capped = clone(A);
    const sf1 = capped.depots.find((d) => d.id === "SF-1");
    sf1.parking = 1;
    for (const row of sf1.series) row[1] = Math.min(row[1], 1);
    assert.deepEqual(ids(checkRun(capped, { configuredCars: A_CARS })), ["P13", "P16"]);
  });

  test("P16: a stalls-held column that drifts from the cars, or reads below zero", () => {
    const r = clone(A);
    const series = r.depots.find((d) => d.id === "SF-1").series;
    const row = series.find((x) => x[1] > 0);
    row[1] -= 1;
    only(r, "P16");
    const negative = clone(A);
    negative.depots.find((d) => d.id === "SF-1").series.find((x) => x[1] === 0 && x[0] > 18000)[1] = -1;
    assert.ok(only(negative, "P16").some((text) => /below zero/.test(text)));
  });

  test("P14: a car stands somewhere its last leg did not take it", () => {
    const r = clone(A);
    iv(r, "SF-001", "IDLE", 37440).location = { area: "PEN" };
    only(r, "P14");
  });

  test("P15: an interval that overlaps the next", () => {
    const r = clone(A);
    iv(r, "SF-001", "IDLE", 37440).t1 += 1;
    only(r, "P15");
  });

  test("P16: the depot series disagrees with the interval log", () => {
    const r = clone(A);
    const series = r.depots.find((d) => d.id === "SF-1").series;
    series[series.length - 1][7] += 1;
    only(r, "P16");
  });

  test("P17: a visit both completed and censored, or a visit record missing", () => {
    const r = clone(A);
    r.visits[0].censored = true;
    only(r, "P17");
    const missing = clone(A);
    missing.visits.pop();
    only(missing, "P17");
  });

  test("P17: a depot leg that ends without an arrival, a diversion or censoring", () => {
    // Fixture D (above): a recall at 122,000 leaves PEN-001 on H1 at the drain end 122,400, its last leg censored.
    let late = applyAxis(defaultScenario(), "parameter:POL-4", "off");
    late = applyAxis(late, "parameter:POL-3", 122000);
    const d = runFixture(late, { cars: [car("PEN-001", "PEN", "SF-1", { area: "PEN" })], requests: [], depotOccupancy: {} });
    const open = clone(d);
    open.intervals["PEN-001"].at(-1).censored = false;
    assert.deepEqual(only(open, "P17", { configuredCars: ["PEN-001"] }),
      ["P17: PEN-001's depot leg from 122000 ends without an arrival, a diversion or censoring"]);
    // A depot leg followed by a state other than INTAKE, GATE_WAIT or TO_DEPOT: SF-001's first depot leg in fixture A
    // now ends READY_AT_DEPOT, which check 9 also reports, so the P17 message itself is asserted.
    const skipped = clone(A);
    const list = skipped.intervals["SF-001"];
    const leg = list.findIndex((x) => x.state === "TO_DEPOT");
    assert.equal(list[leg + 1].state, "INTAKE");
    list[leg + 1].state = "READY_AT_DEPOT";
    const found = checkRun(skipped, { configuredCars: A_CARS });
    assert.ok(found.includes(`P17: SF-001's depot leg from ${list[leg].t0} ends in READY_AT_DEPOT`), found.join(" | "));
  });

  test("P19: a car whose home depot does not exist", () => {
    const r = clone(A);
    r.cars[0].home_depot = "XX-9";
    only(r, "P19");
  });

  test("P20: a release at the wrong time or of a car at home, and a dispatch from a depot with no decision", () => {
    const r = clone(A);
    r.scenario.policies.release_s = 107000;
    only(r, "P20");
    const home = clone(A);
    home.cars.find((c) => c.id === "PEN-001").home_area = "SF";
    only(home, "P20");
    const b = clone(B);
    b.events = b.events.filter((e) => e.kind !== "REQUEST_ASSIGNED");
    only(b, "P20", { configuredCars: ["SF-001"] });
  });

  test("P20: a recall that does not act once at its second", () => {
    // Fixture A sends SF-001 and PEN-001 from IDLE at the recall 88,200. With the recall read as 88,100 those legs start
    // 100 s after it, which no rule allows.
    const late = clone(A);
    late.scenario.policies.recall_s = 88100;
    only(late, "P20");
    // With the recall read as 37,000, SF-001 was on r-SF-1 then (pickup from 36,720, trip to 37,440) and PEN-001 on
    // r-PEN-0 (pickup from 36,100, trip to 37,060): both trips end before the release 107,100, yet both cars end IDLE,
    // and the legs at 88,200 are no longer at the recall second.
    const marked = clone(A);
    marked.scenario.policies.recall_s = 37000;
    const found = only(marked, "P20");
    assert.ok(found.some((text) => text === "P20: SF-001 ends a trip at 37440 idle although it was on that trip at the recall at 37000"), found.join(" | "));
    assert.ok(found.some((text) => text === "P20: PEN-001 ends a trip at 37060 idle although it was on that trip at the recall at 37000"), found.join(" | "));
  });

  test("P20: a car dispatched after the recall does not follow it, as it did under the former pending rule", () => {
    // Engine fixture 4: SF-003 is assigned r-SF-0 at 88,000 (pickup 88,000 to 88,360, trip 88,360 to 89,860), is on that
    // pickup at the recall 88,200, and leaves for SF-1 on the recall at 89,860. That trace holds. With the recall read as
    // 87,900 the same trace is the former pending rule's: the car was IDLE at the recall, was dispatched after it, and
    // still leaves for a depot on the recall when its trip ends (review: 111 such legs in the former default run).
    const trace = runFixture(defaultScenario(), {
      cars: [car("SF-003", "SF", "SF-1", { area: "SF" })],
      requests: [{ id: "r-SF-0", time_s: 88000, origin: "SF", dest: "PEN" }],
      depotOccupancy: {},
    });
    assert.deepEqual(checkRun(trace, { configuredCars: ["SF-003"] }), []);
    const pending = clone(trace);
    pending.scenario.policies.recall_s = 87900;
    const found = only(pending, "P20", { configuredCars: ["SF-003"] });
    assert.ok(found.includes("P20: SF-003 leaves for a depot on the recall at 89860 from ON_TRIP, outside the recall at 87900"), found.join(" | "));
  });

  test("P21: a metric whose area values do not sum to the unscoped value", () => {
    assert.deepEqual(partitionViolations(A), []);
    const faulty = (result, ref) => {
      const out = computeMetric(result, ref);
      return ref.scope.area === "SF" && ref.metric === "requests.total" ? { value: out.value + 1 } : out;
    };
    assert.deepEqual(partitionViolations(A, faulty), ["P21: requests.total sums to 5 over every area, but reads 4 unscoped"]);
  });

  test("P21: checkRun reports a segment whose seconds belong to no area", () => {
    // Threshold 1000 makes every driven second congested. SF-001's in-area segment from 36,000 to 36,360 is moved to an
    // area that does not exist, so the area values sum to 360 s less than the unscoped value.
    const r = clone(A);
    r.scenario.congestion_threshold_permille = 1000;
    const seg = r.intervals["SF-001"].flatMap((x) => x.segments ?? []).find((s) => s.kind === "IN_AREA" && s.t0 >= 21600);
    assert.deepEqual([seg.t0, seg.t1, seg.key], [36000, 36360, "IN-SF"]);
    seg.key = "IN-ZZ";
    assert.deepEqual(only(r, "P21"), ["P21: exposure.congested_empty_s sums to 4740 over every area, but reads 5100 unscoped"]);
  });

  test("12: a replay with a different digest", () => {
    const again = runFixture(scenario, FIXTURE_A);
    assert.deepEqual(checkReplay(A, again), []);
    assert.equal(runDigest(A), runDigest(again));
    const r = clone(A);
    r.requests[0].pickup_s += 1;
    assert.deepEqual(ids(checkReplay(A, r)), ["12"]);
  });

  test("P18: an arm outside the envelope, a mismatched arm, and arms on different worlds", () => {
    const world = buildWorld(scenario, { seed: 1001 });
    assert.deepEqual(checkWorld(world, [scenario]), []);
    // SF peak 120 requests per hour against the world's own envelope of 60,000 thousandths.
    const busier = applyAxis(scenario, "parameter:DEM-1.SF", 120);
    assert.deepEqual(ids(checkWorld(world, [scenario, busier])), ["P18"]);
    assert.deepEqual(ids(checkWorld(world, [{ ...scenario, name: "another_map" }])), ["P18"]);
    const run = runToEnd(scenario, world, { seed: 1001, keepLogs: false });
    assert.deepEqual(checkArms([run, run], world), []);
    assert.deepEqual(ids(checkArms([run, { ...run, world_digest: "0".repeat(64) }])), ["P18"]);
  });

  test("P19 at load: every scenario error", () => {
    assert.deepEqual(checkScenario(scenario), []);
    const bad = { ...defaultScenario(), warmup_end_s: 17000 };
    const found = checkScenario(bad);
    assert.ok(found.length > 0);
    assert.deepEqual(ids(found), ["P19"]);
  });

  test("every reported id is a known check", () => {
    assert.deepEqual(CHECK_IDS, ["1", "2", "3", "5", "8", "9", "10", "11", "12", "Conservation", "P13", "P14", "P15", "P16", "P17", "P18", "P19", "P20", "P21"]);
  });
});

describe("seeded defects are caught by their own check and by no other (design 9.5)", () => {
  const expected = { double_assign: "2", bay_overfill: "5", lot_overfill: "P13", teleport: "P14", illegal_transition: "9" };
  let s = defaultScenario();
  for (const [area, n] of [["SF", 50], ["PEN", 30], ["SJ", 40], ["EB", 30]]) s = applyAxis(s, `parameter:SUP-1.${area}`, n);
  const world = buildWorld(s, { seed: 1001 });

  test("the defect list", () => {
    assert.deepEqual([...DEFECTS].sort(), Object.keys(expected).sort());
  });

  for (const defect of DEFECTS) {
    for (const keepLogs of [true, false]) {
      test(`${defect} with keepLogs ${keepLogs}: check ${expected[defect]} only`, () => {
        const r = runToEnd(s, world, { seed: 1001, defect, keepLogs });
        const all = runViolations(r);
        assert.ok(all.length > 0, `${defect} produced no violation`);
        assert.deepEqual(ids(all), [expected[defect]], all.slice(0, 4).join(" | "));
      });
    }
  }
});

describe("every check holds on every preset for 5 seeds (design 9.5)", () => {
  const SEEDS = [1001, 1002, 1003, 1004, 1005];
  for (const preset of PRESETS) {
    test(`${preset.id}`, () => {
      const arms = [];
      if (preset.kind !== "experiment") arms.push({ label: "preset", scenario: preset.scenario, envelope: null });
      if (preset.experiment !== null) {
        const base = preset.experiment.scenario;
        const cand = applyAxis(base, preset.experiment.axis.id, preset.experiment.axis.candidate);
        const envelope = sharedLambdaMaxPermille([base, cand]);
        arms.push({ label: "baseline", scenario: base, envelope, pair: 0 }, { label: "candidate", scenario: cand, envelope, pair: 0 });
      }
      for (const arm of arms) assert.deepEqual(checkScenario(arm.scenario), [], `${preset.id} ${arm.label}`);
      for (const seed of SEEDS) {
        const worlds = new Map();
        const pairRuns = [];
        for (const arm of arms) {
          const key = arm.envelope === null ? `own-${arm.label}` : "shared";
          if (!worlds.has(key)) {
            const options = arm.envelope === null ? { seed } : { seed, lambdaMaxPermille: arm.envelope };
            worlds.set(key, buildWorld(arm.envelope === null ? arm.scenario : arms.find((a) => a.label === "baseline").scenario, options));
          }
          const world = worlds.get(key);
          const r = runToEnd(arm.scenario, world, { seed });
          assert.deepEqual(runViolations(r), [], `${preset.id} ${arm.label} seed ${seed}`);
          if (seed === SEEDS[0]) assert.deepEqual(checkReplay(r, runToEnd(arm.scenario, world, { seed })), [], `${preset.id} ${arm.label} replay`);
          if (arm.envelope !== null) pairRuns.push([r, arm.scenario, world]);
        }
        if (pairRuns.length === 2) {
          const world = pairRuns[0][2];
          assert.deepEqual(checkWorld(world, pairRuns.map((p) => p[1])), [], `${preset.id} seed ${seed} world`);
          assert.deepEqual(checkArms(pairRuns.map((p) => p[0]), world), [], `${preset.id} seed ${seed} arms`);
        }
      }
    });
  }
});
