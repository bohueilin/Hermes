// World vectors (contract 6.3, design 5.2.2, 5.4, P-1, P18).
//
// Rule-level expectations are derived by hand in the comments. Where a value depends on a SHA-256 draw, the test
// recomputes the draw with node:crypto, independently of src/core, and applies the rule itself; nothing is copied
// from a run of src/model/world.js.
//
// Useful facts: 2^30 = 1,073,741,824; 2^31 = 2,147,483,648; 2^32 = 4,294,967,296; 2^53 = 9,007,199,254,740,992.
// Exponential table entries: EXP[i] = round_half_even(1000 x -ln(1 - i / 65536)); ln 2 = 0.693147180559945.
// EXP[0] = 0; EXP[32768] = 1000 ln 2 = 693.147 -> 693; EXP[65535] = 1000 x 16 ln 2 = 11,090.355 -> 11,090.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import { roundHalfEvenDiv } from "../src/core/stats.js";
import { expTable, multiplierTable, TABLE_DIGESTS } from "../src/core/tables.js";
import { applyAxis, defaultScenario, validateScenario } from "../src/model/schema.js";
import {
  acceptedRequests,
  acceptsCandidate,
  buildWorld,
  destinationPeriod,
  gapSeconds,
  lambdaProfilePermille,
  ownLambdaMaxPermille,
  pickDestination,
  quarterHour,
  realizedSeconds,
  ridePpm,
  segmentFactorKey,
  sharedLambdaMaxPermille,
  trafficPpm,
  worldDigest,
} from "../src/model/world.js";

const TWO_30 = 1073741824;
const TWO_31 = 2147483648;
const TWO_32 = 4294967296;

/** Reference u64 with node:crypto: first 8 bytes, big-endian, of SHA-256 over the parts joined by "|". */
function refU64(...parts) {
  const digest = createHash("sha256").update(parts.map(String).join("|"), "utf8").digest();
  return digest.readBigUInt64BE(0);
}
const refU16 = (...parts) => Number(refU64(...parts) >> 48n);
const refU32 = (...parts) => Number(refU64(...parts) >> 32n);

function assertValid(s) {
  const verdict = validateScenario(s);
  assert.deepEqual({ ok: verdict.ok, errors: verdict.errors }, { ok: true, errors: [] });
}

/** A hand-built world holding chosen candidates, shaped like buildWorld's output, for rule vectors. */
function craftedWorld(scenario, lambdaMaxPermille, candidatesByArea) {
  const candidates = {};
  for (const id of ["SF", "PEN", "SJ", "EB"]) {
    const list = candidatesByArea[id] ?? [];
    candidates[id] = { t_s: list.map((c) => c[0]), thin: list.map((c) => c[1]), dest: list.map((c) => c[2]) };
  }
  return {
    name: scenario.name,
    seed: 1,
    sigma_permille: scenario.sigma_permille,
    window: { ...scenario.window },
    lambdaMaxPermille,
    candidates,
  };
}

const DEFAULT_LMAX = { SF: 60000, PEN: 20000, SJ: 35000, EB: 30000 };

