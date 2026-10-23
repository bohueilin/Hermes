import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import {
  SIGMA_GRID_PERMILLE,
  TABLE_DIGESTS,
  expTable,
  multiplierTable,
  tableDigestHex,
  verifyTable,
} from "../src/core/tables.js";

const SIZE = 65536;

/** SHA-256 of an Int32Array's little-endian bytes through node:crypto, independent of src/core/sha256.js. */
function nodeDigest(table) {
  const buffer = Buffer.alloc(table.length * 4);
  for (let i = 0; i < table.length; i++) buffer.writeInt32LE(table[i], 4 * i);
  return createHash("sha256").update(buffer).digest("hex");
}

// Independent reference entries. Produced by a scratch Python script with the decimal module at 60 significant
// digits, not by this code: exp entries are round_half_even(1000 × -(1 - Decimal(i) / 65536).ln()); z_i is found by
// 210 bisection steps on Phi(z) = erfc(-z / sqrt(2)) / 2, with erfc = 1 - erf and erf from its Taylor series
// (2 / sqrt(pi)) × sum (-1)^n x^(2n+1) / (n! (2n+1)) in decimal, pi from Machin's formula in decimal; multiplier
// entries are round_half_even(10^6 × (sigma × z_i).exp()) with sigma Decimal("0.15") and Decimal("0.5"). The same
// script reported every listed entry at least 0.0059 of a unit away from a .5 boundary, so half-even is unambiguous.
// Indices: 0, 1, 2, 32767, 32768, 65534, 65535 and every multiple of 4099 below 65536.
const REFERENCE_INDICES = [
  0, 1, 2, 4099, 8198, 12297, 16396, 20495, 24594, 28693, 32767, 32768, 32792, 36891, 40990, 45089, 49188, 53287, 57386,
  61485, 65534, 65535,
];
const REFERENCE_EXP = [
  0, 0, 0, 65, 134, 208, 288, 375, 470, 576, 693, 693, 694, 828, 982, 1165, 1388, 1677, 2085, 2784, 10397, 11090,
];
const REFERENCE_MULT_150 = [
  522705, 542574, 552466, 794492, 841575, 875473, 903858, 929400, 953435, 976802, 999997, 1000003, 1000141, 1024041,
  1049150, 1076304, 1106760, 1142716, 1188897, 1259820, 1843067, 1913125,
];
const REFERENCE_MULT_500 = [
  115042, 130276, 138363, 464477, 562742, 641912, 713948, 783445, 853041, 924743, 999990, 1000010, 1000469, 1082408,
  1173433, 1277762, 1402311, 1560013, 1780248, 2159540, 7676036, 8692491,
];

/**
 * Float standard normal quantiles at (i + 0.5) / 65536 for the upper half (index j = i - 32768), test-only.
 * Newton on phi(z) S(z) = q with S(z) = z + z^3/3 + z^5/15 + ..., q = (j + 0.5) / 65536, walking up from z = 0.
 */
function floatUpperQuantiles() {
  const rootTwoPi = Math.sqrt(2 * Math.PI);
  const out = new Float64Array(SIZE / 2);
  let z = 0;
  for (let j = 0; j < SIZE / 2; j++) {
    const q = (j + 0.5) / SIZE;
    for (let iteration = 0; iteration < 200; iteration++) {
      const z2 = z * z;
      let term = z;
      let series = z;
      for (let odd = 3; Math.abs(term) > 1e-18 * Math.abs(series); odd += 2) {
        term = (term * z2) / odd;
        series += term;
      }
      const step = q * rootTwoPi * Math.exp(z2 / 2) - series;
      z += step;
      if (Math.abs(step) < 1e-14) break;
    }
    out[j] = z;
  }
  return out;
}

describe("exponential table", () => {
  test("has 65,536 entries matching the pinned digest, through node:crypto and through sha256.js", () => {
    const table = expTable();
    assert.ok(table instanceof Int32Array);
    assert.equal(table.length, SIZE);
    assert.equal(nodeDigest(table), TABLE_DIGESTS.exp);
    assert.equal(tableDigestHex(table), TABLE_DIGESTS.exp);
  });

  test("is memoized", () => {
    assert.equal(expTable(), expTable());
  });

  test("endpoints: entry 0 is 0 and entry 65535 is 11090", () => {
    // -ln(1 - 0) = 0. -ln(1 - 65535/65536) = ln(65536) = 16 ln 2 = 11.0903548889...; × 1000 = 11090.35 -> 11090.
    const table = expTable();
    assert.equal(table[0], 0);
    assert.equal(table[65535], 11090);
  });

  test("matches the decimal reference entries", () => {
    const table = expTable();
    assert.deepEqual(
      REFERENCE_INDICES.map((i) => table[i]),
      REFERENCE_EXP,
    );
  });

  test("is within 1 unit of the float value 1000 × -Math.log(1 - i / 65536) at every index", () => {
    const table = expTable();
    for (let i = 0; i < SIZE; i++) {
      const float = -1000 * Math.log(1 - i / SIZE);
      assert.ok(Math.abs(table[i] - float) <= 1, `index ${i}: ${table[i]} against ${float}`);
    }
  });

  test("is non-decreasing", () => {
    // Adjacent exact values differ by 1000 × ln((65536 - i) / (65535 - i)) >= 1000 × ln(65536 / 65535) = 0.0153, so
    // rounding can repeat a value but never reverse the order.
    const table = expTable();
    for (let i = 1; i < SIZE; i++) assert.ok(table[i] >= table[i - 1], `index ${i}`);
  });
});

