// Experiment mode of the teaching model (contract 6.6; design 6, P-1 to P-9, "Spec digest and seed sets").
//
// freezeSpec turns a draft into the one frozen spec object, its full digest and its display label. experimentSteps
// runs the frozen spec: one world per seed from the declared scenario with the envelope shared by both arms, the
// replay precheck on the first seed's world, then every seed in spec order with the baseline arm first. It stops at
// the first run with an invariant violation and hands FleetLab's verdict rules the per-seed metric maps.
//
// Decisions this file makes where the design and the contract are silent (reported with the build):
// - A draft may give a threshold as `margin_units` / `max_harm_units` (a safe integer in engine units) or as
//   `margin_text` / `max_harm_text` (decimal text in the metric's shown unit: a fraction for ppm metrics, whole
//   seconds or counts otherwise); the frozen spec keeps only the integer.
// - Equal axis values are allowed only for the labelled null check (design 2.8, UC-01): a draft whose scenario, axis,
//   primary and guardrails canonically equal the UC-01 preset's once checked. Question, seed set, seeds and resamples
//   stay free, so "Use another seed set" and a reworded question keep the exemption; any other change loses it.
// - experimentSteps honours the main-thread slice rule (design 5.9, contract 7) by yielding its current progress
//   marker before and after every unit it cannot slice: the table builds for the spec's sigma (each its own step), each
//   world, createRun, result(), each whole-run check group, each metric computation, and inside the replay digests and
//   the verdict bootstrap. The marker sequence, with repeats removed, and the payload are unchanged.
// - Seeds must be exactly seed set `seed_set`: `1000 × k + 1` to `1000 × k + N`.
// - A draft direction must equal the registry's; a missing one is filled from the registry.
// - `parameter:POL-4` value `off` is stored as null.
// - The shared envelope is the maximum over both arms; a declared scenario asking for more is rejected at freeze.
// - The precheck runs are invariant-checked like every other run, and their two digests must replay (check 12). The
//   candidate arm of the first seed runs twice as well (design 5.4 item 6), right after its paired run, digest only.
// - Descriptive rows are every default metric reference of the declared scenario except the primary, registry order.
// - `per_seed` lists every seed whose two arms both ran, in spec order, also when the verdict is void.
// - experimentSteps takes a second, test-only argument: `defectAt({phase, seed, arm, run})` returns an engine defect
//   name or null, and `compute(result, refs)` replaces computeAll.

import { canonicalJson, specDigest, specHashLabel } from "../core/canon.js";
import { expTable, multiplierTable } from "../core/tables.js";
import { computeVerdictSteps } from "../instrument/paired.js";
import { createRun } from "./engine.js";
import { checkArms, checkReplaySteps, checkWorld, runViolationsSteps } from "./invariants.js";
import { computeAll, defaultRefs, metricKey, metricRow, METRICS_VERSION, validateMetricRef } from "./metrics.js";
import { PRESETS } from "./presets.js";
import { applyAxis, AxisError, cloneScenario, deepFreeze, parseAxis, validateScenario } from "./schema.js";
import { buildWorld, ownLambdaMaxPermille, sharedLambdaMaxPermille } from "./world.js";

/** Format name of a frozen teaching-run spec. */
export const SPEC_FORMAT = "fleetlab-playground-spec";
/** Format version of a frozen teaching-run spec. */
export const SPEC_FORMAT_VERSION = 1;
/** Version of the teaching model the spec was frozen against. */
export const MODEL_VERSION = "playground-model 0.1";
/** Limits of design 2.8: question length (characters), replications and bootstrap resamples. */
export const QUESTION_MAX_CHARS = 300;
export const SEEDS_MIN = 10;
export const SEEDS_MAX = 100;
export const RESAMPLES_MIN = 1000;
export const RESAMPLES_MAX = 100000;
/** The check names of the setup sheet (design 7.2), plus the draft parts they do not cover. */
export const SPEC_CHECKS = Object.freeze([
  "one axis", "margin above 0", "metrics registered", "ranges valid", "scopes valid", "question", "scenario", "seeds", "resamples", "format",
]);

