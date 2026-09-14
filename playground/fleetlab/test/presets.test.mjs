// Teaching presets (src/model/presets.js, design §4): each preset's run shows the mechanism its lesson names. These tests
// run the frozen preset spec on its 20 seeds of seed set 1 at σ 0.15, exactly as Experiment mode does, and assert the
// part of the result the lesson depends on (review: teaching-value lens). They assert run results, never interface
// captions; a caption still states a direction only when test/captions.test.mjs asserts it (design H-9).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createRun, runToEnd } from "../src/model/engine.js";
import { armScenarios, experimentEnvelope, freezeSpec, runExperimentSpec, seedWorld } from "../src/model/experiment.js";
import { computeMetric } from "../src/model/metrics.js";
import { PRESETS, PRESET_REPLICATIONS, presetById, seedSet } from "../src/model/presets.js";
import { applyAxis, defaultScenario } from "../src/model/schema.js";
import { buildWorld } from "../src/model/world.js";

const cache = new Map();

/** The run_experiment output of a preset's own frozen spec, computed once per process. */
function presetRun(presetId) {
  if (!cache.has(presetId)) cache.set(presetId, runExperimentSpec(freezeSpec(structuredClone(presetById(presetId).experiment)).spec));
  return cache.get(presetId);
}

const statusOf = (verdict, metric, scope = {}) => {
  const key = Object.keys(scope).length === 0 ? metric : `${metric}{${Object.entries(scope).map(([k, v]) => `${k}=${String(v)}`).join(",")}}`;
  const found = verdict.guardrail_statuses.find((g) => g.metric === key);
  assert.ok(found, `a guardrail row for ${key}`);
  return found;
};

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("L2 (UC-09): the bay cut reaches the primary window", () => {
  test("SJ-1 is visited inside the 16:00 to 19:00 window in both arms, and one bay lengthens the bay wait there", () => {
    // Runs the first three preset seeds directly, both arms on the spec's shared world, to read SJ-1's visits and its
    // bay wait p90 for arrivals inside the primary window. Review run on 20 seeds: 6.9 and 6.6 visits; 22.2 s and
    // 2,572.3 s.
    const { spec } = freezeSpec(structuredClone(presetById("L2a").experiment));
    const { baseline, candidate } = armScenarios(spec);
    const envelope = experimentEnvelope(spec);
    const window = spec.primary.scope.window;
    const visits = { baseline: [], candidate: [] };
    const bayWait = { baseline: [], candidate: [] };
    for (const seed of spec.seeds.slice(0, 3)) {
      const world = seedWorld(spec, seed, envelope);
      for (const [arm, scenario] of [["baseline", baseline], ["candidate", candidate]]) {
        const result = createRun(scenario, world, { seed, keepLogs: false }).runToEnd();
        visits[arm].push(result.visits.filter((v) => v.depot === "SJ-1" && v.arrival_s >= window.start_s && v.arrival_s < window.end_s).length);
        const m = computeMetric(result, { metric: "depot.bay_wait_p90_s", scope: { depot: "SJ-1", window } });
        assert.ok("value" in m, `seed ${String(seed)} ${arm}: SJ-1 has bay waits in the window`);
        bayWait[arm].push(m.value);
      }
    }
    for (const arm of ["baseline", "candidate"]) assert.ok(visits[arm].every((n) => n >= 1), `${arm}: ${visits[arm].join(",")} SJ-1 visits in the window`);
    assert.ok(mean(bayWait.candidate) > mean(bayWait.baseline) + 600, `1 bay ${String(mean(bayWait.candidate))} s against 3 bays ${String(mean(bayWait.baseline))} s`);
  });

  test("L2a's arms differ inside the primary window, and L2b's added bay wait guardrail regresses to HOLD", () => {
    // Before DEP-7 was set to 5, every one of the 20 paired deltas was exactly 0 and the interval was [0, 0].
    const a = presetRun("L2a").verdict;
    assert.equal(a.validity, "VALID");
    assert.ok(a.primary.paired_deltas.filter((d) => d !== 0).length >= 10, `${String(a.primary.paired_deltas.filter((d) => d !== 0).length)} of 20 paired deltas differ from 0`);
    assert.ok(a.primary.ci_high > a.primary.ci_low, "the interval has width");
    const b = presetRun("L2b").verdict;
    assert.equal(statusOf(b, "depot.bay_wait_p90_s", { depot: "SJ-1" }).status, "REGRESSED");
    assert.equal(b.recommendation, "HOLD");
  });
});

