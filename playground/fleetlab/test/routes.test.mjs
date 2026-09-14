// Hand-derived route and planned-time vectors (contract 6.3, design 5.2.1).
//
// Every expected number below is derived by hand in the comments, never copied from a run.
//
// The integration rule (contract 6.3): remaining free-flow in micro-units R = free_flow_s x 10^6. Inside hour h
// with multiplier m (per-mille) and S whole seconds to the end of that hour, covered = floor(S x 10^9 / m). If
// R <= covered, the time spent in that hour is roundHalfEvenDiv(R x m, 10^9) and the segment ends; otherwise
// R -= covered, S seconds are added and the car moves to the next hour. Hours past 47 use hour 47's multiplier.
//
// Hour index h = floor(t / 3600). Useful clock seconds: D1 07:00 = 25,200; D1 08:00 = 28,800; D1 09:00 = 32,400;
// D1 10:00 = 36,000; D1 16:00 = 57,600; D1 17:00 = 61,200; D1 18:00 = 64,800; D1 19:00 = 68,400;
// D1 20:00 = 72,000; D2 00:00 = 86,400.
//
// Default congestion (contract 6.2): HIGHWAY with SF, hours 7-8 toward SF 1600 and away 1200, hours 16-18 away
// from SF 1600 and toward SF 1200, hour 19 1300; LOCAL and IN_AREA 1300 in hours 7, 8, 16, 17, 18; otherwise 1000.
// The design 3.5 traffic ("Evening depot visit in San Jose") sets every highway direction to 1600 in hours 16-18
// and 1300 in hour 19, and keeps LOCAL and IN_AREA at 1300 in hours 16-18.
//
// Return shapes this file relies on, where contract 6.3 is silent (reported to the engine author):
// - plannedLegSeconds returns a safe integer of seconds.
// - chooseRoute returns the chosen route, read here as a string id, or an object with `id` or `route_id`.
// - pathSegments(from, to, purpose) returns an array of segment objects of contract 6.3 shapes; a route segment
//   before its choice carries `from` and `to` (its `route_id` may be absent).
// - planPath returns `{arrive_s, segments}` where each segment carries its kind fields plus `depart_s` and
//   `planned_s`, and a ROUTE segment carries the chosen `route_id`.
// - purpose strings passed to pathSegments: "PICKUP", "TRIP", "TO_DEPOT", "DIVERSION", "RELEASE".

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { chooseRoute, pathSegments, planPath, plannedLegSeconds } from "../src/model/routes.js";
import { applyAxis, defaultScenario, validateScenario } from "../src/model/schema.js";

/** The design 3.5 traffic, built with the axis grammar exactly as the UC-07 preset does. */
function workedExampleScenario() {
  let s = defaultScenario();
  s = applyAxis(s, "parameter:RD-3.highway.evening", 1600);
  s = applyAxis(s, "parameter:RD-3.highway.late", 1300);
  s = applyAxis(s, "parameter:RD-3.local.evening", 1300);
  s = applyAxis(s, "parameter:RD-3.in_area.evening", 1300);
  return s;
}

/**
 * The scenario is valid with no errors. validateScenario returns {ok, errors, warnings} (schema.js always adds the two
 * arrays), so a strict deepEqual against {ok: true} fails on a valid scenario; ok and errors are checked instead.
 */
function assertValid(s) {
  const verdict = validateScenario(s);
  assert.deepEqual({ ok: verdict.ok, errors: verdict.errors }, { ok: true, errors: [] });
}

/** Sets one congestion row's hour of day on both days, then checks the scenario stays valid. */
function withHours(scenario, cls, dirKey, hoursOfDay, permille) {
  const s = structuredClone(scenario);
  const row = cls === "IN_AREA" ? s.congestion.IN_AREA : s.congestion[cls][dirKey];
  for (const h of hoursOfDay) {
    row[h] = permille;
    row[h + 24] = permille;
  }
  assertValid(s);
  return s;
}

