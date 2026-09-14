import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { canonicalJson } from "../src/core/canon.js";
import { DEFAULT_PRESET_ID, PRESETS, presetById } from "../src/model/presets.js";
import {
  AxisError,
  KNOBS,
  applyAxis,
  cloneScenario,
  defaultScenario,
  describeDifferences,
  parseAxis,
  validateScenario,
} from "../src/model/schema.js";

const LOWER = "lower_is_better";
const HIGHER = "higher_is_better";

// Every ordered pair, both directions of each design 2.9 pair in table order.
const DIRECTIONS = ["SF>PEN", "PEN>SF", "SF>SJ", "SJ>SF", "SF>EB", "EB>SF", "PEN>SJ", "SJ>PEN", "PEN>EB", "EB>PEN", "SJ>EB", "EB>SJ"];
const TOWARD_SF = ["PEN>SF", "SJ>SF", "EB>SF"];
const AWAY_FROM_SF = ["SF>PEN", "SF>SJ", "SF>EB"];
const WITHOUT_SF = ["PEN>SJ", "SJ>PEN", "PEN>EB", "EB>PEN", "SJ>EB", "EB>SJ"];

// Contract 6.2 default congestion by hour of day, written out as literal tables (hours not listed are 1000).
const HIGHWAY_TOWARD_SF = { 7: 1600, 8: 1600, 16: 1200, 17: 1200, 18: 1200, 19: 1300 };
const HIGHWAY_AWAY_FROM_SF = { 7: 1200, 8: 1200, 16: 1600, 17: 1600, 18: 1600, 19: 1300 };
const HIGHWAY_WITHOUT_SF = { 7: 1200, 8: 1200, 16: 1200, 17: 1200, 18: 1200, 19: 1300 };
const LOCAL_AND_IN_AREA = { 7: 1300, 8: 1300, 16: 1300, 17: 1300, 18: 1300 };

/** Expected 48-hour row from an hour-of-day table; both days repeat. */
const rowOf = (table) => Array.from({ length: 48 }, (_, h) => table[h % 24] ?? 1000);

describe("KNOBS", () => {
  const ids = KNOBS.map((k) => k.id);

  test("lists every knob of design 2.2 to 2.7 in design order with its first-build flag", () => {
    assert.deepEqual(ids, [
      "SUP-1", "SUP-2", "SUP-3",
      "DEP-1", "DEP-2", "DEP-3", "DEP-4", "DEP-5", "DEP-6", "DEP-7", "DEP-8", "DEP-9", "DEP-10", "DEP-11", "DEP-12", "DEP-13",
      "DEM-1", "DEM-2", "DEM-3", "DEM-4", "DEM-5", "DEM-6", "DEM-7",
      "RD-1", "RD-2", "RD-3", "RD-4", "RD-5", "RD-6",
      "POL-1", "POL-2", "POL-3", "POL-4", "POL-5", "POL-6",
      "RID-1", "RID-2",
      "CLK-1", "CLK-2", "CLK-3", "CLK-4",
    ]);
    const later = KNOBS.filter((k) => !k.firstBuild).map((k) => k.id);
    assert.deepEqual(later, ["SUP-3", "DEP-10", "DEP-11", "DEP-12", "DEP-13", "DEM-6", "DEM-7", "RD-6", "POL-6", "RID-2"]);
  });

  test("every knob carries the contract fields, and first-build knobs a unit, type and default", () => {
    for (const knob of KNOBS) {
      for (const key of ["id", "group", "label", "help", "unit", "engineUnit", "scale", "type", "range", "default", "firstBuild"]) {
        assert.ok(Object.hasOwn(knob, key), `${knob.id} lacks ${key}`);
      }
      assert.ok(knob.label.length > 0 && knob.help.length > 0, knob.id);
      if (knob.firstBuild) {
        assert.equal(typeof knob.unit, "string", knob.id);
        assert.equal(typeof knob.engineUnit, "string", knob.id);
        assert.notEqual(knob.type, "later", knob.id);
        if (knob.id !== "SUP-2") assert.notEqual(knob.default, null, knob.id);
      } else {
        assert.equal(knob.type, "later", knob.id);
      }
    }
    assert.ok(Object.isFrozen(KNOBS) && Object.isFrozen(KNOBS[0]) && Object.isFrozen(KNOBS[0].default));
  });

  test("defaults and ranges equal the design 2.2 to 2.7 tables, converted to engine units", () => {
    const byId = Object.fromEntries(KNOBS.map((k) => [k.id, k]));
    const check = (id, def, range) => {
      assert.deepEqual(byId[id].default, def, `${id} default`);
      if (range) assert.deepEqual(byId[id].range, range, `${id} range`);
    };
    check("SUP-1", { SF: 30, PEN: 18, SJ: 24, EB: 18 }, { min: 0, max: 200, total_min: 1, total_max: 500 }); // total 90
    check("DEP-1", { SF: ["SF-1", "SF-2"], PEN: [], SJ: ["SJ-1"], EB: ["EB-1"] }, { min: 0, max: 2, total_min: 1 });
    check("DEP-2", { "SF-1": 60, "SF-2": 30, "SJ-1": 30, "EB-1": 30 }, { min: 5, max: 150 });
    check("DEP-3", { "SF-1": 4, "SF-2": 2, "SJ-1": 3, "EB-1": 2 }, { min: 1, max: 12 });
    check("DEP-4", 1200, { min: 300, max: 3600 }); // 20 min (5 to 60 min) × 60
    check("DEP-5", { "SF-1": 2, "SF-2": 1, "SJ-1": 1, "EB-1": 1 }, { min: 0, max: 6 });
    check("DEP-6", 2700, { min: 600, max: 14400 }); // 45 min (10 to 240 min) × 60
    check("DEP-7", 10, { min: 1, max: 100 });
    check("DEP-8", 3, { min: 0, max: 10 });
    check("DEP-9", { intake_s: 180, pull_out_s: 120 }, { min: 60, max: 600 }); // 3 and 2 min (1 to 10 min)
    check("DEM-1", { SF: 60, PEN: 20, SJ: 35, EB: 30 }, { min: 1, max: 120 });
    check("DEM-2", { SF: 15, PEN: 8, SJ: 10, EB: 8 }, { min: 0, max: 120 });
    check("DEM-3", [{ start_h: 7, end_h: 9 }, { start_h: 16, end_h: 19 }]); // 07:00 to 09:00 and 16:00 to 19:00
    check("DEM-5", "peaked", { values: ["flat", "peaked"] });
    check("RD-1", { H1: 1500, L1: 3300, H2: 3300, L2: 6600, H3: 1200, L3: 2700, H4: 1800, L4: 4200, H5: 2400, L5: 4800, H6: 3000, L6: 5700 }, { min: 300, max: 14400 });
    check("RD-2", { SF: 360, PEN: 480, SJ: 480, EB: 420 }, { min: 60, max: 1800 }); // 6, 8, 8, 7 min (1 to 30 min)
    check("RD-4", 1300, { min: 1100, max: 2000 }); // ×1.3 (×1.1 to ×2.0)
    check("RD-5", 0, { min: 0, max: 500, step: 50 }); // σ 0 to 0.50 in steps of 0.05
    check("POL-1", "nearest_idle", { values: ["nearest_idle"] });
    check("POL-2", "home_depot", { values: ["home_depot", "nearest_depot", "nearest_depot_with_capacity"] });
    check("POL-3", 88200); // D2 00:30 = 86400 + 1800
    check("POL-4", 107100); // D2 05:45 = 86400 + 5 × 3600 + 45 × 60
    check("POL-5", "fifo", { values: ["fifo"] });
    check("RID-1", 600, { min: 60, max: 3600 }); // 10 min (1 to 60 min)
    check("CLK-1", { start_s: 18000, end_s: 122400 }, { start_min: 0, end_max: 172800, length_min: 14400, length_max: 129600 }); // D1 05:00, D2 10:00; 4 to 36 h
    check("CLK-2", 21600); // D1 06:00
    check("CLK-3", 3600, { values: [900, 1800, 3600] }); // 15, 30 or 60 min
    check("CLK-4", 108000); // D2 06:00
    assert.equal(byId["RD-3"].default.IN_AREA.length, 48);
    assert.deepEqual(byId["DEM-4"].default, defaultScenario().dest_weights);
  });
});

