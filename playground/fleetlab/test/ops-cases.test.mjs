// The operations casebook (src/model/ops-cases.js, design section 4.4): twenty preregistered situations, each pinned
// to the spec and the verdict its calibration measured (test/ops-cases.pins.json, seed set 1 at σ 0.15 with 2,000
// resamples; seed sets 2 and 3 under FLEET_PLAYGROUND_PERF=1). The runs are deterministic, so the spec digest, the
// mean delta, the interval and every guardrail harm are compared exactly against the pinned doubles; the rounded
// numbers beside them are what the design tables print, and a test holds them to their exact values. The scenario name
// keys the demand trace, so a slug is part of the spec: renaming one moves its numbers. Copy fields obey the design's
// copy rules (H-3, H-6) and never state a direction or cite another case's result (H-9): lessons live in the design
// document beside these pins.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { freezeSpec, runExperimentSpec } from "../src/model/experiment.js";
import { OPS_CASES, OPS_THEME_IDS } from "../src/model/ops-cases.js";
import { PRESETS, PRESET_REPLICATIONS, opsPresetsOf, presetById, seedSet } from "../src/model/presets.js";
import { AREA_IDS, DIRECTION_KEYS, ROUTES, applyAxis, defaultScenario, describeDifferences, parseAxis, validateScenario } from "../src/model/schema.js";

const PINS = JSON.parse(readFileSync(new URL("./ops-cases.pins.json", import.meta.url), "utf8"));
const OPS = PRESETS.filter((p) => p.kind === "ops");
const DASHES = /[\u2013\u2014]/;
const BANNED = /\b(predict\w*|forecast\w*|live|real-time|realtime|real time|monitoring)\b|expected traffic/i;
const H6 = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
// H-9: casebook copy never names a verdict, says which arm reads lower, presupposes a harm, or cites another case's
// result as a fact; the design document carries the measured lessons.
const VERDICT_CLAIMS = /\b(improved|regressed|unchanged|inconclusive|advance_to_next_test|run_more_experiments|no_recommendation|hold)\b|\breads? (lower|higher|no change)\b|\bguardrails? (within|regress)|\bas OPS-\d\d shows\b|\bis expected to\b|\bthe harm\b/i;
const cache = new Map();

/** The frozen label and the run_experiment verdict of a casebook preset's spec, computed once per process. */
function run(id, seedSetNumber = 1) {
  const key = `${id}:${String(seedSetNumber)}`;
  if (!cache.has(key)) {
    const draft = structuredClone(presetById(id).experiment);
    if (seedSetNumber !== 1) Object.assign(draft, { seed_set: seedSetNumber, seeds: seedSet(seedSetNumber, PRESET_REPLICATIONS) });
    const frozen = freezeSpec(draft);
    cache.set(key, { label: frozen.label, verdict: runExperimentSpec(frozen.spec).verdict });
  }
  return cache.get(key);
}