const routeIdOf = (chosen) => (typeof chosen === "string" ? chosen : chosen?.id ?? chosen?.route_id);
const route = (route_id, from, to) => ({ kind: "ROUTE", route_id, from, to });
const access = (depot, dir) => ({ kind: "ACCESS", depot, dir });
const inArea = (area) => ({ kind: "IN_AREA", area });
const PULL_OUT = { kind: "PULL_OUT" };

/** A readable form of a segment for comparing kinds without depending on extra fields. */
function segmentText(seg) {
  if (seg.kind === "ACCESS") return `ACCESS ${seg.dir} ${seg.depot}`;
  if (seg.kind === "IN_AREA") return `IN_AREA ${seg.area}`;
  if (seg.kind === "ROUTE") return `ROUTE ${seg.from}>${seg.to}`;
  return seg.kind;
}

describe("the scenario these vectors assume", () => {
  test("route free-flow seconds and default congestion cells match design 2.9 and contract 6.2", () => {
    const s = defaultScenario();
    const ff = Object.fromEntries(s.routes.map((r) => [r.id, r.free_flow_s]));
    // 25, 55, 20, 30, 40, 50 minutes of highway and 55, 110, 45, 70, 80, 95 minutes of local, times 60.
    assert.deepEqual(ff, {
      H1: 1500, L1: 3300, H2: 3300, L2: 6600, H3: 1200, L3: 2700,
      H4: 1800, L4: 4200, H5: 2400, L5: 4800, H6: 3000, L6: 5700,
    });
    assert.equal(s.congestion.HIGHWAY["SJ>SF"][18], 1200);
    assert.equal(s.congestion.HIGHWAY["SF>SJ"][18], 1600);
    assert.equal(s.congestion.HIGHWAY["SJ>SF"][19], 1300);
    assert.equal(s.congestion.LOCAL["SJ>SF"][18], 1300);
    assert.equal(s.congestion.IN_AREA[17], 1300);
    const w = workedExampleScenario();
    assert.equal(w.congestion.HIGHWAY["SJ>SF"][18], 1600);
    assert.equal(w.congestion.HIGHWAY["SJ>SF"][42], 1600);
    assert.equal(w.congestion.HIGHWAY["SJ>SF"][19], 1300);
    assert.equal(w.congestion.IN_AREA[19], 1000);
  });
});

