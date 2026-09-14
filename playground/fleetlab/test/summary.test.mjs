import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { guardrailStatuses } from "../src/instrument/guardrails.js";
import { resolveOutcome } from "../src/instrument/outcome.js";
import { resolveRecommendation } from "../src/instrument/recommendation.js";
import { FORBIDDEN_SUMMARY_KEYS, resultSummary, summaryText } from "../src/instrument/summary.js";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PLAYGROUND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SAMPLE_PATH = join(REPO_ROOT, "tests/fixtures/fleet_playground/sample_result_summary.json");

/** FleetLab's label tuple, read from its source so this test never spells the strings (design H-8). */
function requiredLabels() {
  const source = readFileSync(join(REPO_ROOT, "src/hermes/fleet/contracts.py"), "utf8");
  const block = source.match(/REQUIRED_LABELS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\n\)/);
  assert.ok(block, "REQUIRED_LABELS tuple found in contracts.py");
  const labels = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(labels.length, 5);
  return labels;
}

const DIGEST = "3f9a1c2e7b4d5a6c8e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f";

const OPTIONS = {
  specDigest: DIGEST,
  modelVersion: "playground-model 0.1",
  question: "Does a fourth cleaning bay at SJ-1 lower the evening p90 wait?",
  axis: "parameter:DEP-3.SJ-1",
  baselineValue: 3,
  candidateValue: 4,
  seedSet: { set: 1, seeds: [1001, 1002, 1003] },
};

const PRIMARY = { name: "wait.p90_s", direction: "lower_is_better", equivalence_margin: 30 };
const GUARDRAILS = [
  { metric: "unserved.fraction", max_harm: 0.02, direction: "lower_is_better" },
  { metric: "depot.queue_p90_s", max_harm: 120, direction: "lower_is_better" },
];

/** A hand-built valid verdict; every number is written here, not produced by a run. */
function handBuiltVerdict() {
  return {
    validity: "VALID",
    invalidity_reason: null,
    invalidity_detail: null,
    // Interval [-68, -52]: high -52 < -30, so IMPROVED.
    outcome: "IMPROVED",
    // No regression and IMPROVED, so ADVANCE_TO_NEXT_TEST.
    recommendation: "ADVANCE_TO_NEXT_TEST",
    primary: {
      metric: "wait.p90_s",
      role: "PRIMARY",
      baseline_mean: 600,
      candidate_mean: 540,
      paired_deltas: [-50, -70, -60], // mean -60, median -60
      mean_delta: -60,
      median_delta: -60,
      ci_low: -68,
      ci_high: -52,
    },
    guardrail_results: [
      {
        metric: "unserved.fraction",
        role: "GUARDRAIL",
        baseline_mean: 0.05,
        candidate_mean: 0.06,
        paired_deltas: [0.01, 0.01, 0.01],
        mean_delta: 0.01,
        median_delta: 0.01,
      },
    ],
    guardrail_regressions: [],
    descriptives: [
      {
        metric: "requests.served",
        role: "DESCRIPTIVE",
        baseline_mean: 400,
        candidate_mean: 410,
        paired_deltas: [10, 12, 8], // mean 10, median 10
        mean_delta: 10,
        median_delta: 10,
      },
    ],
    guardrail_statuses: [
      // lower_is_better harm is the mean delta 0.01, not above 0.02.
      { metric: "unserved.fraction", status: "WITHIN", harm: 0.01, max_harm: 0.02 },
      // depot.queue_p90_s has no comparison: not evaluable.
      { metric: "depot.queue_p90_s", status: "NOT_EVALUABLE", harm: null, max_harm: 120 },
    ],
  };
}

function invalidVerdict() {
  return {
    validity: "INVALID_EXPERIMENT",
    invalidity_reason: "NOT_COMPARABLE",
    invalidity_detail: "primary metric wait.p90_s unavailable in some replication",
    outcome: null,
    recommendation: "NO_RECOMMENDATION",
    primary: null,
    guardrail_results: [],
    guardrail_regressions: [],
    descriptives: [],
    guardrail_statuses: [],
  };
}

/** Every object key at every depth. */
function allKeys(value, keys = []) {
  if (Array.isArray(value)) value.forEach((item) => allKeys(item, keys));
  else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.push(key);
      allKeys(item, keys);
    }
  }
  return keys;
}

