// Experiment mode (contract 6.6 and 10; design 6, P-1 to P-9, "Spec digest and seed sets", 9.5).
// The frozen spec object, decimal text to parts per million, the single ppm division, pinned canonical bytes and
// digests, the run order, the precheck on the shared world, the stop at the first invariant violation, and UC-01's
// required result. Directions of other presets are never asserted here (design H-9).

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import { canonicalJson } from "../src/core/canon.js";
import { meanFleetLab } from "../src/core/stats.js";
import { bootstrapCi, bootstrapCiSteps } from "../src/instrument/bootstrap.js";
import { guardrailRegressions } from "../src/instrument/guardrails.js";
import { computeVerdict, computeVerdictSteps } from "../src/instrument/paired.js";
import { createRun } from "../src/model/engine.js";
import {
  armScenarios, experimentEnvelope, experimentSteps, freezeSpec, isNullCheckAxis, isNullCheckDraft, MODEL_VERSION,
  parseDecimalPpm, runExperimentSpec, seedWorld, SpecError, thresholdValue, validateDraft, verdictDeclarations,
} from "../src/model/experiment.js";
import {
  checkReplay, checkReplaySteps, checkRun, checkRunSteps, runDigest, runDigestSteps, runViolations, runViolationsSteps,
} from "../src/model/invariants.js";
import { computeAll, METRICS_VERSION } from "../src/model/metrics.js";
import { presetById, seedSet } from "../src/model/presets.js";
import { applyAxis } from "../src/model/schema.js";
import { buildWorld, worldDigest } from "../src/model/world.js";

const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const draftOf = (id, patch = {}) => ({ ...structuredClone(presetById(id).experiment), ...patch });
const checksOf = (draft) => validateDraft(draft).errors.map((e) => e.check);

describe("decimal text to parts per million (contract 6.6)", () => {
  test("parses whole and decimal text with integer arithmetic", () => {
    // 0.02 = 2 hundredths = 20,000 millionths; 0.10 = 100,000; 1 = 1,000,000; 0.000015 = 15; 0.123456 = 123,456.
    assert.equal(parseDecimalPpm("0.02"), 20000);
    assert.equal(parseDecimalPpm("0.10"), 100000);
    assert.equal(parseDecimalPpm("0"), 0);
    assert.equal(parseDecimalPpm("1"), 1000000);
    assert.equal(parseDecimalPpm("0.000015"), 15);
    assert.equal(parseDecimalPpm("0.123456"), 123456);
    assert.equal(parseDecimalPpm("2.5"), 2500000);
    // 0.1 + 0.2 in doubles is 0.30000000000000004; the text path never sees a double.
    assert.equal(parseDecimalPpm("0.3"), 300000);
  });

  test("rejects more than 6 decimal places, signs, exponents, blanks and numbers", () => {
    for (const bad of ["0.0000001", "0.1234567", "-0.01", "+0.01", "1e-5", ".5", "5.", " 0.5", "0.5 ", "", "0,5", "O.5"]) {
      assert.throws(() => parseDecimalPpm(bad), RangeError, bad);
    }
    assert.throws(() => parseDecimalPpm(0.02), RangeError);
    assert.throws(() => parseDecimalPpm("0.0000001"), /at most 6/);
  });
});