describe("plannedLegSeconds", () => {
  test("H2 toward SF leaving D1 18:30 under the design 3.5 traffic takes 4628 s (contract check)", () => {
    // Depart 66,600 (hour 18, S = 68,400 - 66,600 = 1800), m = 1600.
    // R = 3300 x 10^6 = 3,300,000,000. covered = floor(1800 x 10^9 / 1600) = 1,125,000,000 < R.
    // R = 3,300,000,000 - 1,125,000,000 = 2,175,000,000; elapsed 1800.
    // Hour 19, m = 1300, S = 3600: covered = floor(3.6 x 10^12 / 1300) = 2,769,230,769 >= R.
    // Time in hour 19 = roundHalfEvenDiv(2,175,000,000 x 1300, 10^9) = 2,827,500,000,000 / 10^9 = 2827.5,
    // an exact half, to the even neighbour 2828. Total 1800 + 2828 = 4628 (Math.round would also give 2828).
    const s = workedExampleScenario();
    assert.equal(plannedLegSeconds(s, route("H2", "SJ", "SF"), 66600), 4628);
  });

  test("the same departure under the default profile: toward SF 4140 s, away from SF 4628 s", () => {
    // Toward SF, hour 18 m = 1200: covered = floor(1.8 x 10^12 / 1200) = 1,500,000,000; R = 1,800,000,000.
    // Hour 19 m = 1300: covered 2,769,230,769 >= R; time = 1,800,000,000 x 1300 / 10^9 = 2340 exactly.
    // Total 1800 + 2340 = 4140.
    // Away from SF, hour 18 m = 1600: identical to the worked example: 4628.
    const s = defaultScenario();
    assert.equal(plannedLegSeconds(s, route("H2", "SJ", "SF"), 66600), 4140);
    assert.equal(plannedLegSeconds(s, route("H2", "SF", "SJ"), 66600), 4628);
  });

  test("the B access leg into SJ-1 leaving 66,600 at 1300 takes 390 s", () => {
    // IN_AREA row, hour 18, m = 1300, S = 1800. R = 300 x 10^6.
    // covered = floor(1.8 x 10^12 / 1300) = 1,384,615,384 >= R; time = 300,000,000 x 1300 / 10^9 = 390.
    const s = workedExampleScenario();
    assert.equal(plannedLegSeconds(s, access("SJ-1", "IN"), 66600), 390);
    assert.equal(plannedLegSeconds(s, access("SJ-1", "OUT"), 66600), 390);
    // The A access leg into SF-1 departs 71,228 (hour 19, IN_AREA 1000 in this preset): 300 s.
    assert.equal(plannedLegSeconds(s, access("SF-1", "IN"), 71228), 300);
  });

  test("in-area legs use the IN_AREA row and pull-out takes no multiplier", () => {
    // SJ in-area 480 s at hour 18 (m 1300): covered = floor(3,048 x 10^9 / 1300) from 65,352 = 2,344,615,384
    // >= 480,000,000; time = 480 x 1.3 = 624.
    const s = workedExampleScenario();
    assert.equal(plannedLegSeconds(s, inArea("SJ"), 65352), 624);
    // SF in-area 360 s in hour 10 (m 1000): 360.
    assert.equal(plannedLegSeconds(s, inArea("SF"), 36000), 360);
    // Pull-out is pull_out_s = 120 in any hour, congested or not (hour 8 and hour 18).
    assert.equal(plannedLegSeconds(s, PULL_OUT, 29000), 120);
    assert.equal(plannedLegSeconds(s, PULL_OUT, 66600), 120);
  });

  test("integration across two hour boundaries: L2 SF>SJ leaving D1 17:30 takes 7846 s", () => {
    // Default LOCAL: 1300 in hours 17 and 18, 1000 in hour 19. Depart 63,000 (hour 17, S = 1800).
    // R = 6,600,000,000. Hour 17: covered = floor(1.8 x 10^12 / 1300) = 1,384,615,384; R = 5,215,384,616.
    // Hour 18 (S 3600): covered = floor(3.6 x 10^12 / 1300) = 2,769,230,769; R = 2,446,153,847.
    // Hour 19 (m 1000): covered 3,600,000,000 >= R; time = roundHalfEvenDiv(2,446,153,847,000, 10^9) = 2446
    // (2446.153847 rounds down). Total 1800 + 3600 + 2446 = 7846; arrival 70,846 is past 18:00 and 19:00.
    const s = defaultScenario();
    assert.equal(plannedLegSeconds(s, route("L2", "SF", "SJ"), 63000), 7846);
  });

  test("integration across three hour boundaries with a declared x3.0 local slowdown", () => {
    // LOCAL SF>SJ set to 3000 in hours 16 and 17 (both days); hour 18 stays 1300 and hour 19 1000.
    // Depart 60,000 (D1 16:40, hour 16, S = 61,200 - 60,000 = 1200). R = 6,600,000,000.
    // Hour 16: covered = floor(1.2 x 10^12 / 3000) = 400,000,000; R = 6,200,000,000.
    // Hour 17: covered = floor(3.6 x 10^12 / 3000) = 1,200,000,000; R = 5,000,000,000.
    // Hour 18: covered = 2,769,230,769; R = 2,230,769,231.
    // Hour 19 (m 1000): covered 3,600,000,000 >= R; time = 2230.769231 -> 2231.
    // Total 1200 + 3600 + 3600 + 2231 = 10,631; arrival 70,631 crosses 17:00, 18:00 and 19:00.
    const s = withHours(defaultScenario(), "LOCAL", "SF>SJ", [16, 17], 3000);
    assert.equal(plannedLegSeconds(s, route("L2", "SF", "SJ"), 60000), 10631);
  });

  test("an exact half rounds to the even neighbour below: H2 SF>SJ leaving 63,128 takes 5278 s", () => {
    // Default HIGHWAY SF>SJ: 1600 in hours 17 and 18, 1300 in hour 19. Depart 63,128 (hour 17, S = 1672).
    // R = 3,300,000,000. Hour 17: covered = floor(1672 x 10^9 / 1600) = 1,045,000,000; R = 2,255,000,000.
    // Hour 18: covered = floor(3.6 x 10^12 / 1600) = 2,250,000,000; R = 5,000,000.
    // Hour 19: covered 2,769,230,769 >= R; time = roundHalfEvenDiv(5,000,000 x 1300, 10^9) = 6.5 -> 6 (even).
    // Total 1672 + 3600 + 6 = 5278. Rounding half up would give 5279.
    const s = defaultScenario();
    assert.equal(plannedLegSeconds(s, route("H2", "SF", "SJ"), 63128), 5278);
  });

  test("hours past 47 use hour 47's multiplier", () => {
    // IN_AREA hour 47 (D2 23:00, 169,200 to 172,800) set to 2000 on day 2 only; hour 23 of day 1 stays 1000.
    // Depart 172,000: S = 800, covered = floor(800 x 10^9 / 2000) = 400,000,000 >= 360,000,000; time 720.
    // Depart 172,700: S = 100, covered = 50,000,000; R = 310,000,000; hour 48 reads hour 47 (2000):
    // time = 310,000,000 x 2000 / 10^9 = 620. Total 100 + 620 = 720.
    const s = structuredClone(defaultScenario());
    s.congestion.IN_AREA[47] = 2000;
    assertValid(s);
    assert.equal(plannedLegSeconds(s, inArea("SF"), 172000), 720);
    assert.equal(plannedLegSeconds(s, inArea("SF"), 172700), 720);
  });
});

