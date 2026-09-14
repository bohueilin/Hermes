import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { keyedU64Source, u64 } from "../src/core/keyed.js";
import { percentileFleetLab, sumLeftToRight } from "../src/core/stats.js";
import { bootstrapCi, bootstrapIndices } from "../src/instrument/bootstrap.js";
import { guardrailRegressions, guardrailStatuses } from "../src/instrument/guardrails.js";
import { OUTCOMES, resolveOutcome } from "../src/instrument/outcome.js";
import { compareMetric, computeVerdict } from "../src/instrument/paired.js";
import { INVALIDITY_REASONS, RECOMMENDATIONS, VALIDITY, resolveRecommendation } from "../src/instrument/recommendation.js";

const VECTORS_PATH = fileURLToPath(new URL("../../../tests/fixtures/fleet_playground/instrument_vectors.json", import.meta.url));

/** Load the vector file written by the Python regenerator; a missing file is a failure, never a skip. */
function loadVectors() {
  assert.ok(existsSync(VECTORS_PATH), `instrument vector fixture is missing: ${VECTORS_PATH}`);
  return JSON.parse(readFileSync(VECTORS_PATH, "utf8"));
}

/** Exact equality: Object.is for numbers (so -0 differs from 0), element-wise for arrays, key-wise for objects. */
function assertExact(actual, expected, path) {
  if (typeof expected === "number") {
    assert.ok(Object.is(actual, expected), `${path}: expected ${Object.is(expected, -0) ? "-0" : expected}, got ${Object.is(actual, -0) ? "-0" : actual}`);
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: expected an array`);
    assert.equal(actual.length, expected.length, `${path}: length`);
    expected.forEach((item, i) => assertExact(actual[i], item, `${path}[${i}]`));
    return;
  }
  if (expected !== null && typeof expected === "object") {
    assert.ok(actual !== null && typeof actual === "object", `${path}: expected an object`);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${path}: keys`);
    for (const key of Object.keys(expected)) assertExact(actual[key], expected[key], `${path}.${key}`);
    return;
  }
  assert.equal(actual, expected, path);
}

