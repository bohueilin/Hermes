// The only export of a teaching run: a result summary for the clipboard (design H-4, P-10, R9).
// It is never a decision record: it carries NOT_EVIDENCE, no digest in full and none of the record's keys.

import { specHashLabel } from "../core/canon.js";

/** The summary's format name. */
export const SUMMARY_FORMAT = "fleetlab-playground-result-summary";

/** Keys a summary never carries, at any depth. */
export const FORBIDDEN_SUMMARY_KEYS = Object.freeze([
  "spec_digest",
  "world_tape_digest",
  "seed_set_digest",
  "deployment_permission",
  "labels",
  "schema_version",
]);

/** Copy a JSON-safe value (null, boolean, string, finite number, array, plain object); throw on anything else. */
function plainValue(value, path) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`summary value at ${path} is not a finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, i) => plainValue(item, `${path}[${i}]`));
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const key of Object.keys(value)) out[key] = plainValue(value[key], `${path}.${key}`);
    return out;
  }
  throw new TypeError(`summary value at ${path} has unsupported type ${typeof value}`);
}

/** Path of the first forbidden key found at any depth, or null. */
function findForbiddenKey(value, path) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findForbiddenKey(value[i], `${path}[${i}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_SUMMARY_KEYS.includes(key)) return `${path}.${key}`;
      const found = findForbiddenKey(value[key], `${path}.${key}`);
      if (found !== null) return found;
    }
  }
  return null;
}

/** The words and numbers of one comparison; the interval only on the primary. */
function comparisonSummary(comparison, path) {
  const out = {
    metric: comparison.metric,
    role: comparison.role,
    baseline_mean: comparison.baseline_mean,
    candidate_mean: comparison.candidate_mean,
    paired_deltas: Array.from(comparison.paired_deltas),
    mean_delta: comparison.mean_delta,
    median_delta: comparison.median_delta,
  };
  if (comparison.role === "PRIMARY") {
    out.ci_low = comparison.ci_low;
    out.ci_high = comparison.ci_high;
  }
  return plainValue(out, path);
}

/**
 * Result summary of a verdict (numbers in each metric's unit). `specDigest` is shown only as its 8-character
 * label; axis values and the seed set are copied as given.
 */
export function resultSummary(verdict, { specDigest, modelVersion, question, axis, baselineValue, candidateValue, seedSet }) {
  const label = specHashLabel(specDigest);
  if (typeof modelVersion !== "string" || modelVersion.length === 0) {
    throw new TypeError("modelVersion must be a non-empty string");
  }
  if (typeof question !== "string") throw new TypeError("question must be a string");
  if (typeof axis !== "string") throw new TypeError("axis must be a string");
  const summary = {
    format: SUMMARY_FORMAT,
    format_version: 1,
    evidence_status: "NOT_EVIDENCE",
    decision_authority: "NONE",
    model_version: modelVersion,
    playground_spec: label,
    question,
    variation_axis: axis,
    baseline_value: plainValue(baselineValue, "baseline_value"),
    candidate_value: plainValue(candidateValue, "candidate_value"),
    seed_set: plainValue(seedSet, "seed_set"),
    validity: verdict.validity,
    invalidity_reason: verdict.invalidity_reason,
    invalidity_detail: verdict.invalidity_detail,
    outcome: verdict.outcome,
    recommendation: verdict.recommendation,
    primary: verdict.primary === null ? null : comparisonSummary(verdict.primary, "primary"),
    guardrails: verdict.guardrail_statuses.map((status, i) =>
      plainValue(
        { metric: status.metric, status: status.status, harm: status.harm, max_harm: status.max_harm },
        `guardrails[${i}]`,
      ),
    ),
    guardrail_results: verdict.guardrail_results.map((c, i) => comparisonSummary(c, `guardrail_results[${i}]`)),
    guardrail_regressions: Array.from(verdict.guardrail_regressions),
    descriptives: verdict.descriptives.map((c, i) => comparisonSummary(c, `descriptives[${i}]`)),
  };
  const forbidden = findForbiddenKey(summary, "$");
  if (forbidden !== null) throw new Error(`a result summary never carries the key at ${forbidden}`);
  if (JSON.stringify(summary).includes(specDigest)) {
    throw new Error("a result summary never carries the full spec digest");
  }
  return summary;
}

/** Plain text of a value for the clipboard. */
function textOf(value) {
  if (value === null) return "not available";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

/** A delta with an explicit plus sign when positive. */
function signed(value) {
  return value > 0 ? `+${String(value)}` : String(value);
}

/** Clipboard text of a result summary, one fact per line. */
export function summaryText(summary) {
  const lines = [
    "FleetLab Playground result summary",
    "Teaching run, not a decision record",
    `Format: ${summary.format} version ${summary.format_version}`,
    `Evidence status: ${summary.evidence_status}`,
    `Decision authority: ${summary.decision_authority}`,
    `Model version: ${summary.model_version}`,
    `Spec: ${summary.playground_spec}`,
    `Question: ${summary.question}`,
    `Variation axis: ${summary.variation_axis} (baseline ${textOf(summary.baseline_value)}, candidate ${textOf(summary.candidate_value)})`,
    `Seed set: ${textOf(summary.seed_set)}`,
    summary.invalidity_reason === null
      ? `Validity: ${summary.validity}`
      : `Validity: ${summary.validity} (${summary.invalidity_reason}: ${summary.invalidity_detail})`,
  ];
  if (summary.primary === null) {
    lines.push("Void evidence has no outcome. It says nothing about the candidate.");
  } else {
    const p = summary.primary;
    lines.push(
      `Outcome: ${textOf(summary.outcome)}`,
      `Primary ${p.metric}: mean delta ${signed(p.mean_delta)}, median delta ${signed(p.median_delta)}, ` +
        `95% interval [${signed(p.ci_low)}, ${signed(p.ci_high)}]`,
      `Primary ${p.metric}: baseline mean ${String(p.baseline_mean)}, candidate mean ${String(p.candidate_mean)}`,
    );
    for (const rail of summary.guardrails) {
      lines.push(
        rail.status === "NOT_EVALUABLE"
          ? `Guardrail ${rail.metric}: NOT EVALUABLE: metric absent in some replication (max harm ${String(rail.max_harm)})`
          : `Guardrail ${rail.metric}: ${rail.status} (harm ${signed(rail.harm)}, max harm ${String(rail.max_harm)})`,
      );
    }
    for (const item of summary.descriptives) {
      lines.push(
        `Descriptive, no claim, ${item.metric}: baseline mean ${String(item.baseline_mean)}, ` +
          `candidate mean ${String(item.candidate_mean)}, mean delta ${signed(item.mean_delta)}`,
      );
    }
  }
  lines.push(`Recommendation: ${summary.recommendation}`, "The rules match FleetLab's instrument; the world does not.");
  return `${lines.join("\n")}\n`;
}