describe("demand gap vectors", () => {
  test("exponential table entries used below", () => {
    const exp = expTable();
    assert.equal(exp[0], 0);
    assert.equal(exp[32768], 693);
    assert.equal(exp[65535], 11090);
  });

  test("gaps are exact integer divisions rounded half to even", () => {
    // 693 x 3600 = 2,494,800; / 60,000 = 41.58 -> 42.
    assert.equal(gapSeconds(693, 60000), 42);
    // Exact half, down to even: 11,090 x 3600 = 39,924,000; / 8,000 = 4,990.5 -> 4,990 (half up would give 4,991).
    assert.equal(gapSeconds(11090, 8000), 4990);
    // Exact half, up to even: 39,924,000 / 24,000 = 1,663.5 -> 1,664.
    assert.equal(gapSeconds(11090, 24000), 1664);
    // Exact half, down to even: 2,494,800 / 64,800 = 38.5 -> 38.
    assert.equal(gapSeconds(693, 64800), 38);
    // A flat envelope that is not a multiple of 1000: 2,494,800 / 25,862: 25,862 x 96 = 2,482,752, remainder 12,048,
    // twice the remainder 24,096 < 25,862, so 96.
    assert.equal(gapSeconds(693, 25862), 96);
    // A zero table entry gives a zero gap: two candidates can share a second (design 5.8).
    assert.equal(gapSeconds(0, 60000), 0);
    // The largest product in the design range: 11,090 x 3600 / 1,000 = 39,924 exactly.
    assert.equal(gapSeconds(11090, 1000), 39924);
  });

  test("roundHalfEvenDiv stays exact for numerators beyond 2^53", () => {
    // (2^53 + 1) / 2 = 4,503,599,627,370,496.5 -> even 4,503,599,627,370,496; 2^53 + 1 has no double.
    assert.equal(roundHalfEvenDiv(9007199254740993n, 2n), 4503599627370496n);
    // (2^53 + 3) / 2 = 4,503,599,627,370,497.5 -> even 4,503,599,627,370,498.
    assert.equal(roundHalfEvenDiv(9007199254740995n, 2n), 4503599627370498n);
    // (2^53 - 1) / 2 = 4,503,599,627,370,495.5 -> even 4,503,599,627,370,496.
    assert.equal(roundHalfEvenDiv(9007199254740991n, 2n), 4503599627370496n);
  });

  test("the thinning products are exact at their boundary and near their maximum", () => {
    // thin x lambdaMax < lambda x 2^32. thin = 2^31, lambdaMax 120,000, lambda 60,000:
    // 2^31 x 120,000 = 257,698,037,760,000 = 60,000 x 2^32, equal, so rejected; 2^31 - 1 is accepted.
    assert.equal(acceptsCandidate(TWO_31, 120000, 60000), false);
    assert.equal(acceptsCandidate(TWO_31 - 1, 120000, 60000), true);
    // The largest products: (2^32 - 1) x 120,000 = 515,396,075,400,000 < 120,000 x 2^32 = 515,396,075,520,000.
    assert.equal(acceptsCandidate(TWO_32 - 1, 120000, 120000), true);
    assert.equal(acceptsCandidate(TWO_32 - 1, 120000, 119999), false);
    // A zero rate accepts nothing, even the smallest draw: 0 x lambdaMax = 0 is not below 0.
    assert.equal(acceptsCandidate(0, 60000, 0), false);
  });

  test("the destination product near 2^53 is exact", () => {
    // Weights SF 2^20 - 1, PEN 1: W = 2^20, cumulative SF 1,048,575, PEN 1,048,576.
    // dest = 2^32 - 1: product (2^32 - 1) x 2^20 = 4,503,599,626,321,920 = 2^52 - 2^20, just under 2^53 / 2;
    // / 2^32 = 2^20 - 2^-12, floor 1,048,575, not below SF's cumulative 1,048,575, so PEN.
    const w = { SF: 1048575, PEN: 1, SJ: 0, EB: 0 };
    assert.equal(pickDestination(TWO_32 - 1, w), "PEN");
    // SF needs index < 1,048,575, that is dest x 2^20 / 2^32 = dest / 4096 < 1,048,575, dest < 4,294,963,200.
    assert.equal(pickDestination(4294963199, w), "SF");
    assert.equal(pickDestination(4294963200, w), "PEN");
  });
});

describe("destination selection", () => {
  test("exactly at a cumulative boundary the draw moves to the next area", () => {
    // Weights 25 each: cumulative 25, 50, 75, 100. index = floor(dest x 100 / 2^32).
    // dest = 2^30: 2^30 x 100 / 2^32 = 25 exactly, not below 25, so PEN. dest = 2^30 - 1: 24.99999998 -> 24, SF.
    // dest = 2^31: 50, SJ. dest = 3 x 2^30 = 3,221,225,472: 75, EB. dest = 2^32 - 1: 99, EB. dest = 0: SF.
    const w = { SF: 25, PEN: 25, SJ: 25, EB: 25 };
    assert.equal(pickDestination(TWO_30, w), "PEN");
    assert.equal(pickDestination(TWO_30 - 1, w), "SF");
    assert.equal(pickDestination(TWO_31, w), "SJ");
    assert.equal(pickDestination(TWO_31 - 1, w), "PEN");
    assert.equal(pickDestination(3 * TWO_30, w), "EB");
    assert.equal(pickDestination(TWO_32 - 1, w), "EB");
    assert.equal(pickDestination(0, w), "SF");
  });

  test("a zero weight is skipped", () => {
    // SF 0, PEN 0, SJ 1, EB 1: cumulative 0, 0, 1, 2; dest 0 gives index 0, below 1, so SJ.
    assert.equal(pickDestination(0, { SF: 0, PEN: 0, SJ: 1, EB: 1 }), "SJ");
    assert.equal(pickDestination(TWO_31, { SF: 0, PEN: 0, SJ: 1, EB: 1 }), "EB");
  });

  test("the period comes from the peak windows: start inclusive, end exclusive", () => {
    const s = defaultScenario();
    // 25,199 is D1 06:59:59; 25,200 is 07:00; 32,399 is 08:59:59; 32,400 is 09:00; 57,600 is 16:00; 68,400 is 19:00.
    assert.equal(destinationPeriod(s, 25199), "other");
    assert.equal(destinationPeriod(s, 25200), "morning");
    assert.equal(destinationPeriod(s, 32399), "morning");
    assert.equal(destinationPeriod(s, 32400), "other");
    assert.equal(destinationPeriod(s, 57600), "evening");
    assert.equal(destinationPeriod(s, 68399), "evening");
    assert.equal(destinationPeriod(s, 68400), "other");
    // Day 2 07:00 is 86,400 + 25,200 = 111,600.
    assert.equal(destinationPeriod(s, 111600), "morning");
  });
});

