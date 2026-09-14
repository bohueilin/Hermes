// Presets of the teaching model: the Bay teaching map, the Learn cases and the Experiment presets
// (design sections 3.5, 4 and 4.1; contract section 6.2). Every threshold is an integer in the metric's engine unit:
// seconds for `_s` metrics, parts per million for fractions.

import { applyAxis, cloneScenario, deepFreeze, defaultScenario } from "./schema.js";

export const DEFAULT_PRESET_ID = "bay_teaching_map";
export const EXPERIMENT_SIGMA_PERMILLE = 150;
export const PRESET_SEED_SET = 1;
export const PRESET_REPLICATIONS = 20;
export const PRESET_RESAMPLES = 2000;

/** Seeds of seed set `k` for `n` replications: `1000 × k + 1` to `1000 × k + n` (design 2.8). */
export function seedSet(k, n) {
  return Array.from({ length: n }, (_, i) => 1000 * k + 1 + i);
}

const day1 = (h, m = 0) => h * 3600 + m * 60;
const day2 = (h, m = 0) => 86400 + day1(h, m);
const span = (start_s, end_s) => ({ start_s, end_s });

/** The Bay teaching map renamed, with axis-grammar changes applied in order. */
function scenarioFrom(name, changes = []) {
  let s = defaultScenario();
  s.name = name;
  for (const [axisId, value] of changes) s = applyAxis(s, axisId, value);
  return s;
}

/**
 * An experiment draft (contract 6.6 without its format fields). The declared scenario is `base` at the Experiment
 * travel variation with the axis set to its baseline value, so the setup reads "baseline = preset".
 */
function draft(base, { question, axis, primary, guardrails }) {
  const withSigma = cloneScenario(base);
  withSigma.sigma_permille = EXPERIMENT_SIGMA_PERMILLE;
  return {
    question,
    scenario: applyAxis(withSigma, axis.id, axis.baseline),
    axis,
    primary,
    guardrails,
    seed_set: PRESET_SEED_SET,
    seeds: seedSet(PRESET_SEED_SET, PRESET_REPLICATIONS),
    resamples: PRESET_RESAMPLES,
  };
}

const waitP90 = (margin_units, scope = {}) => ({ metric: "wait.p90_s", scope, direction: "lower_is_better", margin_units });
const guardrail = (metric, max_harm_units, scope = {}, direction = "lower_is_better") => ({ metric, scope, direction, max_harm_units });
const moments = (learnCase, clocks) =>
  clocks.map((clock_s, i) => ({ id: `m${i + 1}`, clock_s, captionKey: `learn.${learnCase}.m${i + 1}` }));

function learnPreset({ id, learnCase, useCase, title, scenario, experiment, clocks }) {
  return { id, kind: "learn", learnCase, useCase, title, scenario, experiment: draft(scenario, experiment), moments: moments(learnCase, clocks) };
}

function experimentPreset({ id, useCase, title, base, experiment }) {
  const built = draft(base, experiment);
  return { id, kind: "experiment", learnCase: null, useCase, title, scenario: cloneScenario(built.scenario), experiment: built, moments: [] };
}

// UC-09: both preregistered L2 specs share this scenario and differ by one added guardrail.
const L2_SCENARIO = scenarioFrom("l2_bays_not_bottleneck", [["parameter:SUP-1.SJ", 12]]);
const L2_EXPERIMENT = {
  question: "With 12 cars in San Jose, does cutting SJ-1 from 3 cleaning bays to 1 change San Jose rider wait p90 in the day 1 evening peak?",
  axis: { id: "parameter:DEP-3.SJ-1", baseline: 3, candidate: 1 },
  primary: waitP90(60, { area: "SJ", window: span(day1(16), day1(19)) }),
  guardrails: [guardrail("unserved.fraction", 20000)],
};
const L2_CLOCKS = [day1(16), day1(18), day1(19)];