describe("UC-02: extra San Jose cars in the morning peak", () => {
  test("24 cars read IMPROVED against 16 in SJ wait p90 from 07:00 to 09:00, with both guardrails within", () => {
    // Review run: -743.0 s, interval [-897.3, -606.0]; seed sets 2 and 3 read -783.8 s and -798.8 s.
    const v = presetRun("UC-02").verdict;
    assert.equal(v.outcome, "IMPROVED");
    assert.equal(v.recommendation, "ADVANCE_TO_NEXT_TEST");
    const margin = presetById("UC-02").experiment.primary.margin_units; // 60 s
    assert.ok(v.primary.ci_high < -margin, `interval high ${String(v.primary.ci_high)} s is below minus the ${String(margin)} s margin`);
    for (const g of v.guardrail_statuses) assert.equal(g.status, "WITHIN", g.metric);
  });
});

describe("UC-03: the population trap is caught by its guardrail", () => {
  test("5 minute patience reads IMPROVED on wait p90, fewer rides are counted, unserved regresses, HOLD", () => {
    // Review run: primary -572.8 s; unserved harm 0.0179 against 0.01; wait.population_n 1,785.5 to 1,752.6.
    const out = presetRun("UC-03");
    const v = out.verdict;
    assert.equal(v.outcome, "IMPROVED");
    const unserved = statusOf(v, "unserved.fraction");
    assert.equal(unserved.status, "REGRESSED");
    assert.ok(unserved.harm > unserved.max_harm * 1.5, `harm ${String(unserved.harm)} is well above ${String(unserved.max_harm)}`);
    assert.equal(v.recommendation, "HOLD");
    const population = (arm) => mean(out.per_seed.map((p) => p[`${arm}_metrics`]["wait.population_n"].value));
    assert.ok(population("candidate") < population("baseline"), "impatient riders leave the population the wait percentile counts");
  });
});

describe("UC-10: SJ-1's overnight bay saturation in layout A is on the card", () => {
  test("the SJ-1 bay wait guardrail row reads WITHIN with layout B's bay wait at least an hour shorter", () => {
    // Review run: whole-run SJ-1 bay wait p90 25,697.7 s in layout A and 7,804.1 s in layout B, harm -17,893.6 s.
    const v = presetRun("UC-10").verdict;
    const row = statusOf(v, "depot.bay_wait_p90_s", { depot: "SJ-1" });
    assert.equal(row.status, "WITHIN");
    assert.ok(row.harm < -3600, `harm ${String(row.harm)} s`);
  });
});

