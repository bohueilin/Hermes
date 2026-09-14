import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import { canonicalJson, specDigest, specHashLabel } from "../src/core/canon.js";
import { keyString, keyedU64Source, u16, u32, u64 } from "../src/core/keyed.js";
import { prefixHasher, sha256, sha256Hex, utf8Bytes } from "../src/core/sha256.js";
import {
  meanFleetLab,
  medianFleetLab,
  percentileFleetLab,
  roundHalfEven,
  roundHalfEvenDiv,
  sumLeftToRight,
} from "../src/core/stats.js";
import { bootstrapIndices } from "../src/instrument/bootstrap.js";

/** Deterministic test generator (mulberry32); only tests use it. */
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nodeHex = (data) => createHash("sha256").update(data).digest("hex");
const toHex = (bytes) => Buffer.from(bytes).toString("hex");

/** A string mixing ASCII, two-, three- and four-byte UTF-8 characters. */
function mixedText(next, units) {
  const pools = [
    [0x20, 0x7e],
    [0xa0, 0x7ff],
    [0x800, 0xd7ff],
    [0xe000, 0xfffd],
    [0x10000, 0x10ffff],
  ];
  let text = "";
  while (text.length < units) {
    const [lo, hi] = pools[Math.floor(next() * pools.length)];
    text += String.fromCodePoint(lo + Math.floor(next() * (hi - lo + 1)));
  }
  return text;
}