const PPM = 1000000;
const PPM_BIG = 1000000n;
/** Engine events per step between progress yields (a count, not a clock). */
const STEP_EVENTS = 250;
const SPEC_KEYS = ["format", "format_version", "model_version", "metrics_version", "question", "scenario", "axis", "primary", "guardrails", "seed_set", "seeds", "resamples"];
const DRAFT_ONLY_FORMAT_KEYS = ["format", "format_version", "model_version", "metrics_version"];

/** A draft that cannot be frozen; `errors` lists `{check, what, why, fix}` for every problem found. */
export class SpecError extends Error {
  constructor(errors) {
    super(errors.map((e) => `${e.what}: ${e.why}`).join(" | "));
    this.name = "SpecError";
    this.errors = errors;
  }
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const isSafeInt = (v) => Number.isSafeInteger(v) && !Object.is(v, -0);
const shown = (v) => (typeof v === "string" ? JSON.stringify(v) : v === undefined ? "missing" : Array.isArray(v) ? "a list" : isPlainObject(v) ? "an object" : String(v));

/**
 * Parses decimal text such as `0.02` into integer parts per million with integer arithmetic only (no float parse).
 * At most 6 decimal places; signs, exponents and blanks are rejected with a RangeError.
 */
export function parseDecimalPpm(text) {
  if (typeof text !== "string") throw new RangeError(`a fraction is typed as decimal text such as 0.02, not ${shown(text)}`);
  const m = /^([0-9]+)(?:\.([0-9]+))?$/.exec(text);
  if (m === null) throw new RangeError(`${JSON.stringify(text)} is not a decimal number such as 0.02`);
  const decimals = m[2] ?? "";
  if (decimals.length > 6) throw new RangeError(`${JSON.stringify(text)} has ${decimals.length} decimal places; a fraction takes at most 6`);
  const units = BigInt(m[1]) * PPM_BIG + BigInt(decimals.padEnd(6, "0"));
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${JSON.stringify(text)} is too large`);
  return Number(units);
}

/** The double the instrument receives for a threshold of `units` engine units: `units / 1000000` for ppm metrics, else the integer. */
export function thresholdValue(metric, units) {
  const row = metricRow(metric);
  if (row === null) throw new RangeError(`unknown metric: ${metric}`);
  if (!isSafeInt(units)) throw new RangeError(`a threshold is a safe integer in engine units, not ${shown(units)}`);
  return row.engine_unit === "ppm" ? units / PPM : units;
}

/**
 * True when an axis `{id, baseline, candidate}` equals the UC-01 preset's axis. Necessary but not sufficient for the
 * null-check exemption: validateDraft grants it only to a draft for which isNullCheckDraft holds.
 */
export function isNullCheckAxis(axis) {
  const text = canonicalJson(axis);
  return PRESETS.some((p) => p.useCase === "UC-01" && p.experiment !== null && canonicalJson(p.experiment.axis) === text);
}

/** Canonical text of the parts that make a checked draft the null check: scenario, axis, primary and guardrails. */
const nullCheckText = ({ scenario, axis, primary, guardrails }) => canonicalJson({ scenario: cloneScenario(scenario), axis, primary, guardrails });

let uc01NullCheckText;
/** nullCheckText of the UC-01 preset, checked with equal values allowed; null when the registry holds no UC-01 preset. */
function uc01Text() {
  if (uc01NullCheckText === undefined) {
    const preset = PRESETS.find((p) => p.useCase === "UC-01" && p.experiment !== null);
    const checked = preset === undefined ? null : checkDraft(preset.experiment, () => true);
    uc01NullCheckText = checked !== null && checked.ok ? nullCheckText(checked.spec) : null;
  }
  return uc01NullCheckText;
}

const isUc01Parts = (parts) => uc01Text() !== null && nullCheckText(parts) === uc01Text();

/**
 * True when a draft is the labelled null check of UC-01 (design 2.8): it passes every check with equal values allowed,
 * and its scenario, axis, primary and guardrails canonically equal the preset's. Question, seed set, seeds and
 * resamples may differ.
 */
export function isNullCheckDraft(draft) {
  const checked = checkDraft(draft, () => true);
  return checked.ok && isUc01Parts(checked.spec);
}

/** Copy of a scope with only the keys it uses; a window keeps `start_s` and `end_s`. */
function normalizeScope(scope) {
  if (!isPlainObject(scope)) return scope;
  const out = {};
  for (const key of Object.keys(scope)) {
    if (scope[key] === undefined) continue;
    const value = scope[key];
    out[key] = key === "window" && isPlainObject(value) ? { ...value } : value;
  }
  return out;
}

/** Copy of an axis value as the spec stores it (layouts copied, `off` for POL-4 stored as null). */
function normalizeAxisValue(axisId, value) {
  if (axisId === "parameter:POL-4" && value === "off") return null;
  return isPlainObject(value) ? { ...value } : value;
}

/**
 * Checks a draft (contract 6.6 spec shape, format fields optional) and builds the spec when it passes.
 * Returns `{ok, errors, spec}`; `errors` are `{check, what, why, fix}`, `spec` is null unless ok.
 */
export function validateDraft(draft) {
  return checkDraft(draft, isUc01Parts);
}

/** validateDraft with the equal-values rule as a predicate on the checked `{scenario, axis, primary, guardrails}`. */
function checkDraft(draft, equalValuesAllowed) {
  const errors = [];
  const fail = (check, what, why, fix) => errors.push({ check, what, why, fix });
  if (!isPlainObject(draft)) {
    fail("format", "Experiment setup", "An experiment setup is an object with a question, scenario, axis, metrics and seeds.", "Start again from a preset.");
    return { ok: false, errors, spec: null };
  }
  for (const key of Object.keys(draft)) {
    if (!SPEC_KEYS.includes(key)) fail("format", `Unknown setup field: ${key}`, "A frozen spec holds exactly the fields of the spec format and nothing else.", `Remove ${key}.`);
  }
  const expected = { format: SPEC_FORMAT, format_version: SPEC_FORMAT_VERSION, model_version: MODEL_VERSION, metrics_version: METRICS_VERSION };
  for (const key of DRAFT_ONLY_FORMAT_KEYS) {
    if (has(draft, key) && draft[key] !== expected[key]) {
      fail("format", `Setup ${key}: ${shown(draft[key])}`, `This page freezes specs with ${key} ${shown(expected[key])}.`, "Start again from a preset.");
    }
  }

  // Question.
  const question = draft.question;
  if (typeof question !== "string" || question.trim() === "") {
    fail("question", `Question: ${shown(question)}`, "Every experiment asks one question in one sentence.", "Write the question.");
  } else if (Array.from(question).length > QUESTION_MAX_CHARS) {
    fail("question", `Question: ${Array.from(question).length} characters`, `A question holds at most ${QUESTION_MAX_CHARS} characters.`, "Shorten the question.");
  }

  // Scenario.
  const scenarioCheck = validateScenario(draft.scenario);
  const scenario = scenarioCheck.ok ? draft.scenario : null;
  for (const e of scenarioCheck.errors) fail("scenario", e.what, e.why, e.fix);

  // Axis: exactly one, both values in range, different unless it is the labelled null check. Equal values are judged
  // once the metric references are checked; the error keeps its place in the list.
  let axis = null;
  let equalValues = null;
  const rawAxis = draft.axis;
  if (Array.isArray(rawAxis)) {
    fail("one axis", `Variation axis: ${rawAxis.length} axes`, "An experiment varies exactly one axis.", "Keep one axis and test the others in their own experiments.");
  } else if (!isPlainObject(rawAxis) || Object.keys(rawAxis).sort().join(",") !== "baseline,candidate,id") {
    fail("one axis", `Variation axis: ${shown(rawAxis)}`, "An axis holds an id, a baseline value and a candidate value, and nothing else.", "Choose one axis and its two values.");
  } else {
    let parsed = null;
    try {
      parsed = parseAxis(rawAxis.id);
    } catch (error) {
      if (!(error instanceof AxisError)) throw error;
      fail("one axis", error.what, error.why, error.fix);
    }
    if (parsed !== null) {
      const values = {};
      for (const arm of ["baseline", "candidate"]) {
        const value = normalizeAxisValue(rawAxis.id, rawAxis[arm]);
        const typed = isSafeInt(value) || typeof value === "string" || (value === null && rawAxis.id === "parameter:POL-4") ||
          (isPlainObject(value) && Object.values(value).every(isSafeInt));
        if (!typed) {
          fail("ranges valid", `${arm === "baseline" ? "Baseline" : "Candidate"} value for ${rawAxis.id}: ${shown(rawAxis[arm])}`, "An axis value is a whole number in engine units, a named value, a layout of whole numbers, or off for the morning release.", "Enter a value from the knob's range.");
          continue;
        }
        values[arm] = value;
        if (scenario !== null) {
          try {
            applyAxis(scenario, rawAxis.id, value);
          } catch (error) {
            if (!(error instanceof AxisError)) throw error;
            fail("ranges valid", error.what, error.why, error.fix);
          }
        }
      }
      if (has(values, "baseline") && has(values, "candidate")) {
        axis = { id: rawAxis.id, baseline: values.baseline, candidate: values.candidate };
        if (canonicalJson(axis.baseline) === canonicalJson(axis.candidate)) {
          equalValues = {
            at: errors.length,
            error: { check: "one axis", what: `Baseline and candidate for ${axis.id}: both ${shown(axis.baseline)}`, why: "The two arms must differ; only the labelled null check keeps them equal.", fix: "Change the candidate value." },
          };
        }
      }
    }
  }

  // Metric references.
  const reference = (raw, role, unitsKey, textKey) => {
    const label = role === "primary" ? "Primary metric" : `Guardrail ${role + 1}`;
    if (!isPlainObject(raw)) {
      fail("metrics registered", `${label}: ${shown(raw)}`, "A metric reference holds a metric, a scope, a direction and a threshold.", "Choose a registered metric.");
      return null;
    }
    const allowed = ["metric", "scope", "direction", unitsKey, textKey];
    for (const key of Object.keys(raw)) {
      if (!allowed.includes(key)) fail("format", `${label} field: ${key}`, `A ${role === "primary" ? "primary" : "guardrail"} reference has no field named ${key}.`, `Remove ${key}.`);
    }
    const row = typeof raw.metric === "string" ? metricRow(raw.metric) : null;
    if (row === null) {
      fail("metrics registered", `${label}: ${shown(raw.metric)}`, "This metric is not in the playground registry.", "Choose a metric from the list.");
      return null;
    }
    let ok = true;
    if (row.direction === null || row.descriptive_only) {
      fail("metrics registered", `${label}: ${row.name}`, `${row.name} has no direction, so it is descriptive only and cannot be a primary or a guardrail.`, "Choose a metric with a direction.");
      ok = false;
    }
    if (has(raw, "direction") && raw.direction !== row.direction) {
      fail("metrics registered", `${label} direction: ${shown(raw.direction)}`, `${row.name} is registered as ${String(row.direction)}.`, "Declare the registered direction.");
      ok = false;
    }
    const scope = normalizeScope(raw.scope === undefined ? {} : raw.scope);
    const refCheck = validateMetricRef({ metric: row.name, scope }, scenario);
    for (const text of refCheck.errors) fail("scopes valid", `${label}: ${metricKey({ metric: row.name, scope: isPlainObject(scope) ? scope : {} })}`, text, "Use only the scope keys this metric accepts, with a window inside the measured span.");
    if (!refCheck.ok) ok = false;

    let units = null;
    const hasUnits = has(raw, unitsKey) && raw[unitsKey] !== undefined;
    const hasText = has(raw, textKey) && raw[textKey] !== undefined;
    const thresholdName = role === "primary" ? "Equivalence margin" : "Maximum harm";
    if (hasUnits && hasText) {
      fail("ranges valid", `${label} ${thresholdName.toLowerCase()}`, `Give ${unitsKey} or ${textKey}, not both.`, `Remove one of them.`);
    } else if (hasUnits) {
      if (isSafeInt(raw[unitsKey])) units = raw[unitsKey];
      else fail("ranges valid", `${label} ${thresholdName.toLowerCase()}: ${shown(raw[unitsKey])}`, `${unitsKey} is a whole number in the metric's engine unit (${row.engine_unit}).`, "Enter a whole number.");
    } else if (hasText) {
      try {
        if (row.engine_unit === "ppm") units = parseDecimalPpm(raw[textKey]);
        else if (typeof raw[textKey] === "string" && /^[0-9]+$/.test(raw[textKey]) && Number.isSafeInteger(Number(raw[textKey]))) units = Number(raw[textKey]);
        else throw new RangeError(`${shown(raw[textKey])} is not a whole number of ${row.engine_unit === "s" ? "seconds" : row.unit}`);
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        fail("ranges valid", `${label} ${thresholdName.toLowerCase()}: ${shown(raw[textKey])}`, error.message, row.engine_unit === "ppm" ? "Type a fraction such as 0.02." : "Type a whole number.");
      }
    } else {
      fail(role === "primary" ? "margin above 0" : "ranges valid", `${label} ${thresholdName.toLowerCase()}: missing`, `Every ${role === "primary" ? "primary needs an equivalence margin" : "guardrail needs a maximum harm"}.`, "Enter it.");
    }
    if (units !== null) {
      if (role === "primary" && units <= 0) {
        fail("margin above 0", `Equivalence margin: ${units}`, "The equivalence margin must be above 0.", "Enter a margin above 0.");
        units = null;
      } else if (role !== "primary" && units < 0) {
        fail("ranges valid", `${label} maximum harm: ${units}`, "A maximum harm is 0 or more.", "Enter 0 or more.");
        units = null;
      }
    }
    if (!ok || units === null) return null;
    return { metric: row.name, scope, direction: row.direction, [unitsKey]: units };
  };

  const primary = reference(draft.primary, "primary", "margin_units", "margin_text");
  const guardrails = [];
  let guardrailsOk = true;
  if (!Array.isArray(draft.guardrails)) {
    fail("metrics registered", `Guardrails: ${shown(draft.guardrails)}`, "Guardrails are a list, possibly empty.", "Start again from a preset.");
    guardrailsOk = false;
  } else {
    draft.guardrails.forEach((raw, i) => {
      const ref = reference(raw, i, "max_harm_units", "max_harm_text");
      if (ref === null) guardrailsOk = false;
      else guardrails.push(ref);
    });
  }
  if (equalValues !== null) {
    const exempt = scenario !== null && primary !== null && guardrailsOk && equalValuesAllowed({ scenario, axis, primary, guardrails });
    if (!exempt) errors.splice(equalValues.at, 0, equalValues.error);
  }

  // Seeds and resamples.
  const seedSetIndex = draft.seed_set;
  const seeds = draft.seeds;
  if (!isSafeInt(seedSetIndex) || seedSetIndex < 1) {
    fail("seeds", `Seed set: ${shown(seedSetIndex)}`, "Seed sets are numbered from 1.", "Use seed set 1, or the next set.");
  } else if (!Array.isArray(seeds) || seeds.length < SEEDS_MIN || seeds.length > SEEDS_MAX) {
    fail("seeds", `Paired replications: ${Array.isArray(seeds) ? seeds.length : shown(seeds)}`, `An experiment runs ${SEEDS_MIN} to ${SEEDS_MAX} paired replications.`, `Choose ${SEEDS_MIN} to ${SEEDS_MAX}.`);
  } else if (!seeds.every((seed, i) => seed === 1000 * seedSetIndex + 1 + i)) {
    const first = 1000 * seedSetIndex + 1;
    fail("seeds", `Seeds of seed set ${seedSetIndex}`, `Seed set ${seedSetIndex} holds seeds ${first} to ${first + seeds.length - 1} in order; seeds are never chosen by hand.`, "Use the seeds of the seed set.");
  }
  if (!isSafeInt(draft.resamples) || draft.resamples < RESAMPLES_MIN || draft.resamples > RESAMPLES_MAX) {
    fail("resamples", `Bootstrap resamples: ${shown(draft.resamples)}`, `Resamples run from ${RESAMPLES_MIN} to ${RESAMPLES_MAX}.`, `Choose ${RESAMPLES_MIN} to ${RESAMPLES_MAX}.`);
  }

  // The shared envelope must hold the declared scenario that builds every world.
  if (scenario !== null && axis !== null && errors.length === 0) {
    const arms = armScenarios({ scenario, axis });
    const envelope = sharedLambdaMaxPermille([arms.baseline, arms.candidate]);
    const own = ownLambdaMaxPermille(scenario);
    for (const id of Object.keys(own)) {
      if (own[id] > envelope[id]) {
        fail("ranges valid", `Declared demand in ${id}: ${own[id]} thousandths of requests per hour`, "The declared scenario builds every world, and it asks for more requests than either arm, so the shared world cannot hold it.", "Set the declared scenario's value to the baseline value.");
      }
    }
  }

  if (errors.length > 0 || primary === null || !guardrailsOk || axis === null || scenario === null) {
    return { ok: false, errors, spec: null };
  }
  const spec = {
    format: SPEC_FORMAT,
    format_version: SPEC_FORMAT_VERSION,
    model_version: MODEL_VERSION,
    metrics_version: METRICS_VERSION,
    question,
    scenario: cloneScenario(scenario),
    axis,
    primary,
    guardrails,
    seed_set: seedSetIndex,
    seeds: seeds.slice(),
    resamples: draft.resamples,
  };
  canonicalJson(spec); // throws on anything the serializer refuses
  return { ok: true, errors: [], spec };
}