describe("every preset's verdict on seed set 1 is pinned", () => {
  // Review: the recall that acts once and the 120-car default changed three verdicts with no test noticing (L3
  // INCONCLUSIVE to IMPROVED, UC-10 INCONCLUSIVE to IMPROVED, UC-08a INCONCLUSIVE to UNCHANGED). Each row below is the
  // calibration run of the current presets (20 seeds of seed set 1, σ 0.15, 2,000 resamples); a later recalibration
  // must re-derive a row here, and the design's use case text with it, before it can change.
  const PINNED = {
    L1: ["REGRESSED", "HOLD"], // +3,479.2 s, [3,380.3, 3,587.0]; unserved REGRESSED
    L2a: ["INCONCLUSIVE", "RUN_MORE_EXPERIMENTS"], // +25.3 s, [-135.3, 209.2]
    L2b: ["INCONCLUSIVE", "HOLD"], // the same arms; SJ-1 bay wait guardrail REGRESSED
    L3: ["IMPROVED", "ADVANCE_TO_NEXT_TEST"], // -646.5 s, [-949.7, -341.8]; every guardrail WITHIN
    "UC-01": ["UNCHANGED", "NO_RECOMMENDATION"], // 0 s, [0, 0]
    "UC-02": ["IMPROVED", "ADVANCE_TO_NEXT_TEST"], // -743.1 s, [-901.4, -593.1]
    "UC-03": ["IMPROVED", "HOLD"], // -572.8 s, [-656.8, -490.5]; unserved REGRESSED
    "UC-05": ["REGRESSED", "HOLD"], // +4,947.5 s, [4,802.5, 5,099.3]
    "UC-08a": ["UNCHANGED", "NO_RECOMMENDATION"], // -3.4 s, [-10.2, 0.4] inside the 30 s margin
    "UC-08b": ["INCONCLUSIVE", "RUN_MORE_EXPERIMENTS"], // -32.2 s, [-69.8, 0.7]
    "UC-10": ["IMPROVED", "ADVANCE_TO_NEXT_TEST"], // -193.0 s, [-237.6, -143.2]
  };

  test("the pinned table covers every preset with an experiment", () => {
    assert.deepEqual(PRESETS.filter((p) => p.experiment !== null).map((p) => p.id).sort(), Object.keys(PINNED).sort());
  });

  for (const [id, [outcome, recommendation]] of Object.entries(PINNED)) {
    test(`${id} reads VALID ${outcome} ${recommendation}`, () => {
      const v = presetRun(id).verdict;
      assert.deepEqual([v.validity, v.outcome, v.recommendation], ["VALID", outcome, recommendation]);
    });
  }
});

describe("L3 (UC-07) at the 120-car default: nearest_depot lowers the SF morning wait on three seed sets", () => {
  test("seed sets 1 to 3 read IMPROVED with the interval below minus the margin and every guardrail WITHIN", () => {
    // The design's UC-07 reasoning expects HOLD (SJ-1's lot fills, the SF morning wait ends higher). At the 120-car default
    // it does not: under home_depot, SF cars recalled overnight queue at SF-2's 2 cleaning bays, and nearest_depot spreads
    // them. Calibration runs of the frozen L3 spec: set 1 -646.5 s [-949.7, -341.8]; set 2 -534.6 s [-782.0, -288.2];
    // set 3 -461.6 s [-764.1, -172.6]. Preset-only retunes tried at 120 cars (SJ-1 parking 5, 8, 12 or 16; SJ-1 cleaning
    // bays 1 or 2; DEP-7 6 with or without SJ-1 parking 8) all kept the primary IMPROVED on set 1; the 90-car fleet read
    // REGRESSED HOLD on sets 1 and 2 but INCONCLUSIVE on set 3. So the preset stays, and this test holds the direction
    // until the design text is re-derived.
    const base = presetById("L3").experiment;
    for (const k of [1, 2, 3]) {
      const draft = { ...structuredClone(base), seed_set: k, seeds: seedSet(k, PRESET_REPLICATIONS) };
      const v = k === 1 ? presetRun("L3").verdict : runExperimentSpec(freezeSpec(draft).spec).verdict;
      assert.equal(v.outcome, "IMPROVED", `seed set ${String(k)}`);
      assert.ok(v.primary.ci_high < -base.primary.margin_units, `seed set ${String(k)}: interval high ${String(v.primary.ci_high)} s`);
      for (const g of v.guardrail_statuses) assert.equal(g.status, "WITHIN", `seed set ${String(k)}: ${g.metric}`);
    }
  });
});

