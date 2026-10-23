// FleetLab `resolve_recommendation` and the record enums (src/hermes/fleet/contracts.py), design P-9 and T-7.

import { OUTCOMES } from "./outcome.js";

/** Every `FleetRecommendation` value, verbatim. */
export const RECOMMENDATIONS = Object.freeze([
  "ADVANCE_TO_NEXT_TEST",
  "HOLD",
  "RUN_MORE_EXPERIMENTS",
  "NO_RECOMMENDATION",
]);

/** Every `ExperimentValidity` value, verbatim. */
export const VALIDITY = Object.freeze(["VALID", "INVALID_EXPERIMENT"]);

/** Every `InvalidityReason` value, verbatim. */
export const INVALIDITY_REASONS = Object.freeze([
  "INVARIANT_VIOLATION",
  "REPLICATION_MISMATCH",
  "NOT_COMPARABLE",
]);

/** Non-compensatory recommendation from an outcome word and the regressed guardrail metric names. */
export function resolveRecommendation(outcome, regressions) {
  if (!OUTCOMES.includes(outcome)) throw new TypeError(`unknown outcome ${String(outcome)}`);
  if (!Array.isArray(regressions)) throw new TypeError("regressions must be an array of metric names");
  if (regressions.length > 0) return "HOLD";
  if (outcome === "IMPROVED") return "ADVANCE_TO_NEXT_TEST";
  if (outcome === "REGRESSED") return "HOLD";
  if (outcome === "INCONCLUSIVE") return "RUN_MORE_EXPERIMENTS";
  return "NO_RECOMMENDATION";
}