/** Every preset in display order; frozen, so callers clone a scenario before editing it. */
export const PRESETS = deepFreeze([
  {
    id: DEFAULT_PRESET_ID,
    kind: "default",
    learnCase: null,
    useCase: null,
    title: "Bay teaching map",
    scenario: defaultScenario(),
    experiment: null,
    moments: [],
  },
  learnPreset({
    id: "L1",
    learnCase: "L1",
    useCase: "UC-04",
    title: "Peak and off-peak with the same fleet",
    scenario: scenarioFrom("l1_peak_and_offpeak"),
    experiment: {
      question: "With the same total requests, does peaked demand instead of flat demand change rider wait p90 in the day 1 evening peak?",
      axis: { id: "parameter:DEM-5", baseline: "flat", candidate: "peaked" },
      primary: waitP90(60, { window: span(day1(16), day1(19)) }),
      guardrails: [guardrail("unserved.fraction", 20000)],
    },
    clocks: [day1(7), day1(16), day1(17, 30), day1(19, 30)],
  }),
  learnPreset({
    id: "L2a",
    learnCase: "L2",
    useCase: "UC-09",
    title: "Bays are not always the bottleneck",
    scenario: L2_SCENARIO,
    experiment: L2_EXPERIMENT,
    clocks: L2_CLOCKS,
  }),
  learnPreset({
    id: "L2b",
    learnCase: "L2",
    useCase: "UC-09",
    title: "Bays are not always the bottleneck, with a bay wait guardrail",
    scenario: cloneScenario(L2_SCENARIO),
    experiment: {
      ...L2_EXPERIMENT,
      guardrails: [...L2_EXPERIMENT.guardrails, guardrail("depot.bay_wait_p90_s", 600, { depot: "SJ-1" })],
    },
    clocks: L2_CLOCKS,
  }),
  learnPreset({
    id: "L3",
    learnCase: "L3",
    useCase: "UC-07",
    title: "Evening depot visit in San Jose",
    // Design 3.5: highways ×1.6 both directions 16:00 to 19:00 and ×1.3 19:00 to 20:00; local and in-area ×1.3
    // 16:00 to 19:00; the last three are already the defaults and are set again so the preset states them.
    scenario: scenarioFrom("l3_evening_depot_visit_sj", [
      ["parameter:RD-3.highway.evening", 1600],
      ["parameter:RD-3.highway.late", 1300],
      ["parameter:RD-3.local.evening", 1300],
      ["parameter:RD-3.in_area.evening", 1300],
    ]),
    experiment: {
      question: "Does sending cars to the nearest depot instead of their home depot change San Francisco rider wait p90 on day 2 from 07:00 to 09:00?",
      axis: { id: "policy:depot_assignment", baseline: "home_depot", candidate: "nearest_depot" },
      primary: waitP90(60, { area: "SF", window: span(day2(7), day2(9)) }),
      guardrails: [
        guardrail("exposure.congested_empty_s", 0),
        guardrail("depot.parking_peak_fraction", 100000, { depot: "SJ-1" }),
        guardrail("unserved.fraction", 10000),
      ],
    },
    clocks: [day1(18, 30), day1(19, 30), day2(5, 45), day2(7, 15)],
  }),
  experimentPreset({
    id: "UC-01",
    useCase: "UC-01",
    title: "Null check",
    base: scenarioFrom("uc01_null_check"),
    experiment: {
      question: "With trips between depot visits set to 10 in both arms, does the verdict read no change?",
      axis: { id: "parameter:DEP-7", baseline: 10, candidate: 10 },
      primary: waitP90(30),
      guardrails: [guardrail("unserved.fraction", 20000)],
    },
  }),
  experimentPreset({
    id: "UC-02",
    useCase: "UC-02",
    title: "How many cars does San Jose need?",
    base: scenarioFrom("uc02_san_jose_cars"),
    experiment: {
      question: "Does giving San Jose 24 cars instead of 16 change San Jose rider wait p90 in the day 1 evening peak?",
      axis: { id: "parameter:SUP-1.SJ", baseline: 16, candidate: 24 },
      primary: waitP90(60, { area: "SJ", window: span(day1(16), day1(19)) }),
      guardrails: [guardrail("unserved.fraction", 10000), guardrail("unserved.fraction", 10000, { area: "SF" })],
    },
  }),
  experimentPreset({
    id: "UC-03",
    useCase: "UC-03",
    title: "Rider patience and the population trap",
    base: scenarioFrom("uc03_rider_patience"),
    experiment: {
      question: "Does cutting rider patience from 20 minutes to 10 minutes change rider wait p90?",
      axis: { id: "parameter:RID-1", baseline: 1200, candidate: 600 },
      primary: waitP90(30),
      guardrails: [guardrail("unserved.fraction", 20000)],
    },
  }),
  experimentPreset({
    id: "UC-05",
    useCase: "UC-05",
    title: "End-of-day highway slowdown",
    base: scenarioFrom("uc05_evening_highway_slowdown"),
    experiment: {
      question: "Does a highway slowdown of ×1.6 in both directions from 16:00 to 19:00 change San Jose rider wait p90 from 17:00 to 20:00 on day 1?",
      axis: { id: "parameter:RD-3.highway.evening", baseline: 1000, candidate: 1600 },
      primary: waitP90(60, { area: "SJ", window: span(day1(17), day1(20)) }),
      guardrails: [
        guardrail("unserved.fraction", 10000),
        guardrail("fleet.available_fraction", 20000, {}, "higher_is_better"),
      ],
    },
  }),
  experimentPreset({
    id: "UC-08a",
    useCase: "UC-08",
    title: "Depot throughput: more cleaning bays at SF-1",
    base: scenarioFrom("uc08a_sf1_cleaning_bays"),
    experiment: {
      question: "Does raising SF-1 from 4 cleaning bays to 6 change rider wait p90?",
      axis: { id: "parameter:DEP-3.SF-1", baseline: 4, candidate: 6 },
      primary: waitP90(30),
      guardrails: [guardrail("unserved.fraction", 20000)],
    },
  }),
  experimentPreset({
    id: "UC-08b",
    useCase: "UC-08",
    title: "Depot throughput: a shorter clean",
    base: scenarioFrom("uc08b_clean_time"),
    experiment: {
      question: "Does a 15 minute clean instead of a 20 minute clean change rider wait p90?",
      axis: { id: "parameter:DEP-4", baseline: 1200, candidate: 900 },
      primary: waitP90(30),
      guardrails: [guardrail("unserved.fraction", 20000)],
    },
  }),
  experimentPreset({
    id: "UC-10",
    useCase: "UC-10",
    title: "Pool the bays or spread them?",
    base: scenarioFrom("uc10_pool_or_spread_bays", [["policy:depot_assignment", "nearest_depot_with_capacity"]]),
    experiment: {
      question: "With the same total cleaning bays, does moving from 6 at SF-1 and 1 at SJ-1 to 4 and 3 change rider wait p90?",
      axis: {
        id: "parameter:DEP-3",
        baseline: { "SF-1": 6, "SF-2": 2, "SJ-1": 1, "EB-1": 2 },
        candidate: { "SF-1": 4, "SF-2": 2, "SJ-1": 3, "EB-1": 2 },
      },
      primary: waitP90(30),
      guardrails: [
        guardrail("vehicle.empty_drive_fraction", 20000),
        guardrail("depot.parking_peak_fraction", 100000, { depot: "SJ-1" }),
      ],
    },
  }),
]);

/** The frozen preset with this id, or null. */
export function presetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? null;
}