describe("defaultScenario", () => {
  test("equals the contract 6.2 object outside the congestion table and the destination mix", () => {
    const s = defaultScenario();
    const { congestion, dest_weights, ...rest } = s;
    assert.deepEqual(rest, {
      format: "playground-scenario", version: "0.1", name: "bay_teaching_map",
      window: { start_s: 18000, end_s: 122400 }, warmup_end_s: 21600, bucket_s: 3600, placement_snapshot_s: 108000,
      areas: [
        { id: "SF", cars: 30, in_area_s: 360, peak_per_h: 60, offpeak_per_h: 15 },
        { id: "PEN", cars: 18, in_area_s: 480, peak_per_h: 20, offpeak_per_h: 8 },
        { id: "SJ", cars: 24, in_area_s: 480, peak_per_h: 35, offpeak_per_h: 10 },
        { id: "EB", cars: 18, in_area_s: 420, peak_per_h: 30, offpeak_per_h: 8 },
      ],
      // Design 2.9 in minutes × 60: H1 25, L1 55; H2 55, L2 110; H3 20, L3 45; H4 30, L4 70; H5 40, L5 80; H6 50, L6 95.
      routes: [
        { id: "H1", a: "SF", b: "PEN", cls: "HIGHWAY", free_flow_s: 1500 },
        { id: "L1", a: "SF", b: "PEN", cls: "LOCAL", free_flow_s: 3300 },
        { id: "H2", a: "SF", b: "SJ", cls: "HIGHWAY", free_flow_s: 3300 },
        { id: "L2", a: "SF", b: "SJ", cls: "LOCAL", free_flow_s: 6600 },
        { id: "H3", a: "SF", b: "EB", cls: "HIGHWAY", free_flow_s: 1200 },
        { id: "L3", a: "SF", b: "EB", cls: "LOCAL", free_flow_s: 2700 },
        { id: "H4", a: "PEN", b: "SJ", cls: "HIGHWAY", free_flow_s: 1800 },
        { id: "L4", a: "PEN", b: "SJ", cls: "LOCAL", free_flow_s: 4200 },
        { id: "H5", a: "PEN", b: "EB", cls: "HIGHWAY", free_flow_s: 2400 },
        { id: "L5", a: "PEN", b: "EB", cls: "LOCAL", free_flow_s: 4800 },
        { id: "H6", a: "SJ", b: "EB", cls: "HIGHWAY", free_flow_s: 3000 },
        { id: "L6", a: "SJ", b: "EB", cls: "LOCAL", free_flow_s: 5700 },
      ],
      peaks: [{ start_h: 7, end_h: 9 }, { start_h: 16, end_h: 19 }],
      demand_shape: "peaked",
      congestion_threshold_permille: 1300, sigma_permille: 0,
      depots: [
        { id: "SF-1", area: "SF", parking: 60, cleaning_bays: 4, service_bays: 2 },
        { id: "SF-2", area: "SF", parking: 30, cleaning_bays: 2, service_bays: 1 },
        { id: "SJ-1", area: "SJ", parking: 30, cleaning_bays: 3, service_bays: 1 },
        { id: "EB-1", area: "EB", parking: 30, cleaning_bays: 2, service_bays: 1 },
      ],
      depot_access_s: 300, intake_s: 180, pull_out_s: 120, clean_s: 1200, service_s: 2700,
      trips_between_visits: 10, service_every_visits: 3,
      policies: { dispatch: "nearest_idle", depot_assignment: "home_depot", recall_s: 88200, release_s: 107100, queue_order: "fifo" },
      patience_s: 600,
    });
    assert.ok(congestion && dest_weights);
    assert.doesNotThrow(() => canonicalJson(s));
  });

  test("destination weights equal design 2.9, out of 100 per origin", () => {
    assert.deepEqual(defaultScenario().dest_weights, {
      // Morning: from SF, SF 70 and each other 10; from PEN, SJ or EB, SF 55, own 25, each remaining 10.
      morning: {
        SF: { SF: 70, PEN: 10, SJ: 10, EB: 10 },
        PEN: { SF: 55, PEN: 25, SJ: 10, EB: 10 },
        SJ: { SF: 55, PEN: 10, SJ: 25, EB: 10 },
        EB: { SF: 55, PEN: 10, SJ: 10, EB: 25 },
      },
      // Evening: from SF, SF 16 and each other 28; from PEN, SJ or EB, own 60, SF 10, each remaining 15.
      evening: {
        SF: { SF: 16, PEN: 28, SJ: 28, EB: 28 },
        PEN: { SF: 10, PEN: 60, SJ: 15, EB: 15 },
        SJ: { SF: 10, PEN: 15, SJ: 60, EB: 15 },
        EB: { SF: 10, PEN: 15, SJ: 15, EB: 60 },
      },
      // Other hours: own 55, each other 15.
      other: {
        SF: { SF: 55, PEN: 15, SJ: 15, EB: 15 },
        PEN: { SF: 15, PEN: 55, SJ: 15, EB: 15 },
        SJ: { SF: 15, PEN: 15, SJ: 55, EB: 15 },
        EB: { SF: 15, PEN: 15, SJ: 15, EB: 55 },
      },
    });
    for (const period of Object.values(defaultScenario().dest_weights)) {
      for (const weights of Object.values(period)) assert.equal(Object.values(weights).reduce((a, b) => a + b, 0), 100);
    }
  });

  test("congestion tables hold every ordered pair with 48 hours by the contract 6.2 rules", () => {
    const { congestion } = defaultScenario();
    assert.deepEqual(Object.keys(congestion).sort(), ["HIGHWAY", "IN_AREA", "LOCAL"]);
    assert.deepEqual(Object.keys(congestion.HIGHWAY).sort(), [...DIRECTIONS].sort());
    assert.deepEqual(Object.keys(congestion.LOCAL).sort(), [...DIRECTIONS].sort());
    for (const key of TOWARD_SF) assert.deepEqual(congestion.HIGHWAY[key], rowOf(HIGHWAY_TOWARD_SF), key);
    for (const key of AWAY_FROM_SF) assert.deepEqual(congestion.HIGHWAY[key], rowOf(HIGHWAY_AWAY_FROM_SF), key);
    for (const key of WITHOUT_SF) assert.deepEqual(congestion.HIGHWAY[key], rowOf(HIGHWAY_WITHOUT_SF), key);
    for (const key of DIRECTIONS) assert.deepEqual(congestion.LOCAL[key], rowOf(LOCAL_AND_IN_AREA), key);
    assert.deepEqual(congestion.IN_AREA, rowOf(LOCAL_AND_IN_AREA));
  });

  test("congestion rule samples for each class, with row sums derived by hand", () => {
    const { congestion } = defaultScenario();
    const sum = (row) => row.reduce((a, b) => a + b, 0);
    // Highway toward SF: 7, 8 at 1600; 16 to 18 at 1200; 19 at 1300; 18 other hours at 1000.
    assert.equal(congestion.HIGHWAY["PEN>SF"][7], 1600);
    assert.equal(congestion.HIGHWAY["EB>SF"][31], 1600); // day 2 07:00 is hour 31
    assert.equal(congestion.HIGHWAY["SJ>SF"][17], 1200);
    assert.equal(congestion.HIGHWAY["SJ>SF"][19], 1300);
    assert.equal(congestion.HIGHWAY["SJ>SF"][6], 1000);
    assert.equal(sum(congestion.HIGHWAY["SJ>SF"]), 2 * (2 * 1600 + 3 * 1200 + 1300 + 18 * 1000)); // 2 × 26100
    // Highway away from SF: 7, 8 at 1200; 16 to 18 at 1600.
    assert.equal(congestion.HIGHWAY["SF>PEN"][7], 1200);
    assert.equal(congestion.HIGHWAY["SF>SJ"][42], 1600); // day 2 18:00 is hour 42
    assert.equal(congestion.HIGHWAY["SF>EB"][20], 1000);
    assert.equal(sum(congestion.HIGHWAY["SF>SJ"]), 2 * (2 * 1200 + 3 * 1600 + 1300 + 18 * 1000)); // 2 × 26500
    // Highway without SF: 1200 in both peaks both ways; 1300 at 19.
    assert.equal(congestion.HIGHWAY["PEN>SJ"][8], 1200);
    assert.equal(congestion.HIGHWAY["EB>SJ"][16], 1200);
    assert.equal(congestion.HIGHWAY["SJ>PEN"][43], 1300);
    assert.equal(congestion.HIGHWAY["PEN>EB"][9], 1000);
    assert.equal(sum(congestion.HIGHWAY["EB>PEN"]), 2 * (5 * 1200 + 1300 + 18 * 1000)); // 2 × 25300
    // Local, every pair: 1300 in both peaks, never at 19.
    assert.equal(congestion.LOCAL["SF>PEN"][7], 1300);
    assert.equal(congestion.LOCAL["SJ>EB"][19], 1000);
    assert.equal(congestion.LOCAL["EB>SJ"][40], 1300);
    assert.equal(sum(congestion.LOCAL["PEN>SF"]), 2 * (5 * 1300 + 19 * 1000)); // 2 × 25500
    // In-area: as local.
    assert.equal(congestion.IN_AREA[16], 1300);
    assert.equal(congestion.IN_AREA[15], 1000);
    assert.equal(congestion.IN_AREA[47], 1000);
    assert.equal(sum(congestion.IN_AREA), 51000);
  });

  test("returns a fresh object each call, and cloneScenario copies deeply", () => {
    const a = defaultScenario();
    a.congestion.IN_AREA[0] = 2000;
    a.areas[0].cars = 1;
    assert.equal(defaultScenario().congestion.IN_AREA[0], 1000);
    assert.equal(defaultScenario().areas[0].cars, 30);
    const b = defaultScenario();
    const c = cloneScenario(b);
    assert.deepEqual(c, b);
    c.congestion.HIGHWAY["SF>PEN"][7] = 3000;
    c.policies.release_s = null;
    assert.equal(b.congestion.HIGHWAY["SF>PEN"][7], 1200);
    assert.equal(b.policies.release_s, 107100);
  });
});