/** Freezes a draft: `{spec, digest, label}` with the full lowercase hex digest and `playground-spec:` plus 8 characters. Throws SpecError. */
export function freezeSpec(draft) {
  const checked = validateDraft(draft);
  if (!checked.ok) throw new SpecError(checked.errors);
  const spec = deepFreeze(checked.spec);
  const digest = specDigest(spec);
  return Object.freeze({ spec, digest, label: specHashLabel(digest) });
}

/** The two arm scenarios of a spec: the declared scenario with the axis set to each value. */
export function armScenarios(spec) {
  return {
    baseline: applyAxis(spec.scenario, spec.axis.id, spec.axis.baseline),
    candidate: applyAxis(spec.scenario, spec.axis.id, spec.axis.candidate),
  };
}

/** The shared envelope of a spec: per area, the larger hourly maximum of the two arms (thousandths of requests per hour). */
export function experimentEnvelope(spec) {
  const { baseline, candidate } = armScenarios(spec);
  return sharedLambdaMaxPermille([baseline, candidate]);
}

/** The frozen world of one seed: the declared scenario's candidate stream under the shared envelope (P-1). */
export function seedWorld(spec, seed, envelope = experimentEnvelope(spec)) {
  return buildWorld(spec.scenario, { seed, lambdaMaxPermille: envelope });
}