describe("acceptance", () => {
  test("at an hour boundary the candidate reads the rate of the hour that contains it", () => {
    // SF default: 15,000 off-peak in hour 6, 60,000 peak in hours 7 and 8, 15,000 in hour 9; envelope 60,000.
    // k0 t 25,199 (hour 6), thin 2^30 - 1: (2^30 - 1) x 60,000 = 64,424,509,380,000 < 15,000 x 2^32
    //    = 64,424,509,440,000, accepted. Period other: SF 55, 15, 15, 15; dest 0 -> SF.
    // k1 t 25,199, thin 2^30: 64,424,509,440,000, equal, rejected.
    // k2 t 25,200 (hour 7), thin 2^30: 64,424,509,440,000 < 60,000 x 2^32 = 257,698,037,760,000, accepted.
    //    Period morning: SF 70, 10, 10, 10; 70 x 2^32 / 100 = 3,006,477,107.2, so dest 3,006,477,108 gives index 70,
    //    not below 70, PEN.
    // k3 t 32,399 (hour 8), thin 2^31 - 1: (2^31 - 1) x 60,000 < 60,000 x 2^32, accepted. dest 3,006,477,107 gives
    //    index 69 (69.99999998), SF.
    // k4 t 32,400 (hour 9), thin 2^31 - 1: 128,849,018,820,000 > 64,424,509,440,000, rejected.
    const s = defaultScenario();
    const world = craftedWorld(s, DEFAULT_LMAX, {
      SF: [
        [25199, TWO_30 - 1, 0],
        [25199, TWO_30, 0],
        [25200, TWO_30, 3006477108],
        [32399, TWO_31 - 1, 3006477107],
        [32400, TWO_31 - 1, 0],
      ],
    });
    assert.deepEqual(acceptedRequests(world, s), [
      { id: "r-SF-0", time_s: 25199, origin: "SF", dest: "SF" },
      { id: "r-SF-2", time_s: 25200, origin: "SF", dest: "PEN" },
      { id: "r-SF-3", time_s: 32399, origin: "SF", dest: "SF" },
    ]);
  });

  test("the destination boundary vector through acceptedRequests, with a flat hour-10 mix of 25 each", () => {
    // Hour 10 is off-peak (period other). Every candidate uses thin 0, which is accepted at any positive rate.
    const s = defaultScenario();
    s.dest_weights.other.SJ = { SF: 25, PEN: 25, SJ: 25, EB: 25 };
    assertValid(s);
    const world = craftedWorld(s, DEFAULT_LMAX, {
      SJ: [
        [36000, 0, TWO_30 - 1],
        [36001, 0, TWO_30],
        [36002, 0, 3 * TWO_30 - 1],
        [36003, 0, 3 * TWO_30],
      ],
    });
    assert.deepEqual(acceptedRequests(world, s).map((r) => r.dest), ["SF", "PEN", "SJ", "EB"]);
  });

  test("requests sort by time, then by id as text", () => {
    // SF candidates 0 to 8 at 36,000 carry thin 2^32 - 1, rejected at the off-peak 15,000; candidates 9 and 10
    // (thin 0) are accepted at 36,000. PEN candidate 0 is accepted at 36,000 too. Text order: "r-PEN-0" < "r-SF-10"
    // < "r-SF-9" ("1" sorts before "9").
    const s = defaultScenario();
    const sf = Array.from({ length: 11 }, (_, k) => [36000, k < 9 ? TWO_32 - 1 : 0, 0]);
    const world = craftedWorld(s, DEFAULT_LMAX, { SF: sf, PEN: [[36000, 0, 0]] });
    assert.deepEqual(acceptedRequests(world, s).map((r) => r.id), ["r-PEN-0", "r-SF-10", "r-SF-9"]);
  });

  test("an arm whose rate exceeds the world's envelope is refused (P18)", () => {
    const declared = defaultScenario();
    const world = buildWorld(declared, { seed: 1001 });
    const arm = applyAxis(declared, "parameter:DEM-1.SJ", 45);
    assert.throws(() => acceptedRequests(world, arm), /envelope/);
  });

  test("an arm with a different name, window or sigma cannot read the world", () => {
    const declared = defaultScenario();
    const world = buildWorld(declared, { seed: 1001 });
    const renamed = { ...declared, name: "other_map" };
    assert.throws(() => acceptedRequests(world, renamed), /name/);
    const shifted = { ...declared, window: { start_s: 21600, end_s: 122400 } };
    assert.throws(() => acceptedRequests(world, shifted), /window/);
    const varied = { ...declared, sigma_permille: 150 };
    assert.throws(() => acceptedRequests(world, varied), /variation/);
  });
});