/** Every file under a directory. */
function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("result summary", () => {
  test("the hand-built verdict obeys the verdict rules", () => {
    const verdict = handBuiltVerdict();
    assert.equal(resolveOutcome(verdict.primary, PRIMARY), verdict.outcome);
    assert.equal(resolveRecommendation(verdict.outcome, verdict.guardrail_regressions), verdict.recommendation);
    assert.deepEqual(guardrailStatuses(verdict.guardrail_results, GUARDRAILS), verdict.guardrail_statuses);
  });

  test("equals the committed sample summary", () => {
    const expected = JSON.parse(readFileSync(SAMPLE_PATH, "utf8"));
    assert.deepEqual(resultSummary(handBuiltVerdict(), OPTIONS), expected);
  });

  for (const [name, build] of [["valid", handBuiltVerdict], ["invalid", invalidVerdict]]) {
    test(`${name} verdict: no forbidden key at any depth, no full digest, the teaching-run status`, () => {
      const summary = resultSummary(build(), OPTIONS);
      const keys = allKeys(summary);
      for (const forbidden of ["spec_digest", "world_tape_digest", "seed_set_digest", "deployment_permission", "labels", "schema_version"]) {
        assert.ok(FORBIDDEN_SUMMARY_KEYS.includes(forbidden));
        assert.ok(!keys.includes(forbidden), `key ${forbidden} absent`);
      }
      assert.equal(summary.format, "fleetlab-playground-result-summary");
      assert.equal(summary.format_version, 1);
      assert.equal(summary.evidence_status, "NOT_EVIDENCE");
      assert.equal(summary.decision_authority, "NONE");
      assert.equal(summary.model_version, "playground-model 0.1");
      assert.match(summary.playground_spec, /^playground-spec:[0-9a-f]{8}$/);
      assert.equal(summary.playground_spec, `playground-spec:${DIGEST.slice(0, 8)}`);
      const serialized = JSON.stringify(summary);
      const text = summaryText(summary);
      assert.ok(!serialized.includes(DIGEST), "full digest absent from JSON");
      assert.ok(!text.includes(DIGEST), "full digest absent from text");
      assert.ok(!/[\u2013\u2014]/.test(text), "no en or em dash in the text");
      assert.ok(!/\b(predict|forecast|expected traffic|live|real-time|monitoring|wins|beats|better option)\b/i.test(text));
      for (const label of requiredLabels()) {
        assert.ok(!serialized.includes(label) && !text.includes(label), "no FleetLab label string");
      }
    });
  }

  test("text states outcome and recommendation, and void evidence has no outcome", () => {
    const valid = summaryText(resultSummary(handBuiltVerdict(), OPTIONS));
    assert.match(valid, /^Evidence status: NOT_EVIDENCE$/m);
    assert.match(valid, /^Outcome: IMPROVED$/m);
    assert.match(valid, /^Recommendation: ADVANCE_TO_NEXT_TEST$/m);
    assert.match(valid, /95% interval \[-68, -52\]/);
    assert.match(valid, /depot\.queue_p90_s: NOT EVALUABLE: metric absent in some replication/);
    const invalid = summaryText(resultSummary(invalidVerdict(), OPTIONS));
    assert.match(invalid, /Void evidence has no outcome\. It says nothing about the candidate\./);
    assert.doesNotMatch(invalid, /^Outcome:/m);
    assert.match(invalid, /^Recommendation: NO_RECOMMENDATION$/m);
  });

  test("refuses forbidden keys, the full digest and non-JSON values", () => {
    assert.throws(() => resultSummary(handBuiltVerdict(), { ...OPTIONS, seedSet: { labels: ["x"] } }), /never carries the key/);
    assert.throws(() => resultSummary(handBuiltVerdict(), { ...OPTIONS, question: `about ${DIGEST}` }), /full spec digest/);
    assert.throws(() => resultSummary(handBuiltVerdict(), { ...OPTIONS, specDigest: "abc" }), TypeError);
    assert.throws(() => resultSummary(handBuiltVerdict(), { ...OPTIONS, baselineValue: Number.NaN }), TypeError);
    assert.throws(() => resultSummary(handBuiltVerdict(), { ...OPTIONS, modelVersion: "" }), TypeError);
  });

  test("no playground source, test or fixture file contains a FleetLab label string", () => {
    const labels = requiredLabels();
    const files = [...filesUnder(PLAYGROUND_ROOT), ...filesUnder(join(REPO_ROOT, "tests/fixtures/fleet_playground"))];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const label of labels) assert.ok(!content.includes(label), `${file} holds a label string`);
    }
  });
});
