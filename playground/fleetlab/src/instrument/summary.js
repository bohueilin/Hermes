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

/**
 * `value` with `digits` decimals, rounding the exact decimal expansion of the double half to even (as Python's
 * `f"{x:.1f}"` does), never `-0`. The summary object keeps the exact double; only the clipboard text is rounded.
 */
function fixed(value, digits) {
  const [whole, fraction] = Math.abs(value).toFixed(100).split(".");
  const kept = BigInt(whole + fraction.slice(0, digits));
  const rest = fraction.slice(digits);
  const up = rest[0] > "5" || (rest[0] === "5" && (/[1-9]/.test(rest.slice(1)) || kept % 2n === 1n));
  const scaled = kept + (up ? 1n : 0n);
  const unit = 10n ** BigInt(digits);
  const text = digits === 0 ? String(scaled) : `${String(scaled / unit)}.${String(scaled % unit).padStart(digits, "0")}`;
  return value < 0 && scaled !== 0n ? `-${text}` : text;
}

/**
 * A metric value as clipboard text in its unit, read from the metric key's name (the instrument does not import the
 * registry): a name ending `_s` is seconds to one decimal with ` s`, a name holding `fraction` is a fraction to four
 * decimals, anything else is a count to one decimal. A nonzero value never reads as zero: when rounding would leave no
 * nonzero digit, the text is the exact double in plain decimals, so a regressed harm of 2.7e-5 against max harm 0 does
 * not read `0.0000`. `withSign` adds `+` to a positive value whose text is not zero.
 */
function metricText(metric, value, { withSign = false } = {}) {
  const name = String(metric).split("{")[0];
  const seconds = name.endsWith("_s");
  let text = fixed(value, name.includes("fraction") ? 4 : 1);
  if (value !== 0 && !/[1-9]/.test(text)) text = `${value < 0 ? "-" : ""}${plainDecimal(Math.abs(value))}`;
  const shown = withSign && !text.startsWith("-") && /[1-9]/.test(text) ? `+${text}` : text;
  return seconds ? `${shown} s` : shown;
}

/** The shortest round-trip text of a small positive double in plain decimals: `1e-7` reads `0.0000001`. */
function plainDecimal(magnitude) {
  const text = String(magnitude);
  const exponent = /^(\d)(?:\.(\d+))?e-(\d+)$/.exec(text);
  return exponent === null ? text : `0.${"0".repeat(Number(exponent[3]) - 1)}${exponent[1]}${exponent[2] ?? ""}`;
}

const signed = (metric, value) => metricText(metric, value, { withSign: true });

/** Clipboard text of a result summary, one fact per line; numbers are rounded for reading (see metricText). */
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
    const m = p.metric;
    lines.push(
      `Outcome: ${textOf(summary.outcome)}`,
      `Primary ${m}: mean delta ${signed(m, p.mean_delta)}, median delta ${signed(m, p.median_delta)}, ` +
        `95% interval [${signed(m, p.ci_low)}, ${signed(m, p.ci_high)}]`,
      `Primary ${m}: baseline mean ${metricText(m, p.baseline_mean)}, candidate mean ${metricText(m, p.candidate_mean)}`,
    );
    for (const rail of summary.guardrails) {
      const maxHarm = metricText(rail.metric, rail.max_harm);
      lines.push(
        rail.status === "NOT_EVALUABLE"
          ? `Guardrail ${rail.metric}: NOT EVALUABLE: metric absent in some replication (max harm ${maxHarm})`
          : `Guardrail ${rail.metric}: ${rail.status} (harm ${signed(rail.metric, rail.harm)}, max harm ${maxHarm})`,
      );
    }
    for (const item of summary.descriptives) {
      lines.push(
        `Descriptive, no claim, ${item.metric}: baseline mean ${metricText(item.metric, item.baseline_mean)}, ` +
          `candidate mean ${metricText(item.metric, item.candidate_mean)}, mean delta ${signed(item.metric, item.mean_delta)}`,
      );
    }
  }
  lines.push(`Recommendation: ${summary.recommendation}`, "The rules match FleetLab's instrument; the world does not.");
  return `${lines.join("\n")}\n`;
}