describe("thresholds reach the instrument as one division (contract 6.6)", () => {
  test("ppm metrics divide by 1,000,000 once; seconds and counts stay integers", () => {
    assert.equal(thresholdValue("unserved.fraction", 20000), 0.02); // 20000 / 1000000 is correctly rounded to the literal 0.02
    assert.equal(thresholdValue("depot.parking_peak_fraction", 100000), 0.1);
    assert.equal(thresholdValue("wait.p90_s", 60), 60);
    assert.equal(thresholdValue("depot.diversions", 3), 3);
    assert.ok(Object.is(thresholdValue("unserved.fraction", 15), 15 / 1000000));
  });

  test("a guardrail at 15 ppm with harm exactly 15 / 1000000 is not regressed", () => {
    // The two ways to scale differ: 15 * 1e-6 is 1.4999999999999999e-5, below the correctly rounded 15 / 1000000.
    const harm = 15 / 1000000;
    assert.ok(15 * 1e-6 < harm, "multiplying by 1e-6 would put the limit below the harm");
    // 22 paired seeds: baseline 0, candidate 15 / 1000000. Left-to-right, 22 copies of the double divided by 22 give
    // it back exactly (precondition asserted, not assumed), so the mean delta equals the harm.
    const n = 22;
    const baselineRuns = Array.from({ length: n }, () => ({ "wait.p90_s": 100, "unserved.fraction": 0 }));
    const candidateRuns = Array.from({ length: n }, () => ({ "wait.p90_s": 100, "unserved.fraction": harm }));
    assert.ok(Object.is(meanFleetLab(candidateRuns.map((r) => r["unserved.fraction"] - 0)), harm));

    // UC-08a, not UC-01: a UC-01 draft with another guardrail is no longer the null check, so its equal arms would not
    // freeze (design 2.8). UC-08a's primary is the same wait.p90_s, unscoped, margin 30 s; only the guardrail is set here.
    const frozen = freezeSpec(draftOf("UC-08a", { guardrails: [{ metric: "unserved.fraction", scope: {}, direction: "lower_is_better", max_harm_text: "0.000015" }] }));
    assert.equal(verdictDeclarations(frozen.spec).primary.name, "wait.p90_s");
    assert.equal(frozen.spec.guardrails[0].max_harm_units, 15);
    const { primary, guardrails } = verdictDeclarations(frozen.spec);
    assert.ok(Object.is(guardrails[0].max_harm, harm));
    const verdict = computeVerdict({ primary, guardrails, baselineRuns, candidateRuns, resamples: 1000, key: frozen.digest, precheckMatched: true });
    assert.equal(verdict.validity, "VALID");
    assert.deepEqual(verdict.guardrail_regressions, []);
    assert.equal(verdict.guardrail_statuses[0].status, "WITHIN");
    // Harm equal to the limit is not above it (P-8 strict); the wrong scaling would have regressed.
    assert.deepEqual(guardrailRegressions(verdict.guardrail_results, [{ ...guardrails[0], max_harm: 15 * 1e-6 }]), ["unserved.fraction"]);
  });
});