describe("chooseRoute", () => {
  test("the highway wins a tie", () => {
    // HIGHWAY SF>PEN set to 2200 in hour 10. Depart 36,000 (S 3600).
    // H1: covered = floor(3.6 x 10^12 / 2200) = 1,636,363,636 >= 1,500,000,000; time = 1.5 x 10^9 x 2200 / 10^9 = 3300.
    // L1: LOCAL hour 10 is 1000; 3300 x 1 = 3300. Equal, so H1.
    const s = withHours(defaultScenario(), "HIGHWAY", "SF>PEN", [10], 2200);
    assert.equal(plannedLegSeconds(s, route("H1", "SF", "PEN"), 36000), 3300);
    assert.equal(plannedLegSeconds(s, route("L1", "SF", "PEN"), 36000), 3300);
    assert.equal(routeIdOf(chooseRoute(s, "SF", "PEN", 36000)), "H1");
  });

  test("the design 3.5 profile keeps the highway for H2 toward SF at D1 18:30", () => {
    // Worked-example traffic: H2 4628 (above). L2 SJ>SF: hour 18 m 1300 covered 1,384,615,384,
    // R = 5,215,384,616; hour 19 LOCAL 1000: 5215.384616 -> 5215. Total 7015 > 4628, so H2.
    const s = workedExampleScenario();
    assert.equal(plannedLegSeconds(s, route("L2", "SJ", "SF"), 66600), 7015);
    assert.equal(routeIdOf(chooseRoute(s, "SJ", "SF", 66600)), "H2");
  });

  test("LOCAL is chosen when the highway is congested enough", () => {
    // HIGHWAY PEN>SF set to 3000 in hours 7 and 8. Depart 25,200 (D1 07:00).
    // H1: hour 7 covered = 1,200,000,000; R = 300,000,000; hour 8 covered 1,200,000,000 >= R;
    //     time = 300,000,000 x 3000 / 10^9 = 900. Total 3600 + 900 = 4500.
    // L1 (LOCAL 1300 in hours 7 and 8): hour 7 covered 2,769,230,769; R = 530,769,231;
    //     hour 8: time = roundHalfEvenDiv(690,000,000,300, 10^9) = 690. Total 4290.
    // 4290 < 4500, so L1.
    const s = withHours(defaultScenario(), "HIGHWAY", "PEN>SF", [7, 8], 3000);
    assert.equal(plannedLegSeconds(s, route("H1", "PEN", "SF"), 25200), 4500);
    assert.equal(plannedLegSeconds(s, route("L1", "PEN", "SF"), 25200), 4290);
    assert.equal(routeIdOf(chooseRoute(s, "PEN", "SF", 25200)), "L1");
    // The unmodified default: H1 hour 7 toward SF 1600: 1500 x 1.6 = 2400 (covered 2,250,000,000 >= R), so H1.
    assert.equal(routeIdOf(chooseRoute(defaultScenario(), "PEN", "SF", 25200)), "H1");
  });
});

