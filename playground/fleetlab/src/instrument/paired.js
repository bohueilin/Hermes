// FleetLab `_compare` and the decision flow of `run_experiment` (src/hermes/fleet/experiment.py),
// design P-3 to P-9. The runs are metric maps already computed; this module decides nothing else.

import { meanFleetLab, medianFleetLab } from "../core/stats.js";
import { bootstrapCi } from "./bootstrap.js";
import { guardrailRegressions, guardrailStatuses } from "./guardrails.js";
import { resolveOutcome } from "./outcome.js";
import { resolveRecommendation } from "./recommendation.js";

/** True when a run holds the metric (a missing key or undefined means it does not). */
function hasMetric(run, metric) {
  return Object.hasOwn(run, metric) && run[metric] !== undefined;
}

/** Throw when a value would fail FleetLab's finite-float validation of `MetricComparison`. */
function requireFinite(value, what) {
  if (!Number.isFinite(value)) throw new RangeError(`${what} is not a finite number`);
}

/**
 * Paired comparison of one metric, in the metric's unit: `null` when any run lacks it, else
 * `{metric, role, baseline_mean, candidate_mean, paired_deltas, mean_delta, median_delta}`.
 */
export function compareMetric(metric, role, baselineRuns, candidateRuns) {
  for (const run of [...baselineRuns, ...candidateRuns]) {
    if (!hasMetric(run, metric)) return null;
  }
  if (baselineRuns.length !== candidateRuns.length) {
    throw new RangeError("baseline and candidate need the same number of replications (zip strict)");
  }
  const baseline = baselineRuns.map((run) => run[metric]);
  const candidate = candidateRuns.map((run) => run[metric]);
  const deltas = baseline.map((b, i) => candidate[i] - b);
  const result = {
    metric,
    role,
    baseline_mean: meanFleetLab(baseline),
    candidate_mean: meanFleetLab(candidate),
    paired_deltas: deltas,
    mean_delta: meanFleetLab(deltas),
    median_delta: medianFleetLab(deltas),
  };
  requireFinite(result.baseline_mean, `${metric} baseline_mean`);
  requireFinite(result.candidate_mean, `${metric} candidate_mean`);
  requireFinite(result.mean_delta, `${metric} mean_delta`);
  requireFinite(result.median_delta, `${metric} median_delta`);
  for (const delta of deltas) requireFinite(delta, `${metric} paired delta`);
  return result;
}

/** Python `detail[:300]`: the first 300 code points. */
function firstCodePoints(text, count) {
  return Array.from(text).slice(0, count).join("");
}

/** A void verdict: no outcome, no primary, NO_RECOMMENDATION. */
function invalidVerdict(reason, detail) {
  return {
    validity: "INVALID_EXPERIMENT",
    invalidity_reason: reason,
    invalidity_detail: firstCodePoints(detail, 300),
    outcome: null,
    recommendation: "NO_RECOMMENDATION",
    primary: null,
    guardrail_results: [],
    guardrail_regressions: [],
    descriptives: [],
    guardrail_statuses: [],
  };
}

/**
 * The verdict of `run_experiment` from per-seed metric maps, in the metrics' units. `primary` is
 * `{name, direction, equivalence_margin}`; guardrails are `{metric, max_harm, direction}`; `key` is the full digest.
 */
export function computeVerdict({
  primary,
  guardrails = [],
  descriptiveNames = [],
  baselineRuns,
  candidateRuns,
  resamples,
  key,
  precheckMatched,
  invariantViolation = null,
}) {
  if (typeof precheckMatched !== "boolean") throw new TypeError("precheckMatched must be true or false");
  if (invariantViolation !== null && typeof invariantViolation !== "string") {
    throw new TypeError("invariantViolation must be null or the first violation's text");
  }
  if (!precheckMatched) {
    return invalidVerdict("REPLICATION_MISMATCH", "identical seed produced different metrics on replay");
  }
  if (invariantViolation !== null) {
    return invalidVerdict("INVARIANT_VIOLATION", invariantViolation);
  }
  const compared = compareMetric(primary.name, "PRIMARY", baselineRuns, candidateRuns);
  if (compared === null) {
    return invalidVerdict("NOT_COMPARABLE", `primary metric ${primary.name} unavailable in some replication`);
  }
  const [low, high] = bootstrapCi(compared.paired_deltas, resamples, key);
  const primaryResult = { ...compared, ci_low: low, ci_high: high };

  const guardrailResults = [];
  for (const rail of guardrails) {
    const result = compareMetric(rail.metric, "GUARDRAIL", baselineRuns, candidateRuns);
    if (result !== null) guardrailResults.push(result);
  }
  const regressions = guardrailRegressions(guardrailResults, guardrails);
  const descriptives = [];
  for (const name of descriptiveNames) {
    if (name === primary.name) continue;
    const result = compareMetric(name, "DESCRIPTIVE", baselineRuns, candidateRuns);
    if (result !== null) descriptives.push(result);
  }

  const outcome = resolveOutcome(primaryResult, primary);
  const recommendation = resolveRecommendation(outcome, regressions);
  return {
    validity: "VALID",
    invalidity_reason: null,
    invalidity_detail: null,
    outcome,
    recommendation,
    primary: primaryResult,
    guardrail_results: guardrailResults,
    guardrail_regressions: regressions,
    descriptives,
    guardrail_statuses: guardrailStatuses(guardrailResults, guardrails),
  };
}