describe("freezeSpec builds exactly the contract 6.6 object", () => {
  test("keys, format fields, references and seeds of the L3 preset", () => {
    const { spec, digest, label } = freezeSpec(draftOf("L3"));
    assert.deepEqual(Object.keys(spec).sort(), ["axis", "format", "format_version", "guardrails", "metrics_version", "model_version", "primary", "question", "resamples", "scenario", "seed_set", "seeds"]);
    assert.equal(spec.format, "fleetlab-playground-spec");
    assert.equal(spec.format_version, 1);
    assert.equal(spec.model_version, "playground-model 0.1");
    assert.equal(MODEL_VERSION, "playground-model 0.1");
    assert.equal(spec.metrics_version, METRICS_VERSION);
    assert.deepEqual(spec.axis, { id: "policy:depot_assignment", baseline: "home_depot", candidate: "nearest_depot" });
    // Day 2 07:00 = 86,400 + 7 × 3,600 = 111,600; 09:00 = 118,800.
    assert.deepEqual(spec.primary, { metric: "wait.p90_s", scope: { area: "SF", window: { start_s: 111600, end_s: 118800 } }, direction: "lower_is_better", margin_units: 60 });
    assert.deepEqual(spec.guardrails.map((g) => g.metric), ["exposure.congested_empty_s", "depot.parking_peak_fraction", "unserved.fraction"]);
    assert.deepEqual(spec.guardrails[1], { metric: "depot.parking_peak_fraction", scope: { depot: "SJ-1" }, direction: "lower_is_better", max_harm_units: 100000 });
    assert.deepEqual(spec.seeds, Array.from({ length: 20 }, (_, i) => 1001 + i));
    assert.equal(spec.seed_set, 1);
    assert.equal(spec.resamples, 2000);
    assert.ok(Object.isFrozen(spec) && Object.isFrozen(spec.scenario.areas[0]));
    assert.equal(digest, sha(canonicalJson(spec)));
    assert.equal(label, `playground-spec:${digest.slice(0, 8)}`);
  });

  test("freezing a frozen spec gives the same digest; text thresholds equal integer thresholds", () => {
    const first = freezeSpec(draftOf("L3"));
    assert.equal(freezeSpec(first.spec).digest, first.digest);
    const typed = draftOf("L3");
    typed.primary = { metric: "wait.p90_s", scope: { area: "SF", window: { start_s: 111600, end_s: 118800 }, depot: undefined }, margin_text: "60" };
    typed.guardrails = [
      { metric: "exposure.congested_empty_s", scope: {}, max_harm_text: "0" },
      { metric: "depot.parking_peak_fraction", scope: { depot: "SJ-1" }, max_harm_text: "0.10" },
      { metric: "unserved.fraction", max_harm_text: "0.01" },
    ];
    assert.equal(freezeSpec(typed).digest, first.digest, "missing direction and scope are filled; undefined scope keys are omitted");
  });

  test("guardrails keep the user's order, and the order is part of the digest", () => {
    const draft = draftOf("L3");
    const reversed = { ...draft, guardrails: draft.guardrails.slice().reverse() };
    const a = freezeSpec(draft);
    const b = freezeSpec(reversed);
    assert.deepEqual(b.spec.guardrails.map((g) => g.metric), ["unserved.fraction", "depot.parking_peak_fraction", "exposure.congested_empty_s"]);
    assert.notEqual(a.digest, b.digest);
  });

  test("the morning release value off is stored as null", () => {
    const draft = draftOf("UC-08b", { axis: { id: "parameter:POL-4", baseline: 107100, candidate: "off" } });
    assert.equal(freezeSpec(draft).spec.axis.candidate, null);
    assert.deepEqual(checksOf(draftOf("UC-08b", { axis: { id: "parameter:DEP-4", baseline: 1200, candidate: null } })), ["ranges valid"]);
  });

  test("equal values pass only for the labelled null check of UC-01", () => {
    assert.equal(isNullCheckAxis({ id: "parameter:DEP-7", baseline: 10, candidate: 10 }), true);
    assert.equal(freezeSpec(draftOf("UC-01")).spec.axis.candidate, 10);
    assert.deepEqual(checksOf(draftOf("UC-08a", { axis: { id: "parameter:DEP-3.SF-1", baseline: 4, candidate: 4 } })), ["one axis"]);
    assert.deepEqual(checksOf(draftOf("UC-01", { axis: { id: "parameter:DEP-7", baseline: 11, candidate: 11 } })), ["one axis"]);
  });

  test("the exemption belongs to the UC-01 preset, not to any draft with its axis", () => {
    // UC-02's scenario, primary, guardrails and question with UC-01's axis at 10 and 10.
    const copied = draftOf("UC-02", { axis: { id: "parameter:DEP-7", baseline: 10, candidate: 10 } });
    assert.equal(isNullCheckAxis(copied.axis), true, "the axis alone matches UC-01's");
    assert.equal(isNullCheckDraft(copied), false);
    assert.deepEqual(checksOf(copied), ["one axis"]);
    assert.throws(() => freezeSpec(copied), (error) => error instanceof SpecError && error.errors.length === 1 && error.errors[0].check === "one axis");
    // The same draft with 999 resamples: the equal-values error keeps its place ahead of later checks.
    assert.deepEqual(checksOf({ ...copied, resamples: 999 }), ["one axis", "resamples"]);
    // UC-01 itself loses the exemption when its scenario, primary or guardrails change.
    assert.deepEqual(checksOf(draftOf("UC-01", { guardrails: [] })), ["one axis"]);
    assert.deepEqual(checksOf(draftOf("UC-01", { primary: { metric: "wait.p90_s", scope: {}, margin_units: 31 } })), ["one axis"]);
    assert.deepEqual(checksOf(draftOf("UC-01", { scenario: applyAxis(presetById("UC-01").experiment.scenario, "parameter:SUP-1.SJ", 12) })), ["one axis"]);
  });

  test("UC-01 keeps the exemption with another seed set, question or resample count, and threshold as text", () => {
    const set2 = freezeSpec(draftOf("UC-01", { seed_set: 2, seeds: seedSet(2, 20) }));
    assert.deepEqual(set2.spec.axis, { id: "parameter:DEP-7", baseline: 10, candidate: 10 });
    assert.deepEqual(set2.spec.seeds, seedSet(2, 20));
    for (const patch of [
      { seed_set: 2, seeds: seedSet(2, 20) },
      { seed_set: 3, seeds: seedSet(3, 10), resamples: 1000 },
      { question: "Does the null check read no change on these seeds?" },
      // Direction and scope filled from the registry, 30 s typed as text: the checked primary is UC-01's.
      { primary: { metric: "wait.p90_s", margin_text: "30" } },
    ]) {
      const draft = draftOf("UC-01", patch);
      assert.equal(isNullCheckDraft(draft), true, JSON.stringify(patch));
      assert.deepEqual(checksOf(draft), [], JSON.stringify(patch));
    }
  });
});