/**
 * The declarations the instrument receives (contract 4, 6.6): `primary {name, direction, equivalence_margin}`,
 * `guardrails [{metric, max_harm, direction}]` with thresholds converted once, `descriptiveNames`, and the metric
 * references every run computes. Names are `metricKey` of each reference.
 */
export function verdictDeclarations(spec) {
  const primaryName = metricKey(spec.primary);
  const primary = { name: primaryName, direction: spec.primary.direction, equivalence_margin: thresholdValue(spec.primary.metric, spec.primary.margin_units) };
  const guardrails = spec.guardrails.map((g) => ({ metric: metricKey(g), max_harm: thresholdValue(g.metric, g.max_harm_units), direction: g.direction }));
  const descriptive = defaultRefs(spec.scenario).filter((ref) => metricKey(ref) !== primaryName);
  const refs = [];
  const seen = new Set();
  for (const ref of [spec.primary, ...spec.guardrails, ...descriptive]) {
    const key = metricKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ metric: ref.metric, scope: ref.scope });
  }
  return { primary, guardrails, descriptiveNames: descriptive.map(metricKey), refs };
}

/** A computeAll map as the instrument reads it: key to number, absent metrics left out. */
function instrumentRun(map) {
  const out = {};
  for (const key of Object.keys(map)) if (has(map[key], "value")) out[key] = map[key].value;
  return out;
}

