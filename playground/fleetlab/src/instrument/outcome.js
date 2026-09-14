// FleetLab `_resolve_outcome` (src/hermes/fleet/experiment.py), design P-7 and T-7.

/** Every `ExperimentOutcome` value, verbatim; MIXED is defined and unreachable in a single regime. */
export const OUTCOMES = Object.freeze(["IMPROVED", "REGRESSED", "MIXED", "UNCHANGED", "INCONCLUSIVE"]);

/** The two declared directions a primary metric or guardrail may carry. */
export const DIRECTIONS = Object.freeze(["lower_is_better", "higher_is_better"]);

/** Outcome of an interval `{ci_low, ci_high}` against `{direction, equivalence_margin}`, both in the metric's unit. */
export function resolveOutcome({ ci_low, ci_high }, { direction, equivalence_margin }) {
  if (typeof ci_low !== "number" || typeof ci_high !== "number") {
    throw new TypeError("resolveOutcome needs a numeric ci_low and ci_high (Python asserts they are set)");
  }
  if (!DIRECTIONS.includes(direction)) throw new TypeError(`unknown direction ${String(direction)}`);
  let low = ci_low;
  let high = ci_high;
  const margin = equivalence_margin;
  // Normalise so that negative deltas are always "better".
  if (direction === "higher_is_better") {
    low = -ci_high;
    high = -ci_low;
  }
  if (high < -margin) return "IMPROVED";
  if (low > margin) return "REGRESSED";
  if (-margin <= low && high <= margin) return "UNCHANGED";
  return "INCONCLUSIVE";
}
