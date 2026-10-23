// FleetLab `_guardrail_regressions` (src/hermes/fleet/experiment.py) plus the playground's
// NOT_EVALUABLE status (design P-8, D-05), which is shown beside the recommendation and never changes it.

/** Every guardrail status the playground shows. */
export const GUARDRAIL_STATUSES = Object.freeze(["REGRESSED", "WITHIN", "NOT_EVALUABLE"]);

/** Map metric name to its comparison; a later duplicate wins, as in a Python dict comprehension. */
function byMetric(results) {
  const map = new Map();
  for (const result of results) map.set(result.metric, result);
  return map;
}

/** Harm in the metric's unit: the mean delta, negated for a higher_is_better guardrail. */
function harmOf(result, rail) {
  return rail.direction === "lower_is_better" ? result.mean_delta : -result.mean_delta;
}

/** Names of guardrail metrics whose harm exceeds max_harm (strict), in guardrail order; unavailable ones skipped. */
export function guardrailRegressions(results, guardrails) {
  const found = byMetric(results);
  const regressed = [];
  for (const rail of guardrails) {
    const result = found.get(rail.metric);
    if (result === undefined) continue;
    if (harmOf(result, rail) > rail.max_harm) regressed.push(rail.metric);
  }
  return regressed;
}

/** Per guardrail, in order: `{metric, status, harm, max_harm}` in the metric's unit; harm is null when NOT_EVALUABLE. */
export function guardrailStatuses(results, guardrails) {
  const found = byMetric(results);
  return guardrails.map((rail) => {
    const result = found.get(rail.metric);
    if (result === undefined) {
      return { metric: rail.metric, status: "NOT_EVALUABLE", harm: null, max_harm: rail.max_harm };
    }
    const harm = harmOf(result, rail);
    return { metric: rail.metric, status: harm > rail.max_harm ? "REGRESSED" : "WITHIN", harm, max_harm: rail.max_harm };
  });
}
