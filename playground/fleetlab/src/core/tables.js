// Integer quantile tables (design §5.4 item 2): Exp(1) in thousandths and lognormal multipliers in millionths.
// Built with exact integer and BigInt fixed-point arithmetic only, so every JavaScript engine builds the same bytes,
// and checked against pinned SHA-256 digests on first build.
//
// Fixed point: a BigInt v stands for v / 2^128. Every step below floors, so each step is off by at most a few units
// of 2^-128. Error budget, in the table's own unit before rounding:
// - ln(n) for n = 1..65536 is a running sum of 65,535 atanh series of at most 60 floored terms: under 2^22 units of
//   2^-128, so an exponential entry (1000 × a difference of two logs) is off by less than 2^-96.
// - z_i: each Newton step is floored to a few units of 2^-128; e^(z^2/2) is carried multiplicatively with a relative
//   drift under 2^-100, which moves z by at most that drift times S(z) < 2^15, so |error z| < 2^-84. Newton stops
//   once the step is below 2^-62, leaving a truncation error below 2.3 × 2^-124.
// - A multiplier entry 10^6 × exp(σ z) is at most 8.8 × 10^6 < 2^24 units, off by less than 2^24 × (2^-84 + 2^-100)
//   relative terms, i.e. below 2^-58 of a unit (about 3.5e-18).
// Every entry must also sit farther than 1e-9 of a unit from a .5 boundary (asserted while building), so half-even
// rounding is unambiguous: no computed value can be on the wrong side of a boundary.

import { sha256 } from "./sha256.js";

const SIZE = 65536;
const HALF_SIZE = 32768;
const F = 128n;
const ONE = 1n << F;
const MASK = ONE - 1n;
const HALF_UNIT = ONE >> 1n;
const BOUNDARY_MARGIN = ONE / 1000000000n;
const NEWTON_STOP = ONE >> 62n;
const MILLION = 1000000n;

/** The σ grid of design RD-5 in thousandths (0, 50, ..., 500). */
export const SIGMA_GRID_PERMILLE = Object.freeze([0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);

/** Lowercase hex SHA-256 of each table's 262,144 little-endian Int32 bytes, keyed `exp` and `mult_<sigmaPermille>`. */
export const TABLE_DIGESTS = Object.freeze({
  exp: "273940afcbf900cd549190ff616283d7071c59160af890f326a8f9316b832e1a",
  mult_0: "d6869b9220a44ccec6b406dffa3e1d32fcc1c07ef263efe4ea5bd165002e40ad",
  mult_50: "89ae2197e1bdec7c7498fcc21fadf059bf38f30bd84e52397c745b7ef1425449",
  mult_100: "c441fece7b4517577da085010d28920735d2ebcf702214bead62f842a06f395a",
  mult_150: "5152c947063cfb4ace1ca59ed2beb4bba43a2d091658143b8b12a494b346ca69",
  mult_200: "6a446077f305621315bc514c5bd8ecd27c0fc77fa624503766bdd4d4902eb4aa",
  mult_250: "b63a535850f1203b1f8820ce1a34a90a7d762568a0b4e83dcc5e586c3eb67b42",
  mult_300: "b0a41e82d40b9f6648ab4be82ca91e78f2f840525b50e0663ca5851f5fbbaf32",
  mult_350: "a09e4838415aaa4ec9fbcb7b4ec1ced822cf13e25a0acb38dee9ffb798c62867",
  mult_400: "c43cb63711041d5126bc5ca0058f88138b9ec1bbaf8a917cecf8e8737f78617b",
  mult_450: "bde170b62235e944acbd2049d94fa688452c4a92f24253a35433fb22de05a491",
  mult_500: "3fcadf55389b39d3d97d7be140aca33edf384c2f6c4fee836bfe58936cd65a51",
});

/** Lowercase hex SHA-256 of an Int32Array's little-endian bytes (independent of the platform's byte order). */
export function tableDigestHex(table) {
  if (!(table instanceof Int32Array)) throw new TypeError("tableDigestHex expects an Int32Array");
  const bytes = new Uint8Array(table.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < table.length; i++) view.setInt32(4 * i, table[i], true);
  const digest = sha256(bytes);
  let hex = "";
  for (let i = 0; i < digest.length; i++) hex += (digest[i] < 16 ? "0" : "") + digest[i].toString(16);
  return hex;
}

/** Throws unless `table` hashes to the pinned digest `TABLE_DIGESTS[name]`; returns the table. */
export function verifyTable(name, table) {
  const pinned = TABLE_DIGESTS[name];
  if (typeof pinned !== "string") throw new RangeError(`no pinned digest named ${String(name)}`);
  const actual = tableDigestHex(table);
  if (actual !== pinned) throw new Error(`table ${name} digest ${actual} differs from the pinned ${pinned}`);
  return table;
}

/** Round a non-negative fixed-point value half to even, refusing values within 1e-9 of a .5 boundary (unitless). */
function roundFixed(value, name, index) {
  const offset = (value & MASK) - HALF_UNIT;
  if (offset < BOUNDARY_MARGIN && offset > -BOUNDARY_MARGIN) {
    throw new Error(`table ${name} entry ${index} lies within 1e-9 of a rounding boundary`);
  }
  return Number(offset > 0n ? (value >> F) + 1n : value >> F);
}

/** exp(a) for a small fixed-point a (|a| below about 2), by its Taylor series. */
function expSmall(a) {
  let sum = ONE + a;
  let term = a;
  for (let k = 2n; term !== 0n; k++) {
    term = ((term * a) >> F) / k;
    sum += term;
  }
  return sum;
}

/** Integer square root: the largest r with r^2 <= n, for a non-negative BigInt n. */
function isqrt(n) {
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length >> 1) + 1);
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}