describe("freezeSpec rejects every unchecked draft (design 2.8, 7.2 checks)", () => {
  const cases = [
    ["two axes", () => draftOf("UC-08a", { axis: [{ id: "parameter:DEP-4", baseline: 1200, candidate: 900 }, { id: "parameter:DEP-7", baseline: 10, candidate: 8 }] }), ["one axis"]],
    ["an unknown axis", () => draftOf("UC-08a", { axis: { id: "parameter:NOPE-1", baseline: 1, candidate: 2 } }), ["one axis"]],
    ["an axis with an extra field", () => draftOf("UC-08a", { axis: { id: "parameter:DEP-4", baseline: 1200, candidate: 900, note: "x" } }), ["one axis"]],
    ["a value out of range (13 cleaning bays; the range is 1 to 12)", () => draftOf("UC-08a", { axis: { id: "parameter:DEP-3.SF-1", baseline: 4, candidate: 13 } }), ["ranges valid"]],
    ["a margin of 0", () => draftOf("UC-08a", { primary: { metric: "wait.p90_s", scope: {}, direction: "lower_is_better", margin_units: 0 } }), ["margin above 0"]],
    ["a missing margin", () => draftOf("UC-08a", { primary: { metric: "wait.p90_s", scope: {}, direction: "lower_is_better" } }), ["margin above 0"]],
    ["a fractional margin", () => draftOf("UC-08a", { primary: { metric: "wait.p90_s", scope: {}, direction: "lower_is_better", margin_units: 30.5 } }), ["ranges valid"]],
    ["seconds typed as decimal text", () => draftOf("UC-08a", { primary: { metric: "wait.p90_s", scope: {}, margin_text: "30.5" } }), ["ranges valid"]],
    ["a fraction with 7 decimal places", () => draftOf("UC-08a", { guardrails: [{ metric: "unserved.fraction", scope: {}, max_harm_text: "0.0200001" }] }), ["ranges valid"]],
    ["both a units and a text threshold", () => draftOf("UC-08a", { guardrails: [{ metric: "unserved.fraction", scope: {}, max_harm_units: 20000, max_harm_text: "0.02" }] }), ["ranges valid"]],
    ["a negative maximum harm", () => draftOf("UC-08a", { guardrails: [{ metric: "unserved.fraction", scope: {}, max_harm_units: -1 }] }), ["ranges valid"]],
    ["an unknown metric", () => draftOf("UC-08a", { primary: { metric: "wait.p99_s", scope: {}, margin_units: 30 } }), ["metrics registered"]],
    ["a neutral primary", () => draftOf("UC-08a", { primary: { metric: "requests.total", scope: {}, margin_units: 30 } }), ["metrics registered"]],
    ["a descriptive-only guardrail", () => draftOf("UC-08a", { guardrails: [{ metric: "depot.turnaround_completed_p90_s", scope: {}, max_harm_units: 60 }] }), ["metrics registered"]],
    ["a direction that is not the registry's", () => draftOf("UC-08a", { guardrails: [{ metric: "fleet.available_fraction", scope: {}, direction: "lower_is_better", max_harm_units: 20000 }] }), ["metrics registered"]],
    ["a scope the metric does not accept", () => draftOf("UC-08a", { guardrails: [{ metric: "fleet.placement_gap", scope: { area: "SF" }, max_harm_units: 2 }] }), ["scopes valid"]],
    ["a parking peak without a depot", () => draftOf("UC-08a", { guardrails: [{ metric: "depot.parking_peak_fraction", scope: {}, max_harm_units: 100000 }] }), ["scopes valid"]],
    // The measured span is [warm-up end 21,600, window end 122,400); a window starting at 18,000 lies in the warm-up.
    ["a window inside the warm-up", () => draftOf("UC-08a", { primary: { metric: "wait.p90_s", scope: { window: { start_s: 18000, end_s: 25200 } }, margin_units: 30 } }), ["scopes valid"]],
    ["9 seeds", () => draftOf("UC-08a", { seeds: seedSet(1, 9) }), ["seeds"]],
    ["101 seeds", () => draftOf("UC-08a", { seeds: seedSet(1, 101) }), ["seeds"]],
    ["seeds that are not the seed set", () => draftOf("UC-08a", { seeds: seedSet(1, 20).reverse() }), ["seeds"]],
    ["seeds of another set", () => draftOf("UC-08a", { seed_set: 2 }), ["seeds"]],
    ["999 resamples", () => draftOf("UC-08a", { resamples: 999 }), ["resamples"]],
    ["100,001 resamples", () => draftOf("UC-08a", { resamples: 100001 }), ["resamples"]],
    ["an empty question", () => draftOf("UC-08a", { question: "  " }), ["question"]],
    ["a question of 301 characters", () => draftOf("UC-08a", { question: "é".repeat(301) }), ["question"]],
    ["an unknown field", () => draftOf("UC-08a", { label: "mine" }), ["format"]],
    ["another spec format", () => draftOf("UC-08a", { format: "fleetlab-spec" }), ["format"]],
    ["an invalid scenario", () => draftOf("UC-08a", { scenario: { ...draftOf("UC-08a").scenario, patience_s: 5 } }), ["scenario"]],
    // Declared SJ peak 35/h, arms 20/h and 30/h: 35,000 thousandths lies above the shared envelope 30,000.
    ["a declared scenario above the shared envelope", () => draftOf("UC-08a", { axis: { id: "parameter:DEM-1.SJ", baseline: 20, candidate: 30 } }), ["ranges valid"]],
  ];
  for (const [name, make, checks] of cases) {
    test(name, () => {
      const draft = make();
      assert.deepEqual(checksOf(draft), checks);
      assert.throws(() => freezeSpec(draft), (error) => error instanceof SpecError && error.errors.length === checks.length);
    });
  }

  test("a question of exactly 300 characters and one of 10 and 100 seeds pass", () => {
    assert.equal(validateDraft(draftOf("UC-08a", { question: "é".repeat(300) })).ok, true);
    assert.equal(validateDraft(draftOf("UC-08a", { seeds: seedSet(1, 10) })).ok, true);
    assert.equal(validateDraft(draftOf("UC-08a", { seeds: seedSet(1, 100), resamples: 100000 })).ok, true);
  });
});