describe("multiplier tables", () => {
  test("every sigma on the grid matches its pinned digest, through node:crypto and through sha256.js", () => {
    assert.deepEqual(SIGMA_GRID_PERMILLE, [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);
    assert.deepEqual(Object.keys(TABLE_DIGESTS).sort(), ["exp", ...SIGMA_GRID_PERMILLE.map((s) => `mult_${s}`)].sort());
    for (const sigma of SIGMA_GRID_PERMILLE) {
      const table = multiplierTable(sigma);
      assert.ok(table instanceof Int32Array);
      assert.equal(table.length, SIZE);
      assert.equal(nodeDigest(table), TABLE_DIGESTS[`mult_${sigma}`], `sigma ${sigma}`);
      assert.equal(tableDigestHex(table), TABLE_DIGESTS[`mult_${sigma}`], `sigma ${sigma}`);
    }
  });

  test("is memoized per sigma", () => {
    assert.equal(multiplierTable(150), multiplierTable(150));
    assert.notEqual(multiplierTable(150), multiplierTable(200));
  });

  test("sigma 0 gives exactly 1,000,000 everywhere", () => {
    const table = multiplierTable(0);
    for (let i = 0; i < SIZE; i++) assert.equal(table[i], 1000000, `index ${i}`);
  });

  test("rejects sigma values off the grid", () => {
    for (const bad of [25, -50, 550, 1000, 150.5, "150", 150n, Number.NaN, null, undefined]) {
      assert.throws(() => multiplierTable(bad), RangeError, `sigma ${String(bad)}`);
    }
  });

  test("sigma 150 and 500 match the decimal reference entries", () => {
    const t150 = multiplierTable(150);
    const t500 = multiplierTable(500);
    assert.deepEqual(
      REFERENCE_INDICES.map((i) => t150[i]),
      REFERENCE_MULT_150,
    );
    assert.deepEqual(
      REFERENCE_INDICES.map((i) => t500[i]),
      REFERENCE_MULT_500,
    );
  });

  test("sigma 150 and 500 are within 1 unit of 10^6 × Math.exp(sigma × z) with a float quantile at every index", () => {
    const upper = floatUpperQuantiles();
    for (const sigma of [150, 500]) {
      const table = multiplierTable(sigma);
      for (let i = 0; i < SIZE; i++) {
        const z = i >= SIZE / 2 ? upper[i - SIZE / 2] : -upper[SIZE / 2 - 1 - i];
        const float = 1e6 * Math.exp((sigma / 1000) * z);
        assert.ok(Math.abs(table[i] - float) <= 1, `sigma ${sigma} index ${i}: ${table[i]} against ${float}`);
      }
    }
  });

  test("mirror entries multiply to 10^12 up to the rounding of both", () => {
    // z at index 65535 - i is -z_i, so the exact values are A and B = 10^12 / A. With m_i = A + e1 and
    // m_j = B + e2, |e1|, |e2| <= 1/2: m_i m_j - 10^12 = A e2 + B e1 + e1 e2, so the gap is at most
    // (A + B) / 2 + 1/4 <= (m_i + 1/2 + m_j + 1/2) / 2 + 1/4 = (m_i + m_j) / 2 + 3/4.
    // One side is at most 10^6 and the other at most 8.7 × 10^6, so products stay below 8.7 × 10^12 < 2^53 and the
    // double arithmetic is exact.
    for (const sigma of SIGMA_GRID_PERMILLE) {
      const table = multiplierTable(sigma);
      for (let i = 0; i < SIZE / 2; i++) {
        const a = table[i];
        const b = table[SIZE - 1 - i];
        const gap = Math.abs(a * b - 1e12);
        assert.ok(gap <= (a + b) / 2 + 0.75, `sigma ${sigma} index ${i}: ${a} × ${b}`);
        assert.ok(a <= 1000000 && b >= 1000000, `sigma ${sigma} index ${i} sides`);
      }
    }
  });

  test("is strictly increasing for every sigma above 0", () => {
    // Exact entry i is 10^6 exp(σ z_i), and z moves by 1/65536 in probability per index, so its slope in i is
    // 10^6 σ exp(σ z) sqrt(2π) exp(z^2 / 2) / 65536, smallest at z = -σ where it is 10^6 σ sqrt(2π) exp(-σ^2 / 2) / 65536.
    // Over one index the exact values rise by at least that minimum: at σ = 0.05 it is
    // 10^6 × 0.05 × 2.5066 × 0.99875 / 65536 = 1.91 > 1, and larger for every larger σ on the grid,
    // so two rounded neighbours can never be equal.
    for (const sigma of SIGMA_GRID_PERMILLE.filter((s) => s > 0)) {
      const table = multiplierTable(sigma);
      for (let i = 1; i < SIZE; i++) assert.ok(table[i] > table[i - 1], `sigma ${sigma} index ${i}`);
    }
  });
});

describe("digest verification", () => {
  test("verifyTable accepts the built table and rejects a copy with one entry changed or an unknown name", () => {
    const table = multiplierTable(50);
    assert.equal(verifyTable("mult_50", table), table);
    const changed = Int32Array.from(table);
    changed[40000] += 1;
    assert.throws(() => verifyTable("mult_50", changed), /differs from the pinned/);
    assert.throws(() => verifyTable("mult_25", table), RangeError);
    assert.throws(() => tableDigestHex([1, 2, 3]), TypeError);
  });
});

describe("build time (only with FLEET_PLAYGROUND_PERF=1)", { skip: process.env.FLEET_PLAYGROUND_PERF !== "1" }, () => {
  test("a fresh module builds the exponential table and one multiplier table in under 1.5 s", async () => {
    const fresh = await import(`../src/core/tables.js?perf=${Math.floor(performance.now())}`);
    const start = performance.now();
    fresh.expTable();
    fresh.multiplierTable(150);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 1500, `took ${elapsed.toFixed(1)} ms`);
  });
});
