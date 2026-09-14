import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { guardrailStatuses } from "../src/instrument/guardrails.js";
import { resolveOutcome } from "../src/instrument/outcome.js";
import { resolveRecommendation } from "../src/instrument/recommendation.js";
import { FORBIDDEN_SUMMARY_KEYS, resultSummary, summaryText } from "../src/instrument/summary.js";
import { MODEL_VERSION, freezeSpec, runExperimentSpec } from "../src/model/experiment.js";
import { presetById, seedSet } from "../src/model/presets.js";

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

  test("the committed sample summary is the UC-01 preset's real verdict from the model", () => {
    // Built in-process from the preset exactly as the Experiment sheet freezes it; the fixture was written by hand from
    // a scratch run of this same call, and no playground code writes it (contract section 12, item 12).
    const frozen = freezeSpec(structuredClone(presetById("UC-01").experiment));
    const { verdict, digest, label } = runExperimentSpec(frozen.spec);
    const { spec } = frozen;
    const summary = resultSummary(verdict, {
      specDigest: digest,
      modelVersion: spec.model_version,
      question: spec.question,
      axis: spec.axis.id,
      baselineValue: spec.axis.baseline,
      candidateValue: spec.axis.candidate,
      seedSet: { set: spec.seed_set, seeds: [...spec.seeds] },
    });
    const expected = JSON.parse(readFileSync(SAMPLE_PATH, "utf8"));
    assert.deepStrictEqual(summary, expected);
    assert.equal(summary.model_version, MODEL_VERSION);
    assert.equal(summary.playground_spec, label);
    assert.deepEqual(summary.seed_set, { set: 1, seeds: seedSet(1, 20) });
    // UC-01 is the labelled null check (both arms 10), so the verdict must read no change.
    assert.equal(summary.outcome, "UNCHANGED");
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
    // Changed with G6: the text rounds seconds to one decimal and names the unit, so [-68, -52] reads [-68.0 s, -52.0 s].
    assert.match(valid, /95% interval \[-68\.0 s, -52\.0 s\]/);
    assert.match(valid, /depot\.queue_p90_s: NOT EVALUABLE: metric absent in some replication/);
    const invalid = summaryText(resultSummary(invalidVerdict(), OPTIONS));
    assert.match(invalid, /Void evidence has no outcome\. It says nothing about the candidate\./);
    assert.doesNotMatch(invalid, /^Outcome:/m);
    assert.match(invalid, /^Recommendation: NO_RECOMMENDATION$/m);
  });

  test("text rounds numbers for reading while the summary keeps the exact values (G6)", () => {
    const verdict = handBuiltVerdict();
    // 826.15 is stored as 826.14999999999997726...; half to even on that exact expansion gives 826.1 at one decimal.
    // 0.25 s is exact in binary, a tie at one decimal, so it rounds to the even 0.2. 0.00005 is stored as
    // 0.0000500000000000000024..., above the tie, so at four decimals it reads 0.0001.
    verdict.primary = { ...verdict.primary, mean_delta: 826.15, ci_high: 0.25 };
    verdict.guardrail_statuses = [{ ...verdict.guardrail_statuses[0], harm: 0.00005 }, verdict.guardrail_statuses[1]];
    const summary = resultSummary(verdict, OPTIONS);
    assert.equal(summary.primary.mean_delta, 826.15, "the summary object keeps the exact double");
    assert.equal(summary.guardrails[0].harm, 0.00005);
    const text = summaryText(summary);
    assert.match(text, /^Primary wait\.p90_s: mean delta \+826\.1 s, median delta -60\.0 s, 95% interval \[-68\.0 s, \+0\.2 s\]$/m);
    // Means 600 and 540 s at one decimal.
    assert.match(text, /^Primary wait\.p90_s: baseline mean 600\.0 s, candidate mean 540\.0 s$/m);
    // A fraction reads at four decimals: harm 0.00005 is +0.0001 and max harm 0.02 is 0.0200.
    assert.match(text, /^Guardrail unserved\.fraction: WITHIN \(harm \+0\.0001, max harm 0\.0200\)$/m);
    // A seconds metric that is not evaluable keeps its max harm in seconds: 120 is 120.0 s.
    assert.match(text, /^Guardrail depot\.queue_p90_s: NOT EVALUABLE: metric absent in some replication \(max harm 120\.0 s\)$/m);
    // A count reads at one decimal: means 400 and 410, delta +10.
    assert.match(text, /^Descriptive, no claim, requests\.served: baseline mean 400\.0, candidate mean 410\.0, mean delta \+10\.0$/m);
    assert.match(text, /^Evidence status: NOT_EVIDENCE$/m);
  });

  test("text never reads -0: a small negative keeps its sign and digits, and a negative zero reads 0.0 (G6)", () => {
    // Review: no test fed a negative value that rounds to zero. -0.00001 rounds to 0.0 at one decimal and to 0.0000 at
    // four; a nonzero value never reads as zero (the honesty rule below), so each reads its exact double -0.00001, and
    // neither "-0.0 s" nor "-0.0000" appears. -0 is zero and reads 0.0 s with no sign.
    const verdict = handBuiltVerdict();
    verdict.primary = { ...verdict.primary, ci_high: -0 };
    verdict.descriptives = [{ ...verdict.descriptives[0], mean_delta: -0.00001 }];
    verdict.guardrail_statuses = [{ ...verdict.guardrail_statuses[0], harm: -0.00001 }, verdict.guardrail_statuses[1]];
    const text = summaryText(resultSummary(verdict, OPTIONS));
    assert.match(text, /^Primary wait\.p90_s: mean delta -60\.0 s, median delta -60\.0 s, 95% interval \[-68\.0 s, 0\.0 s\]$/m);
    assert.match(text, /^Descriptive, no claim, requests\.served: baseline mean 400\.0, candidate mean 410\.0, mean delta -0\.00001$/m);
    assert.match(text, /^Guardrail unserved\.fraction: WITHIN \(harm -0\.00001, max harm 0\.0200\)$/m);
    assert.doesNotMatch(text, /-0(?:\.0+)?(?![0-9.])/, "no text reads a negative zero");
  });

  test("text never rounds a nonzero value to zero, so a regressed guardrail keeps its harm (honesty review)", () => {
    // One more unserved request out of 1,836 in one of 20 paired seeds gives a mean delta of 1/1836/20, about
    // 2.7e-5. guardrails.js marks it REGRESSED against max harm 0 (strict harm > max_harm). At four decimals it would
    // read 0.0000 with no sign, the same as its max harm, so the text falls back to the exact double instead.
    const harm = 1 / 1836 / 20;
    const [rail] = guardrailStatuses(
      [{ metric: "unserved.fraction", mean_delta: harm }],
      [{ metric: "unserved.fraction", max_harm: 0, direction: "lower_is_better" }],
    );
    assert.equal(rail.status, "REGRESSED");
    const verdict = handBuiltVerdict();
    verdict.guardrail_statuses = [rail, verdict.guardrail_statuses[1]];
    // Small nonzero primary values on a fraction metric follow the same rule, including a negative bound and a value
    // below 1e-6, which String() would print in exponent notation (1e-7 must read 0.0000001).
    verdict.primary = {
      ...verdict.primary,
      metric: "unserved.fraction",
      mean_delta: -harm,
      median_delta: 0,
      ci_low: -1e-7,
      ci_high: 0.00003,
      baseline_mean: 0.00001,
      candidate_mean: 0.00001,
    };
    const text = summaryText(resultSummary(verdict, OPTIONS));
    assert.doesNotMatch(text, /harm 0\.0000, max harm 0\.0000/);
    assert.match(text, /^Guardrail unserved\.fraction: REGRESSED \(harm \+0\.00002723311546840959, max harm 0\.0000\)$/m);
    assert.match(
      text,
      /^Primary unserved\.fraction: mean delta -0\.00002723311546840959, median delta 0\.0000, 95% interval \[-0\.0000001, \+0\.00003\]$/m,
    );
    assert.match(text, /^Primary unserved\.fraction: baseline mean 0\.00001, candidate mean 0\.00001$/m);
    assert.doesNotMatch(text, /e-\d/);
    // A seconds value below 0.05 s keeps its sign and unit the same way.
    const seconds = handBuiltVerdict();
    seconds.guardrail_statuses = [
      seconds.guardrail_statuses[0],
      { metric: "depot.queue_p90_s", status: "REGRESSED", harm: 0.025, max_harm: 0.01 },
    ];
    assert.match(
      summaryText(resultSummary(seconds, OPTIONS)),
      /^Guardrail depot\.queue_p90_s: REGRESSED \(harm \+0\.025 s, max harm 0\.01 s\)$/m,
    );
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