describe("lambda profiles", () => {
  test("the flat shape is the half-even mean of the peaked rates over the window's whole hours", () => {
    // Window 18,000 to 122,400: whole hours 5 to 33, 29 hours. Peak hours of day 7, 8, 16, 17, 18 fall on hours
    // 7, 8, 16, 17, 18 and 31, 32 (D2 07:00 and 08:00): 7 peak hours and 22 off-peak hours.
    // SF: 7 x 60,000 + 22 x 15,000 = 750,000; / 29 = 25,862.07 -> 25,862.
    // PEN: 7 x 20,000 + 22 x 8,000 = 316,000; / 29 = 10,896.55 -> 10,897.
    // SJ: 7 x 35,000 + 22 x 10,000 = 465,000; / 29 = 16,034.48 -> 16,034.
    // EB: 7 x 30,000 + 22 x 8,000 = 386,000; / 29 = 13,310.34 -> 13,310.
    const flat = applyAxis(defaultScenario(), "parameter:DEM-5", "flat");
    const profile = lambdaProfilePermille(flat);
    const expected = { SF: 25862, PEN: 10897, SJ: 16034, EB: 13310 };
    for (const [id, value] of Object.entries(expected)) assert.deepEqual(profile[id], new Array(48).fill(value), id);
    assert.deepEqual(ownLambdaMaxPermille(flat), expected);
    // The flat total differs from the peaked total by at most 0.5 thousandths per window hour:
    // SF 25,862 x 29 = 749,998, off by 2 <= 14.5.
    assert.ok(Math.abs(25862 * 29 - 750000) <= 29 / 2);
  });

  test("an exact half in the flat mean rounds to even", () => {
    // Window 18,000 to 75,600 (D1 05:00 to 21:00): whole hours 5 to 20, 16 hours; peak hours 7, 8, 16, 17, 18.
    // SF peak 61, off-peak 16: 5 x 61,000 + 11 x 16,000 = 481,000; / 16 = 30,062.5 -> 30,062.
    // PEN peak 21, off-peak 8: 5 x 21,000 + 11 x 8,000 = 193,000; / 16 = 12,062.5 -> 12,062.
    // SJ peak 35, off-peak 11: 175,000 + 121,000 = 296,000; / 16 = 18,500 exactly.
    // EB peak 31, off-peak 9: 155,000 + 99,000 = 254,000; / 16 = 15,875 exactly.
    const s = defaultScenario();
    s.window = { start_s: 18000, end_s: 75600 };
    s.placement_snapshot_s = 72000;
    s.policies.recall_s = 72000;
    s.policies.release_s = null;
    s.demand_shape = "flat";
    const rates = { SF: [61, 16], PEN: [21, 8], SJ: [35, 11], EB: [31, 9] };
    for (const area of s.areas) [area.peak_per_h, area.offpeak_per_h] = rates[area.id];
    assertValid(s);
    assert.deepEqual(ownLambdaMaxPermille(s), { SF: 30062, PEN: 12062, SJ: 18500, EB: 15875 });
  });

  test("a window that starts and ends inside an hour averages only its whole hours", () => {
    // Window 19,800 (05:30) to 34,200 (09:30), 4 hours: whole hours 6, 7, 8.
    // SF: 15,000 + 60,000 + 60,000 = 135,000; / 3 = 45,000. Peaked, the own maximum over hours 5 to 9 is 60,000.
    const s = defaultScenario();
    s.window = { start_s: 19800, end_s: 34200 };
    s.warmup_end_s = 21600;
    s.placement_snapshot_s = 34200;
    s.policies.recall_s = 30000;
    s.policies.release_s = null;
    assertValid(s);
    assert.equal(ownLambdaMaxPermille(s).SF, 60000);
    s.demand_shape = "flat";
    assert.equal(ownLambdaMaxPermille(s).SF, 45000);
  });

  test("the shared envelope takes each area's larger maximum", () => {
    // DEM-1.SJ 45 lifts SJ to 45,000; the other areas keep their own peaks.
    const a = defaultScenario();
    const b = applyAxis(a, "parameter:DEM-1.SJ", 45);
    assert.deepEqual(sharedLambdaMaxPermille([a, b]), { SF: 60000, PEN: 20000, SJ: 45000, EB: 30000 });
    // flat against peaked: the peaked maxima dominate every area.
    const flat = applyAxis(a, "parameter:DEM-5", "flat");
    assert.deepEqual(sharedLambdaMaxPermille([flat, a]), DEFAULT_LMAX);
  });
});