describe("instrument parity with FleetLab's Python vectors", () => {
  const vectors = existsSync(VECTORS_PATH) ? JSON.parse(readFileSync(VECTORS_PATH, "utf8")) : null;
  const group = (name) => {
    const data = vectors ?? loadVectors();
    assert.ok(Array.isArray(data[name]) && data[name].length > 0, `vector group ${name} is missing or empty`);
    return data[name];
  };

  test("fixture header", () => {
    const data = vectors ?? loadVectors();
    assert.equal(data.format, "fleet-playground-instrument-vectors");
    assert.equal(data.format_version, 1);
    assert.equal(data.python_version, "3.11");
  });

  test("u64 (FleetLab _u64)", () => {
    const rows = group("u64");
    assert.ok(rows.length >= 50, "at least 50 u64 vectors");
    assert.ok(rows.some((row) => row.parts.some((p) => typeof p === "string" && /[^\x00-\x7f]/.test(p))), "non-ASCII part");
    assert.ok(rows.some((row) => row.parts.some((p) => typeof p === "number")), "integer part");
    for (const [i, row] of rows.entries()) {
      const expected = BigInt(row.value);
      assert.equal(u64(...row.parts), expected, `u64[${i}]`);
      if (row.parts.length > 1) {
        assert.equal(keyedU64Source(...row.parts.slice(0, -1))(row.parts.at(-1)), expected, `keyedU64Source[${i}]`);
      }
    }
  });

  test("bootstrap indices (round half to even)", () => {
    const rows = group("bootstrap_indices");
    for (const want of [1020, 1060, 2000, 100000]) {
      assert.ok(rows.some((row) => row.resamples === want), `R = ${want} present`);
    }
    for (const row of rows) {
      assertExact(bootstrapIndices(row.resamples), [row.low_index, row.high_index], `R=${row.resamples}`);
    }
  });

  test("percentile (run_metrics)", () => {
    for (const [i, row] of group("percentile").entries()) {
      assertExact(percentileFleetLab(row.values, row.q), row.value, `percentile[${i}] q=${row.q}`);
    }
  });

  test("left-to-right sum (Python 3.11 sum)", () => {
    for (const [i, row] of group("sum_left_to_right").entries()) {
      assertExact(sumLeftToRight(row.values), row.value, `sum[${i}]`);
    }
  });

  test("paired comparison (_compare)", () => {
    for (const [i, row] of group("compare").entries()) {
      const actual = compareMetric(row.metric, row.role, row.baseline_runs, row.candidate_runs);
      if (row.result === null) assert.equal(actual, null, `compare[${i}] unavailable`);
      else assertExact(actual, row.result, `compare[${i}]`);
    }
  });

  test("bootstrap interval (_bootstrap_ci)", () => {
    for (const row of group("bootstrap")) {
      const [low, high] = bootstrapCi(row.deltas, row.resamples, row.key);
      assertExact(low, row.low, `${row.name} low`);
      assertExact(high, row.high, `${row.name} high`);
    }
  });

  test("outcome (_resolve_outcome)", () => {
    for (const [i, row] of group("outcome").entries()) {
      const actual = resolveOutcome({ ci_low: row.ci_low, ci_high: row.ci_high }, { direction: row.direction, equivalence_margin: row.margin });
      assert.equal(actual, row.outcome, `outcome[${i}] [${row.ci_low}, ${row.ci_high}] ${row.direction} margin ${row.margin}`);
    }
  });

  test("guardrail regressions (_guardrail_regressions) and statuses that never change them", () => {
    for (const [i, row] of group("guardrails").entries()) {
      assertExact(guardrailRegressions(row.results, row.guardrails), row.regressions, `guardrails[${i}]`);
      const statuses = guardrailStatuses(row.results, row.guardrails);
      assertExact(statuses.filter((s) => s.status === "REGRESSED").map((s) => s.metric), row.regressions, `statuses[${i}]`);
    }
  });

  test("recommendation (resolve_recommendation)", () => {
    const rows = group("recommendation");
    for (const outcome of OUTCOMES) assert.ok(rows.some((row) => row.outcome === outcome), `row for ${outcome}`);
    for (const [i, row] of rows.entries()) {
      assert.equal(resolveRecommendation(row.outcome, row.regressions), row.recommendation, `recommendation[${i}]`);
    }
  });

  test("end to end (run_experiment decision flow)", () => {
    for (const row of group("end_to_end")) {
      const [low, high] = bootstrapCi(row.deltas, row.resamples, row.key);
      assertExact(low, row.low, `${row.name} low`);
      assertExact(high, row.high, `${row.name} high`);
      const outcome = resolveOutcome({ ci_low: low, ci_high: high }, { direction: row.direction, equivalence_margin: row.margin });
      assert.equal(outcome, row.outcome, `${row.name} outcome`);
      const regressions = guardrailRegressions(row.guardrail_results, row.guardrails);
      assertExact(regressions, row.regressions, `${row.name} regressions`);
      assert.equal(resolveRecommendation(outcome, regressions), row.recommendation, `${row.name} recommendation`);

      // The same row through computeVerdict, on the Python-built runs: the primary is "primary" with baseline 0 and
      // candidate d, and each guardrail result's metric carries runs whose FleetLab mean delta is the row's mean_delta.
      const verdict = computeVerdict({
        primary: { name: "primary", direction: row.direction, equivalence_margin: row.margin },
        guardrails: row.guardrails,
        baselineRuns: row.baseline_runs,
        candidateRuns: row.candidate_runs,
        resamples: row.resamples,
        key: row.key,
        precheckMatched: true,
      });
      assertExact(verdict.primary.paired_deltas, row.deltas, `${row.name} verdict deltas`);
      assertExact([verdict.primary.ci_low, verdict.primary.ci_high], [row.low, row.high], `${row.name} verdict interval`);
      assert.equal(verdict.outcome, row.outcome, `${row.name} verdict outcome`);
      assertExact(
        verdict.guardrail_results.map((r) => ({ metric: r.metric, mean_delta: r.mean_delta })),
        row.guardrail_results,
        `${row.name} verdict guardrail results`,
      );
      assertExact(verdict.guardrail_regressions, row.regressions, `${row.name} verdict regressions`);
      assert.equal(verdict.recommendation, row.recommendation, `${row.name} verdict recommendation`);
    }
  });

  test("verdict assembly (run_experiment record from per-seed runs)", () => {
    const rows = group("verdict");
    const data = vectors ?? loadVectors();
    assert.ok(rows.some((row) => row.name === "fleet-005" && row.key === data.fleet_005_spec_digest), "FLEET-005 row with its digest");
    assert.ok(
      rows.some((row) => {
        const available = row.record.guardrail_results.map((r) => r.metric);
        const regressed = row.record.guardrail_regressions;
        return available.length >= 2 && !regressed.includes(available[0]) && regressed.length > 0;
      }),
      "a row where a later available guardrail regresses after a first one within its limit",
    );
    // FleetLab's record carries ci_low and ci_high as null outside the primary; compareMetric omits them.
    const withNullInterval = (result) => ({ ci_low: null, ci_high: null, ...result });
    for (const row of rows) {
      const verdict = computeVerdict({
        primary: row.primary,
        guardrails: row.guardrails,
        descriptiveNames: row.descriptive_names,
        baselineRuns: row.baseline_runs,
        candidateRuns: row.candidate_runs,
        resamples: row.resamples,
        key: row.key,
        precheckMatched: true,
      });
      const actual = {
        validity: verdict.validity,
        outcome: verdict.outcome,
        recommendation: verdict.recommendation,
        primary: verdict.primary,
        guardrail_results: verdict.guardrail_results.map(withNullInterval),
        guardrail_regressions: verdict.guardrail_regressions,
        descriptives: verdict.descriptives.map(withNullInterval),
      };
      assertExact(actual, row.record, `verdict ${row.name}`);
    }
  });
});

