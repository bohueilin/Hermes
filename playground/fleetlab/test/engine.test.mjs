// Engine structure tests (contract 6.4, design 5.3, 5.4, 5.7, 5.9, 9.5): home depots, seeded defects each caught by its
// own named check, resumable stepping, the event ordinal, the drain end, snapshots, keepLogs, and bucketed dispatch
// against a brute-force ranking. Hand-derived expectations carry their arithmetic in comments.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import { multiplierTable } from "../src/core/tables.js";
import { createRun, DEFECTS, MAX_EVENT_TIME_S, runToEnd, SNAPSHOT_STEP_S } from "../src/model/engine.js";
import { checkRun, runViolations } from "../src/model/invariants.js";
import { assignDepot, divertDepot, homeDepotSets, nearestIdle } from "../src/model/policies.js";
import { presetById } from "../src/model/presets.js";
import { planPath, plannedLegSeconds } from "../src/model/routes.js";
import { applyAxis, defaultScenario, validateScenario } from "../src/model/schema.js";
import { buildWorld, sharedLambdaMaxPermille } from "../src/model/world.js";

const PERF = process.env.FLEET_PLAYGROUND_PERF === "1";

function scaled(sigma = 0) {
  let s = defaultScenario();
  for (const [area, n] of [["SF", 50], ["PEN", 30], ["SJ", 40], ["EB", 30]]) s = applyAxis(s, `parameter:SUP-1.${area}`, n);
  s.sigma_permille = sigma;
  return s;
}

const digestOf = (r) => createHash("sha256").update(JSON.stringify([r.events, r.intervals, r.visits, r.requests, r.depots, r.snapshots])).digest("hex");
const homeOf = (result, id) => result.cars.find((c) => c.id === id).home_depot;

describe("home depots (contract 6.4, SUP-2)", () => {
  // Free-flow seconds to each depot, access 300 included: SF to SF-1 or SF-2 300; SJ to SJ-1 300; EB to EB-1 300.
  // PEN has no depot: SF-1 and SF-2 via H1 1500 + 300 = 1800; SJ-1 via H4 1800 + 300 = 2100; EB-1 via H5 2400 + 300 = 2700.
  // So SF and PEN each share {SF-1, SF-2} by vehicle number: index i takes SF-1 when i is even, SF-2 when odd.
  test("the free-flow nearest sets", () => {
    assert.deepEqual(homeDepotSets(defaultScenario()), { SF: ["SF-1", "SF-2"], PEN: ["SF-1", "SF-2"], SJ: ["SJ-1"], EB: ["EB-1"] });
  });

  const runWith = (sf, pen) => {
    let s = defaultScenario();
    s = applyAxis(applyAxis(s, "parameter:SUP-1.SF", sf), "parameter:SUP-1.PEN", pen);
    const w = buildWorld(s, { seed: 1001 });
    const run = createRun(s, w, { seed: 1001, keepLogs: false });
    run.step(1); // cars exist from creation; one event is enough
    while (!run.step(100000));
    return run.result();
  };

  test("defaults give SF-017 SF-1 (index 16, even)", () => {
    const r = runWith(30, 18);
    assert.equal(homeOf(r, "SF-017"), "SF-1");
    assert.equal(homeOf(r, "SF-002"), "SF-2");
    assert.equal(homeOf(r, "SJ-024"), "SJ-1");
    assert.equal(homeOf(r, "EB-001"), "EB-1");
  });

  test("the counter is per home area", () => {
    // SF 30 and PEN 19: SF-001 is SF index 0, so SF-1. SF 31 and PEN 18: PEN-001 is PEN index 0 (SF-1), PEN-018 index 17 (SF-2).
    assert.equal(homeOf(runWith(30, 19), "SF-001"), "SF-1");
    const r = runWith(31, 18);
    assert.equal(homeOf(r, "PEN-001"), "SF-1");
    assert.equal(homeOf(r, "PEN-018"), "SF-2");
  });
});