describe("candidate stream", () => {
  test("candidates follow the gap rule from the window start and stop at the window end", () => {
    const s = defaultScenario();
    const world = buildWorld(s, { seed: 1001 });
    const exp = expTable();
    for (const id of ["SF", "PEN", "SJ", "EB"]) {
      const lmax = BigInt(DEFAULT_LMAX[id]);
      const { t_s, thin, dest } = world.candidates[id];
      let t = s.window.start_s;
      for (let k = 0; k < t_s.length; k++) {
        t += Number(roundHalfEvenDiv(BigInt(exp[refU16(s.name, "gap", id, k)]) * 3600n, lmax));
        assert.equal(t_s[k], t, `${id} candidate ${k} time`);
        assert.equal(thin[k], refU32(s.name, "thin", id, k), `${id} candidate ${k} thin`);
        assert.equal(dest[k], refU32(s.name, "dest", id, k), `${id} candidate ${k} dest`);
      }
      assert.ok(t_s[t_s.length - 1] < s.window.end_s);
      const next = t + Number(roundHalfEvenDiv(BigInt(exp[refU16(s.name, "gap", id, t_s.length)]) * 3600n, lmax));
      assert.ok(next >= s.window.end_s, `${id} stops at the first candidate at or after the window end`);
    }
    assert.ok(Object.isFrozen(world) && Object.isFrozen(world.candidates.SF) && Object.isFrozen(world.candidates.SF.t_s));
  });

  test("the demand key is the scenario name, not the seed", () => {
    const s = defaultScenario();
    assert.deepEqual(buildWorld(s, { seed: 1001 }).candidates, buildWorld(s, { seed: 1002 }).candidates);
    const renamed = { ...s, name: "renamed_map" };
    assert.notDeepEqual(buildWorld(renamed, { seed: 1001 }).candidates.SF, buildWorld(s, { seed: 1001 }).candidates.SF);
  });

  test("an area with a zero envelope has no candidates; an envelope below the scenario's own maximum is refused", () => {
    const s = defaultScenario();
    s.areas[1].offpeak_per_h = 0;
    s.areas[1].peak_per_h = 1;
    assert.throws(() => buildWorld(s, { seed: 1, lambdaMaxPermille: { PEN: 999 } }), /below/);
    assert.throws(() => buildWorld(s, { seed: 1, lambdaMaxPermille: { XX: 1000 } }), /unknown area/);
    assert.throws(() => buildWorld(s, { seed: 1, lambdaMaxPermille: { SF: 120001 } }), RangeError);
    assert.throws(() => buildWorld(s, { seed: 1.5 }), RangeError);
    // A scenario with no PEN demand in the window: a 4-hour window 09:00 to 13:00 is all off-peak, and PEN off-peak is 0.
    const quiet = defaultScenario();
    quiet.window = { start_s: 32400, end_s: 46800 };
    quiet.warmup_end_s = 36000;
    quiet.placement_snapshot_s = 46800;
    quiet.policies.recall_s = 40000;
    quiet.policies.release_s = null;
    quiet.areas[1].offpeak_per_h = 0;
    assertValid(quiet);
    const world = buildWorld(quiet, { seed: 1 });
    assert.equal(world.lambdaMaxPermille.PEN, 0);
    assert.deepEqual([...world.candidates.PEN.t_s], []);
  });
});