describe("validateScenario", () => {
  const assertProblem = (p) => {
    assert.deepEqual(Object.keys(p).sort(), ["fix", "knob", "what", "why"]);
    for (const slot of ["what", "why", "fix"]) assert.ok(typeof p[slot] === "string" && p[slot].length > 0, slot);
    assert.ok(p.knob === null || typeof p.knob === "string");
  };

  test("the default scenario is valid with no warnings", () => {
    assert.deepEqual(validateScenario(defaultScenario()), { ok: true, errors: [], warnings: [] });
  });

  test("a value that is not an object is rejected", () => {
    for (const value of [null, undefined, [], "bay", 7]) {
      const r = validateScenario(value);
      assert.equal(r.ok, false);
      assert.equal(r.errors.length, 1);
      assertProblem(r.errors[0]);
    }
  });

  // [case, mutation, knob every error must name, pattern for the first error's WHAT slot]
  const REJECTIONS = [
    ["no depot on the map", (s) => { s.depots = []; }, "DEP-1", /^Depots on the map: 0$/],
    ["total cars above 500", (s) => { s.areas[0].cars = 200; s.areas[1].cars = 200; s.areas[2].cars = 101; }, "SUP-1", /^Total cars: 519$/], // 200 + 200 + 101 + 18
    ["no car at all", (s) => { for (const a of s.areas) a.cars = 0; }, "SUP-1", /^Total cars: 0$/],
    ["an area above 200 cars", (s) => { s.areas[0].cars = 201; }, "SUP-1", /^Cars in San Francisco: 201$/],
    ["an area below 0 cars", (s) => { s.areas[1].cars = -1; }, "SUP-1", /^Cars in Peninsula: -1$/],
    ["fractional cars", (s) => { s.areas[2].cars = 24.5; }, "SUP-1", /^Cars in San Jose: 24.5$/],
    ["areas out of order", (s) => { s.areas.reverse(); }, "SUP-1", /^Area 1: "EB"$/],
    ["an unknown area field", (s) => { s.areas[3].label = "East Bay"; }, "SUP-1", /^Unknown field in area EB: label$/],
    ["peak below off-peak", (s) => { s.areas[0].offpeak_per_h = 61; }, "DEM-1", /^Peak requests per hour in San Francisco: 60, off-peak 61$/],
    ["peak of 0", (s) => { s.areas[3].peak_per_h = 0; }, "DEM-1", /^Peak requests per hour in East Bay: 0$/],
    ["off-peak above 120", (s) => { s.areas[2].offpeak_per_h = 121; }, "DEM-2", /^Off-peak requests per hour in San Jose: 121$/],
    ["in-area time below 1 min", (s) => { s.areas[0].in_area_s = 59; }, "RD-2", /^In-area trip time in San Francisco: 0.9833/],
    ["overlapping peak windows", (s) => { s.peaks[1].start_h = 8; }, "DEM-3", /^Peak windows: 07:00 to 09:00 and 08:00 to 19:00$/],
    ["a peak that ends before it starts", (s) => { s.peaks[0] = { start_h: 9, end_h: 7 }; }, "DEM-3", /^Morning peak: 09:00 to 07:00$/],
    ["three peak windows", (s) => { s.peaks.push({ start_h: 20, end_h: 22 }); }, "DEM-3", /^Peak windows: 3$/],
    ["a peak ending after 24", (s) => { s.peaks[1].end_h = 25; }, "DEM-3", /^Evening peak end: 25:00$/],
    ["an unknown peak field", (s) => { s.peaks[0].label = "am"; }, "DEM-3", /^Unknown field/],
    ["an unknown demand shape", (s) => { s.demand_shape = "spiky"; }, "DEM-5", /^Demand shape: "spiky"$/],
    ["a negative destination weight", (s) => { s.dest_weights.morning.SF.PEN = -1; }, "DEM-4", /^Weight from SF to PEN for morning peak: -1$/],
    ["destination weights totalling 0", (s) => { s.dest_weights.other.EB = { SF: 0, PEN: 0, SJ: 0, EB: 0 }; }, "DEM-4", /total 0$/],
    ["a missing origin in the mix", (s) => { delete s.dest_weights.evening.SJ; }, "DEM-4", /^Missing field in the destination mix for evening peak: SJ$/],
    ["an unknown period in the mix", (s) => { s.dest_weights.night = {}; }, "DEM-4", /^Unknown field in the destination mix: night$/],
    ["a fractional weight", (s) => { s.dest_weights.morning.PEN.SF = 55.5; }, "DEM-4", /55.5$/],
    ["a congestion row of 47 hours", (s) => { s.congestion.HIGHWAY["SF>SJ"].pop(); }, "RD-3", /^Congestion for highway routes SF>SJ: 47 hours$/],
    ["a congestion value below 1000", (s) => { s.congestion.LOCAL["EB>SJ"][30] = 999; }, "RD-3", /^Congestion for local routes EB>SJ at D2 06:00: ×0.999$/], // hour 30 = 108000 s
    ["a congestion value above 3000", (s) => { s.congestion.IN_AREA[0] = 3001; }, "RD-3", /^Congestion for in-area driving at D1 00:00: ×3.001$/],
    ["a fractional congestion value", (s) => { s.congestion.HIGHWAY["PEN>SF"][7] = 1600.5; }, "RD-3", /1600.5$/],
    ["a missing direction", (s) => { delete s.congestion.LOCAL["SJ>EB"]; }, "RD-3", /^Missing field in local congestion: SJ>EB$/],
    ["a missing in-area row", (s) => { delete s.congestion.IN_AREA; }, "RD-3", /^Missing field in congestion: IN_AREA$/],
    ["an unknown direction", (s) => { s.congestion.HIGHWAY["SF>SF"] = new Array(48).fill(1000); }, "RD-3", /^Unknown field in highway congestion: SF>SF$/],
    ["a threshold below ×1.1", (s) => { s.congestion_threshold_permille = 1099; }, "RD-4", /^Congestion threshold: ×1.099$/],
    ["a threshold above ×2.0", (s) => { s.congestion_threshold_permille = 2001; }, "RD-4", /^Congestion threshold/],
    ["sigma off the grid", (s) => { s.sigma_permille = 125; }, "RD-5", /^Travel variation: 125$/],
    ["sigma above 500", (s) => { s.sigma_permille = 550; }, "RD-5", /^Travel variation: 550$/],
    ["negative sigma", (s) => { s.sigma_permille = -50; }, "RD-5", /^Travel variation: -50$/],
    ["sigma as text", (s) => { s.sigma_permille = "150"; }, "RD-5", /^Travel variation: "150"$/],
    ["a route below 5 min", (s) => { s.routes[0].free_flow_s = 299; }, "RD-1", /^Free-flow time on H1: 4.9833/],
    ["a renamed route", (s) => { s.routes[0].id = "H9"; }, "RD-1", /^Route 1 id: "H9"$/],
    ["a route with another class", (s) => { s.routes[1].cls = "HIGHWAY"; }, "RD-1", /^Route 2 cls: "HIGHWAY"$/],
    ["eleven routes", (s) => { s.routes.pop(); }, "RD-1", /^Routes: 11$/],
    ["parking below 5", (s) => { s.depots[0].parking = 4; }, "DEP-2", /^Parking at SF-1: 4$/],
    ["parking above 150", (s) => { s.depots[3].parking = 151; }, "DEP-2", /^Parking at EB-1: 151$/],
    ["no cleaning bay", (s) => { s.depots[2].cleaning_bays = 0; }, "DEP-3", /^Cleaning bays at SJ-1: 0$/],
    ["13 cleaning bays", (s) => { s.depots[1].cleaning_bays = 13; }, "DEP-3", /^Cleaning bays at SF-2: 13$/],
    ["7 service bays", (s) => { s.depots[0].service_bays = 7; }, "DEP-5", /^Service bays at SF-1: 7$/],
    ["negative service bays", (s) => { s.depots[0].service_bays = -1; }, "DEP-5", /^Service bays at SF-1: -1$/],
    ["service due with no service bay anywhere", (s) => { for (const d of s.depots) d.service_bays = 0; }, "DEP-5", /^Service bays on the map: 0$/],
    ["a third depot in one area", (s) => { s.depots.splice(2, 0, { id: "SF-3", area: "SF", parking: 30, cleaning_bays: 2, service_bays: 1 }); }, "DEP-1", /^Depot id: "SF-3"$/],
    ["a depot outside the four areas", (s) => { s.depots[3].area = "LA"; }, "DEP-1", /^Area of EB-1: "LA"$/],
    ["a depot id that names another area", (s) => { s.depots[2].id = "SF-2"; }, "DEP-1", /^Depot id: "SF-2"$/],
    ["a duplicate depot", (s) => { s.depots[1] = { ...s.depots[0] }; }, "DEP-1", /^Depot id: SF-1 appears twice$/],
    ["depots out of order", (s) => { [s.depots[2], s.depots[3]] = [s.depots[3], s.depots[2]]; }, "DEP-1", /^Depot order: SJ-1 after EB-1$/],
    ["a depot that is not an object", (s) => { s.depots[0] = 5; }, "DEP-1", /^Depot 1: 5$/],
    ["an unknown depot field", (s) => { s.depots[0].chargers = 2; }, "DEP-1", /^Unknown field in depot 1: chargers$/],
    ["a different depot access time", (s) => { s.depot_access_s = 240; }, "DEP-1", /^Depot access time: 240$/],
    ["clean time below 5 min", (s) => { s.clean_s = 299; }, "DEP-4", /^Clean time: /],
    ["service time above 240 min", (s) => { s.service_s = 14401; }, "DEP-6", /^Service time: /],
    ["0 trips between visits", (s) => { s.trips_between_visits = 0; }, "DEP-7", /^Trips between depot visits: 0$/],
    ["service every 11 visits", (s) => { s.service_every_visits = 11; }, "DEP-8", /^Service every N visits: 11$/],
    ["intake below 1 min", (s) => { s.intake_s = 59; }, "DEP-9", /^Intake time: /],
    ["pull-out above 10 min", (s) => { s.pull_out_s = 601; }, "DEP-9", /^Pull-out time: 10.0166/],
    ["patience below 1 min", (s) => { s.patience_s = 59; }, "RID-1", /^Rider patience: /],
    ["patience above 60 min", (s) => { s.patience_s = 3601; }, "RID-1", /^Rider patience: /],
    ["release equal to the recall", (s) => { s.policies.release_s = 88200; }, "POL-4", /^Morning release: D2 00:30, recall D2 00:30$/],
    ["release before the recall", (s) => { s.policies.release_s = 80000; }, "POL-4", /^Morning release: D1 22:13, recall D2 00:30$/], // 80000 s = 22 h 13 min 20 s
    ["release as text", (s) => { s.policies.release_s = "05:45"; }, "POL-4", /^Morning release: "05:45"$/],
    ["release undefined", (s) => { s.policies.release_s = undefined; }, "POL-4", /^Morning release: missing$/],
    ["release key missing", (s) => { delete s.policies.release_s; }, "POL-4", /^Missing field in the rules: release_s$/],
    ["release at the window end", (s) => { s.policies.release_s = 122400; }, "POL-4", /^Morning release: D2 10:00$/],
    ["recall before the window", (s) => { s.policies.recall_s = 17000; }, "POL-3", /^End-of-service recall: D1 04:43$/], // 17000 s = 4 h 43 min 20 s
    ["an unknown dispatch rule", (s) => { s.policies.dispatch = "random"; }, "POL-1", /^Dispatch: "random"$/],
    ["an unknown depot assignment", (s) => { s.policies.depot_assignment = "farthest"; }, "POL-2", /^Depot assignment: "farthest"$/],
    ["an unknown queue order", (s) => { s.policies.queue_order = "lifo"; }, "POL-5", /^Depot queue order: "lifo"$/],
    ["an unknown rules field", (s) => { s.policies.reposition = "none"; }, null, /^Unknown field in the rules: reposition$/],
    ["a 3 hour window", (s) => { s.window.end_s = 28800; }, "CLK-1", /^Window length: 3 h$/], // 28800 - 18000 = 10800 s
    ["a 37 hour window", (s) => { s.window.end_s = 151200; }, "CLK-1", /^Window length: 37 h$/], // 151200 - 18000 = 133200 s
    ["a window past day 2", (s) => { s.window = { start_s: 50000, end_s: 172801 }; }, "CLK-1", /^Window end: D3 00:00$/],
    ["an unknown window field", (s) => { s.window.zone = "local"; }, "CLK-1", /^Unknown field in the simulated window: zone$/],
    ["warm-up at the window end", (s) => { s.warmup_end_s = 122400; }, "CLK-2", /^Warm-up end: D2 10:00$/],
    ["a 10 minute bucket", (s) => { s.bucket_s = 600; }, "CLK-3", /^Reporting bucket: 600$/],
    ["a snapshot after the window", (s) => { s.placement_snapshot_s = 122401; }, "CLK-4", /^Placement snapshot: D2 10:00$/],
    ["an unknown top-level field", (s) => { s.chargers = 1; }, null, /^Unknown field in the scenario: chargers$/],
    ["a missing top-level field", (s) => { delete s.patience_s; }, "RID-1", /^Missing field in the scenario: patience_s$/],
    ["missing depots", (s) => { delete s.depots; }, "DEP-1", /^Missing field in the scenario: depots$/],
    ["another format", (s) => { s.format = "fleetlab-spec"; }, null, /^Scenario format: "fleetlab-spec"$/],
    ["another version", (s) => { s.version = "0.2"; }, null, /^Scenario version: "0.2"$/],
    ["a name with spaces", (s) => { s.name = "Bay map"; }, null, /^Scenario name: "Bay map"$/],
  ];

  for (const [name, mutate, knob, what] of REJECTIONS) {
    test(`rejects ${name} with knob ${knob}`, () => {
      const s = defaultScenario();
      mutate(s);
      const r = validateScenario(s);
      assert.equal(r.ok, false);
      assert.ok(r.errors.length >= 1);
      r.errors.forEach(assertProblem);
      assert.deepEqual(r.errors.map((e) => e.knob), r.errors.map(() => knob), JSON.stringify(r.errors));
      assert.match(r.errors[0].what, what);
    });
  }

  test("warns, without rejecting, when patience is shorter than an area's in-area pickup", () => {
    const s = defaultScenario();
    s.patience_s = 450; // shorter than PEN 480 and SJ 480; not shorter than SF 360 or EB 420
    const r = validateScenario(s);
    assert.equal(r.ok, true);
    assert.deepEqual(r.warnings.map((w) => w.knob), ["RID-1", "RID-1"]);
    assert.match(r.warnings[0].what, /Peninsula/);
    assert.match(r.warnings[1].what, /San Jose/);
    r.warnings.forEach(assertProblem);
    s.patience_s = 480; // equal is not shorter
    assert.deepEqual(validateScenario(s).warnings, []);
    s.patience_s = 300; // shorter than all four
    assert.equal(validateScenario(s).warnings.length, 4);
  });

  test("accepts the edges the design allows", () => {
    const accept = (mutate) => {
      const s = defaultScenario();
      mutate(s);
      const r = validateScenario(s);
      assert.deepEqual(r.errors, []);
    };
    accept((s) => { s.policies.release_s = null; }); // release off
    accept((s) => { for (const d of s.depots) d.service_bays = 0; s.service_every_visits = 0; }); // never service
    accept((s) => { s.depots.splice(2, 0, { id: "PEN-1", area: "PEN", parking: 20, cleaning_bays: 1, service_bays: 0 }); });
    accept((s) => { s.depots = [{ id: "EB-2", area: "EB", parking: 5, cleaning_bays: 12, service_bays: 6 }]; });
    accept((s) => { s.areas[1].offpeak_per_h = 0; s.areas[1].peak_per_h = 1; });
    accept((s) => { s.areas[0].offpeak_per_h = 60; }); // peak equal to off-peak
    accept((s) => { s.areas[0].cars = 200; s.areas[1].cars = 200; s.areas[2].cars = 82; }); // 200 + 200 + 82 + 18 = 500
    accept((s) => { s.peaks = [{ start_h: 0, end_h: 12 }, { start_h: 12, end_h: 24 }]; }); // touching windows
    accept((s) => { s.sigma_permille = 500; s.congestion.IN_AREA[47] = 3000; s.congestion_threshold_permille = 2000; });
    accept((s) => { s.window = { start_s: 0, end_s: 129600 }; }); // 36 h
    accept((s) => { s.window = { start_s: 158400, end_s: 172800 }; s.warmup_end_s = 158400; s.placement_snapshot_s = 172800; s.policies.recall_s = 160000; s.policies.release_s = null; }); // 4 h at the end of day 2
    accept((s) => { Object.freeze(s); });
  });
});

