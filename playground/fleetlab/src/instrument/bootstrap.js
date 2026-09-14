// FleetLab `_bootstrap_ci` (src/hermes/fleet/experiment.py), design P-6 and T-1.

import { prefixHasher } from "../core/sha256.js";
import { numericAscending, roundHalfEven } from "../core/stats.js";

/** Indices `[low, high]` into the R sorted resample means, with Python round-half-even on the double. */
export function bootstrapIndices(resamples) {
  if (!Number.isSafeInteger(resamples) || resamples < 1) {
    throw new RangeError("resamples must be a positive integer");
  }
  const low = Math.max(0, roundHalfEven(0.025 * resamples) - 1);
  const high = Math.min(resamples - 1, roundHalfEven(0.975 * resamples));
  return [low, high];
}

/** Hash draws between two yields of bootstrapCiSteps (a count, not a clock). */
const DRAWS_PER_YIELD = 4096;

/**
 * 95% percentile bootstrap `[low, high]` over paired deltas, in the deltas' unit. Draw `j` of resample `i` is
 * `deltas[u64(key, "bootstrap", i, j) mod n]`; the hash runs through a prefix hasher on `${key}|bootstrap|`.
 */
export function bootstrapCi(deltas, resamples, key) {
  const steps = bootstrapCiSteps(deltas, resamples, key);
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}

/**
 * bootstrapCi as a generator for time-sliced callers (design 5.9): yields undefined after every whole resample that
 * completes at least DRAWS_PER_YIELD draws since the last yield, and once before the sort; returns `[low, high]`.
 */
export function* bootstrapCiSteps(deltas, resamples, key) {
  if (typeof key !== "string") throw new TypeError("bootstrap key must be a string");
  const n = deltas.length;
  if (n === 0) throw new RangeError("bootstrap needs at least one delta (Python raises ZeroDivisionError)");
  const [lowIndex, highIndex] = bootstrapIndices(resamples);
  const hasher = prefixHasher(`${key}|bootstrap|`);
  const modulus = BigInt(n);
  const means = new Array(resamples);
  let draws = 0;
  for (let i = 0; i < resamples; i++) {
    let total = 0;
    for (let j = 0; j < n; j++) {
      const d = hasher(`${i}|${j}`);
      const high = ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0;
      const low = ((d[4] << 24) | (d[5] << 16) | (d[6] << 8) | d[7]) >>> 0;
      total += deltas[Number(((BigInt(high) << 32n) | BigInt(low)) % modulus)];
    }
    means[i] = total / n;
    draws += n;
    if (draws >= DRAWS_PER_YIELD) {
      draws = 0;
      yield;
    }
  }
  yield;
  means.sort(numericAscending);
  return [means[lowIndex], means[highIndex]];
}