describe("pairing on one shared envelope", () => {
  const declared = defaultScenario();
  const more = applyAxis(declared, "parameter:DEM-1.SJ", 45);
  const shared = sharedLambdaMaxPermille([declared, more]);

  test("both arms build identical candidates and one world digest", () => {
    const a = buildWorld(declared, { seed: 1003, lambdaMaxPermille: shared });
    const b = buildWorld(more, { seed: 1003, lambdaMaxPermille: shared });
    assert.deepEqual(a.candidates, b.candidates);
    assert.equal(worldDigest(a), worldDigest(b));
    // A non-demand axis leaves the accepted requests identical.
    const fewerCars = applyAxis(declared, "parameter:SUP-1.SJ", 16);
    assert.deepEqual(acceptedRequests(a, fewerCars), acceptedRequests(a, declared));
  });

  test("a DEM-1 axis nests: every request of the lower arm is in the higher arm with the same second and destination", () => {
    const world = buildWorld(declared, { seed: 1003, lambdaMaxPermille: shared });
    const low = acceptedRequests(world, declared);
    const high = acceptedRequests(world, more);
    const byId = new Map(high.map((r) => [r.id, r]));
    for (const r of low) assert.deepEqual(byId.get(r.id), r);
    assert.ok(high.length > low.length);
    // Only SJ gains requests: every other area's requests are identical.
    const notSj = (list) => list.filter((r) => r.origin !== "SJ");
    assert.deepEqual(notSj(high), notSj(low));
  });

  test("a DEM-5 axis shares candidates but does not nest", () => {
    const flat = applyAxis(declared, "parameter:DEM-5", "flat");
    const envelope = sharedLambdaMaxPermille([flat, declared]);
    const world = buildWorld(flat, { seed: 1003, lambdaMaxPermille: envelope });
    assert.equal(worldDigest(world), worldDigest(buildWorld(declared, { seed: 1003, lambdaMaxPermille: envelope })));
    const flatIds = new Set(acceptedRequests(world, flat).map((r) => r.id));
    const peakedIds = new Set(acceptedRequests(world, declared).map((r) => r.id));
    const onlyFlat = [...flatIds].filter((id) => !peakedIds.has(id));
    const onlyPeaked = [...peakedIds].filter((id) => !flatIds.has(id));
    assert.ok(onlyFlat.length > 0, "the flat arm accepts some off-peak candidates the peaked arm rejects");
    assert.ok(onlyPeaked.length > 0, "the peaked arm accepts some peak candidates the flat arm rejects");
  });

  test("accepted requests apply the thinning and destination rules to each candidate", () => {
    const world = buildWorld(declared, { seed: 1003, lambdaMaxPermille: shared });
    const expected = [];
    for (const id of ["SF", "PEN", "SJ", "EB"]) {
      const area = more.areas.find((x) => x.id === id);
      const { t_s, thin, dest } = world.candidates[id];
      for (let k = 0; k < t_s.length; k++) {
        const hod = Math.floor(t_s[k] / 3600) % 24;
        const peak = (hod >= 7 && hod < 9) || (hod >= 16 && hod < 19);
        const lambda = (peak ? area.peak_per_h : area.offpeak_per_h) * 1000;
        if (!(BigInt(thin[k]) * BigInt(shared[id]) < BigInt(lambda) * 4294967296n)) continue;
        const period = hod >= 7 && hod < 9 ? "morning" : hod >= 16 && hod < 19 ? "evening" : "other";
        const weights = more.dest_weights[period][id];
        const total = ["SF", "PEN", "SJ", "EB"].reduce((sum, x) => sum + weights[x], 0);
        const index = Number((BigInt(dest[k]) * BigInt(total)) >> 32n);
        let cumulative = 0;
        const to = ["SF", "PEN", "SJ", "EB"].find((x) => (cumulative += weights[x]) > index);
        expected.push({ id: `r-${id}-${k}`, time_s: t_s[k], origin: id, dest: to });
      }
    }
    expected.sort((a, b) => a.time_s - b.time_s || (a.id < b.id ? -1 : 1));
    assert.deepEqual(acceptedRequests(world, more), expected);
  });
});