describe("applyAxis", () => {
  const diff = (axisId, value) => {
    const base = defaultScenario();
    const before = canonicalJson(base);
    const next = applyAxis(base, axisId, value);
    assert.equal(canonicalJson(base), before, "the input scenario is untouched");
    assert.deepEqual(validateScenario(next).errors, []);
    return describeDifferences(base, next);
  };

  // [axis, value, the only differences it makes]
  const FORMS = [
    ["parameter:SUP-1.SJ", 16, [{ knob: "SUP-1.SJ", from: 24, to: 16 }]],
    ["parameter:RD-2.SF", 300, [{ knob: "RD-2.SF", from: 360, to: 300 }]],
    ["parameter:DEM-1.PEN", 40, [{ knob: "DEM-1.PEN", from: 20, to: 40 }]],
    ["parameter:DEM-2.EB", 0, [{ knob: "DEM-2.EB", from: 8, to: 0 }]],
    ["parameter:DEP-2.SF-2", 40, [{ knob: "DEP-2.SF-2", from: 30, to: 40 }]],
    ["parameter:DEP-3.SJ-1", 1, [{ knob: "DEP-3.SJ-1", from: 3, to: 1 }]],
    ["parameter:DEP-5.EB-1", 0, [{ knob: "DEP-5.EB-1", from: 1, to: 0 }]],
    ["parameter:DEP-3", { "SF-1": 6, "SF-2": 2, "SJ-1": 1, "EB-1": 2 }, [{ knob: "DEP-3.SF-1", from: 4, to: 6 }, { knob: "DEP-3.SJ-1", from: 3, to: 1 }]],
    ["parameter:DEP-2", { "SF-1": 50, "SF-2": 40, "SJ-1": 30, "EB-1": 30 }, [{ knob: "DEP-2.SF-1", from: 60, to: 50 }, { knob: "DEP-2.SF-2", from: 30, to: 40 }]],
    ["parameter:DEP-5", { "SF-1": 1, "SF-2": 1, "SJ-1": 1, "EB-1": 1 }, [{ knob: "DEP-5.SF-1", from: 2, to: 1 }]],
    ["parameter:DEP-4", 900, [{ knob: "DEP-4", from: 1200, to: 900 }]],
    ["parameter:DEP-6", 3600, [{ knob: "DEP-6", from: 2700, to: 3600 }]],
    ["parameter:DEP-7", 5, [{ knob: "DEP-7", from: 10, to: 5 }]],
    ["parameter:DEP-8", 0, [{ knob: "DEP-8", from: 3, to: 0 }]],
    ["parameter:DEP-9.intake", 240, [{ knob: "DEP-9.intake", from: 180, to: 240 }]],
    ["parameter:DEP-9.pull_out", 60, [{ knob: "DEP-9.pull_out", from: 120, to: 60 }]],
    ["parameter:DEM-5", "flat", [{ knob: "DEM-5", from: "peaked", to: "flat" }]],
    ["parameter:RD-1.H2", 3600, [{ knob: "RD-1.H2", from: 3300, to: 3600 }]],
    ["parameter:RD-4", 1500, [{ knob: "RD-4", from: 1300, to: 1500 }]],
    ["parameter:RID-1", 1200, [{ knob: "RID-1", from: 600, to: 1200 }]],
    ["parameter:POL-3", 90000, [{ knob: "POL-3", from: 88200, to: 90000 }]],
    ["parameter:POL-4", 100800, [{ knob: "POL-4", from: 107100, to: 100800 }]],
    ["parameter:POL-4", "off", [{ knob: "POL-4", from: 107100, to: null }]],
    ["parameter:POL-4", null, [{ knob: "POL-4", from: 107100, to: null }]],
    ["policy:depot_assignment", "nearest_depot", [{ knob: "POL-2", from: "home_depot", to: "nearest_depot" }]],
    ["policy:depot_assignment", "nearest_depot_with_capacity", [{ knob: "POL-2", from: "home_depot", to: "nearest_depot_with_capacity" }]],
    ["policy:dispatch", "nearest_idle", []],
    ["policy:queue_order", "fifo", []],
  ];
  for (const [axisId, value, expected] of FORMS) {
    test(`${axisId} = ${JSON.stringify(value)}`, () => {
      assert.deepEqual(diff(axisId, value), expected);
    });
  }

  const rd3 = (axisId, value, rowKeys, hours) => {
    const base = defaultScenario();
    const next = applyAxis(base, axisId, value);
    const changes = describeDifferences(base, next);
    assert.deepEqual(changes.map((c) => c.knob), rowKeys);
    for (const change of changes) {
      change.to.forEach((v, h) => assert.equal(v, hours.includes(h) ? value : change.from[h], `${change.knob} hour ${h}`));
    }
  };

  test("parameter:RD-3.highway.evening sets hours 16 to 18 of both days on every highway direction", () => {
    // Away-from-SF rows already hold 1600 in those hours, so only the other 9 rows change.
    rd3("parameter:RD-3.highway.evening", 1600, [...TOWARD_SF, ...WITHOUT_SF].sort((a, b) => DIRECTIONS.indexOf(a) - DIRECTIONS.indexOf(b)).map((k) => `RD-3.highway.${k}`), [16, 17, 18, 40, 41, 42]);
    // At 1200 only the three away-from-SF rows (1600) change.
    rd3("parameter:RD-3.highway.evening", 1200, AWAY_FROM_SF.map((k) => `RD-3.highway.${k}`), [16, 17, 18, 40, 41, 42]);
  });

  test("parameter:RD-3.highway.morning and .late set hours 7 to 8 and 19 on every highway direction", () => {
    rd3("parameter:RD-3.highway.morning", 1000, DIRECTIONS.map((k) => `RD-3.highway.${k}`), [7, 8, 31, 32]);
    rd3("parameter:RD-3.highway.late", 1000, DIRECTIONS.map((k) => `RD-3.highway.${k}`), [19, 43]);
  });

  test("parameter:RD-3.local changes local rows only, and in_area only the in-area row", () => {
    rd3("parameter:RD-3.local.evening", 1500, DIRECTIONS.map((k) => `RD-3.local.${k}`), [16, 17, 18, 40, 41, 42]);
    rd3("parameter:RD-3.local.late", 1300, DIRECTIONS.map((k) => `RD-3.local.${k}`), [19, 43]);
    rd3("parameter:RD-3.in_area.morning", 2000, ["RD-3.in_area"], [7, 8, 31, 32]);
  });

  // [axis, value, knob of the rejection]
  const REJECTED = [
    [42, 1, null],
    ["parameter:XYZ-1", 1, null],
    ["knob:SUP-1", 1, null],
    ["policy:recall", 88200, null],
    ["parameter:SUP-3", 1, "SUP-3"],
    ["parameter:SUP-1", 16, "SUP-1"],
    ["parameter:SUP-1.LA", 16, "SUP-1"],
    ["parameter:SUP-1.SJ.cars", 16, "SUP-1"],
    ["parameter:SUP-1.SJ", 201, "SUP-1"],
    ["parameter:SUP-1.SJ", 16.5, "SUP-1"],
    ["parameter:SUP-1.SJ", "16", "SUP-1"],
    ["parameter:DEM-1.SF", 10, "DEM-1"], // below SF off-peak 15
    ["parameter:DEM-2.SF", 121, "DEM-2"],
    ["parameter:DEP-3.PEN-1", 2, "DEP-3"], // grammar allows it; the map has no PEN-1
    ["parameter:DEP-3.XX-1", 2, "DEP-3"],
    ["parameter:DEP-3.SF-1", 13, "DEP-3"],
    ["parameter:DEP-3", { "SF-1": 6, "SF-2": 2, "SJ-1": 1 }, "DEP-3"], // EB-1 missing
    ["parameter:DEP-3", { "SF-1": 6, "SF-2": 2, "SJ-1": 1, "EB-1": 2, "PEN-1": 1 }, "DEP-3"],
    ["parameter:DEP-3", { "SF-1": "6", "SF-2": 2, "SJ-1": 1, "EB-1": 2 }, "DEP-3"],
    ["parameter:DEP-3", [6, 2, 1, 2], "DEP-3"],
    ["parameter:DEP-5", { "SF-1": 0, "SF-2": 0, "SJ-1": 0, "EB-1": 0 }, "DEP-5"], // service every 3 visits needs a bay
    ["parameter:DEP-4.SF-1", 900, "DEP-4"],
    ["parameter:DEP-4", 299, "DEP-4"],
    ["parameter:DEP-8", 11, "DEP-8"],
    ["parameter:DEP-9", 240, "DEP-9"],
    ["parameter:DEP-9.clean", 240, "DEP-9"],
    ["parameter:RD-1.H7", 1800, "RD-1"],
    ["parameter:RD-3.highway", 1600, "RD-3"],
    ["parameter:RD-3.rail.evening", 1600, "RD-3"],
    ["parameter:RD-3.highway.night", 1600, "RD-3"],
    ["parameter:RD-3.highway.evening", 999, "RD-3"],
    ["parameter:RD-3.in_area.late", 3001, "RD-3"],
    ["parameter:DEM-5", "spiky", "DEM-5"],
    ["parameter:RID-1", 30, "RID-1"],
    ["policy:depot_assignment", "farthest", "POL-2"],
    ["policy:dispatch", "random", "POL-1"],
    ["policy:queue_order", "lifo", "POL-5"],
    ["parameter:POL-4", "never", "POL-4"],
    ["parameter:POL-4", 88200, "POL-4"], // not after the recall at 88200
    ["parameter:POL-3", 107100, "POL-4"], // the release at 107100 would no longer come after it
    ["parameter:SUP-2", "SF-1", "SUP-2"],
    ["parameter:DEP-1", 1, "DEP-1"],
    ["parameter:DEM-3", 7, "DEM-3"],
    ["parameter:DEM-4", 55, "DEM-4"],
    ["parameter:RD-5", 150, "RD-5"],
    ["parameter:CLK-1", 18000, "CLK-1"],
    ["parameter:CLK-2", 25200, "CLK-2"],
    ["parameter:CLK-3", 1800, "CLK-3"],
    ["parameter:CLK-4", 104400, "CLK-4"],
    ["parameter:POL-1", "nearest_idle", "POL-1"],
    ["parameter:POL-2", "nearest_depot", "POL-2"],
    ["parameter:POL-5", "fifo", "POL-5"],
  ];
  for (const [axisId, value, knob] of REJECTED) {
    test(`rejects ${String(axisId)} = ${JSON.stringify(value)} with knob ${knob}`, () => {
      assert.throws(
        () => applyAxis(defaultScenario(), axisId, value),
        (error) => {
          assert.ok(error instanceof AxisError);
          assert.equal(error.name, "AxisError");
          assert.equal(error.knob, knob);
          for (const slot of ["what", "why", "fix"]) assert.ok(typeof error[slot] === "string" && error[slot].length > 0);
          return true;
        },
      );
    });
  }

  test("rejects an axis on a scenario that is itself invalid", () => {
    const s = defaultScenario();
    s.depots = [];
    assert.throws(() => applyAxis(s, "parameter:DEP-7", 5), (e) => e instanceof AxisError && e.knob === "DEP-1");
  });

  test("returns an editable copy of a frozen scenario", () => {
    const next = applyAxis(presetById(DEFAULT_PRESET_ID).scenario, "parameter:DEP-7", 5);
    next.areas[0].cars = 29;
    assert.equal(next.trips_between_visits, 5);
  });

  test("every first-build knob is either an axis or rejected as one, naming itself", () => {
    const accepted = new Set([...FORMS.map(([axisId]) => parseAxis(axisId).knob), "RD-3"]);
    // First-build knobs whose values are not one axis value, or that feed the shared world or only the measurement.
    const refused = ["SUP-2", "DEP-1", "DEM-3", "DEM-4", "RD-5", "CLK-1", "CLK-2", "CLK-3", "CLK-4"];
    for (const knob of refused) {
      assert.ok(REJECTED.some(([axisId, , k]) => axisId === `parameter:${knob}` && k === knob), knob);
      assert.equal(accepted.has(knob), false, knob);
    }
    const firstBuild = KNOBS.filter((k) => k.firstBuild).map((k) => k.id).sort();
    assert.deepEqual([...accepted, ...refused].sort(), firstBuild);
  });
});