describe("pinned canonical bytes and digests (design 6, Spec digest and seed sets)", () => {
  // The digests below are pinned vectors: a change to the spec object, the scenario, the canonical serializer or the
  // presets moves them, and that change must be deliberate. Everything outside the scenario is written by hand here
  // in sorted key order, so the test also shows the byte layout; the scenario is pinned by its own digest.
  // Re-pinned deliberately for the SUP-1 recalibration (default cars SF 30, PEN 18, SJ 24, EB 18 became 40, 24, 32, 24):
  // only the scenario's car counts changed, each to a number of the same width, so the byte counts stay 9489 and 9848
  // and the scenario and spec digests move. Values from canonicalJson and SHA-256 of the frozen presets.
  const seedsText = (k) => `[${seedSet(k, 20).join(",")}]`;
  const uc01 = (k, scenarioText) =>
    '{"axis":{"baseline":10,"candidate":10,"id":"parameter:DEP-7"},"format":"fleetlab-playground-spec","format_version":1,' +
    '"guardrails":[{"direction":"lower_is_better","max_harm_units":20000,"metric":"unserved.fraction","scope":{}}],' +
    '"metrics_version":"playground-metrics 0.1","model_version":"playground-model 0.1",' +
    '"primary":{"direction":"lower_is_better","margin_units":30,"metric":"wait.p90_s","scope":{}},' +
    '"question":"With trips between depot visits set to 10 in both arms, does the verdict read no change?",' +
    `"resamples":2000,"scenario":${scenarioText},"seed_set":${k},"seeds":${seedsText(k)}}`;
  const l3 = (scenarioText) =>
    '{"axis":{"baseline":"home_depot","candidate":"nearest_depot","id":"policy:depot_assignment"},"format":"fleetlab-playground-spec","format_version":1,' +
    '"guardrails":[{"direction":"lower_is_better","max_harm_units":0,"metric":"exposure.congested_empty_s","scope":{}},' +
    '{"direction":"lower_is_better","max_harm_units":100000,"metric":"depot.parking_peak_fraction","scope":{"depot":"SJ-1"}},' +
    '{"direction":"lower_is_better","max_harm_units":10000,"metric":"unserved.fraction","scope":{}}],' +
    '"metrics_version":"playground-metrics 0.1","model_version":"playground-model 0.1",' +
    '"primary":{"direction":"lower_is_better","margin_units":60,"metric":"wait.p90_s","scope":{"area":"SF","window":{"end_s":118800,"start_s":111600}}},' +
    '"question":"Does sending cars to the nearest depot instead of their home depot change San Francisco rider wait p90 on day 2 from 07:00 to 09:00?",' +
    `"resamples":2000,"scenario":${scenarioText},"seed_set":1,"seeds":${seedsText(1)}}`;

  const vectors = [
    { name: "UC-01 on seed set 1", draft: () => draftOf("UC-01"), text: (sc) => uc01(1, sc), scenario: "4d1c940632b29dd442bcfeac36dba68fcff3baae50a543cc2eb4139e1bcc61b6", bytes: 9489, digest: "fbcabddf75de09e18980ca6e90eb8c3d186c03d26efdf75935c939f7c0112669" },
    { name: "L3 on seed set 1", draft: () => draftOf("L3"), text: l3, scenario: "b7aaab54daa424bf2165006e2d1046f53aff4f91f5ac1f13be786c577637c7fe", bytes: 9848, digest: "df5db7a2857cd9b520fa6064ad11f6a11bb1baaebc1bea231c64a77f911f5de4" },
    { name: "UC-01 on seed set 2", draft: () => draftOf("UC-01", { seed_set: 2, seeds: seedSet(2, 20) }), text: (sc) => uc01(2, sc), scenario: "4d1c940632b29dd442bcfeac36dba68fcff3baae50a543cc2eb4139e1bcc61b6", bytes: 9489, digest: "dc778f556a0c5245c58617df3fd061a8f90aaf2d50835eabab28a7297599cf93" },
  ];
  for (const v of vectors) {
    test(v.name, () => {
      const { spec, digest, label } = freezeSpec(v.draft());
      const scenarioText = canonicalJson(spec.scenario);
      assert.equal(sha(scenarioText), v.scenario);
      const text = canonicalJson(spec);
      assert.equal(text, v.text(scenarioText));
      assert.equal(Buffer.byteLength(text, "utf8"), v.bytes);
      assert.equal(sha(text), v.digest);
      assert.equal(digest, v.digest);
      assert.equal(label, `playground-spec:${v.digest.slice(0, 8)}`);
    });
  }

  test("another seed set is another spec with its own digest", () => {
    assert.notEqual(vectors[0].digest, vectors[2].digest);
  });
});