describe("worldDigest", () => {
  const s = defaultScenario();

  test("equals SHA-256 of the canonical JSON the contract lists, and is stable", () => {
    const world = buildWorld(s, { seed: 1001 });
    const candidates = {};
    for (const id of ["EB", "PEN", "SF", "SJ"]) {
      const c = world.candidates[id];
      candidates[id] = c.t_s.map((t, k) => [t, c.thin[k], c.dest[k]]);
    }
    // Keys written in code-point order so JSON.stringify gives the canonical bytes.
    const text = JSON.stringify({
      candidates,
      lambdaMax: { EB: 30000, PEN: 20000, SF: 60000, SJ: 35000 },
      name: "bay_teaching_map",
      seed: 1001,
      sigma_permille: 0,
      table_digests: { exp: TABLE_DIGESTS.exp, mult_0: TABLE_DIGESTS.mult_0 },
      window: { end_s: 122400, start_s: 18000 },
    });
    const expected = createHash("sha256").update(text, "utf8").digest("hex");
    assert.equal(worldDigest(world), expected);
    assert.equal(worldDigest(world), expected);
    assert.equal(worldDigest(buildWorld(s, { seed: 1001 })), expected);
  });

  test("changes with each input and with nothing else", () => {
    const base = worldDigest(buildWorld(s, { seed: 1001 }));
    const variants = {
      name: [{ ...s, name: "bay_teaching_map_b" }, { seed: 1001 }],
      window_start: [{ ...s, window: { start_s: 18001, end_s: 122400 } }, { seed: 1001 }],
      window_end: [{ ...s, window: { start_s: 18000, end_s: 122399 } }, { seed: 1001 }],
      envelope: [s, { seed: 1001, lambdaMaxPermille: { EB: 30001 } }],
      seed: [s, { seed: 1002 }],
      sigma: [{ ...s, sigma_permille: 150 }, { seed: 1001 }],
    };
    const seen = new Set([base]);
    for (const [label, [scenario, options]] of Object.entries(variants)) {
      const digest = worldDigest(buildWorld(scenario, options));
      assert.ok(!seen.has(digest), `${label} changes the world digest`);
      seen.add(digest);
    }
    // Knobs outside the world leave it unchanged: cars, depots, destination mix, congestion, rates under the envelope.
    let other = applyAxis(s, "parameter:SUP-1.SF", 50);
    other = applyAxis(other, "parameter:DEP-3.SF-1", 6);
    other = applyAxis(other, "parameter:RD-3.highway.evening", 2000);
    other = applyAxis(other, "parameter:DEM-2.SF", 10);
    other = applyAxis(other, "policy:depot_assignment", "nearest_depot");
    other.dest_weights.other.SF = { SF: 1, PEN: 1, SJ: 1, EB: 1 };
    assertValid(other);
    assert.equal(worldDigest(buildWorld(other, { seed: 1001, lambdaMaxPermille: DEFAULT_LMAX })), base);
  });
});