describe("describeDifferences", () => {
  test("identical scenarios, or ones that differ only by name, have no differences", () => {
    const a = defaultScenario();
    const b = defaultScenario();
    assert.deepEqual(describeDifferences(a, b), []);
    b.name = "renamed";
    assert.deepEqual(describeDifferences(a, b), []);
  });

  test("lists changes in knob order, whatever order they were made in", () => {
    const a = defaultScenario();
    const b = defaultScenario();
    b.placement_snapshot_s = 104400;
    b.patience_s = 1200;
    b.sigma_permille = 100;
    b.depots[0].cleaning_bays = 5;
    b.areas[1].cars = 20;
    assert.deepEqual(describeDifferences(a, b), [
      { knob: "SUP-1.PEN", from: 18, to: 20 },
      { knob: "DEP-3.SF-1", from: 4, to: 5 },
      { knob: "RD-5", from: 0, to: 100 },
      { knob: "RID-1", from: 600, to: 1200 },
      { knob: "CLK-4", from: 108000, to: 104400 },
    ]);
  });

  test("an added depot shows in DEP-1 and in each per-depot knob, from null", () => {
    const a = defaultScenario();
    const b = defaultScenario();
    b.depots.splice(2, 0, { id: "PEN-1", area: "PEN", parking: 20, cleaning_bays: 1, service_bays: 0 });
    assert.deepEqual(describeDifferences(a, b), [
      { knob: "DEP-1.PEN", from: [], to: ["PEN-1"] },
      { knob: "DEP-2.PEN-1", from: null, to: 20 },
      { knob: "DEP-3.PEN-1", from: null, to: 1 },
      { knob: "DEP-5.PEN-1", from: null, to: 0 },
    ]);
  });

  test("structured knobs report whole values, copied", () => {
    const a = defaultScenario();
    const b = defaultScenario();
    b.peaks[0].end_h = 10;
    b.dest_weights.evening.SJ.SJ = 50;
    b.window.end_s = 118800;
    const changes = describeDifferences(a, b);
    assert.deepEqual(changes.map((c) => c.knob), ["DEM-3", "DEM-4.evening.SJ", "CLK-1"]);
    assert.deepEqual(changes[1].to, { SF: 10, PEN: 15, SJ: 50, EB: 15 });
    changes[0].to[0].end_h = 11;
    assert.equal(b.peaks[0].end_h, 10);
  });
});