describe("sha256", () => {
  test("known vectors", () => {
    assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("equals node:crypto on at least 1,000 byte inputs of length 0 to 300", () => {
    const next = generator(20260913);
    let checked = 0;
    for (let length = 0; length <= 300; length++) {
      for (let copy = 0; copy < 3; copy++) {
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) bytes[i] = Math.floor(next() * 256);
        assert.equal(toHex(sha256(bytes)), nodeHex(bytes), `length ${length}`);
        checked++;
      }
    }
    for (const length of [55, 56, 63, 64, 65, 119, 120]) {
      for (const fill of [0x00, 0x61, 0xff]) {
        const bytes = new Uint8Array(length).fill(fill);
        assert.equal(toHex(sha256(bytes)), nodeHex(bytes), `boundary length ${length}`);
        checked++;
      }
    }
    assert.ok(checked >= 900 + 21);
  });

  test("equals node:crypto on non-ASCII text, including lone surrogates", () => {
    const next = generator(7);
    let checked = 0;
    for (let units = 0; units < 150; units++) {
      const text = mixedText(next, units);
      assert.equal(sha256Hex(text), nodeHex(Buffer.from(text, "utf8")), `text of ${units} units`);
      assert.deepEqual(Buffer.from(utf8Bytes(text)), Buffer.from(text, "utf8"));
      checked++;
    }
    for (const text of ["\ud800", "a\udc00b", "\ud83d", "😀", "\udfff\ud800x", "é中😀"]) {
      assert.equal(sha256Hex(text), nodeHex(Buffer.from(text, "utf8")));
      checked++;
    }
    assert.ok(checked >= 156);
  });

  test("prefixHasher equals sha256(prefix + suffix) for short and long prefixes", () => {
    const next = generator(99);
    const prefixByteLengths = [0, 1, 11, 55, 63, 64, 65, 75, 127, 128, 129, 200];
    for (const length of prefixByteLengths) {
      const prefix = "p".repeat(length);
      const hasher = prefixHasher(prefix);
      for (const suffixLength of [0, 1, 8, 20, 52, 53, 56, 64, 65, 130, 300, 5]) {
        const suffix = mixedText(next, suffixLength);
        assert.equal(toHex(hasher(suffix)), nodeHex(Buffer.from(prefix + suffix, "utf8")), `${length}+${suffixLength}`);
      }
    }
    const unicodePrefix = mixedText(next, 90);
    assert.ok(Buffer.byteLength(unicodePrefix, "utf8") > 64);
    const hasher = prefixHasher(unicodePrefix);
    for (let i = 0; i < 50; i++) {
      const suffix = `${i}|${i * 7}`;
      assert.equal(toHex(hasher(suffix)), nodeHex(Buffer.from(unicodePrefix + suffix, "utf8")));
    }
  });
});

describe("keyed", () => {
  const nodeU64 = (parts) => BigInt(`0x${nodeHex(Buffer.from(parts.map(String).join("|"), "utf8")).slice(0, 16)}`);

  test("keyString joins strings and safe integers with a bar", () => {
    assert.equal(keyString(["abc", "bootstrap", 0, 17]), "abc|bootstrap|0|17");
    assert.equal(keyString([-5, Number.MAX_SAFE_INTEGER, "é"]), `-5|${Number.MAX_SAFE_INTEGER}|é`);
    assert.equal(keyString([]), "");
  });

  test("keyString rejects every non-integer part with TypeError", () => {
    const rejected = [2.5, 1e-5, Number.NaN, Infinity, -Infinity, 2 ** 53, -(2 ** 53), true, false, null, undefined, {}, [], [1], 1n];
    for (const part of rejected) {
      assert.throws(() => keyString(["a", part]), TypeError, `part ${typeof part}`);
      assert.throws(() => u64("a", part), TypeError);
    }
    assert.throws(() => keyString("a|b"), TypeError);
  });

  test("u64, u16 and u32 equal the top bits of node:crypto's digest", () => {
    const next = generator(4242);
    for (let i = 0; i < 300; i++) {
      const parts = [mixedText(next, Math.floor(next() * 12)), "bootstrap", Math.floor(next() * 100000), -Math.floor(next() * 50)];
      const expected = nodeU64(parts);
      const value = u64(...parts);
      assert.equal(typeof value, "bigint");
      assert.equal(value, expected);
      assert.equal(u16(...parts), Number(expected >> 48n));
      assert.equal(u32(...parts), Number(expected >> 32n));
    }
    assert.equal(u64("x"), nodeU64(["x"]));
  });

  test("keyedU64Source gives identical values", () => {
    const next = generator(5);
    for (const prefix of [[], ["k"], ["d".repeat(64), "bootstrap"], [mixedText(next, 70), 3]]) {
      const source = keyedU64Source(...prefix);
      for (let i = 0; i < 100; i++) {
        const rest = i % 3 === 0 ? [i] : [i, Math.floor(next() * 1000), "tail"];
        assert.equal(source(...rest), u64(...prefix, ...rest));
      }
      if (prefix.length > 0) assert.equal(source(), u64(...prefix));
    }
    assert.throws(() => keyedU64Source("a", 0.5), TypeError);
    assert.throws(() => keyedU64Source("a")(0.5), TypeError);
  });
});

describe("stats", () => {
  test("roundHalfEven matches Python round() on doubles", () => {
    const table = [
      [0.5, 0], [1.5, 2], [2.5, 2], [3.5, 4], [-0.5, 0], [-1.5, -2], [-2.5, -2], [-3.5, -4],
      [25.5, 26], [26.5, 26], [1019.5, 1020], [2.675, 3], [1e15 + 0.5, 1e15], [1e15 + 1.5, 1e15 + 2],
      [0.49999999999999994, 0], [-0.49999999999999994, 0], [0.5000000000000001, 1], [-0.5000000000000001, -1],
      [2 ** 53, 2 ** 53], [1e300, 1e300], [-7.2, -7], [7.8, 8], [0, 0],
    ];
    for (const [x, expected] of table) assert.equal(roundHalfEven(x), expected, `round(${x})`);
    assert.ok(Object.is(roundHalfEven(-0), 0));
    assert.ok(Object.is(roundHalfEven(-0.4), 0));
    for (const bad of [Number.NaN, Infinity, -Infinity]) assert.throws(() => roundHalfEven(bad), RangeError);
  });

  test("bootstrap indices differ from Math.round exactly where the design measured", () => {
    assert.deepEqual(bootstrapIndices(2000), [49, 1950]);
    assert.equal(bootstrapIndices(1020)[1], 994); // 0.975 * 1020 = 994.5, even neighbour 994
    assert.equal(bootstrapIndices(1060)[0], 25); // 0.025 * 1060 = 26.5, even neighbour 26, minus 1
    let disagreements = 0;
    for (let r = 1000; r <= 100000; r++) {
      const lowDiffers = roundHalfEven(0.025 * r) !== Math.round(0.025 * r);
      const highDiffers = roundHalfEven(0.975 * r) !== Math.round(0.975 * r);
      if (lowDiffers || highDiffers) disagreements++;
    }
    assert.equal(disagreements, 2475); // design section 6, P-6
  });

  test("roundHalfEvenDiv rounds BigInt quotients half to even", () => {
    const table = [
      [5n, 2n, 2n], [7n, 2n, 4n], [-5n, 2n, -2n], [-7n, 2n, -4n], [1n, 3n, 0n], [2n, 3n, 1n],
      [-2n, 3n, -1n], [-1n, 3n, 0n], [10n, 4n, 2n], [14n, 4n, 4n], [0n, 9n, 0n],
      [3000000000000000000001n, 2n, 1500000000000000000000n], [3000000000000000000003n, 2n, 1500000000000000000002n],
    ];
    for (const [n, d, q] of table) assert.equal(roundHalfEvenDiv(n, d), q, `${n}/${d}`);
    // Exhaustive small check: q is the nearest integer to n/d, ties to even, by exact integer comparison.
    for (let d = 1n; d <= 12n; d++) {
      for (let n = -150n; n <= 150n; n++) {
        const q = roundHalfEvenDiv(n, d);
        const distance = 2n * n - 2n * q * d; // 2d times (n/d - q)
        assert.ok(distance <= d && distance >= -d, `${n}/${d}`);
        if (distance === d || distance === -d) assert.equal(q % 2n, 0n);
      }
    }
    assert.throws(() => roundHalfEvenDiv(1n, 0n), RangeError);
    assert.throws(() => roundHalfEvenDiv(1n, -2n), RangeError);
    assert.throws(() => roundHalfEvenDiv(1, 2n), TypeError);
  });

  test("sumLeftToRight and meanFleetLab add left to right", () => {
    assert.equal(sumLeftToRight([1e16, 1.0, -1e16]), 0);
    assert.equal(sumLeftToRight([]), 0);
    assert.ok(Object.is(sumLeftToRight([-0]), 0)); // Python: 0 + -0.0 == 0.0
    assert.equal(sumLeftToRight([0.1, 0.2, 0.3]), (0.1 + 0.2) + 0.3);
    assert.equal(meanFleetLab([1, 2, 4]), 7 / 3);
    assert.throws(() => meanFleetLab([]), RangeError);
  });

  test("medianFleetLab ports _compare, stable for -0 and 0", () => {
    assert.equal(medianFleetLab([3, 1, 2]), 2);
    assert.equal(medianFleetLab([4, 1, 3, 2]), 2.5); // (2 + 3) / 2
    assert.equal(medianFleetLab([7]), 7);
    assert.ok(Object.is(medianFleetLab([0, -0, 5]), -0)); // sorted keeps [0.0, -0.0, 5.0]; middle is -0.0
    assert.ok(Object.is(medianFleetLab([-0, 0, 5]), 0));
    assert.throws(() => medianFleetLab([]), RangeError);
    const input = [3, 1, 2];
    medianFleetLab(input);
    assert.deepEqual(input, [3, 1, 2]);
  });

  test("percentileFleetLab ports run_metrics", () => {
    // position 1.8, low 1, high 2: 120 + 620 * 0.8 = 616
    assert.equal(percentileFleetLab([740, 120, 120], 0.9), 616);
    assert.equal(percentileFleetLab([10, 20, 30, 40], 0.5), 25); // position 1.5: 20 + 10 * 0.5
    assert.equal(percentileFleetLab([5], 0.9), 5);
    assert.equal(percentileFleetLab([9, 9, 9], 0.5), 9);
    assert.equal(percentileFleetLab([1, 2, 3, 4, 5], 0.5), 3);
    assert.throws(() => percentileFleetLab([], 0.5), RangeError);
  });
});

describe("canon", () => {
  test("canonical JSON sorts keys by code unit and has no whitespace", () => {
    const value = { zeta: 1, ab: 2, a_b: 3, aB: 4, alpha: [3, -2, { b: true, a: null }], B: 'é"q', nested: { y: 0, x: -7 } };
    const expected = '{"B":"é\\"q","aB":4,"a_b":3,"ab":2,"alpha":[3,-2,{"a":null,"b":true}],"nested":{"x":-7,"y":0},"zeta":1}';
    assert.equal(canonicalJson(value), expected);
    assert.equal(specDigest(value), createHash("sha256").update(Buffer.from(expected, "utf8")).digest("hex"));
  });

  test("canonical JSON rejects floats, -0, non-finite numbers and non-JSON values", () => {
    class Thing {}
    const bad = [1.5, -0, Number.NaN, Infinity, -Infinity, 2 ** 53, undefined, () => 1, 1n, new Thing(), new Map(), Symbol("s")];
    for (const item of bad) {
      assert.throws(() => canonicalJson({ ok: 1, item }), TypeError);
      assert.throws(() => canonicalJson([item]), TypeError);
    }
    assert.throws(() => canonicalJson(undefined), TypeError);
    // eslint-disable-next-line no-sparse-arrays
    assert.throws(() => canonicalJson([1, , 2]), TypeError);
    assert.equal(canonicalJson(Object.assign(Object.create(null), { b: 1, a: 2 })), '{"a":2,"b":1}');
  });

  test("specHashLabel shows 8 characters", () => {
    const digest = specDigest({ format: "playground-spec", seeds: [1001, 1002] });
    assert.match(digest, /^[0-9a-f]{64}$/);
    assert.equal(specHashLabel(digest), `playground-spec:${digest.slice(0, 8)}`);
    assert.throws(() => specHashLabel(digest.toUpperCase()), TypeError);
    assert.throws(() => specHashLabel(digest.slice(1)), TypeError);
  });
});