describe("decision flow (hand-derived)", () => {
  const primary = { name: "wait.p90_s", direction: "lower_is_better", equivalence_margin: 30 };
  // Candidate minus baseline per seed: -100, -80, -90, so every bootstrap mean lies in [-100, -80] and high < -30.
  const baselineRuns = [
    { "wait.p90_s": 500, "unserved.fraction": 0.5, "requests.served": 10 },
    { "wait.p90_s": 600, "unserved.fraction": 0.25, "requests.served": 20 },
    { "wait.p90_s": 700, "unserved.fraction": 0.5, "requests.served": 30 },
  ];
  const candidateRuns = [
    { "wait.p90_s": 400, "unserved.fraction": 0.5, "requests.served": 11 },
    { "wait.p90_s": 520, "unserved.fraction": 0.25, "requests.served": 22 },
    { "wait.p90_s": 610, "unserved.fraction": 0.5, "requests.served": 33 },
  ];
  const base = { primary, baselineRuns, candidateRuns, resamples: 1000, key: "k".repeat(64), precheckMatched: true };

  test("enums are mirrored verbatim", () => {
    assert.deepEqual([...OUTCOMES], ["IMPROVED", "REGRESSED", "MIXED", "UNCHANGED", "INCONCLUSIVE"]);
    assert.deepEqual([...RECOMMENDATIONS], ["ADVANCE_TO_NEXT_TEST", "HOLD", "RUN_MORE_EXPERIMENTS", "NO_RECOMMENDATION"]);
    assert.deepEqual([...VALIDITY], ["VALID", "INVALID_EXPERIMENT"]);
    assert.deepEqual([...INVALIDITY_REASONS], ["INVARIANT_VIOLATION", "REPLICATION_MISMATCH", "NOT_COMPARABLE"]);
  });

  test("a precheck mismatch voids the run before anything else", () => {
    const verdict = computeVerdict({ ...base, precheckMatched: false, invariantViolation: "9: ignored" });
    assert.equal(verdict.validity, "INVALID_EXPERIMENT");
    assert.equal(verdict.invalidity_reason, "REPLICATION_MISMATCH");
    assert.equal(verdict.invalidity_detail, "identical seed produced different metrics on replay");
    assert.equal(verdict.outcome, null);
    assert.equal(verdict.primary, null);
    assert.equal(verdict.recommendation, "NO_RECOMMENDATION");
    assert.deepEqual(verdict.guardrail_statuses, []);
  });

  test("an invariant violation voids the run with its first 300 code points", () => {
    const text = `seed 1001: ${"😀".repeat(400)}`;
    const verdict = computeVerdict({ ...base, invariantViolation: text });
    assert.equal(verdict.invalidity_reason, "INVARIANT_VIOLATION");
    assert.equal(Array.from(verdict.invalidity_detail).length, 300);
    assert.ok(text.startsWith(verdict.invalidity_detail));
    assert.equal(verdict.outcome, null);
  });

  test("an unavailable primary is NOT_COMPARABLE", () => {
    const verdict = computeVerdict({ ...base, primary: { ...primary, name: "depot.queue_p90_s" } });
    assert.equal(verdict.invalidity_reason, "NOT_COMPARABLE");
    assert.equal(verdict.invalidity_detail, "primary metric depot.queue_p90_s unavailable in some replication");
    assert.equal(verdict.recommendation, "NO_RECOMMENDATION");
  });

  test("an absent guardrail is NOT_EVALUABLE and never changes the recommendation", () => {
    const guardrails = [
      { metric: "unserved.fraction", max_harm: 0, direction: "lower_is_better" },
      { metric: "depot.queue_p90_s", max_harm: 60, direction: "lower_is_better" },
    ];
    const verdict = computeVerdict({ ...base, guardrails, descriptiveNames: ["requests.served", "wait.p90_s", "wait.p50_s"] });
    assert.equal(verdict.validity, "VALID");
    assert.equal(verdict.outcome, "IMPROVED");
    assert.equal(verdict.recommendation, "ADVANCE_TO_NEXT_TEST");
    // unserved.fraction deltas 0, 0, 0: harm 0 is not above max_harm 0.
    assert.deepEqual(verdict.guardrail_statuses, [
      { metric: "unserved.fraction", status: "WITHIN", harm: 0, max_harm: 0 },
      { metric: "depot.queue_p90_s", status: "NOT_EVALUABLE", harm: null, max_harm: 60 },
    ]);
    assert.deepEqual(verdict.guardrail_results.map((r) => r.metric), ["unserved.fraction"]);
    assert.deepEqual(verdict.guardrail_regressions, []);
    // Descriptives skip the primary and the absent wait.p50_s; requests.served deltas 1, 2, 3 have mean 2.
    assert.deepEqual(verdict.descriptives.map((r) => [r.metric, r.role, r.mean_delta, r.median_delta]), [["requests.served", "DESCRIPTIVE", 2, 2]]);
    // wait.p90_s: baseline mean 600, candidate mean 510, mean delta -90, median -90.
    assert.equal(verdict.primary.baseline_mean, 600);
    assert.equal(verdict.primary.candidate_mean, 510);
    assert.equal(verdict.primary.mean_delta, -90);
    assert.equal(verdict.primary.median_delta, -90);
    assert.ok(verdict.primary.ci_low >= -100 && verdict.primary.ci_high <= -80);
  });

  test("a regressed guardrail holds an improved primary", () => {
    const guardrails = [{ metric: "requests.served", max_harm: 1, direction: "higher_is_better" }];
    // requests.served mean delta +2 on a higher_is_better guardrail is harm -2: within.
    assert.equal(computeVerdict({ ...base, guardrails }).recommendation, "ADVANCE_TO_NEXT_TEST");
    const harmful = [{ metric: "requests.served", max_harm: 1, direction: "lower_is_better" }];
    // As lower_is_better the harm is +2 > 1: regressed, so HOLD.
    const verdict = computeVerdict({ ...base, guardrails: harmful });
    assert.equal(verdict.outcome, "IMPROVED");
    assert.deepEqual(verdict.guardrail_regressions, ["requests.served"]);
    assert.equal(verdict.recommendation, "HOLD");
    assert.equal(verdict.guardrail_statuses[0].status, "REGRESSED");
  });

  test("R = 100000 with n = 20 finishes in a few seconds", () => {
    const deltas = Array.from({ length: 20 }, (_, i) => i - 9.5);
    const started = process.hrtime.bigint();
    const [low, high] = bootstrapCi(deltas, 100000, "a".repeat(64));
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    assert.ok(low <= high);
    assert.ok(seconds < 5, `took ${seconds} s`);
  });
});