describe("experimentSteps runs the contract 6.6 order", () => {
  // L1 with 10 seeds: a demand axis (flat to peaked), so the shared envelope differs from the baseline arm's own.
  const spec = freezeSpec(draftOf("L1", { seeds: seedSet(1, 10), resamples: 1000 })).spec;
  const arms = armScenarios(spec);
  const envelope = experimentEnvelope(spec);
  const runs = [];
  const progress = [];
  const steps = experimentSteps(spec, {
    compute: (result, refs) => {
      runs.push({ seed: result.seed, arm: result.scenario.demand_shape === "flat" ? "baseline" : "candidate", world: result.world_digest });
      return computeAll(result, refs);
    },
  });
  let out;
  for (;;) {
    const next = steps.next();
    if (next.done) {
      out = next.value;
      break;
    }
    const last = progress[progress.length - 1];
    if (!last || last.done !== next.value.done || last.label !== next.value.label) progress.push(next.value);
  }

  test("precheck twice on the first seed's shared world, then seeds in order, baseline first", () => {
    const expected = [
      { seed: 1001, arm: "baseline" }, { seed: 1001, arm: "baseline" },
      ...spec.seeds.flatMap((seed) => [{ seed, arm: "baseline" }, { seed, arm: "candidate" }]),
    ];
    assert.deepEqual(runs.map(({ seed, arm }) => ({ seed, arm })), expected);
    const shared = worldDigest(buildWorld(spec.scenario, { seed: 1001, lambdaMaxPermille: envelope }));
    assert.equal(runs[0].world, shared);
    assert.equal(runs[1].world, shared);
    assert.equal(runs[2].world, shared);
    // FleetLab builds its precheck world from the baseline arm (P-3); the teaching engine does not. With its own
    // envelope the flat arm's world is another world.
    assert.notEqual(worldDigest(buildWorld(arms.baseline, { seed: 1001 })), shared);
    for (const run of runs.slice(2)) assert.equal(run.world, worldDigest(seedWorld(spec, run.seed, envelope)));
  });

  test("progress counts runs out of 2 × seeds + 3 and the payload has the runtime's keys", () => {
    // 2 precheck runs, 10 seeds × 2 arms, and the candidate arm's replay on the first seed (design 5.4 item 6): 23.
    assert.ok(progress.every((p) => p.total === 23));
    assert.deepEqual([...new Set(progress.map((p) => p.done))], Array.from({ length: 24 }, (_, i) => i));
    assert.ok(progress.some((p) => p.label === "Replay check on seed 1001, candidate arm"));
    assert.deepEqual(Object.keys(out).sort(), ["digest", "label", "lambdaMaxPermille", "per_seed", "verdict"]);
    assert.equal(out.digest, freezeSpec(spec).digest);
    assert.deepEqual(out.lambdaMaxPermille, envelope);
    assert.deepEqual(out.per_seed.map((p) => p.seed), spec.seeds);
    assert.equal(out.verdict.validity, "VALID");
  });
});