/** floor(2^bits × atan(1 / x)) within a few units, for an integer x >= 2. */
function atanInverse(x, bits) {
  const scale = 1n << bits;
  const x2 = x * x;
  let power = scale / x;
  let sum = 0n;
  for (let k = 0n; power !== 0n; k++) {
    const term = power / (2n * k + 1n);
    sum += k % 2n === 0n ? term : -term;
    power /= x2;
  }
  return sum;
}

/** sqrt(2π) in fixed point, from Machin's formula and an integer square root. */
function sqrtTwoPi() {
  const guard = 16n;
  const bits = 2n * F + guard;
  const pi = 16n * atanInverse(5n, bits) - 4n * atanInverse(239n, bits);
  return isqrt((2n * pi) >> guard);
}

let expCache = null;
const multiplierCache = new Map();
let quantileCache = null;

/** Build the Exp(1) quantile table in thousandths: entry i is round_half_even(1000 × -ln(1 - i / 65536)). */
function buildExpTable() {
  // ln(n) = ln(n - 1) + 2 atanh(1 / (2n - 1)), and atanh(1/m) = sum over k of 1 / ((2k + 1) m^(2k + 1)).
  // floor(floor(a / b) / c) = floor(a / (bc)) for positive integers, so `power` is exactly floor(2^128 / m^(2k+1)).
  const logs = new Array(SIZE + 1);
  logs[1] = 0n;
  let acc = 0n;
  for (let n = 2; n <= SIZE; n++) {
    const m = BigInt(2 * n - 1);
    const m2 = m * m;
    let power = ONE / m;
    let sum = power;
    for (let odd = 3n; power !== 0n; odd += 2n) {
      power /= m2;
      sum += power / odd;
    }
    acc += 2n * sum;
    logs[n] = acc;
  }
  // -ln(1 - i/65536) = ln(65536) - ln(65536 - i).
  const top = logs[SIZE];
  const table = new Int32Array(SIZE);
  for (let i = 0; i < SIZE; i++) table[i] = roundFixed(1000n * (top - logs[SIZE - i]), "exp", i);
  return table;
}

/**
 * z_j for j = 0..32767: the standard normal quantile at 1/2 + (j + 0.5) / 65536, in fixed point. The lower half is
 * the negation by symmetry. Newton's method on phi(z) S(z) = q, where S(z) = z + z^3/3 + z^5/15 + ... has only
 * positive terms and Phi(z) - 1/2 = phi(z) S(z); the step is q sqrt(2π) e^(z^2/2) - S(z).
 */
