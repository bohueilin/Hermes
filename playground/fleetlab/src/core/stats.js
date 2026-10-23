// Python 3.11 numeric behaviour FleetLab depends on (design T-1, T-2, T-5).

/** Python `round(x)` on a finite double: the nearest integer, exact halves to the even neighbour (unitless). */
export function roundHalfEven(x) {
  if (typeof x !== "number") throw new TypeError("roundHalfEven expects a number");
  if (!Number.isFinite(x)) throw new RangeError(`cannot round ${String(x)} to an integer`);
  const floor = Math.floor(x);
  const fraction = x - floor;
  let result;
  if (fraction < 0.5) result = floor;
  else if (fraction > 0.5) result = floor + 1;
  else result = floor % 2 === 0 ? floor : floor + 1;
  // Python returns an int, which has no negative zero.
  return result === 0 ? 0 : result;
}

/** `numerator / denominator` rounded half to even, on BigInt integers; the denominator must be positive. */
export function roundHalfEvenDiv(numerator, denominator) {
  if (typeof numerator !== "bigint" || typeof denominator !== "bigint") {
    throw new TypeError("roundHalfEvenDiv expects two BigInt values");
  }
  if (denominator <= 0n) throw new RangeError("roundHalfEvenDiv needs a positive denominator");
  let quotient = numerator / denominator;
  let remainder = numerator % denominator;
  if (remainder < 0n) {
    quotient -= 1n;
    remainder += denominator;
  }
  const twice = 2n * remainder;
  if (twice > denominator) return quotient + 1n;
  if (twice < denominator) return quotient;
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

/** Python 3.11 `sum(values)`: a plain left-to-right loop from 0, in the values' own unit. */
export function sumLeftToRight(values) {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i];
  return total;
}

/** `sum(values) / len(values)` as FleetLab's `_compare` computes a mean, in the values' own unit. */
export function meanFleetLab(values) {
  if (values.length === 0) throw new RangeError("mean of an empty list (Python raises ZeroDivisionError)");
  return sumLeftToRight(values) / values.length;
}

/** Ascending comparator that keeps equal values (including -0 and 0) in input order under a stable sort. */
export function numericAscending(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Copy of `values` sorted ascending with Python `sorted` semantics (stable; -0 and 0 compare equal). */
export function sortedFleetLab(values) {
  return Array.from(values).sort(numericAscending);
}

/** Median exactly as `_compare` computes `median_delta`, in the values' own unit. */
export function medianFleetLab(values) {
  if (values.length === 0) throw new RangeError("median of an empty list (Python raises IndexError)");
  const ordered = sortedFleetLab(values);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
}

/** Linear-interpolation percentile at position `(n - 1) * q`, exactly as `run_metrics`, in the values' own unit. */
export function percentileFleetLab(values, q) {
  const ordered = sortedFleetLab(values);
  if (ordered.length === 0) throw new RangeError("percentile of an empty list");
  const position = (ordered.length - 1) * q;
  const low = Math.trunc(position);
  const high = Math.min(low + 1, ordered.length - 1);
  return ordered[low] + (ordered[high] - ordered[low]) * (position - low);
}