describe("pathSegments", () => {
  test("segment kinds for every location pair of contract 6.3", () => {
    const kinds = (from, to, purpose) => pathSegments(from, to, purpose).map(segmentText);
    assert.deepEqual(kinds({ area: "SF" }, { area: "SF" }, "PICKUP"), ["IN_AREA SF"]);
    assert.deepEqual(kinds({ area: "SF" }, { area: "PEN" }, "TRIP"), ["ROUTE SF>PEN"]);
    assert.deepEqual(kinds({ depot: "SF-1" }, { area: "SF" }, "PICKUP"), ["PULL_OUT", "ACCESS OUT SF-1", "IN_AREA SF"]);
    assert.deepEqual(kinds({ depot: "SF-1" }, { area: "PEN" }, "PICKUP"), ["PULL_OUT", "ACCESS OUT SF-1", "ROUTE SF>PEN"]);
    assert.deepEqual(kinds({ depot: "SJ-1" }, { area: "SF" }, "RELEASE"), ["PULL_OUT", "ACCESS OUT SJ-1", "ROUTE SJ>SF"]);
    assert.deepEqual(kinds({ area: "SJ" }, { depot: "SF-1" }, "TO_DEPOT"), ["ROUTE SJ>SF", "ACCESS IN SF-1"]);
    assert.deepEqual(kinds({ area: "SJ" }, { depot: "SJ-1" }, "TO_DEPOT"), ["ACCESS IN SJ-1"]);
    assert.deepEqual(kinds({ depot: "SF-1" }, { depot: "SF-2" }, "DIVERSION"), ["ACCESS OUT SF-1", "ACCESS IN SF-2"]);
  });
});