describe("sliced variants return what the one-shot functions return (design 5.9 slice rule)", () => {
  const spec = freezeSpec(draftOf("L1", { seeds: seedSet(1, 10), resamples: 1000 })).spec;
  const arms = armScenarios(spec);
  const world = seedWorld(spec, 1001);
  const drain = (steps) => {
    let yields = 0;
    for (;;) {
      const next = steps.next();
      if (next.done) return { value: next.value, yields };
      assert.equal(next.value, undefined, "the check generators yield bare ticks");
      yields += 1;
    }
  };

  test("whole-run checks, violations, digests and replay on clean and defective runs, with and without logs", () => {
    for (const keepLogs of [true, false]) {
      for (const defect of [null, "double_assign"]) {
        const r = createRun(arms.candidate, world, { seed: 1001, keepLogs, defect }).runToEnd();
        const again = createRun(arms.candidate, world, { seed: 1001, keepLogs, defect }).runToEnd();
        const name = `logs ${keepLogs}, defect ${defect}`;
        const checks = drain(checkRunSteps(r));
        assert.deepEqual(checks.value, checkRun(r), name);
        // One yield after each of the 11 check groups.
        assert.equal(checks.yields, 11, name);
        assert.deepEqual(drain(runViolationsSteps(r)).value, runViolations(r), name);
        if (defect !== null) assert.ok(runViolations(r).length > 0, name);
        const digest = drain(runDigestSteps(r));
        assert.equal(digest.value, runDigest(r), name);
        if (keepLogs) assert.ok(digest.yields > 0, `${name}: a logged run's digest is hashed in more than one piece`);
        assert.deepEqual(drain(checkReplaySteps(r, again)).value, checkReplay(r, again), name);
      }
    }
    // A replay mismatch reads the same text both ways.
    const clean = createRun(arms.candidate, world, { seed: 1001 }).runToEnd();
    const other = createRun(arms.baseline, world, { seed: 1001 }).runToEnd();
    assert.equal(checkReplay(clean, other).length, 1);
    assert.deepEqual(drain(checkReplaySteps(clean, other)).value, checkReplay(clean, other));
  });

  test("runDigestSteps hashes exactly the JSON.stringify text: empty slots, skipped keys, non-ASCII across pieces", () => {
    const odd = {
      events: [{ kind: "é", note: undefined, f: () => 1 }, undefined, null],
      intervals: { a: [1, 2], skipped: undefined, "clé": [{ t0: 1 }] },
      visits: [],
      requests: [Number.NaN],
      drain_end_s: undefined,
    };
    assert.equal(drain(runDigestSteps(odd)).value, runDigest(odd));
    // 3,000 events of about 110 characters each, with surrogate pairs, cross the 262,144-character piece boundary.
    const long = { events: Array.from({ length: 3000 }, (_, i) => ({ ord: i, text: "\u{1F600}".repeat(50) })), intervals: {}, visits: [], requests: [], drain_end_s: 7 };
    const sliced = drain(runDigestSteps(long));
    assert.ok(sliced.yields > 0);
    assert.equal(sliced.value, runDigest(long));
  });

  test("bootstrapCiSteps and computeVerdictSteps", () => {
    const deltas = Array.from({ length: 20 }, (_, i) => ((i * 37) % 11) - 5 + i / 8);
    const key = "cd".repeat(32);
    const ci = drain(bootstrapCiSteps(deltas, 2000, key));
    assert.deepEqual(ci.value, bootstrapCi(deltas, 2000, key));
    // 2,000 resamples × 20 draws = 40,000 draws: a yield after every 205th resample (4,100 draws, the first multiple of 20
    // at or above 4,096) gives floor(2000 / 205) = 9 yields, then one before the sort.
    assert.equal(ci.yields, 10);
    const baselineRuns = deltas.map(() => ({ "wait.p90_s": 100 }));
    const candidateRuns = deltas.map((d) => ({ "wait.p90_s": 100 + d }));
    const args = { primary: { name: "wait.p90_s", direction: "lower_is_better", equivalence_margin: 30 }, baselineRuns, candidateRuns, resamples: 2000, key, precheckMatched: true };
    assert.deepEqual(drain(computeVerdictSteps(args)).value, computeVerdict(args));
    assert.deepEqual(drain(computeVerdictSteps({ ...args, precheckMatched: false })).value, computeVerdict({ ...args, precheckMatched: false }));
  });

  test("experimentSteps yields only progress markers, and its de-duplicated marker sequence never steps back", () => {
    let last = null;
    const steps = experimentSteps(spec);
    for (let next = steps.next(); !next.done; next = steps.next()) {
      const p = next.value;
      assert.ok(p !== null && typeof p === "object" && Number.isSafeInteger(p.done) && p.total === 23 && typeof p.label === "string");
      if (last !== null) assert.ok(p.done >= last.done, `${p.label} (${p.done}) after ${last.label} (${last.done})`);
      last = p;
    }
  });
});