function buildQuantiles() {
  const c = sqrtTwoPi();
  const z = new Array(HALF_SIZE);
  let z0 = 0n;
  let z20 = 0n;
  let e0 = ONE; // e^(z0^2 / 2)
  for (let j = 0; j < HALF_SIZE; j++) {
    const qc = (BigInt(2 * j + 1) * c) >> 17n; // q = (2j + 1) / 2^17, times sqrt(2π)
    // Start from the cubic Taylor step of the quantile function w(p): w' = sqrt(2π) e^(w^2/2), w'' = w w'^2,
    // w''' = w'^3 (1 + 2 w^2). Every derivative is positive for w >= 0, so the start never passes the root and
    // Newton, on a concave increasing function, then climbs to it without overshooting.
    const slope = (c * e0) >> F;
    const d1 = j === 0 ? slope >> 17n : slope >> 16n;
    const d2 = (d1 * d1) >> F;
    const d3 = (d2 * d1) >> F;
    let x = z0 + d1 + ((z0 * d2) >> (F + 1n)) + (((ONE + 2n * z20) * d3) >> F) / 6n;
    let x2 = (x * x) >> F;
    let e = (e0 * expSmall((x2 - z20) >> 1n)) >> F;
    for (let iteration = 0; ; iteration++) {
      if (iteration === 64) throw new Error(`normal quantile ${j} did not converge`);
      let term = x;
      let series = x;
      for (let odd = 3n; term !== 0n; odd += 2n) {
        term = ((term * x2) >> F) / odd;
        series += term;
      }
      const step = ((qc * e) >> F) - series;
      x += step;
      const next2 = (x * x) >> F;
      e = (e * expSmall((next2 - x2) >> 1n)) >> F;
      x2 = next2;
      if (step < NEWTON_STOP && step > -NEWTON_STOP) break;
    }
    z[j] = x;
    z0 = x;
    z20 = x2;
    e0 = e;
  }
  return z;
}

/** Build the multiplier table for σ = sigmaPermille / 1000: entry i is round_half_even(10^6 × exp(σ z_i)). */
function buildMultiplierTable(sigmaPermille) {
  const name = `mult_${sigmaPermille}`;
  const table = new Int32Array(SIZE);
  if (sigmaPermille === 0) return table.fill(1000000);
  if (quantileCache === null) quantileCache = buildQuantiles();
  const z = quantileCache;
  const sigma = BigInt(sigmaPermille);
  // Walk outward from the median: exp(σ z_j) = exp(σ z_(j-1)) × exp(σ (z_j - z_(j-1))), and the mirror entry
  // exp(-σ z_j) the same way; the increments telescope exactly to σ z_j.
  let up = ONE;
  let down = ONE;
  let previous = 0n;
  for (let j = 0; j < HALF_SIZE; j++) {
    const a = (sigma * (z[j] - previous)) / 1000n;
    previous = z[j];
    let even = ONE;
    let odd = a;
    let term = a;
    for (let k = 2n; term !== 0n; k++) {
      term = ((term * a) >> F) / k;
      if (k % 2n === 0n) even += term;
      else odd += term;
    }
    up = (up * (even + odd)) >> F;
    down = (down * (even - odd)) >> F;
    table[HALF_SIZE + j] = roundFixed(MILLION * up, name, HALF_SIZE + j);
    table[HALF_SIZE - 1 - j] = roundFixed(MILLION * down, name, HALF_SIZE - 1 - j);
  }
  return table;
}

/** The Exp(1) quantile table: 65,536 entries in thousandths, verified against its pinned digest; memoized. */
export function expTable() {
  if (expCache === null) expCache = verifyTable("exp", buildExpTable());
  return expCache;
}

/** The lognormal multiplier table for sigmaPermille in {0, 50, ..., 500}: 65,536 entries in millionths; memoized. */
export function multiplierTable(sigmaPermille) {
  if (!SIGMA_GRID_PERMILLE.includes(sigmaPermille)) {
    throw new RangeError(`sigmaPermille must be one of ${SIGMA_GRID_PERMILLE.join(", ")}; got ${String(sigmaPermille)}`);
  }
  let table = multiplierCache.get(sigmaPermille);
  if (table === undefined) {
    table = verifyTable(`mult_${sigmaPermille}`, buildMultiplierTable(sigmaPermille));
    multiplierCache.set(sigmaPermille, table);
  }
  return table;
}