describe("seeded defects are each caught by their own named check (design 9.5)", () => {
  const expected = { double_assign: "2", bay_overfill: "5", lot_overfill: "P13", teleport: "P14", illegal_transition: "9" };
  const s = scaled();
  const w = buildWorld(s, { seed: 1001 });

  test("a clean run of the reference preset has no violation", () => {
    const r = runToEnd(s, w, { seed: 1001, keepLogs: false });
    assert.deepEqual(r.invariant_violations, []);
    assert.deepEqual(checkRun(r), []);
  });

  for (const defect of DEFECTS) {
    test(`${defect} is caught by check ${expected[defect]}`, () => {
      const r = runToEnd(s, w, { seed: 1001, defect, keepLogs: false });
      assert.ok(r.invariant_violations.length > 0, `${defect} produced no violation`);
      const ids = new Set(r.invariant_violations.map((v) => v.slice(0, v.indexOf(":"))));
      assert.deepEqual([...ids], [expected[defect]], r.invariant_violations.slice(0, 3).join(" | "));
    });
  }
});

describe("run structure on the reference preset", () => {
  const s = scaled(150);
  const w = buildWorld(s, { seed: 1002 });
  const whole = runToEnd(s, w, { seed: 1002 });

  test("stepping in slices of any size gives the identical result", () => {
    for (const size of [1, 13, 997]) {
      const run = createRun(s, w, { seed: 1002 });
      let slices = 0;
      while (!run.step(size)) slices += 1;
      assert.ok(slices > 0);
      assert.equal(run.step(size), true, "a finished run stays finished");
      assert.equal(digestOf(run.result()), digestOf(whole), `slice size ${size}`);
    }
  });

  test("log ordinals count from 0 by 1 and times never decrease", () => {
    whole.events.forEach((e, i) => {
      assert.equal(e.ord, i);
      if (i > 0) assert.ok(e.t >= whole.events[i - 1].t);
    });
    assert.equal(whole.counters.log_entries, whole.events.length);
  });

  test("the drain end is the last terminal second, or the window end, and nothing is logged after it", () => {
    const terminal = whole.requests.map((r) => (r.state === "COMPLETED" ? r.dropoff_s : r.unserved_s));
    assert.ok(whole.requests.every((r) => r.state === "COMPLETED" || r.state === "UNSERVED"));
    assert.equal(whole.drain_end_s, Math.max(s.window.end_s, ...terminal));
    assert.ok(whole.events.every((e) => e.t <= whole.drain_end_s));
    const censored = whole.events.filter((e) => e.kind === "VISIT_CENSORED").map((e) => e.car);
    assert.deepEqual(censored, whole.visits.filter((v) => v.censored).map((v) => v.car).sort());
  });

  test("every car's intervals are contiguous from the window start to the drain end", () => {
    for (const [id, list] of Object.entries(whole.intervals)) {
      assert.equal(list[0].t0, s.window.start_s, id);
      assert.equal(list.at(-1).t1, whole.drain_end_s, id);
      for (let i = 1; i < list.length; i += 1) assert.equal(list[i].t0, list[i - 1].t1, `${id} interval ${i}`);
    }
  });

  test("snapshots every 300 s from the window start to the drain end", () => {
    // 18,000 + 300 k <= drain end, so floor((drain end - 18,000) / 300) + 1 snapshots.
    const count = Math.floor((whole.drain_end_s - s.window.start_s) / SNAPSHOT_STEP_S) + 1;
    assert.equal(whole.snapshots.length, count);
    whole.snapshots.forEach((snap, k) => {
      assert.equal(snap.t, s.window.start_s + SNAPSHOT_STEP_S * k);
      assert.equal(snap.cars.length, 150);
      for (const d of snap.depots) assert.ok(d.stalls_held <= s.depots.find((x) => x.id === d.id).parking);
    });
  });

  test("keepLogs false drops the event list and snapshots and nothing else", () => {
    const lean = runToEnd(s, w, { seed: 1002, keepLogs: false });
    assert.deepEqual([lean.events.length, lean.snapshots.length], [0, 0]);
    const strip = (r) => JSON.stringify([r.intervals, r.visits, r.requests, r.depots, r.drain_end_s]);
    assert.equal(strip(lean), strip(whole));
  });

  test("the world is read only: a second run on the same world is identical", () => {
    assert.equal(digestOf(runToEnd(s, w, { seed: 1002 })), digestOf(whole));
    assert.equal(whole.world_digest.length, 64);
  });

  test("a seed that differs from the world's is refused", () => {
    assert.throws(() => createRun(s, w, { seed: 1001 }), RangeError);
  });
});