/** The calibration's rounding of a value for the design tables: 0.1 s for a metric in seconds, 1e-6 otherwise. */
function rounded(metric, value) {
  if (value === null) return null;
  return /_s(\{|$)/.test(metric) ? Math.round(value * 10) / 10 : Math.round(value * 1e6) / 1e6;
}

/** Asserts a run's verdict against one pinned block, exactly: the label, the words and every double. */
function assertPinned(id, k, { label, verdict: v }, pinned) {
  const at = `${id} set ${String(k)}`;
  assert.equal(label, pinned.label, `${at}: spec digest`);
  assert.deepEqual([v.validity, v.outcome, v.recommendation], ["VALID", pinned.outcome, pinned.recommendation], at);
  assert.equal(v.primary.metric, pinned.primary, at);
  assert.ok(v.primary.mean_delta === pinned.mean_delta_exact, `${at}: mean delta ${String(v.primary.mean_delta)} against ${String(pinned.mean_delta_exact)}`);
  assert.ok(v.primary.ci_low === pinned.ci_exact[0] && v.primary.ci_high === pinned.ci_exact[1], `${at}: interval [${String(v.primary.ci_low)}, ${String(v.primary.ci_high)}] against ${JSON.stringify(pinned.ci_exact)}`);
  assert.deepEqual(v.guardrail_statuses.map((g) => [g.metric, g.status]), pinned.guardrails.map((g) => [g.metric, g.status]), at);
  for (const [i, g] of v.guardrail_statuses.entries()) {
    assert.ok(g.harm === pinned.guardrails[i].harm_exact, `${at}: ${g.metric} harm ${String(g.harm)} against ${String(pinned.guardrails[i].harm_exact)}`);
  }
}

/** The knob names describeDifferences uses for one axis id: `SUP-1.EB`, `DEP-4`, `POL-2`, or every RD-3 row of a class. */
function knobNamesOf(axisId) {
  const axis = parseAxis(axisId);
  if (axisId.startsWith("policy:")) return [axis.knob];
  if (axis.part === null) return [axis.knob];
  if (axis.knob === "RD-3") {
    const [cls] = axis.part.split(".");
    return cls === "in_area" ? ["RD-3.in_area"] : DIRECTION_KEYS.map((k) => `RD-3.${cls}.${k}`);
  }
  return [`${axis.knob}.${axis.part}`];
}

describe("the casebook records", () => {
  test("twenty records, OPS-01 to OPS-20 in theme order, unique frozen slugs, unique titles", () => {
    assert.equal(OPS_CASES.length, 20);
    assert.deepEqual(OPS_CASES.map((c) => c.id), Array.from({ length: 20 }, (_, i) => `OPS-${String(i + 1).padStart(2, "0")}`));
    assert.deepEqual(OPS_THEME_IDS, ["sf", "new_area", "rain", "crowds", "police"]);
    const themes = OPS_CASES.map((c) => c.theme);
    assert.deepEqual([...new Set(themes)], OPS_THEME_IDS, "themes appear in order");
    themes.forEach((t, i) => { if (i > 0) assert.ok(OPS_THEME_IDS.indexOf(t) >= OPS_THEME_IDS.indexOf(themes[i - 1]), "grouped by theme"); });
    for (const theme of OPS_THEME_IDS) assert.equal(opsPresetsOf(theme).length, 4, theme);
    const slugs = OPS_CASES.map((c) => c.slug);
    assert.equal(new Set(slugs).size, 20);
    for (const c of OPS_CASES) {
      assert.match(c.slug, /^ops\d\d_[a-z0-9_]{1,55}$/, c.id);
      assert.equal(c.slug.slice(3, 5), c.id.slice(4), `${c.id} slug carries its number`);
      assert.equal(c.slug, PINS.cases[c.id].slug, `${c.id} slug is the pinned one`);
    }
    assert.equal(new Set(OPS_CASES.map((c) => c.title)).size, 20);
    assert.ok(Object.isFrozen(OPS_CASES) && OPS_CASES.every((c) => Object.isFrozen(c) && Object.isFrozen(c.proxy)));
  });

  test("every record carries the copy the setup sheet shows, within the design's copy rules and never a direction", () => {
    for (const c of OPS_CASES) {
      assert.ok(c.title.length > 0 && c.title.length <= 60, `${c.id} title length`);
      assert.ok(c.situation.length >= 80 && c.situation.length <= 600, `${c.id} situation length`);
      assert.ok(c.experiment.question.endsWith("?") && c.experiment.question.length <= 300, `${c.id} question`);
      assert.ok(c.proxy.length >= 1 && c.proxy.length <= 4, `${c.id} proxy count`);
      for (const p of c.proxy) assert.deepEqual(Object.keys(p).sort(), ["misses", "setAs", "standsFor"], c.id);
      assert.ok(c.watch.length > 0 && c.outsideModel.length >= 1, c.id);
      const copy = [c.title, c.situation, c.experiment.question, c.watch, ...c.outsideModel, ...c.proxy.flatMap((p) => [p.standsFor, p.setAs, p.misses])];
      for (const text of copy) {
        assert.doesNotMatch(text, DASHES, `${c.id}: ${text}`);
        assert.doesNotMatch(text, BANNED, `${c.id}: ${text}`);
        assert.doesNotMatch(text, H6, `${c.id}: ${text}`);
        assert.doesNotMatch(text, VERDICT_CLAIMS, `${c.id}: ${text}`);
        assert.ok(!/\s$|^\s/.test(text), `${c.id}: untrimmed text`);
      }
    }
  });

  test("the module holds no em or en dash, and no record carries a lesson, a mechanism or private notes", () => {
    const source = readFileSync(new URL("../src/model/ops-cases.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, DASHES);
    for (const c of OPS_CASES) {
      assert.deepEqual(Object.keys(c).sort(), ["base", "experiment", "id", "outsideModel", "proxy", "situation", "slug", "theme", "title", "watch"], c.id);
      assert.deepEqual(Object.keys(c.experiment).sort(), ["axis", "guardrails", "primary", "question"], c.id);
    }
  });
});

describe("the casebook presets", () => {
  test("each preset is an Experiment preset of kind ops with its record's copy, scenario name and declared changes", () => {
    assert.equal(OPS.length, 20);
    for (const c of OPS_CASES) {
      const p = presetById(c.id);
      assert.equal(p.kind, "ops");
      assert.deepEqual([p.theme, p.title, p.situation, p.watch], [c.theme, c.title, c.situation, c.watch]);
      assert.deepEqual(p.proxy, c.proxy);
      assert.deepEqual(p.outsideModel, c.outsideModel);
      assert.deepEqual(p.moments, []);
      assert.equal(p.learnCase, null);
      assert.equal(p.scenario.name, c.slug, `${c.id}: the scenario name is the slug`);
      assert.deepEqual(validateScenario(p.scenario), { ok: true, errors: [], warnings: [] }, c.id);
      assert.deepEqual(p.scenario, p.experiment.scenario, `${c.id}: the preset scenario is the declared baseline`);
      assert.equal(p.experiment.scenario.sigma_permille, 150);
      assert.deepEqual(Object.keys(p.experiment).sort(), ["axis", "guardrails", "primary", "question", "resamples", "scenario", "seed_set", "seeds"]);
      assert.equal(p.experiment.seed_set, 1);
      assert.deepEqual(p.experiment.seeds, seedSet(1, PRESET_REPLICATIONS));
      assert.equal(p.experiment.resamples, 2000);
      assert.deepEqual(applyAxis(p.experiment.scenario, p.experiment.axis.id, p.experiment.axis.baseline), p.experiment.scenario, c.id);
      assert.doesNotThrow(() => applyAxis(p.experiment.scenario, p.experiment.axis.id, p.experiment.axis.candidate), c.id);
      assert.notDeepEqual(p.experiment.axis.baseline, p.experiment.axis.candidate, `${c.id}: the two arms differ`);

      // The declared base is the only difference from the Bay teaching map: its changes, its congestion scalings (every
      // row of each class), travel variation, and the axis at its baseline value.
      const expected = new Set(["RD-5", ...knobNamesOf(c.experiment.axis.id)]);
      for (const [axisId] of c.base.changes) for (const name of knobNamesOf(axisId)) expected.add(name);
      for (const scaling of c.base.congestion) {
        for (const cls of scaling.classes) {
          if (cls === "IN_AREA") expected.add("RD-3.in_area");
          else for (const k of DIRECTION_KEYS) expected.add(`RD-3.${cls.toLowerCase()}.${k}`);
        }
      }
      const changed = describeDifferences(defaultScenario(), p.experiment.scenario).map((d) => d.knob);
      for (const name of changed) assert.ok(expected.has(name), `${c.id}: ${name} changed but not declared`);
      // A base may restate a default so the record reads whole (as L3 does); every change must at least apply.
      for (const [axisId, value] of c.base.changes) assert.doesNotThrow(() => applyAxis(defaultScenario(), axisId, value), `${c.id}: ${axisId}`);
    }
    assert.ok(AREA_IDS.length === 4 && ROUTES.length === 12);
  });

  test("every preset's spec is the preregistered one, verbatim", () => {
    for (const c of OPS_CASES) {
      const pinned = PINS.cases[c.id].experiment;
      const { question, axis, primary, guardrails } = presetById(c.id).experiment;
      assert.deepEqual({ question, axis, primary, guardrails }, pinned, c.id);
      for (const ref of [primary, ...guardrails]) {
        for (const key of Object.keys(ref.scope)) assert.ok(["area", "depot", "window"].includes(key), c.id);
        if (ref.scope.window) {
          const s = presetById(c.id).experiment.scenario;
          assert.ok(ref.scope.window.start_s >= s.warmup_end_s && ref.scope.window.end_s <= s.window.end_s && ref.scope.window.start_s < ref.scope.window.end_s, `${c.id} window`);
        }
      }
      assert.ok(Number.isSafeInteger(primary.margin_units) && primary.margin_units > 0, c.id);
      for (const g of guardrails) assert.ok(Number.isSafeInteger(g.max_harm_units) && g.max_harm_units >= 0, c.id);
    }
  });
});

describe("every casebook verdict on seed set 1 is pinned to its calibration run", () => {
  for (const c of OPS_CASES) {
    test(`${c.id} reads ${PINS.cases[c.id].measured.set1.outcome} ${PINS.cases[c.id].measured.set1.recommendation}`, () => {
      assertPinned(c.id, 1, run(c.id), PINS.cases[c.id].measured.set1);
    });
  }

  test("the pins cover the twenty presets and all three seed sets agree on outcome and recommendation", () => {
    assert.deepEqual(Object.keys(PINS.cases).sort(), OPS_CASES.map((c) => c.id).sort());
    for (const c of OPS_CASES) {
      const m = PINS.cases[c.id].measured;
      for (const k of ["set2", "set3"]) {
        assert.deepEqual([m[k].outcome, m[k].recommendation], [m.set1.outcome, m.set1.recommendation], `${c.id} ${k}`);
      }
    }
  });

  test("each pin holds the spec, the three measured blocks and the lesson, nothing else, and every rounded number is the rounding of its exact double", () => {
    for (const c of OPS_CASES) {
      const pinned = PINS.cases[c.id];
      assert.deepEqual(Object.keys(pinned).sort(), ["experiment", "lesson", "measured", "slug", "theme"], c.id);
      assert.ok(typeof pinned.lesson === "string" && pinned.lesson.length > 0, c.id);
      assert.deepEqual(Object.keys(pinned.measured), ["set1", "set2", "set3"], c.id);
      for (const [k, m] of Object.entries(pinned.measured)) {
        const at = `${c.id} ${k}`;
        assert.match(m.label, /^playground-spec:[0-9a-f]{8}$/, at);
        assert.ok(Number.isFinite(m.mean_delta_exact) && m.ci_exact.length === 2 && m.ci_exact.every(Number.isFinite), at);
        assert.ok(m.mean_delta === rounded(m.primary, m.mean_delta_exact), `${at}: mean delta ${String(m.mean_delta)} is not ${String(m.mean_delta_exact)} rounded`);
        assert.ok(m.ci[0] === rounded(m.primary, m.ci_exact[0]) && m.ci[1] === rounded(m.primary, m.ci_exact[1]), `${at}: interval`);
        for (const g of m.guardrails) {
          assert.ok("harm_exact" in g && (g.harm_exact === null || Number.isFinite(g.harm_exact)), `${at}: ${g.metric}`);
          assert.ok(g.harm === rounded(g.metric, g.harm_exact), `${at}: ${g.metric} harm ${String(g.harm)} is not ${String(g.harm_exact)} rounded`);
        }
      }
    }
  });

  test("seed sets 2 and 3 reproduce their pins (FLEET_PLAYGROUND_PERF=1)", { skip: process.env.FLEET_PLAYGROUND_PERF !== "1" && "set FLEET_PLAYGROUND_PERF=1" }, () => {
    for (const c of OPS_CASES) {
      for (const k of [2, 3]) assertPinned(c.id, k, run(c.id, k), PINS.cases[c.id].measured[`set${String(k)}`]);
    }
  });
});