describe("factors", () => {
  test("with sigma 0 every factor is 10^6 and realized seconds equal planned seconds", () => {
    const world = buildWorld(defaultScenario(), { seed: 1006 });
    assert.equal(world.trafficPpm("H2", "SJ>SF", 74), 1000000);
    assert.equal(world.trafficPpm("IN-SJ", "-", 74), 1000000);
    assert.equal(world.trafficPpm("ACC-SJ-1", "IN", 74), 1000000);
    assert.equal(world.ridePpm("r-SJ-0"), 1000000);
    for (const planned of [0, 1, 390, 4628, 14400]) {
      assert.equal(realizedSeconds(planned, world.trafficPpm("H2", "SJ>SF", 74), world.ridePpm("r-SJ-0")), planned);
      assert.equal(realizedSeconds(planned, 1000000), planned);
    }
  });

  test("with sigma 0.15 factors are read from the pinned table at the keyed index", () => {
    const s = { ...defaultScenario(), sigma_permille: 150 };
    const world = buildWorld(s, { seed: 1006 });
    const table = multiplierTable(150);
    const cases = [
      ["H2", "SJ>SF", 74],
      ["L2", "SJ>SF", 74],
      ["H2", "SF>SJ", 74],
      ["H2", "SJ>SF", 75],
      ["IN-SJ", "-", 74],
      ["ACC-SJ-1", "IN", 74],
      ["ACC-SJ-1", "OUT", 74],
    ];
    const values = new Set();
    for (const [key, dir, qh] of cases) {
      const expected = table[refU16(1006, "traffic", key, dir, qh)];
      assert.equal(world.trafficPpm(key, dir, qh), expected, `${key} ${dir} ${qh}`);
      assert.equal(world.trafficPpm(key, dir, qh), expected, `${key} ${dir} ${qh} (cached)`);
      assert.equal(trafficPpm(1006, key, dir, qh, 150), expected);
      values.add(expected);
    }
    assert.ok(values.size > 1, "different keys draw different factors");
    for (const id of ["r-SJ-0", "r-SF-12"]) {
      assert.equal(world.ridePpm(id), table[refU16(1006, "ride", id)]);
      assert.equal(ridePpm(1006, id, 150), table[refU16(1006, "ride", id)]);
    }
    // The seed keys the factors: another seed reads other entries for the same keys.
    const other = buildWorld(s, { seed: 1007 });
    assert.equal(other.trafficPpm("H2", "SJ>SF", 74), table[refU16(1007, "traffic", "H2", "SJ>SF", 74)]);
    assert.throws(() => trafficPpm(1006, "H2", "SJ>SF", 74, 120), RangeError);
  });

  test("realized seconds round the exact product half to even", () => {
    // 5 x 1.1 = 5.5 -> 6; 15 x 1.1 = 16.5 -> 16; 1 x 1.5 = 1.5 -> 2; 1 x 2.5 = 2.5 -> 2.
    assert.equal(realizedSeconds(5, 1100000, 1000000), 6);
    assert.equal(realizedSeconds(15, 1100000), 16);
    assert.equal(realizedSeconds(1, 1500000, 1000000), 2);
    assert.equal(realizedSeconds(1, 2500000, 1000000), 2);
    // Both factors: 4628 x 1.1 x 1.05 = 4628 x 1.155 = 5,345.34 -> 5,345.
    assert.equal(realizedSeconds(4628, 1100000, 1050000), 5345);
    // Order of the factors does not matter: 1.05 x 1.1 is the same product.
    assert.equal(realizedSeconds(4628, 1050000, 1100000), 5345);
    // A product far beyond 2^53: 14,400 x 8,800,000 x 8,800,000 = 1.115136 x 10^18; / 10^12 = 1,115,136 exactly.
    assert.equal(realizedSeconds(14400, 8800000, 8800000), 1115136);
    // 3 x 8,800,001 x 8,800,001 = 232,320,052,800,003; / 10^12 = 232.3200528 -> 232.
    assert.equal(realizedSeconds(3, 8800001, 8800001), 232);
  });

  test("factor keys and quarter hours of each segment kind", () => {
    assert.deepEqual(segmentFactorKey({ kind: "ROUTE", route_id: "H2", from: "SJ", to: "SF" }), { key: "H2", dir: "SJ>SF" });
    assert.deepEqual(segmentFactorKey({ kind: "IN_AREA", area: "SJ" }), { key: "IN-SJ", dir: "-" });
    assert.deepEqual(segmentFactorKey({ kind: "ACCESS", depot: "SJ-1", dir: "IN" }), { key: "ACC-SJ-1", dir: "IN" });
    assert.equal(segmentFactorKey({ kind: "PULL_OUT" }), null);
    // 66,600 / 900 = 74 exactly; 66,599 is in quarter hour 73.
    assert.equal(quarterHour(66600), 74);
    assert.equal(quarterHour(66599), 73);
  });
});

describe("performance on the design 5.9 reference preset", { skip: process.env.FLEET_PLAYGROUND_PERF !== "1" }, () => {
  test("building the world and accepted requests for 150 cars over 29 hours stays well under the run budget", () => {
    let s = defaultScenario();
    for (const [id, cars] of [["SF", 50], ["PEN", 30], ["SJ", 40], ["EB", 30]]) s = applyAxis(s, `parameter:SUP-1.${id}`, cars);
    s.sigma_permille = 150;
    assertValid(s);
    const t0 = performance.now();
    const world = buildWorld(s, { seed: 1001 });
    const t1 = performance.now();
    const requests = acceptedRequests(world, s);
    const t2 = performance.now();
    worldDigest(world);
    const t3 = performance.now();
    assert.ok(requests.length > 0);
    // One Sandbox run has 500 ms; the world is a small share of it.
    assert.ok(t3 - t0 < 250, `world ${Math.round(t1 - t0)} ms, requests ${Math.round(t2 - t1)} ms, digest ${Math.round(t3 - t2)} ms`);
  });
});