describe("bucketed dispatch equals the brute-force ranking (design 5.9)", () => {
  // Every car at one location shares its planned arrival, so the minimum of (arrival, first id) over locations equals
  // the minimum of (arrival, id) over every car. Checked on 300 pseudo-random layouts and departure seconds.
  const scenario = defaultScenario();
  const places = [{ area: "SF" }, { area: "PEN" }, { area: "SJ" }, { area: "EB" }, { depot: "SF-1" }, { depot: "SF-2" }, { depot: "SJ-1" }, { depot: "EB-1" }];
  let state = 12345;
  const next = (n) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % n;
  };
  const plan = (from, to, t, purpose) => planPath(scenario, from, to, t, purpose).arrive_s;

  test("300 layouts", () => {
    for (let c = 0; c < 300; c += 1) {
      const t = 18000 + next(100000);
      const riderArea = places[next(4)].area;
      const cars = [];
      const count = 1 + next(12);
      for (let i = 0; i < count; i += 1) cars.push({ id: `${["SF", "PEN", "SJ", "EB"][next(4)]}-${String(1 + next(40)).padStart(3, "0")}`, at: places[next(8)] });
      const unique = [...new Map(cars.map((x) => [x.id, x])).values()];
      const brute = unique
        .map((x) => ({ car: x.id, arrive_s: plan(x.at, { area: riderArea }, t, "PICKUP") }))
        .sort((a, b) => a.arrive_s - b.arrive_s || (a.car < b.car ? -1 : 1))[0];
      const byPlace = new Map();
      for (const x of unique) {
        const key = JSON.stringify(x.at);
        if (!byPlace.has(key) || x.id < byPlace.get(key).firstCar) byPlace.set(key, { location: x.at, firstCar: x.id });
      }
      const got = nearestIdle({ t, riderArea, locations: [...byPlace.values()], plan });
      assert.deepEqual([got.car, got.arrive_s], [brute.car, brute.arrive_s], `layout ${c}`);
    }
  });

  test("a tie in planned arrival across two locations goes to the lower vehicle id, in either location order", () => {
    // Rider in SF at 36,000 (hour 10, every multiplier 1000). From a depot in SF to the SF centre: PULL_OUT 120, ACCESS
    // OUT 300, IN_AREA SF 360, so SF-1 and SF-2 both plan 36,000 + 780 = 36,780. SF-002 is first at SF-1 and SF-001 at
    // SF-2, so only the vehicle-id tie-break (design 5.5, contract 6.4) picks SF-001, whichever location is listed first.
    const atSf1 = { location: { depot: "SF-1" }, firstCar: "SF-002" };
    const atSf2 = { location: { depot: "SF-2" }, firstCar: "SF-001" };
    assert.equal(plan({ depot: "SF-1" }, { area: "SF" }, 36000, "PICKUP"), 36780);
    assert.equal(plan({ depot: "SF-2" }, { area: "SF" }, 36000, "PICKUP"), 36780);
    for (const locations of [[atSf1, atSf2], [atSf2, atSf1]]) {
      assert.deepEqual(nearestIdle({ t: 36000, riderArea: "SF", locations, plan }), { car: "SF-001", location: { depot: "SF-2" }, arrive_s: 36780 });
    }
  });

  test("depot assignment falls back when capacity or a service bay is missing", () => {
    // From the SF centre at 36,000 (hour 10, every multiplier 1000): SF-1 and SF-2 300, EB-1 1500, SJ-1 3600.
    const depots = [
      { id: "EB-1", area: "EB", parking: 30, stalls_held: 0, inbound: 0, service_bays: 1 },
      { id: "SF-1", area: "SF", parking: 60, stalls_held: 59, inbound: 1, service_bays: 2 },
      { id: "SF-2", area: "SF", parking: 30, stalls_held: 30, inbound: 0, service_bays: 0 },
      { id: "SJ-1", area: "SJ", parking: 30, stalls_held: 0, inbound: 0, service_bays: 1 },
    ];
    const view = (serviceDue, homeDepot = "SF-2") => ({ t: 36000, from: { area: "SF" }, homeDepot, serviceDue, depots, plan });
    assert.deepEqual(assignDepot(view(false), "home_depot"), { depot: "SF-2", cause: "home_depot" });
    assert.deepEqual(assignDepot(view(true), "home_depot"), { depot: "SF-1", cause: "home_depot_without_service_bay_nearest_depot" });
    assert.deepEqual(assignDepot(view(false), "nearest_depot"), { depot: "SF-1", cause: "nearest_depot" });
    // SF-1 has 60 - 59 - 1 = 0 room and SF-2 30 - 30 = 0, so the nearest with room is EB-1 (1500 against SJ-1 3600).
    assert.deepEqual(assignDepot(view(false), "nearest_depot_with_capacity"), { depot: "EB-1", cause: "nearest_depot_with_capacity" });
    const full = depots.map((d) => ({ ...d, stalls_held: d.parking }));
    assert.deepEqual(assignDepot({ ...view(false), depots: full }, "nearest_depot_with_capacity"), { depot: "SF-1", cause: "no_depot_with_capacity_nearest_depot" });

    // Service due. The suffix _service_bays_only appears only when skipping SF-2 (no service bay) changed the depot.
    // nearest_depot: SF-1 wins with or without SF-2 (tie at 300, SF-1 by id): no suffix.
    assert.deepEqual(assignDepot(view(true), "nearest_depot"), { depot: "SF-1", cause: "nearest_depot" });
    // SF-1 without service bays and SF-2 with them: SF-2 among depots with a service bay, SF-1 over every depot.
    const swapped = depots.map((d) => (d.id === "SF-1" ? { ...d, service_bays: 0 } : d.id === "SF-2" ? { ...d, service_bays: 2 } : d));
    assert.deepEqual(assignDepot({ ...view(true), depots: swapped }, "nearest_depot"), { depot: "SF-2", cause: "nearest_depot_service_bays_only" });
    // SF-2 empty (30 - 0 - 0 = 30 room) but without a service bay: EB-1 is the nearest roomy depot with one (1500).
    const roomySf2 = depots.map((d) => (d.id === "SF-2" ? { ...d, stalls_held: 0 } : d));
    assert.deepEqual(assignDepot({ ...view(true), depots: roomySf2 }, "nearest_depot_with_capacity"), { depot: "EB-1", cause: "nearest_depot_with_capacity_service_bays_only" });
    assert.deepEqual(assignDepot({ ...view(false), depots: roomySf2 }, "nearest_depot_with_capacity"), { depot: "SF-2", cause: "nearest_depot_with_capacity" });
    // Every depot with a service bay full, SF-2 empty: the fallback goes to SF-1, which SF-2's room would have beaten.
    const onlySf2Roomy = full.map((d) => (d.id === "SF-2" ? { ...d, stalls_held: 0 } : d));
    assert.deepEqual(assignDepot({ ...view(true), depots: onlySf2Roomy }, "nearest_depot_with_capacity"), { depot: "SF-1", cause: "no_depot_with_capacity_nearest_depot_service_bays_only" });
  });

  test("diversion picks the nearest free stall and says when it skipped a depot without a service bay", () => {
    // From SF-1 at 36,000 (every multiplier 1000): SF-2 by access out and in 600; EB-1 300 + H3 1200 + 300 = 1800;
    // SJ-1 300 + H2 3300 + 300 = 3900. SF-2 has free stalls and no service bay.
    const depots = [
      { id: "EB-1", area: "EB", parking: 30, stalls_held: 0, inbound: 0, service_bays: 1 },
      { id: "SF-1", area: "SF", parking: 60, stalls_held: 60, inbound: 0, service_bays: 2 },
      { id: "SF-2", area: "SF", parking: 30, stalls_held: 0, inbound: 0, service_bays: 0 },
      { id: "SJ-1", area: "SJ", parking: 30, stalls_held: 0, inbound: 0, service_bays: 1 },
    ];
    const view = (serviceDue, list = depots) => ({ t: 36000, from: { depot: "SF-1" }, serviceDue, depots: list, plan });
    assert.deepEqual(divertDepot(view(false)), { depot: "SF-2", cause: "nearest_free_stall" });
    assert.deepEqual(divertDepot(view(true)), { depot: "EB-1", cause: "nearest_free_stall_service_bays_only" });
    assert.equal(divertDepot(view(true, depots.map((d) => (d.service_bays > 0 ? { ...d, stalls_held: d.parking } : d)))), null);
  });
});