describe("the Bay teaching map's calibration envelope (src/model/schema.js, SUP-1)", () => {
  // The targets of the recalibration sweep, measured on seeds 1001 to 1005 at σ 0 over the warm-up end to the window end.
  // The busiest peak hour is the peak hour with the most requests; the longest bay wait is first task start minus intake
  // end over visits that started a task. Sweep rows (all five seeds read alike at σ 0): 105 cars 3.12% unserved, busiest
  // hour p90 2,400 s, worst hour 24.2%, day 2 morning 5.1%; 120 cars 0.50%, 1,134 s, 8.2%, 0%, gap 7, bay wait 15,022 s.
  const H = 3600;
  const PEAK_HOURS = [7, 8, 16, 17, 18, 31, 32];
  function measure(scenario, seed) {
    const r = runToEnd(scenario, buildWorld(scenario, { seed }), { seed, keepLogs: false });
    const value = (metric, scope = {}) => computeMetric(r, { metric, scope }).value;
    const lo = scenario.warmup_end_s;
    const hi = scenario.window.end_s;
    const requests = r.requests.filter((q) => q.time_s >= lo && q.time_s < hi);
    const hours = new Map();
    for (const q of requests) {
      const h = Math.floor(q.time_s / H);
      const b = hours.get(h) ?? { n: 0, unserved: 0 };
      b.n += 1;
      if (q.state === "UNSERVED") b.unserved += 1;
      hours.set(h, b);
    }
    const busiest = PEAK_HOURS.filter((h) => hours.has(h)).reduce((best, h) => (best === null || hours.get(h).n > hours.get(best).n ? h : best), null);
    const morning = requests.filter((q) => q.time_s >= 111600 && q.time_s < hi);
    const bayWaits = r.visits.filter((x) => x.arrival_s >= lo && x.arrival_s < hi && x.first_task_s !== null).map((x) => x.first_task_s - x.intake_end_s);
    return {
      unserved: value("unserved.fraction"),
      peakP90: value("wait.p90_s", { window: { start_s: busiest * H, end_s: (busiest + 1) * H } }),
      worstHour: Math.max(...[...hours.values()].map((b) => b.unserved / b.n)),
      morningUnserved: morning.filter((q) => q.state === "UNSERVED").length / morning.length,
      gap: value("fleet.placement_gap"),
      longestBayWait: Math.max(...bayWaits),
      violations: r.invariant_violations.length,
    };
  }
  const SEEDS = [1001, 1002, 1003, 1004, 1005];

  test("120 cars meet the peak hour, worst hour, day 2 morning and placement gap targets, with no invariant violation", () => {
    for (const seed of SEEDS) {
      const m = measure(defaultScenario(), seed);
      assert.ok(m.peakP90 >= 600 && m.peakP90 <= 1500, `seed ${String(seed)}: busiest peak hour wait p90 ${String(m.peakP90)} s`);
      assert.ok(m.worstHour <= 0.2, `seed ${String(seed)}: worst hour unserved ${String(m.worstHour)}`);
      assert.ok(m.morningUnserved < 0.1, `seed ${String(seed)}: day 2 07:00 to 10:00 unserved ${String(m.morningUnserved)}`);
      assert.ok(m.gap > 0, `seed ${String(seed)}: placement gap ${String(m.gap)}`);
      assert.equal(m.violations, 0);
    }
  });

  test("the two accepted exceptions hold as recorded: unserved below the 1% floor, the longest bay wait above 90 minutes", () => {
    // Pinned to their calibration values so a change that closes or widens either exception fails here first:
    // 9 unserved of 1,795 requests after the warm-up is 0.005013..., and the longest bay wait is 15,022 s (250.4 min) at SF-2.
    for (const seed of SEEDS) {
      const m = measure(defaultScenario(), seed);
      assert.ok(Math.abs(m.unserved - 0.005013927576601671) < 1e-12, `seed ${String(seed)}: unserved ${String(m.unserved)}`);
      assert.equal(m.longestBayWait, 15022, `seed ${String(seed)}`);
    }
  });

  test("120 is the smallest swept total that meets the peak hour target: 105 cars at 5:3:4:3 miss it", () => {
    let s = defaultScenario();
    for (const [area, n] of [["SF", 35], ["PEN", 21], ["SJ", 28], ["EB", 21]]) s = applyAxis(s, `parameter:SUP-1.${area}`, n);
    const m = measure(s, 1001);
    assert.equal(m.peakP90, 2400);
    assert.ok(m.peakP90 > 1500 && m.worstHour > 0.2, `105 cars: ${String(m.peakP90)} s, worst hour ${String(m.worstHour)}`);
  });
});