describe("planPath", () => {
  test("from a depot to a rider in the depot's area: pull-out, access out, in-area", () => {
    // Depart 36,000 (hour 10, every multiplier 1000): PULL_OUT 36,000 to 36,120; ACCESS OUT SF-1 300 s to 36,420;
    // IN_AREA SF 360 s to 36,780.
    const p = planPath(defaultScenario(), { depot: "SF-1" }, { area: "SF" }, 36000);
    assert.equal(p.arrive_s, 36780);
    assert.deepEqual(p.segments.map(segmentText), ["PULL_OUT", "ACCESS OUT SF-1", "IN_AREA SF"]);
    assert.deepEqual(p.segments.map((x) => [x.depart_s, x.planned_s]), [[36000, 120], [36120, 300], [36420, 360]]);
  });

  test("from a depot to another area in the evening: pull-out, congested access out, H1", () => {
    // Default profile, depart 61,200 (D1 17:00). PULL_OUT 120 to 61,320.
    // ACCESS OUT SF-1 at 61,320, IN_AREA hour 17 m 1300: S = 3480, covered >= R; 300 x 1.3 = 390; to 61,710.
    // Route chosen at 61,710 (hour 17, S = 3090):
    //   H1 SF>PEN, away from SF, 1600: covered = floor(3090 x 10^9 / 1600) = 1,931,250,000 >= 1.5 x 10^9;
    //     time = 1500 x 1.6 = 2400.
    //   L1 at 1300: covered = floor(3090 x 10^9 / 1300) = 2,376,923,076; R = 923,076,924; hour 18 (1300):
    //     roundHalfEvenDiv(1,200,000,001,200, 10^9) = 1200; total 3090 + 1200 = 4290.
    //   H1. Arrival 61,710 + 2400 = 64,110.
    const p = planPath(defaultScenario(), { depot: "SF-1" }, { area: "PEN" }, 61200);
    assert.equal(p.arrive_s, 64110);
    assert.deepEqual(p.segments.map(segmentText), ["PULL_OUT", "ACCESS OUT SF-1", "ROUTE SF>PEN"]);
    assert.deepEqual(p.segments.map((x) => [x.depart_s, x.planned_s]), [[61200, 120], [61320, 390], [61710, 2400]]);
    assert.equal(p.segments[2].route_id, "H1");
  });

  test("from an area to a depot in another area: route, then access in (worked example arm A)", () => {
    // H2 from 66,600: 4628 s to 71,228; ACCESS IN SF-1 at 71,228 (hour 19, IN_AREA 1000): 300 s to 71,528.
    const p = planPath(workedExampleScenario(), { area: "SJ" }, { depot: "SF-1" }, 66600);
    assert.equal(p.arrive_s, 71528);
    assert.deepEqual(p.segments.map(segmentText), ["ROUTE SJ>SF", "ACCESS IN SF-1"]);
    assert.deepEqual(p.segments.map((x) => [x.depart_s, x.planned_s]), [[66600, 4628], [71228, 300]]);
    assert.equal(p.segments[0].route_id, "H2");
  });

  test("depot to depot in one area: access out, access in", () => {
    // Depart 88,500 (hour 24, hour of day 0, m 1000): 300 + 300; arrival 89,100.
    const p = planPath(defaultScenario(), { depot: "SF-1" }, { depot: "SF-2" }, 88500);
    assert.equal(p.arrive_s, 89100);
    assert.deepEqual(p.segments.map((x) => [x.depart_s, x.planned_s]), [[88500, 300], [88800, 300]]);
  });

  test("the morning release path from SJ-1 at D2 05:45 in free flow (worked example arm B)", () => {
    // PULL_OUT 107,100 to 107,220; ACCESS OUT SJ-1 hour 29 (05:00, m 1000) 300 s to 107,520;
    // H2 SJ>SF at 107,520: hour 29 S = 480, covered 480,000,000; R = 2,820,000,000; hour 30 (06:00) m 1000:
    // time 2820; total 3300 (L2 6600). Arrival 110,820 (D2 06:47).
    const p = planPath(workedExampleScenario(), { depot: "SJ-1" }, { area: "SF" }, 107100);
    assert.equal(p.arrive_s, 110820);
    assert.deepEqual(p.segments.map((x) => [x.depart_s, x.planned_s]), [[107100, 120], [107220, 300], [107520, 3300]]);
    assert.equal(p.segments[2].route_id, "H2");
  });

  test("a route segment chooses its route at its own planned departure, not at the path's", () => {
    // Declared: HIGHWAY SF>PEN 3000 in hour 8; LOCAL SF>PEN 1000 in hour 8 (IN_AREA stays 1300 in hour 8).
    // For a departure with S seconds left in hour 8 (S < 3600): H1 = S + (1500 - S / 3) = 1500 + 2S/3 and
    // L1 = 3300, so the highway is slower only when S > 2700.
    // chooseRoute at 29,400 (S = 3000): H1: covered = floor(3000 x 10^9 / 3000) = 1,000,000,000; R = 500,000,000;
    //   hour 9 (m 1000): 500; total 3500 > 3300, so L1.
    // planPath from SF-1 at 29,400: PULL_OUT to 29,520; ACCESS OUT at 29,520 (IN_AREA 1300, S = 2880,
    //   covered = 2,215,384,615 >= R): 390 s to 29,910. Route at 29,910 (S = 2490): H1 covered 830,000,000;
    //   R = 670,000,000; hour 9: 670; total 2490 + 670 = 3160 < 3300, so H1. Arrival 29,910 + 3160 = 33,070.
    let s = withHours(defaultScenario(), "HIGHWAY", "SF>PEN", [8], 3000);
    s = withHours(s, "LOCAL", "SF>PEN", [8], 1000);
    assert.equal(routeIdOf(chooseRoute(s, "SF", "PEN", 29400)), "L1");
    assert.equal(routeIdOf(chooseRoute(s, "SF", "PEN", 29910)), "H1");
    const p = planPath(s, { depot: "SF-1" }, { area: "PEN" }, 29400);
    assert.equal(p.segments[2].route_id, "H1");
    assert.deepEqual(p.segments.map((x) => [x.depart_s, x.planned_s]), [[29400, 120], [29520, 390], [29910, 3160]]);
    assert.equal(p.arrive_s, 33070);
  });
});