/** Rounds n / d half to even (BigInt, n >= 0). */
function halfEven(n, d) {
  const q = n / d;
  const r = n % d;
  return 2n * r > d || (2n * r === d && q % 2n === 1n) ? q + 1n : q;
}

describe("every realized segment at σ 0.15 recomputed independently (contract 6.4 Legs, design 5.2.1)", () => {
  // Each segment departs at the realized end of the one before; its planned seconds and route choice are taken at that
  // second; its traffic factor is MULT_TABLE_150[u16(seed, "traffic", key, dir, floor(depart / 900))]; pickup and trip
  // legs also take MULT_TABLE_150[u16(seed, "ride", request)], depot and release legs never do; pull-out is fixed.
  // Keyed draws come from node:crypto here, and planned seconds from a BigInt copy of contract 6.3's integration.
  const scenario = defaultScenario();
  scenario.sigma_permille = 150;
  const seed = 1001;
  const result = runToEnd(scenario, buildWorld(scenario, { seed }), { seed, keepLogs: false });
  const table = multiplierTable(150);
  const u16 = (...parts) => Number(createHash("sha256").update(parts.map(String).join("|")).digest().readBigUInt64BE(0) >> 48n);
  const planned = (freeFlow, row, depart) => {
    let remaining = BigInt(freeFlow) * 1000000n;
    let at = BigInt(depart);
    let elapsed = 0n;
    for (;;) {
      const hour = at / 3600n;
      const m = BigInt(row[hour > 47n ? 47 : Number(hour)]);
      const toHourEnd = (hour + 1n) * 3600n - at;
      const covered = (toHourEnd * 1000000000n) / m;
      if (remaining <= covered) return elapsed + halfEven(remaining * m, 1000000000n);
      remaining -= covered;
      elapsed += toHourEnd;
      at += toHourEnd;
    }
  };

  test("chain, route choice, planned seconds, traffic quarter and ride factor", () => {
    const tally = { segments: 0, laterQuarter: 0, riderLegs: 0, emptyLegs: 0 };
    for (const [carId, list] of Object.entries(result.intervals)) {
      for (const iv of list) {
        if (!iv.segments) continue;
        const rider = iv.state === "ENROUTE_PICKUP" || iv.state === "ON_TRIP";
        const ride = rider ? BigInt(table[u16(seed, "ride", iv.request)]) : 1000000n;
        if (rider) tally.riderLegs += 1;
        else tally.emptyLegs += 1;
        let cur = iv.t0;
        iv.segments.forEach((g, k) => {
          const where = `${carId} ${iv.state} at ${iv.t0} segment ${k}`;
          assert.equal(g.t0, cur, `${where} departs at the end of the one before`);
          cur = g.t1;
          tally.segments += 1;
          const cut = iv.censored === true && k === iv.segments.length - 1;
          if (g.kind === "PULL_OUT") {
            if (!cut) assert.equal(g.t1 - g.t0, scenario.pull_out_s, where);
            return;
          }
          let plan;
          if (g.kind === "ROUTE") {
            const [from, to] = g.dir.split(">");
            const pair = scenario.routes.filter((r) => (r.a === from && r.b === to) || (r.a === to && r.b === from));
            const hw = pair.find((r) => r.cls === "HIGHWAY");
            const lo = pair.find((r) => r.cls === "LOCAL");
            const hwS = planned(hw.free_flow_s, scenario.congestion.HIGHWAY[g.dir], g.t0);
            const loS = planned(lo.free_flow_s, scenario.congestion.LOCAL[g.dir], g.t0);
            assert.equal(g.key, loS < hwS ? lo.id : hw.id, `${where} route choice`);
            plan = loS < hwS ? loS : hwS;
          } else if (g.kind === "IN_AREA") {
            assert.equal(g.dir, "-", where);
            plan = planned(scenario.areas.find((a) => `IN-${a.id}` === g.key).in_area_s, scenario.congestion.IN_AREA, g.t0);
          } else {
            assert.equal(g.kind, "ACCESS", where);
            plan = planned(scenario.depot_access_s, scenario.congestion.IN_AREA, g.t0);
          }
          if (Math.floor(g.t0 / 900) !== Math.floor(iv.t0 / 900)) tally.laterQuarter += 1;
          const traffic = BigInt(table[u16(seed, "traffic", g.key, g.dir, Math.floor(g.t0 / 900))]);
          if (!cut) assert.equal(g.t1 - g.t0, Number(halfEven(plan * traffic * ride, 1000000000000n)), `${where} realized seconds`);
        });
      }
    }
    // The run exercises every rule: many segments, segments departing in a later quarter hour than their leg, and both
    // rider legs and empty legs.
    assert.ok(tally.segments > 1000 && tally.laterQuarter > 100 && tally.riderLegs > 500 && tally.emptyLegs > 50, JSON.stringify(tally));
  });
});