describe("PRESETS", () => {
  const ids = PRESETS.map((p) => p.id);
  const learn = PRESETS.filter((p) => p.kind === "learn");
  const withExperiment = PRESETS.filter((p) => p.experiment);
  const d1 = (h, m = 0) => h * 3600 + m * 60;
  const d2 = (h, m = 0) => 86400 + d1(h, m);
  const changesOf = (scenario) => describeDifferences(defaultScenario(), scenario).map((c) => c.knob);

  test("holds the Bay teaching map, the Learn cases and the seven Experiment presets", () => {
    assert.deepEqual(ids, ["bay_teaching_map", "L1", "L2a", "L2b", "L3", "UC-01", "UC-02", "UC-03", "UC-05", "UC-08a", "UC-08b", "UC-10"]);
    assert.deepEqual(PRESETS.map((p) => p.kind), ["default", "learn", "learn", "learn", "learn", ...new Array(7).fill("experiment")]);
    assert.equal(DEFAULT_PRESET_ID, "bay_teaching_map");
    assert.equal(presetById("L3").title, "Evening depot visit in San Jose");
    assert.equal(presetById("nope"), null);
    assert.deepEqual(presetById(DEFAULT_PRESET_ID).scenario, defaultScenario());
    assert.equal(presetById(DEFAULT_PRESET_ID).experiment, null);
    assert.ok(Object.isFrozen(PRESETS) && Object.isFrozen(PRESETS[4].scenario.congestion.HIGHWAY["SJ>SF"]));
    assert.equal(Object.hasOwn(PRESETS, "REFERENCE_PANELS"), false);
  });

  test("every preset scenario and every experiment scenario validates with no warning", () => {
    for (const preset of PRESETS) {
      assert.deepEqual(validateScenario(preset.scenario), { ok: true, errors: [], warnings: [] }, preset.id);
      if (preset.experiment) {
        assert.deepEqual(validateScenario(preset.experiment.scenario), { ok: true, errors: [], warnings: [] }, preset.id);
      }
    }
  });

  test("Learn presets run at σ 0 and carry 3 to 5 ordered moments inside the measured span", () => {
    assert.deepEqual(learn.map((p) => [p.id, p.learnCase, p.useCase]), [["L1", "L1", "UC-04"], ["L2a", "L2", "UC-09"], ["L2b", "L2", "UC-09"], ["L3", "L3", "UC-07"]]);
    for (const preset of learn) {
      assert.equal(preset.scenario.sigma_permille, 0, preset.id);
      assert.ok(preset.moments.length >= 3 && preset.moments.length <= 5, preset.id);
      preset.moments.forEach((m, i) => {
        assert.deepEqual(Object.keys(m).sort(), ["captionKey", "clock_s", "id"]);
        assert.equal(m.id, `m${i + 1}`);
        assert.equal(m.captionKey, `learn.${preset.learnCase}.m${i + 1}`);
        assert.ok(Number.isSafeInteger(m.clock_s));
        assert.ok(m.clock_s >= preset.scenario.warmup_end_s && m.clock_s < preset.scenario.window.end_s, `${preset.id} ${m.id}`);
        if (i > 0) assert.ok(m.clock_s > preset.moments[i - 1].clock_s);
      });
    }
    assert.deepEqual(presetById("L3").moments.map((m) => m.clock_s), [d1(18, 30), d1(19, 30), d2(5, 45), d2(7, 15)]); // 66600, 70200, 107100, 112500
    for (const preset of PRESETS.filter((p) => p.kind !== "learn")) assert.deepEqual(preset.moments, []);
  });

  test("L3 declares the design 3.5 traffic at σ 0", () => {
    const s = presetById("L3").scenario;
    const evening = { 7: null, 8: null, 16: 1600, 17: 1600, 18: 1600, 19: 1300 };
    for (const key of DIRECTIONS) {
      const morning = TOWARD_SF.includes(key) ? HIGHWAY_TOWARD_SF : AWAY_FROM_SF.includes(key) ? HIGHWAY_AWAY_FROM_SF : HIGHWAY_WITHOUT_SF;
      const expected = rowOf({ ...morning, ...Object.fromEntries(Object.entries(evening).filter(([, v]) => v !== null)) });
      assert.deepEqual(s.congestion.HIGHWAY[key], expected, key);
      assert.deepEqual(s.congestion.LOCAL[key], rowOf(LOCAL_AND_IN_AREA), key);
    }
    assert.deepEqual(s.congestion.IN_AREA, rowOf(LOCAL_AND_IN_AREA));
    // H2 toward SF leaving D1 18:30: hour 18 at ×1.6, hour 19 at ×1.3 (the contract 6.3 check).
    assert.equal(s.congestion.HIGHWAY["SJ>SF"][18], 1600);
    assert.equal(s.congestion.HIGHWAY["SJ>SF"][19], 1300);
    assert.equal(s.sigma_permille, 0);
    // Only the 9 highway rows that were not already ×1.6 from 16:00 to 19:00 differ from the Bay map.
    assert.deepEqual(changesOf(s), DIRECTIONS.filter((k) => !AWAY_FROM_SF.includes(k)).map((k) => `RD-3.highway.${k}`));
  });

  // Design section 4, thresholds in integer units: 0.02 = 20000 ppm, 0.01 = 10000 ppm, 0.10 = 100000 ppm.
  // Clock: 16:00 = 57600, 17:00 = 61200, 19:00 = 68400, 20:00 = 72000; D2 07:00 = 86400 + 25200 = 111600, D2 09:00 = 118800.
  const unserved = (max, scope = {}) => ({ metric: "unserved.fraction", scope, direction: LOWER, max_harm_units: max });
  const EXPECTED = {
    L1: {
      axis: { id: "parameter:DEM-5", baseline: "flat", candidate: "peaked" },
      primary: { metric: "wait.p90_s", scope: { window: { start_s: 57600, end_s: 68400 } }, direction: LOWER, margin_units: 60 },
      guardrails: [unserved(20000)],
    },
    L2a: {
      axis: { id: "parameter:DEP-3.SJ-1", baseline: 3, candidate: 1 },
      primary: { metric: "wait.p90_s", scope: { area: "SJ", window: { start_s: 57600, end_s: 68400 } }, direction: LOWER, margin_units: 60 },
      guardrails: [unserved(20000)],
    },
    L2b: {
      axis: { id: "parameter:DEP-3.SJ-1", baseline: 3, candidate: 1 },
      primary: { metric: "wait.p90_s", scope: { area: "SJ", window: { start_s: 57600, end_s: 68400 } }, direction: LOWER, margin_units: 60 },
      guardrails: [unserved(20000), { metric: "depot.bay_wait_p90_s", scope: { depot: "SJ-1" }, direction: LOWER, max_harm_units: 600 }],
    },
    L3: {
      axis: { id: "policy:depot_assignment", baseline: "home_depot", candidate: "nearest_depot" },
      primary: { metric: "wait.p90_s", scope: { area: "SF", window: { start_s: 111600, end_s: 118800 } }, direction: LOWER, margin_units: 60 },
      guardrails: [
        { metric: "exposure.congested_empty_s", scope: {}, direction: LOWER, max_harm_units: 0 },
        { metric: "depot.parking_peak_fraction", scope: { depot: "SJ-1" }, direction: LOWER, max_harm_units: 100000 },
        unserved(10000),
      ],
    },
    "UC-01": {
      axis: { id: "parameter:DEP-7", baseline: 10, candidate: 10 },
      primary: { metric: "wait.p90_s", scope: {}, direction: LOWER, margin_units: 30 },
      guardrails: [unserved(20000)],
    },
    "UC-02": {
      axis: { id: "parameter:SUP-1.SJ", baseline: 16, candidate: 24 },
      primary: { metric: "wait.p90_s", scope: { area: "SJ", window: { start_s: 57600, end_s: 68400 } }, direction: LOWER, margin_units: 60 },
      guardrails: [unserved(10000), unserved(10000, { area: "SF" })],
    },
    "UC-03": {
      axis: { id: "parameter:RID-1", baseline: 1200, candidate: 600 }, // 20 min and 10 min
      primary: { metric: "wait.p90_s", scope: {}, direction: LOWER, margin_units: 30 },
      guardrails: [unserved(20000)],
    },
    "UC-05": {
      axis: { id: "parameter:RD-3.highway.evening", baseline: 1000, candidate: 1600 },
      primary: { metric: "wait.p90_s", scope: { area: "SJ", window: { start_s: 61200, end_s: 72000 } }, direction: LOWER, margin_units: 60 },
      guardrails: [unserved(10000), { metric: "fleet.available_fraction", scope: {}, direction: HIGHER, max_harm_units: 20000 }],
    },
    "UC-08a": {
      axis: { id: "parameter:DEP-3.SF-1", baseline: 4, candidate: 6 },
      primary: { metric: "wait.p90_s", scope: {}, direction: LOWER, margin_units: 30 },
      guardrails: [unserved(20000)],
    },
    "UC-08b": {
      axis: { id: "parameter:DEP-4", baseline: 1200, candidate: 900 }, // 20 min and 15 min
      primary: { metric: "wait.p90_s", scope: {}, direction: LOWER, margin_units: 30 },
      guardrails: [unserved(20000)],
    },
    "UC-10": {
      axis: {
        id: "parameter:DEP-3",
        baseline: { "SF-1": 6, "SF-2": 2, "SJ-1": 1, "EB-1": 2 }, // total 11
        candidate: { "SF-1": 4, "SF-2": 2, "SJ-1": 3, "EB-1": 2 }, // total 11
      },
      primary: { metric: "wait.p90_s", scope: {}, direction: LOWER, margin_units: 30 },
      guardrails: [
        { metric: "vehicle.empty_drive_fraction", scope: {}, direction: LOWER, max_harm_units: 20000 },
        { metric: "depot.parking_peak_fraction", scope: { depot: "SJ-1" }, direction: LOWER, max_harm_units: 100000 },
      ],
    },
  };

  test("experiments match design section 4 exactly: axis, primary with scope and margin, guardrails", () => {
    assert.deepEqual(withExperiment.map((p) => p.id), Object.keys(EXPECTED));
    for (const preset of withExperiment) {
      const { axis, primary, guardrails } = preset.experiment;
      assert.deepEqual({ axis, primary, guardrails }, EXPECTED[preset.id], preset.id);
    }
  });

  test("experiments use seed set 1 with 20 seeds, 2,000 resamples, σ 0.15 and a bounded question", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => 1001 + i); // 1000 × 1 + 1 to 1000 × 1 + 20
    for (const preset of withExperiment) {
      const e = preset.experiment;
      assert.deepEqual(Object.keys(e).sort(), ["axis", "guardrails", "primary", "question", "resamples", "scenario", "seed_set", "seeds"], preset.id);
      assert.equal(e.seed_set, 1);
      assert.deepEqual(e.seeds, seeds);
      assert.equal(e.resamples, 2000);
      assert.equal(e.scenario.sigma_permille, 150, preset.id);
      assert.ok(typeof e.question === "string" && e.question.length > 0 && e.question.length <= 300, preset.id);
      assert.ok(Number.isSafeInteger(e.primary.margin_units) && e.primary.margin_units > 0);
      for (const g of e.guardrails) assert.ok(Number.isSafeInteger(g.max_harm_units) && g.max_harm_units >= 0);
      for (const ref of [e.primary, ...e.guardrails]) {
        for (const key of Object.keys(ref.scope)) assert.ok(["area", "depot", "window"].includes(key));
        if (ref.scope.window) {
          assert.ok(ref.scope.window.start_s >= e.scenario.warmup_end_s && ref.scope.window.end_s <= e.scenario.window.end_s);
          assert.ok(ref.scope.window.start_s < ref.scope.window.end_s);
        }
        if (ref.scope.depot) assert.ok(e.scenario.depots.some((d) => d.id === ref.scope.depot));
      }
      assert.doesNotThrow(() => canonicalJson(e), preset.id);
    }
    for (const preset of PRESETS.filter((p) => p.kind === "experiment")) {
      assert.deepEqual(preset.scenario, preset.experiment.scenario, preset.id);
    }
  });

  test("axis values are in range, the declared scenario is the baseline arm, and values differ except UC-01", () => {
    for (const preset of withExperiment) {
      const { scenario, axis } = preset.experiment;
      assert.deepEqual(applyAxis(scenario, axis.id, axis.baseline), scenario, preset.id);
      assert.doesNotThrow(() => applyAxis(scenario, axis.id, axis.candidate), preset.id);
      if (preset.id === "UC-01") assert.deepEqual(axis.baseline, axis.candidate);
      else assert.notDeepEqual(axis.baseline, axis.candidate, preset.id);
    }
  });

  test("each preset changes exactly the design section 4 knobs from the Bay teaching map", () => {
    const highwayRows = DIRECTIONS.map((k) => `RD-3.highway.${k}`);
    const l3Rows = DIRECTIONS.filter((k) => !AWAY_FROM_SF.includes(k)).map((k) => `RD-3.highway.${k}`);
    const expected = {
      bay_teaching_map: [[], null],
      // L1 sets SF off-peak requests from 15 to 8 (DEM-2.SF) so the Learn preset differs visibly from the map (design
      // 4.1); describeDifferences lists knobs in KNOBS order, so DEM-2.SF comes before DEM-5 and RD-5.
      L1: [["DEM-2.SF"], ["DEM-2.SF", "DEM-5", "RD-5"]],
      L2a: [["SUP-1.SJ"], ["SUP-1.SJ", "RD-5"]],
      L2b: [["SUP-1.SJ"], ["SUP-1.SJ", "RD-5"]],
      L3: [l3Rows, [...l3Rows, "RD-5"]],
      "UC-01": [["RD-5"], ["RD-5"]],
      "UC-02": [["SUP-1.SJ", "RD-5"], ["SUP-1.SJ", "RD-5"]],
      "UC-03": [["RD-5", "RID-1"], ["RD-5", "RID-1"]],
      "UC-05": [[...highwayRows, "RD-5"], [...highwayRows, "RD-5"]], // every highway row set to 1000 from 16:00 to 19:00
      "UC-08a": [["RD-5"], ["RD-5"]],
      "UC-08b": [["RD-5"], ["RD-5"]],
      "UC-10": [["DEP-3.SF-1", "DEP-3.SJ-1", "RD-5", "POL-2"], ["DEP-3.SF-1", "DEP-3.SJ-1", "RD-5", "POL-2"]],
    };
    for (const preset of PRESETS) {
      const [scenarioChanges, experimentChanges] = expected[preset.id];
      assert.deepEqual(changesOf(preset.scenario), scenarioChanges, `${preset.id} scenario`);
      if (experimentChanges) assert.deepEqual(changesOf(preset.experiment.scenario), experimentChanges, `${preset.id} experiment`);
    }
    const byKnob = (preset, knob) => describeDifferences(defaultScenario(), presetById(preset).experiment.scenario).find((c) => c.knob === knob);
    assert.deepEqual(byKnob("L2a", "SUP-1.SJ"), { knob: "SUP-1.SJ", from: 24, to: 12 });
    assert.deepEqual(byKnob("UC-02", "SUP-1.SJ"), { knob: "SUP-1.SJ", from: 24, to: 16 });
    assert.deepEqual(byKnob("UC-03", "RID-1"), { knob: "RID-1", from: 600, to: 1200 });
    assert.deepEqual(byKnob("UC-10", "POL-2"), { knob: "POL-2", from: "home_depot", to: "nearest_depot_with_capacity" });
    assert.deepEqual(byKnob("L1", "DEM-5"), { knob: "DEM-5", from: "peaked", to: "flat" });
    assert.deepEqual(byKnob("L1", "DEM-2.SF"), { knob: "DEM-2.SF", from: 15, to: 8 });
    // Design 4.1: every Learn preset has a visible difference from the Bay teaching map, and it is not the name.
    for (const preset of learn) assert.ok(describeDifferences(defaultScenario(), preset.scenario).length > 0, preset.id);
    assert.deepEqual(byKnob("UC-05", "RD-3.highway.SF>SJ").to.slice(15, 21), [1000, 1000, 1000, 1000, 1300, 1000]);
    assert.equal(presetById("L1").scenario.demand_shape, "peaked");
    // The two L2 specs are preregistered together: one scenario and question, L2b adds one guardrail at the end.
    const l2a = presetById("L2a").experiment;
    const l2b = presetById("L2b").experiment;
    assert.deepEqual({ ...l2b, guardrails: l2b.guardrails.slice(0, -1) }, l2a);
  });
});

describe("text rules", () => {
  const DASHES = /[\u2013\u2014]/;
  const BANNED = /\b(predict\w*|forecast\w*|live|real-time|monitoring)\b|expected traffic/i;
  const copy = [
    ...KNOBS.flatMap((k) => [k.label, k.help, k.unit ?? "", k.group]),
    ...PRESETS.flatMap((p) => [p.title, p.experiment ? p.experiment.question : ""]),
  ];

  test("knob and preset copy has no banned word and no em or en dash", () => {
    for (const text of copy) {
      assert.doesNotMatch(text, DASHES, text);
      assert.doesNotMatch(text, BANNED, text);
    }
  });

  test("the schema, preset and test files hold no em or en dash", () => {
    for (const path of ["../src/model/schema.js", "../src/model/presets.js", "./schema.test.mjs"]) {
      assert.doesNotMatch(readFileSync(new URL(path, import.meta.url), "utf8"), DASHES, path);
    }
  });
});