/** Whether two computeAll maps are identical (same keys, values by Object.is, same absence reasons). */
function sameMetricMaps(a, b) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => has(b, key) && Object.is(a[key].value, b[key].value) && a[key].absent === b[key].absent);
}

/** Drives a generator that yields undefined, yielding `marker` in its place; returns its value. */
function* marked(steps, marker) {
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
    yield marker;
  }
}

/** Runs one arm on a world in steps, yielding `marker` around createRun, between steps and around result(). */
function* driveRun(scenario, world, seed, keepLogs, defect, marker) {
  yield marker;
  const run = createRun(scenario, world, { seed, keepLogs, defect });
  yield marker;
  while (!run.step(STEP_EVENTS)) yield marker;
  yield marker;
  const result = run.result();
  yield marker;
  return result;
}

/**
 * Runs a frozen spec (contract 6.6), yielding `{done, total, label}` (runs finished of `2 × seeds + 3`) and returning
 * `{verdict, digest, label, lambdaMaxPermille, per_seed: [{seed, baseline_metrics, candidate_metrics}]}`.
 */
export function* experimentSteps(spec, { defectAt = () => null, compute = computeAll } = {}) {
  const frozen = freezeSpec(spec);
  const s = frozen.spec;
  const { baseline, candidate } = armScenarios(s);
  const envelope = sharedLambdaMaxPermille([baseline, candidate]);
  const declarations = verdictDeclarations(s);
  const n = s.seeds.length;
  const total = 2 * n + 3;
  let done = 0;
  const baselineRuns = [];
  const candidateRuns = [];
  const perSeed = [];

  // The verdict, computed in slices; `marker` is yielded while the bootstrap runs.
  function* finish(precheckMatched, invariantViolation, marker) {
    const verdict = yield* marked(computeVerdictSteps({
      primary: declarations.primary,
      guardrails: declarations.guardrails,
      descriptiveNames: declarations.descriptiveNames,
      baselineRuns,
      candidateRuns,
      resamples: s.resamples,
      key: frozen.digest,
      precheckMatched,
      invariantViolation,
    }), marker);
    return { verdict, digest: frozen.digest, label: frozen.label, lambdaMaxPermille: { ...envelope }, per_seed: perSeed };
  }

  // Precheck (P-3, as the teaching engine departs): the baseline arm twice on the first seed's shared world.
  const seed0 = s.seeds[0];
  const first = { done, total, label: `Replay check on seed ${seed0}, run 1 of 2` };
  // Tables for the spec's sigma, each its own step (memoized, so only the first experiment pays for them).
  yield first;
  expTable();
  yield first;
  multiplierTable(s.scenario.sigma_permille);
  yield first;
  const world0 = seedWorld(s, seed0, envelope);
  yield first;
  const worldProblems0 = checkWorld(world0, [baseline, candidate]);
  const precheck = [];
  for (let run = 1; run <= 2; run += 1) {
    const marker = run === 1 ? first : { done, total, label: `Replay check on seed ${seed0}, run ${run} of 2` };
    const defect = defectAt({ phase: "precheck", seed: seed0, arm: "baseline", run });
    const result = yield* driveRun(baseline, world0, seed0, true, defect, marker);
    done += 1;
    const found = yield* marked(runViolationsSteps(result), marker);
    const violations = [...(run === 1 ? worldProblems0 : []), ...found, ...checkArms([result], world0)];
    yield marker;
    const metrics = compute(result, declarations.refs);
    yield marker;
    precheck.push({ result, metrics });
    if (run === 2) {
      if (!sameMetricMaps(precheck[0].metrics, metrics)) return yield* finish(false, null, marker);
      violations.push(...(yield* marked(checkReplaySteps(precheck[0].result, result), marker)));
    }
    if (violations.length > 0) return yield* finish(true, `seed ${seed0}: ${violations[0]}`, marker);
  }

  // Paired loop: seeds in spec order, baseline arm before candidate arm, one world per seed.
  for (let i = 0; i < n; i += 1) {
    const seed = s.seeds[i];
    const opening = { done, total, label: `Seed ${i + 1} of ${n}, baseline arm` };
    yield opening;
    const world = i === 0 ? world0 : seedWorld(s, seed, envelope);
    yield opening;
    const worldProblems = i === 0 ? [] : checkWorld(world, [baseline, candidate]);
    const pair = {};
    const results = [];
    for (const [arm, scenario] of [["baseline", baseline], ["candidate", candidate]]) {
      const replayed = i === 0 && arm === "candidate";
      const marker = arm === "baseline" ? opening : { done, total, label: `Seed ${i + 1} of ${n}, ${arm} arm` };
      const defect = defectAt({ phase: "paired", seed, arm, run: 1 });
      const result = yield* driveRun(scenario, world, seed, replayed, defect, marker);
      done += 1;
      results.push(result);
      const found = yield* marked(runViolationsSteps(result), marker);
      const violations = [...(arm === "baseline" ? worldProblems : []), ...found, ...checkArms(results, world)];
      if (violations.length > 0) return yield* finish(true, `seed ${seed}: ${violations[0]}`, marker);
      let current = marker;
      if (replayed) {
        // Design 5.4 item 6: the first seed of each arm runs twice; the baseline arm's pair is the precheck above.
        const again = { done, total, label: `Replay check on seed ${seed}, candidate arm` };
        const replay = yield* driveRun(scenario, world, seed, true, defectAt({ phase: "replay", seed, arm, run: 2 }), again);
        done += 1;
        const replayViolations = yield* marked(runViolationsSteps(replay), again);
        const replayProblems = [...replayViolations, ...(yield* marked(checkReplaySteps(result, replay), again))];
        if (replayProblems.length > 0) return yield* finish(true, `seed ${seed}: ${replayProblems[0]}`, again);
        current = again; // progress never steps back to the finished run's count
      }
      yield current;
      pair[arm] = compute(result, declarations.refs);
      yield current;
    }
    baselineRuns.push(instrumentRun(pair.baseline));
    candidateRuns.push(instrumentRun(pair.candidate));
    perSeed.push({ seed, baseline_metrics: pair.baseline, candidate_metrics: pair.candidate });
  }
  const verdictMarker = { done, total, label: "Computing the verdict" };
  yield verdictMarker;
  return yield* finish(true, null, verdictMarker);
}

/** Drives experimentSteps to the end in one call and returns its payload (options as experimentSteps). */
export function runExperimentSpec(spec, options) {
  const steps = experimentSteps(spec, options);
  for (;;) {
    const next = steps.next();
    if (next.done) return next.value;
  }
}