describe("event times stay inside the heap's range (MAX_EVENT_TIME_S)", () => {
  // Schema maxima: window end 172,800 (a 36-hour window from 43,200), patience 3600, pull-out and intake 600, service
  // 14,400, routes 14,400 s, in-area 1800 s, every congestion row 3000, σ 0.5. Depot access is fixed at 300.
  // Planned seconds at multiplier 3000 are at most 3 × free flow + 1 (each hour floors its covered micro-units, and the
  // last step rounds half to even). A realized segment is round_half_even(planned × traffic × ride / 10^12) with both
  // factors at most the table's top entry. A push happens at an event second t <= T_d and adds one leg, intake, clean or
  // service; T_d is at most the last drop-off: an assignment by (end_s - 1) + patience, then a pickup leg (pull-out,
  // access out, route) and a trip leg (a route), both with the ride factor.
  const s = defaultScenario();
  s.window = { start_s: 43200, end_s: 172800 };
  s.warmup_end_s = 43200;
  s.placement_snapshot_s = 43200;
  s.policies.recall_s = 100000;
  s.policies.release_s = 120000;
  for (const route of s.routes) route.free_flow_s = 14400;
  for (const area of s.areas) area.in_area_s = 1800;
  for (const cls of ["HIGHWAY", "LOCAL"]) for (const key of Object.keys(s.congestion[cls])) s.congestion[cls][key].fill(3000);
  s.congestion.IN_AREA.fill(3000);
  Object.assign(s, { sigma_permille: 500, patience_s: 3600, pull_out_s: 600, intake_s: 600, service_s: 14400, clean_s: 3600 });

  test("the worst chain at the schema maxima fits, and the former 2^21 range did not", () => {
    assert.deepEqual(validateScenario(s).errors, []);
    for (let t = 43200; t < 172800; t += 900) {
      assert.ok(plannedLegSeconds(s, { kind: "ROUTE", route_id: "L2", from: "SF", to: "SJ" }, t) <= 43201, `route at ${t}`);
      assert.ok(plannedLegSeconds(s, { kind: "ACCESS", depot: "SF-1", dir: "OUT" }, t) <= 901, `access at ${t}`);
    }
    const top = BigInt(multiplierTable(500).reduce((m, v) => (v > m ? v : m), 0));
    const realized = (plannedS, withRide) => Number(halfEven(BigInt(plannedS) * top * (withRide ? top : 1000000n), 1000000000000n));
    const pickup = 600 + realized(901, true) + realized(43201, true);
    const trip = realized(43201, true);
    const lastPush = Math.max(600 + 2 * realized(901, false) + realized(43201, false), 600, 3600, 14400);
    const chain = 172799 + 3600 + pickup + trip + lastPush;
    assert.ok(chain <= MAX_EVENT_TIME_S, `worst chain ${chain} against ${MAX_EVENT_TIME_S}`);
    assert.ok(realized(43200, true) > 2097151, "one trip segment at the top pair already passed 2^21 - 1");
    // (t × 8 + class) × 2^27 + seq stays an exact double up to the range.
    assert.ok((MAX_EVENT_TIME_S * 8 + 7) * 134217728 + 134217727 <= Number.MAX_SAFE_INTEGER);
  });

  test("a run at the schema maxima reaches its drain end", () => {
    const r = runToEnd(s, buildWorld(s, { seed: 1001 }), { seed: 1001, keepLogs: false });
    assert.deepEqual(r.invariant_violations, []);
    assert.ok(r.drain_end_s > s.window.end_s && r.drain_end_s <= MAX_EVENT_TIME_S, `drain end ${r.drain_end_s}`);
  });
});