describe("invalid experiments stop where contract 6.6 and run_experiment stop", () => {
  const spec = freezeSpec(draftOf("UC-08b", { seeds: seedSet(1, 10), resamples: 1000 })).spec;
  const envelope = experimentEnvelope(spec);

  test("the first invariant violation stops the run with `seed N: first violation`", () => {
    const attempts = [];
    const out = runExperimentSpec(spec, {
      defectAt: (at) => {
        attempts.push(at);
        return at.phase === "paired" && at.seed === 1003 && at.arm === "candidate" ? "double_assign" : null;
      },
    });
    // The same run outside the experiment: seed 1003's shared world, the candidate arm, the same defect.
    const world = seedWorld(spec, 1003, envelope);
    const alone = createRun(armScenarios(spec).candidate, world, { seed: 1003, keepLogs: false, defect: "double_assign" }).runToEnd();
    const first = runViolations(alone)[0];
    assert.match(first, /^2: /);
    assert.equal(out.verdict.validity, "INVALID_EXPERIMENT");
    assert.equal(out.verdict.invalidity_reason, "INVARIANT_VIOLATION");
    assert.equal(out.verdict.invalidity_detail, `seed 1003: ${first}`.slice(0, 300));
    assert.equal(out.verdict.outcome, null);
    assert.equal(out.verdict.recommendation, "NO_RECOMMENDATION");
    // 2 precheck runs, seed 1001 in both arms plus its candidate replay, seed 1002 in both arms, then 1003 baseline
    // and candidate: 9 runs, nothing later.
    assert.equal(attempts.length, 9);
    // Order: precheck 1 and 2 (indices 0, 1), 1001 baseline (2), 1001 candidate (3), its replay (4).
    assert.deepEqual(attempts[3], { phase: "paired", seed: 1001, arm: "candidate", run: 1 });
    assert.deepEqual(attempts[4], { phase: "replay", seed: 1001, arm: "candidate", run: 2 });
    assert.deepEqual(attempts[8], { phase: "paired", seed: 1003, arm: "candidate", run: 1 });
    assert.deepEqual(out.per_seed.map((p) => p.seed), [1001, 1002]);
  });

  test("a violation in the first precheck run stops before the second", () => {
    const attempts = [];
    const out = runExperimentSpec(spec, { defectAt: (at) => (attempts.push(at), at.phase === "precheck" && at.run === 1 ? "teleport" : null) });
    assert.equal(out.verdict.invalidity_reason, "INVARIANT_VIOLATION");
    assert.match(out.verdict.invalidity_detail, /^seed 1001: P14: /);
    assert.equal(attempts.length, 1);
  });

  test("different metric maps on replay give REPLICATION_MISMATCH and nothing runs later", () => {
    let calls = 0;
    const out = runExperimentSpec(spec, {
      compute: (result, refs) => {
        calls += 1;
        const map = computeAll(result, refs);
        return calls === 2 ? { ...map, "wait.p90_s": { value: map["wait.p90_s"].value + 1 } } : map;
      },
    });
    assert.equal(calls, 2);
    assert.equal(out.verdict.invalidity_reason, "REPLICATION_MISMATCH");
    assert.equal(out.verdict.invalidity_detail, "identical seed produced different metrics on replay");
    assert.deepEqual(out.per_seed, []);
  });

  test("a primary absent in one replication gives NOT_COMPARABLE", () => {
    let calls = 0;
    const out = runExperimentSpec(spec, {
      compute: (result, refs) => {
        calls += 1;
        const map = computeAll(result, refs);
        return calls === 6 ? { ...map, "wait.p90_s": { absent: "no completed request in scope" } } : map;
      },
    });
    assert.equal(calls, 22);
    assert.equal(out.verdict.invalidity_reason, "NOT_COMPARABLE");
    assert.equal(out.verdict.invalidity_detail, "primary metric wait.p90_s unavailable in some replication");
  });
});

describe("UC-01 null check: its required result (design UC-01)", () => {
  const frozen = freezeSpec(draftOf("UC-01"));
  const out = runExperimentSpec(frozen.spec);
  const v = out.verdict;

  test("UNCHANGED, every paired delta exactly 0, a zero-width interval, NO_RECOMMENDATION", () => {
    assert.equal(v.validity, "VALID");
    assert.equal(v.outcome, "UNCHANGED");
    assert.equal(v.recommendation, "NO_RECOMMENDATION");
    assert.equal(v.primary.name ?? v.primary.metric, "wait.p90_s");
    assert.equal(v.primary.paired_deltas.length, 20);
    for (const d of v.primary.paired_deltas) assert.ok(Object.is(d, 0), `delta ${d}`);
    // Every bootstrap mean averages zeros, so both indexed means (49 and 1950 at R = 2000) are 0.
    assert.ok(Object.is(v.primary.ci_low, 0) && Object.is(v.primary.ci_high, 0));
    assert.deepEqual(v.guardrail_regressions, []);
    for (const g of v.guardrail_results) for (const d of g.paired_deltas) assert.ok(Object.is(d, 0));
    for (const row of v.descriptives) for (const d of row.paired_deltas) assert.ok(Object.is(d, 0), row.metric);
  });

  test("both arms read identical metric maps on every seed, and the payload names the frozen spec", () => {
    assert.equal(out.digest, frozen.digest);
    assert.equal(out.label, frozen.label);
    assert.equal(out.per_seed.length, 20);
    for (const p of out.per_seed) assert.deepEqual(p.candidate_metrics, p.baseline_metrics);
    // The null check is not a demand axis, so the envelope is the scenario's own: SF peak 60/h is 60,000 thousandths.
    assert.equal(out.lambdaMaxPermille.SF, 60000);
    assert.deepEqual(applyAxis(frozen.spec.scenario, "parameter:DEP-7", 10), frozen.spec.scenario);
  });
});