/**
 * The longest time any depot's series stays unchanged while every stall is held and no car is ready there:
 * `{s, depot, row}`. With no fixture holds, such a state changes within the longest intake, clean or service: an intake
 * or task in progress ends, and otherwise every stall holder is queued for a task whose bays are free (the freed-bay
 * rule) or all hold blocked cars (the hand-off).
 */
function longestFullLot(result) {
  let worst = { s: 0, depot: null, row: null };
  for (const d of result.depots) {
    const rows = d.series;
    for (let i = 0; i < rows.length;) {
      let j = i + 1;
      while (j < rows.length && rows[j].every((v, k) => k === 0 || v === rows[i][k])) j += 1;
      const span = (j < rows.length ? rows[j][0] : result.drain_end_s) - rows[i][0];
      if (rows[i][1] === d.parking && rows[i][7] === 0 && span > worst.s) worst = { s: span, depot: d.id, row: rows[i] };
      i = j;
    }
  }
  return worst;
}

describe("no depot locks up with a full lot and no ready car (design 3.3)", () => {
  const bound = (s) => Math.max(s.intake_s, s.clean_s, s.service_s);

  test("UC-10 on its 20 seeds, both arms on one shared envelope", () => {
    // Before the hand-off, SJ-1 (30 stalls, 1 cleaning bay) in the baseline arm froze for good in 8 of the 20 seeds,
    // for example seed 1001 from 98,869 to T_d 129,676 with 30 held, 30 queued, 1 blocked and 0 ready.
    const p = presetById("UC-10");
    const { id, baseline, candidate } = p.experiment.axis;
    const arms = [applyAxis(p.scenario, id, baseline), applyAxis(p.scenario, id, candidate)];
    const lambdaMaxPermille = sharedLambdaMaxPermille(arms);
    for (const [a, scenario] of arms.entries()) {
      for (const seed of p.experiment.seeds) {
        const r = runToEnd(scenario, buildWorld(scenario, { seed, lambdaMaxPermille }), { seed, keepLogs: false });
        const worst = longestFullLot(r);
        assert.ok(worst.s <= bound(scenario), `arm ${a} seed ${seed}: ${worst.depot} unchanged for ${worst.s} s at ${JSON.stringify(worst.row)}`);
        assert.deepEqual(runViolations(r), [], `arm ${a} seed ${seed}`);
      }
    }
  });

  test("every depot at 5 stalls, 1 cleaning bay and 1 service bay", () => {
    // Before the hand-off every depot froze by 45,958 and the last car became ready anywhere at 34,624.
    const s = defaultScenario();
    for (const d of s.depots) Object.assign(d, { parking: 5, cleaning_bays: 1, service_bays: 1 });
    assert.deepEqual(validateScenario(s).errors, []);
    for (const seed of [1001, 1002]) {
      const r = runToEnd(s, buildWorld(s, { seed }), { seed, keepLogs: false });
      const worst = longestFullLot(r);
      assert.ok(worst.s <= bound(s), `seed ${seed}: ${worst.depot} unchanged for ${worst.s} s at ${JSON.stringify(worst.row)}`);
      assert.deepEqual(runViolations(r), [], `seed ${seed}`);
      const lastReady = Math.max(...r.visits.map((v) => v.ready_s ?? 0));
      assert.ok(lastReady > s.policies.release_s, `seed ${seed}: cars still become ready after the release (last ${lastReady})`);
    }
  });
});

describe("wall-clock budget of design 5.9 (FLEET_PLAYGROUND_PERF=1)", { skip: PERF ? false : "set FLEET_PLAYGROUND_PERF=1" }, () => {
  test("one 150-car, 29-hour run with logs stays within 500 ms", () => {
    const s = scaled(150);
    const w = buildWorld(s, { seed: 1003 });
    const t0 = performance.now();
    runToEnd(s, w, { seed: 1003 });
    const ms = performance.now() - t0;
    assert.ok(ms <= 500, `${ms.toFixed(1)} ms`);
  });
});
