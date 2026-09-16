// Experiment mode (design §6, §7.1 freeze rule, §7.2 setup and verdict, §1.3 reference panels): the setup sheet in
// six blocks with its checks, Freeze and run, the freeze notice, the verdict card, the session log and the two quoted
// FleetLab reference panels. Views are built from the store state with dom.js helpers; text enters only through
// textContent and every string comes from labels.js (plus model check text and metric names, which are data).
//
// Decisions this module makes where the design is silent (reported with the build):
// - FleetLab can run an axis only when it is one `parameter:` axis over a FleetLab scenario field with no qualifier:
//   DEP-6 (service_duration_s), DEP-7 (trips_between_service) and RID-1 (max_wait_s). Every other axis carries the
//   design §1.3 tag, and a scoped metric carries the teaching-model grammar tag (design §2.8, P-0).
// - The primary strip is charts.js's verdict strip (`chartsPrimaryStrip`, replaceable for tests); the card always carries
//   the interval, the band and the outcome sentence as text, so no value depends on the drawing. Guardrails are the
//   card's own table followed by charts.js's guardrail bullet rows (`chartsGuardrailRows`, design §7.5), both from one
//   verdict group; descriptive deltas are a table. A quoted panel has no paired deltas, so it draws no strip or rows.
// - Metric names show their scope on the simulated clock (`wait.p90_s · SF · D2 07:00 to 09:00`); the key itself stays
//   in each row's `data-metric` and in the copied result summary.
// - The gate chain and the depot stages are ordered lists drawn as arrow flows without number markers (design §8.5).
// - Every displayed number carries `data-field` and `data-value` (the unrounded double), so a test can compare the card
//   with the payload exactly.
// - On a phone (below 768 px) the blocks are an accordion of `details` elements with only the question open; the
//   open blocks are kept across re-renders.
// - A quoted reference panel carries no teaching-run footer and no teaching-model limits (it ran in FleetLab's world); it
//   carries the differences panel instead, and each suppressed row's link moves focus to it.
// - "Start from a preset" (design §10.1) is a select at the top of the setup sheet in groups: every Experiment preset,
//   then L2a and L2b, then the operations casebook, one group per theme (section 4.4). The scenario block lists
//   differences from the preset the baseline came from, so a Learn preset's declared Experiment travel variation
//   (design §2.5 RD-5) stays listed.
// - A casebook preset adds an unnumbered SITUATION block before 1 QUESTION: the situation, what each change stands for,
//   how it is set and what it misses, what lies outside the model, and what to watch (the preset's copy, never a
//   verdict). Once the draft no longer matches the case's spec (the question aside), the block keeps the lead and the
//   situation and says so in place of the proxy, outside-model and watch lines, so the sheet never carries two accounts
//   of what the run changes. Every other preset has no such block, and on a phone it joins the accordion closed.
// - "Use another seed set" freezes the frozen spec moved to seed set k + 1, never the draft, and is off while the setup
//   is out of date (design §6, §7.1).
// - The run estimate (design §7.2 seeds block) scales the last finished experiment's time per seed on this page; before
//   any run it uses the design §7.7 target for 20 seeds (10 s on a laptop, 45 s on a phone). Above 60 s the block adds
//   the fewer-seeds advice, with the interval widening by the square root of the seed ratio.

import { resultSummary, summaryText } from "../instrument/summary.js";
import { freezeSpec, isNullCheckDraft, SpecError, thresholdValue, validateDraft, verdictDeclarations } from "../model/experiment.js";
import { violationId } from "../model/invariants.js";
import { METRICS, metricRow } from "../model/metrics.js";
import { OPS_THEME_IDS, opsPresetsOf, PRESETS, presetById, seedSet } from "../model/presets.js";
import { REFERENCE_PANELS } from "../model/reference-panels.js";
import { AxisError, cloneScenario, describeDifferences, KNOBS, parseAxis } from "../model/schema.js";
import { metricSubject, verdictCharts } from "./charts.js";
import { el, withArrows } from "./dom.js";
import * as format from "./format.js";
import * as labels from "./labels.js";
import { ENGINE_PATHS, sandboxChangesSinceFreeze } from "./store.js";

/** Axes FleetLab's own grammar can run (design P-0): one `parameter:` axis over a numeric FleetLab scenario field. */
export const FLEETLAB_AXES = Object.freeze(["parameter:DEP-6", "parameter:DEP-7", "parameter:RID-1"]);

/** The five checks of the design §7.2 setup sheet, in its order, as `validateDraft` names them. */
export const DESIGN_CHECKS = Object.freeze([
  ["one axis", "oneAxis"],
  ["margin above 0", "marginAboveZero"],
  ["metrics registered", "metricsRegistered"],
  ["ranges valid", "rangesValid"],
  ["scopes valid", "scopesValid"],
]);

/** Draft parts `validateDraft` checks beyond the five, each shown only when it fails. */
export const OTHER_CHECKS = Object.freeze(["question", "scenario", "seeds", "resamples", "format"]);

/** The reference panel ids and their §1.3 chips and titles. */
export const REFERENCE_IDS = Object.freeze(["fleet005", "probe"]);

const PANEL_TEXT = {
  fleet005: { chip: () => labels.HONESTY.fleet005Panel, title: () => labels.REFERENCE.fleet005Title },
  probe: { chip: () => labels.HONESTY.twoZoneProbePanel, title: () => labels.REFERENCE.twoZoneProbeTitle },
};

const PHONE_QUERY = "(max-width: 767.98px)";
const DESCRIPTIVE_PREVIEW_ROWS = 3;
const PPM = 1000000;

// ---------------------------------------------------------------------------------------------------------------
// Draft and checks.

/**
 * The freezeSpec draft of a store draft (store.js): the baseline scenario, the seeds of the seed set for the seed count,
 * and the question, axis, primary, guardrails and resamples as given. An unusable seed count gives `seeds: null`, which
 * the seeds check reports.
 */
export function specDraftOf(draft) {
  const count = draft.seedCount;
  const usable = Number.isSafeInteger(count) && count >= 0 && count <= 1000 && Number.isSafeInteger(draft.seedSet);
  return {
    question: draft.question,
    scenario: draft.baselineScenario,
    axis: draft.axis,
    primary: draft.primary,
    guardrails: draft.guardrails,
    seed_set: draft.seedSet,
    seeds: usable ? seedSet(draft.seedSet, count) : null,
    resamples: draft.resamples,
  };
}

/**
 * The setup checks of a store draft: `{ok, checks: [{id, label, passes}], errors: [{check, what, why, fix}]}`. The five
 * design checks are always listed; the other draft checks are listed only when they fail. `ok` is true only when
 * `validateDraft` accepts the draft.
 */
export function setupChecks(draft) {
  const result = validateDraft(specDraftOf(draft));
  const failing = new Set(result.errors.map((e) => e.check));
  const checks = DESIGN_CHECKS.map(([id, key]) => ({ id, label: labels.EXPERIMENT_SETUP.checks[key], passes: !failing.has(id) }));
  for (const id of OTHER_CHECKS) {
    if (failing.has(id)) checks.push({ id, label: labels.EXPERIMENT_SETUP.otherChecks[id], passes: false });
  }
  return { ok: result.ok, checks, errors: result.errors };
}

/** Whether the design §1.3 tag "Teaching-model axis: FleetLab cannot run this" applies to an axis id. */
export function isTeachingModelAxis(axisId) {
  return typeof axisId === "string" && axisId.length > 0 && !FLEETLAB_AXES.includes(axisId);
}

// ---------------------------------------------------------------------------------------------------------------
// Presets and the run estimate.

/**
 * The groups of "Start from a preset" (design §10.1, section 4.4), each `{label, ids}`: every Experiment preset in preset
 * order, the two L2 presets, then the operations casebook, one group per theme in OPS_THEME_IDS order.
 */
export const CHOOSER_GROUPS = Object.freeze([
  [labels.PRESET_GROUPS.experiment, PRESETS.filter((p) => p.kind === "experiment").map((p) => p.id)],
  [labels.PRESET_GROUPS.learn, ["L2a", "L2b"]],
  ...OPS_THEME_IDS.map((theme) => [labels.casebookGroup(theme), opsPresetsOf(theme).map((p) => p.id)]),
].map(([label, ids]) => Object.freeze({ label, ids: Object.freeze(ids) })));

/** The presets the setup sheet offers, flat, in chooser order. */
export const CHOOSER_PRESET_IDS = Object.freeze(CHOOSER_GROUPS.flatMap((g) => g.ids));

/**
 * The store draft of a preset's declared experiment: question, declared scenario (a copy), axis, primary, guardrails,
 * seed set, seed count and resamples, as `experiment/fromPreset` and `learn/testItProperly` take it.
 */
export function presetDraft(presetId) {
  const preset = presetById(presetId);
  if (preset === null || preset.experiment === null) throw new RangeError(`preset ${String(presetId)} declares no experiment`);
  const x = structuredClone(preset.experiment);
  return {
    question: x.question,
    baselineScenario: cloneScenario(x.scenario),
    axis: x.axis,
    primary: x.primary,
    guardrails: x.guardrails,
    seedSet: x.seed_set,
    seedCount: x.seeds.length,
    resamples: x.resamples,
  };
}

/** "Start from a preset": that preset's scenario in Sandbox and its declared experiment in the setup sheet. */
export function startFromPreset(dispatch, presetId) {
  if (!CHOOSER_PRESET_IDS.includes(presetId)) throw new RangeError(`preset ${String(presetId)} is not offered in Experiment`);
  dispatch({ type: "experiment/fromPreset", presetId, scenario: cloneScenario(presetById(presetId).scenario), draft: presetDraft(presetId) });
}

/** Design §7.7 targets for an experiment of 20 seeds × 2 arms, in seconds: the estimate before any run has been timed. */
export const EXPERIMENT_TARGET_S = Object.freeze({ seeds: 20, laptop: 10, phone: 45 });

/** Above this estimate, in seconds, the setup suggests fewer seeds (design §7.7). */
export const SLOW_EXPERIMENT_S = 60;

/**
 * The run estimate of a seed count: `{seconds, fewerSeeds}`, whole seconds rounded up (at least 1), from `msPerSeed` (the
 * last finished experiment's time divided by its seeds) or else the design §7.7 target for the device. `fewerSeeds` is
 * the largest count (at least 2) that fits in SLOW_EXPERIMENT_S when the estimate is above it, else null. Null when the
 * seed count is not a whole number from 1 to 1000.
 */
export function runEstimate({ seedCount, msPerSeed = null, phone = false }) {
  if (!Number.isSafeInteger(seedCount) || seedCount < 1 || seedCount > 1000) return null;
  const timed = typeof msPerSeed === "number" && Number.isFinite(msPerSeed) && msPerSeed >= 0;
  const perSeedMs = timed ? msPerSeed : ((phone ? EXPERIMENT_TARGET_S.phone : EXPERIMENT_TARGET_S.laptop) * 1000) / EXPERIMENT_TARGET_S.seeds;
  const seconds = Math.max(1, Math.ceil(Math.round(perSeedMs * seedCount) / 1000));
  if (seconds <= SLOW_EXPERIMENT_S) return { seconds, fewerSeeds: null };
  const fewer = Math.max(2, Math.floor((SLOW_EXPERIMENT_S * 1000) / perSeedMs));
  return { seconds, fewerSeeds: fewer < seedCount ? fewer : null };
}

// ---------------------------------------------------------------------------------------------------------------
// Values as text.

/** The unit family of a metric name or key (`s`, `fraction` or `count`); names outside the registry go by suffix. */
export function metricUnitFamily(metricOrKey) {
  const name = String(metricOrKey).split("{")[0];
  const row = metricRow(name);
  if (row !== null) return row.engine_unit === "ppm" ? "fraction" : row.engine_unit === "s" ? "s" : "count";
  if (name.endsWith("_s")) return "s";
  return name.includes("fraction") ? "fraction" : "count";
}

/**
 * A metric mean or delta as text in the metric's unit: seconds to 0.1 s, fractions to 0.001, counts to 0.1. A nonzero
 * value never reads as zero: when rounding leaves no nonzero digit, the text is the exact double in plain decimals (as
 * the copied summary does, via `format.nonzero`), so a regressed harm of 2.7e-5 against max harm 0 reads `+0.000027`,
 * not `0.000`. Never `-0`.
 */
export function metricValueText(metricOrKey, value, { withSign = false } = {}) {
  const family = metricUnitFamily(metricOrKey);
  const text = format.nonzero(value, family === "fraction" ? 3 : 1, { withSign });
  return family === "s" ? `${text} ${labels.UNITS.seconds}` : text;
}

/** A declared threshold (margin or maximum harm) as text with no trailing zeros: `30 s`, `0.02`, `600 s`. */
export function thresholdText(metricOrKey, value) {
  const family = metricUnitFamily(metricOrKey);
  let text = format.number(value, 6);
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  return family === "s" ? `${text} ${labels.UNITS.seconds}` : text;
}

/** The unit word shown beside a metric's direction: `s`, `fraction` or the registry unit. */
function unitWord(row) {
  return row.engine_unit === "ppm" ? "fraction" : row.unit;
}

/** A threshold in integer engine units as the text a person types: ppm as a decimal fraction, else the integer. */
export function unitsAsText(metric, units) {
  const row = metricRow(metric);
  if (row === null || !Number.isSafeInteger(units)) return "";
  if (row.engine_unit !== "ppm") return String(units);
  const whole = Math.floor(units / PPM);
  const rest = String(units % PPM).padStart(6, "0").replace(/0+$/, "");
  return rest.length === 0 ? String(whole) : `${String(whole)}.${rest}`;
}

const knobOf = (knobPath) => KNOBS.find((k) => k.id === String(knobPath).split(".")[0]) ?? null;

/** One knob value in engine units as display text, using the knob's scale and unit. */
export function knobValueText(knobPath, value) {
  const knob = knobOf(knobPath);
  if (value === null) return labels.VALUE_WORDS.off;
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (knob === null) return format.number(value, 0);
    if (knob.unit === "clock") return format.clock(value);
    if (knob.unit === "min") return format.minutes(value);
    if (knob.engineUnit === "per-mille" && knob.unit.startsWith(labels.UNITS.times)) return format.multiplier(value);
    if (knob.engineUnit === "per-mille") return format.number(value / 1000, 2);
    return `${format.number(value, 0)} ${knob.unit}`;
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) return value.join(", ");
    return value
      .map((part) => (part !== null && typeof part === "object" && "start_h" in part ? `${format.hourClock(part.start_h)} ${labels.VALUE_WORDS.to} ${format.hourClock(part.end_h)}` : String(part)))
      .join(", ");
  }
  if (value !== null && typeof value === "object") {
    if ("start_s" in value && "end_s" in value) return `${format.clock(value.start_s)} ${labels.VALUE_WORDS.to} ${format.clock(value.end_s)}`;
    return Object.entries(value).map(([k, v]) => `${k} ${String(v)}`).join(", ");
  }
  return String(value);
}

/** One `describeDifferences` entry as display text: `Cleaning bays per depot, SJ-1: 3 bays to 1 bays`. */
export function differenceText({ knob, from, to }) {
  const row = knobOf(knob);
  const qualifier = String(knob).split(".").slice(1).join(" ").replace(">", ` ${labels.VALUE_WORDS.to} `);
  const knobName = row === null ? knob : qualifier.length > 0 ? `${row.label}, ${qualifier}` : row.label;
  if (Array.isArray(from) && Array.isArray(to) && from.length === to.length && from.every((v) => typeof v === "number")) {
    return `${knobName}: ${labels.hoursChanged(from.filter((v, i) => v !== to[i]).length)}`;
  }
  return labels.changeItem({ knobName, from: knobValueText(knob, from), to: knobValueText(knob, to) });
}

// ---------------------------------------------------------------------------------------------------------------
// Verdict views: one shape for a teaching run and for a quoted panel.

/**
 * The view of a teaching-run verdict payload (`run_experiment`) under its frozen spec: every number in the metric's unit,
 * copied from the payload; thresholds are the doubles the instrument received.
 */
export function verdictView(payload, frozen) {
  const { verdict } = payload;
  const spec = frozen.spec;
  const replications = spec.seeds.length;
  const base = {
    kind: "teaching",
    replications,
    label: frozen.label,
    validity: verdict.validity,
    invalidityReason: verdict.invalidity_reason,
    invalidityDetail: verdict.invalidity_detail,
    outcome: verdict.outcome,
    recommendation: verdict.recommendation,
  };
  if (verdict.validity !== "VALID") return { ...base, primary: null, guardrails: [], descriptives: [], suppressed: [], deltas: [] };
  const p = verdict.primary;
  return {
    ...base,
    primary: {
      metric: p.metric,
      direction: spec.primary.direction,
      equivalence_margin: thresholdValue(spec.primary.metric, spec.primary.margin_units),
      baseline_mean: p.baseline_mean,
      candidate_mean: p.candidate_mean,
      mean_delta: p.mean_delta,
      median_delta: p.median_delta,
      ci_low: p.ci_low,
      ci_high: p.ci_high,
    },
    deltas: spec.seeds.map((seed, i) => ({ seed, delta: p.paired_deltas[i] })),
    guardrails: verdict.guardrail_statuses.map((g, i) => ({
      metric: g.metric,
      direction: spec.guardrails[i].direction,
      status: g.status,
      harm: g.harm,
      max_harm: g.max_harm,
    })),
    descriptives: verdict.descriptives.map((d) => ({ metric: d.metric, baseline_mean: d.baseline_mean, candidate_mean: d.candidate_mean, mean_delta: d.mean_delta })),
    suppressed: [],
  };
}

/** The view of a quoted reference panel (contract 5.2 projection); values unmodified, no digest, no label tuple. */
export function referenceView(panel) {
  return {
    kind: "reference",
    replications: panel.replications,
    label: null,
    validity: panel.validity,
    invalidityReason: panel.invalidity_reason,
    invalidityDetail: null,
    outcome: panel.outcome,
    recommendation: panel.recommendation,
    primary: panel.primary === null ? null : { ...panel.primary },
    deltas: [],
    guardrails: panel.guardrails.map((g) => ({
      metric: g.metric,
      direction: g.direction,
      status: g.regressed ? "REGRESSED" : "WITHIN",
      harm: g.direction === "lower_is_better" ? g.mean_delta : -g.mean_delta,
      max_harm: g.max_harm,
    })),
    descriptives: panel.descriptives.map((d) => ({ ...d })),
    suppressed: panel.suppressed.slice(),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Small builders.

/** A status chip: glyph (hidden from screen readers) and the literal word, coloured only by its status token. */
function chip(entry, word = entry.word) {
  return el("span", { class: "fl-verdict-chip", "data-status": entry.status }, [
    el("span", { class: "fl-verdict-chip__glyph", "aria-hidden": "true" }, entry.glyph),
    el("span", { class: "fl-verdict-chip__word" }, word),
  ]);
}

/** A number cell with its unrounded value in `data-value`. */
function valueSpan(field, value, text) {
  return el("span", { class: "fl-mono", "data-field": field, "data-value": String(value) }, text);
}

/** An absent value, never 0, blank or a dash. */
function absentSpan(field, reason) {
  return el("span", { class: "fl-absent", "data-field": field, "data-absent": reason }, labels.absentValue(reason));
}

/** A disclosure button that shows or hides `target`; `open` is kept by the caller across renders. */
function disclosure({ key, open, showText, hideText, target, onToggle }) {
  target.hidden = !open;
  return el(
    "button",
    { type: "button", class: "fl-button", "aria-expanded": open ? "true" : "false", "data-focus-key": key, on: { click: () => onToggle(!open) } },
    open ? hideText : showText,
  );
}

function heading(level, text, attrs = {}) {
  return el(`h${String(level)}`, { class: "fl-title", ...attrs }, text);
}

// ---------------------------------------------------------------------------------------------------------------
// Verdict card.

/** The reason under the recommendation (design §7.2 gate chain). */
function recommendationReason(view, regressions) {
  const r = labels.RECOMMENDATION_REASONS;
  if (view.validity !== "VALID") return r.invalid;
  if (regressions > 0) return r.guardrailHarmed;
  return { REGRESSED: r.primaryRegressed, IMPROVED: r.improved, INCONCLUSIVE: r.inconclusive, UNCHANGED: r.unchanged }[view.outcome] ?? r.unchanged;
}

function gate(id, name, content) {
  return el("li", { "data-gate": id }, [el("span", { class: "fl-small-label" }, name), ...content]);
}

function gateChain(view) {
  const words = labels.STATUS_WORDS;
  const regressions = view.guardrails.filter((g) => g.status === "REGRESSED").length;
  const notEvaluable = view.guardrails.filter((g) => g.status === "NOT_EVALUABLE").length;
  const valid = view.validity === "VALID";
  const items = [gate("validity", labels.VERDICT.validity, [chip(words.validity[view.validity])])];
  if (valid) {
    const rails = [];
    if (view.guardrails.length === 0) rails.push(el("span", { class: "fl-muted" }, labels.VERDICT.noGuardrails));
    else if (regressions > 0) rails.push(chip(words.guardrail.REGRESSED, labels.guardrailsRegressedCount(regressions)));
    else if (notEvaluable < view.guardrails.length) rails.push(chip(words.guardrail.WITHIN));
    if (notEvaluable > 0) rails.push(chip(words.guardrail.NOT_EVALUABLE, labels.guardrailsNotEvaluableCount(notEvaluable)));
    if (regressions > 0) rails.push(el("span", { class: "fl-muted", "data-role": "decides" }, labels.VERDICT.decides));
    items.push(gate("guardrails", labels.VERDICT.guardrails, rails));
    items.push(
      gate("primary", labels.VERDICT.primaryOutcome, [
        chip(words.outcome[view.outcome]),
        el("span", { class: "fl-muted", "data-role": regressions > 0 ? "shown-not-needed" : "decides" }, regressions > 0 ? labels.VERDICT.shownNotNeeded : labels.VERDICT.decides),
      ]),
    );
  }
  const recommendation = [
    chip(words.recommendation[view.recommendation]),
    el("q", { "data-role": "reason" }, recommendationReason(view, regressions)),
  ];
  if (valid && notEvaluable > 0) recommendation.push(el("span", { class: "fl-muted", "data-role": "not-evaluable" }, labels.NOT_EVALUABLE_TEXT));
  items.push(gate("recommendation", labels.VERDICT.recommendation, recommendation));
  return el("section", { "data-section": "gates", "aria-label": labels.VERDICT.gateChain }, [
    heading(3, labels.VERDICT.gates),
    el("ol", { class: "fl-flow" }, withArrows(items, labels.FLOW_ARROW)),
  ]);
}

function primarySection(view, strip) {
  const p = view.primary;
  const key = p.metric;
  const rows = [
    [labels.VERDICT.baselineMean, valueSpan("primary.baseline_mean", p.baseline_mean, metricValueText(key, p.baseline_mean))],
    [labels.VERDICT.candidateMean, valueSpan("primary.candidate_mean", p.candidate_mean, metricValueText(key, p.candidate_mean))],
    [labels.candidateMinusBaseline(labels.VERDICT.meanDelta), valueSpan("primary.mean_delta", p.mean_delta, metricValueText(key, p.mean_delta, { withSign: true }))],
    [labels.candidateMinusBaseline(labels.VERDICT.medianDelta), valueSpan("primary.median_delta", p.median_delta, metricValueText(key, p.median_delta, { withSign: true }))],
    [
      labels.candidateMinusBaseline(labels.VERDICT.interval95),
      el("span", {}, [
        valueSpan("primary.ci_low", p.ci_low, metricValueText(key, p.ci_low, { withSign: true })),
        el("span", {}, ` ${labels.VALUE_WORDS.to} `),
        valueSpan("primary.ci_high", p.ci_high, metricValueText(key, p.ci_high, { withSign: true })),
      ]),
    ],
    [labels.EXPERIMENT_SETUP.marginLabel, valueSpan("primary.equivalence_margin", p.equivalence_margin, labels.marginBand(thresholdText(key, p.equivalence_margin)))],
  ];
  const low = metricValueText(key, p.ci_low, { withSign: true });
  const high = metricValueText(key, p.ci_high, { withSign: true });
  return el("section", { "data-section": "primary" }, [
    heading(3, labels.VERDICT.primary),
    el("p", {}, [
      el("span", { class: "fl-mono", "data-field": "primary.metric", "data-metric": key }, metricSubject(key)),
      el("span", { class: "fl-muted", "data-role": "delta-caption" }, ` · ${labels.primaryDeltaCaption(p.direction)} · ${labels.DIRECTIONS[p.direction] ?? labels.DIRECTIONS.neutral}`),
    ]),
    el("dl", {}, rows.flatMap(([term, value]) => [el("dt", { class: "fl-small-label" }, term), el("dd", {}, value)])),
    strip,
    el("p", { "data-role": "outcome-sentence" }, labels.OUTCOME_SENTENCES[view.outcome]),
    el("p", { class: "fl-sr-only" }, labels.verdictStripSummary({ count: view.replications, metric: metricSubject(key), low, high, outcome: view.outcome })),
  ]);
}

function guardrailSection(view) {
  if (view.guardrails.length === 0) {
    return el("section", { "data-section": "guardrails" }, [heading(3, labels.VERDICT.guardrailsHeading), el("p", { class: "fl-muted" }, labels.VERDICT.noGuardrails)]);
  }
  const head = el("tr", {}, [labels.VERDICT.metric, labels.VERDICT.meanHarm, labels.VERDICT.maxHarm, labels.VERDICT.status].map((t) => el("th", { scope: "col" }, t)));
  const rows = view.guardrails.map((g) => {
    const words = labels.STATUS_WORDS.guardrail[g.status];
    const harm = g.harm === null ? absentSpan("harm", labels.ABSENT_REASONS.metricAbsentInSomeReplication) : valueSpan("harm", g.harm, metricValueText(g.metric, g.harm, { withSign: true }));
    const status = g.status === "NOT_EVALUABLE" ? [chip(words), el("span", { class: "fl-muted" }, labels.NOT_EVALUABLE_TEXT)] : [chip(words)];
    return el("tr", { "data-metric": g.metric, "data-status": g.status }, [
      el("th", { scope: "row", class: "fl-mono" }, metricSubject(g.metric)),
      el("td", {}, harm),
      el("td", {}, valueSpan("max_harm", g.max_harm, thresholdText(g.metric, g.max_harm))),
      el("td", {}, status),
    ]);
  });
  return el("section", { "data-section": "guardrails" }, [
    heading(3, labels.VERDICT.guardrailsHeading),
    el("div", { class: "fl-scroll" }, el("table", { class: "fl-table" }, [el("thead", {}, head), el("tbody", {}, rows)])),
  ]);
}

/** The guardrail bullet rows right under the guardrail table, in their own section so the table stays the only rows. */
function guardrailRowsSection(rails) {
  if (rails.length === 0) return null;
  return el("section", { "data-section": "guardrail-rows", "aria-label": labels.VERDICT.guardrailsHeading, style: "display: grid; gap: 12px" }, rails);
}

/** A suppressed row: its name and lead as text, then a link-like button that moves focus to the differences panel. */
function suppressedRow(name, onDifferences) {
  const link = el("button", { type: "button", class: "fl-button", "data-role": "differences-link", on: { click: () => onDifferences() } }, labels.REFERENCE.suppressedRowLink);
  return el("tr", { "data-metric": name, "data-suppressed": "true" }, [
    el("td", { colspan: "4", class: "fl-muted" }, [el("span", {}, `${name}: ${labels.REFERENCE.suppressedRowLead}`), link]),
  ]);
}

/**
 * The differences panel of a quoted reference panel (design §1.2, §7.2, D-05): what is shared, what differs on purpose,
 * and why each suppressed value is withheld. It takes focus from the suppressed rows' links.
 */
function differencesSection(view) {
  const d = labels.REFERENCE_DIFFERENCES;
  return el("section", { "data-section": "differences", tabindex: "-1", "aria-label": labels.REFERENCE.differencesPanel }, [
    heading(3, labels.REFERENCE.differencesPanel),
    el("p", {}, d.shared),
    el("p", { class: "fl-small-label" }, d.differentHeading),
    el("ul", { "data-role": "intentionally-different" }, d.different.map((text) => el("li", {}, text))),
    view.suppressed.length === 0 ? null : el("p", { class: "fl-small-label" }, d.withheldHeading),
    view.suppressed.length === 0 ? null : el("ul", { "data-role": "withheld" }, view.suppressed.map((name) => el("li", { "data-metric": name }, labels.withheldReason(name)))),
  ]);
}

function descriptiveSection(view, ui, rerender, { showRows = [], onDifferences = () => {} } = {}) {
  const head = el("tr", {}, [labels.VERDICT.metric, labels.VERDICT.baselineMean, labels.VERDICT.candidateMean, labels.VERDICT.meanDelta].map((t) => el("th", { scope: "col" }, t)));
  const open = ui.open.has("descriptives");
  const rows = view.descriptives.map((d, i) => {
    const row = el("tr", { "data-metric": d.metric }, [
      el("th", { scope: "row", class: "fl-mono" }, metricSubject(d.metric)),
      el("td", {}, valueSpan("baseline_mean", d.baseline_mean, metricValueText(d.metric, d.baseline_mean))),
      el("td", {}, valueSpan("candidate_mean", d.candidate_mean, metricValueText(d.metric, d.candidate_mean))),
      el("td", {}, valueSpan("mean_delta", d.mean_delta, metricValueText(d.metric, d.mean_delta, { withSign: true }))),
    ]);
    // A row a Learn moment asks the reader to look at stays visible in the preview.
    row.hidden = !open && i >= DESCRIPTIVE_PREVIEW_ROWS && !showRows.includes(d.metric);
    return row;
  });
  const suppressed = view.suppressed.map((name) => suppressedRow(name, onDifferences));
  const children = [heading(3, labels.VERDICT.descriptive)];
  if (view.descriptives.length === 0 && suppressed.length === 0) {
    children.push(el("p", { class: "fl-muted" }, labels.VERDICT.noDescriptives));
  } else {
    children.push(el("div", { class: "fl-scroll" }, el("table", { class: "fl-table" }, [el("thead", {}, head), el("tbody", {}, [...rows, ...suppressed])])));
  }
  if (view.descriptives.length > DESCRIPTIVE_PREVIEW_ROWS) {
    children.push(
      el("button", {
        type: "button",
        class: "fl-button",
        "aria-expanded": open ? "true" : "false",
        "data-focus-key": `${view.kind}-descriptives`,
        on: { click: () => { toggle(ui.open, "descriptives"); rerender(); } },
      }, open ? labels.VERDICT.fewerRows : labels.VERDICT.allRows),
    );
  }
  return el("section", { "data-section": "descriptives" }, children);
}

function limitationSection(view, ui, rerender) {
  const items = [...labels.VERDICT.limitationItems];
  if (view.outcome === "MIXED") items.push(labels.VERDICT.mixedNote);
  const listed = [heading(3, labels.VERDICT.limitations), el("ul", {}, items.map((t) => el("li", {}, t)))];
  // The §5.8 simplifications describe the teaching model; a quoted FleetLab panel ran in FleetLab's world (H-7).
  if (view.kind === "reference") return el("section", { "data-section": "limitations" }, listed);
  const open = ui.open.has("limitations");
  const all = el("ul", { "data-role": "all-limitations" }, Object.entries(labels.MODEL_LIMITS).filter(([k]) => k !== "heading").map(([, t]) => el("li", {}, t)));
  return el("section", { "data-section": "limitations" }, [
    ...listed,
    disclosure({
      key: `${view.kind}-limitations`,
      open,
      showText: labels.VERDICT.allLimitations,
      hideText: labels.VERDICT.fewerRows,
      target: all,
      onToggle: () => { toggle(ui.open, "limitations"); rerender(); },
    }),
    all,
  ]);
}

function toggle(set, key) {
  if (set.has(key)) set.delete(key);
  else set.add(key);
}

/** The invalid treatment: only the reason and the void-evidence text (design §7.2), plus NO_RECOMMENDATION (P-9). */
function invalidSection(view) {
  const reason = view.invalidityReason;
  const children = [
    heading(3, labels.VERDICT.invalidReasonHeading),
    el("p", {}, chip(labels.STATUS_WORDS.invalidityReason[reason])),
    el("p", { "data-role": "invalid-meaning" }, labels.INVALIDITY_TEXT[reason]),
  ];
  if (reason === "INVARIANT_VIOLATION" && typeof view.invalidityDetail === "string") {
    const detail = view.invalidityDetail.replace(/^seed [0-9]+: /, "");
    const id = violationId(detail);
    const rule = labels.INVARIANT_RULES[id];
    if (typeof rule === "string") children.push(el("p", { "data-role": "invariant" }, labels.invariantFailure({ rule, id })));
  }
  children.push(el("p", { "data-role": "void-evidence" }, labels.SEED_WATCH.voidEvidence));
  return el("section", { "data-section": "invalid" }, children);
}

/**
 * The verdict card of a teaching run or a quoted panel. Options: `ui` and `rerender` (disclosure state), `strip` (the
 * primary strip node or null), `actions` (nodes placed above the footer), `notices` (nodes under the chip), `panelId`,
 * `showRows` (descriptive metrics kept visible in the preview). A quoted panel carries the differences panel and no
 * teaching-run footer.
 */
export function renderVerdictCard(view, { ui = { open: new Set() }, rerender = () => {}, strip = null, rails = [], actions = [], notices = [], panelId = null, showRows = [] } = {}) {
  const valid = view.validity === "VALID";
  const reference = view.kind === "reference";
  const differences = reference ? differencesSection(view) : null;
  const onDifferences = () => {
    if (differences === null) return;
    differences.focus();
    if (typeof differences.scrollIntoView === "function") differences.scrollIntoView({ block: "nearest" });
  };
  const chipText = view.kind === "reference" ? PANEL_TEXT[panelId].chip() : labels.verdictHeader(view.replications);
  const header = [
    heading(2, view.kind === "reference" ? PANEL_TEXT[panelId].title() : labels.VERDICT.heading),
    el("p", { class: "fl-teaching-chip", "data-role": "teaching-chip" }, chipText),
    el("p", {}, [
      el("span", { class: "fl-chip-across", "data-role": "register" }, labels.acrossReplicationsChip(view.replications)),
      view.label === null ? null : el("span", { class: "fl-mono", "data-field": "label" }, ` ${view.label}`),
    ]),
    ...notices,
  ];
  const body = valid
    ? [gateChain(view), primarySection(view, strip), guardrailSection(view), guardrailRowsSection(rails), descriptiveSection(view, ui, rerender, { showRows, onDifferences }), limitationSection(view, ui, rerender)]
    : [gateChain(view), invalidSection(view), limitationSection(view, ui, rerender)];
  const footer = reference ? differences : el("p", { class: "fl-verdict__footer" }, labels.HONESTY.verdictFooter);
  return el(
    "article",
    { class: "fl-verdict", "data-kind": view.kind, "data-validity": view.validity, "data-panel": panelId, "aria-label": view.kind === "reference" ? PANEL_TEXT[panelId].title() : labels.VERDICT.heading },
    [...header, ...body, actions.length > 0 ? el("div", { "data-role": "actions", role: "group", "aria-label": labels.VERDICT.actions }, actions) : null, footer],
  );
}

/**
 * A quoted FleetLab reference panel (`fleet005` or `probe`) from REFERENCE_PANELS, with its §1.3 label and the differences
 * panel. `showRows` keeps named descriptive rows visible in the preview (a Learn moment that asks for one).
 */
export function renderReferencePanel(panelId, { onClose = null, ui, rerender, showRows = [] } = {}) {
  if (!REFERENCE_IDS.includes(panelId)) throw new RangeError(`unknown reference panel ${String(panelId)}`);
  const panel = REFERENCE_PANELS[panelId];
  const view = referenceView(panel);
  const notices = [
    el("p", {}, [el("span", { class: "fl-small-label" }, `${labels.REFERENCE.question} `), el("span", { "data-field": "question" }, panel.question)]),
    el("p", {}, [
      el("span", { class: "fl-small-label" }, `${labels.REFERENCE.axis} `),
      el("span", { class: "fl-mono", "data-field": "axis" }, labels.referenceAxisLine({ axis: panel.variation_axis, baseline: format.number(panel.baseline_value, 0), candidate: format.number(panel.candidate_value, 0) })),
    ]),
  ];
  const actions = onClose === null ? [] : [el("button", { type: "button", class: "fl-button", "data-focus-key": `close-${panelId}`, on: { click: onClose } }, labels.REFERENCE.close)];
  return renderVerdictCard(view, { ui, rerender, notices, actions, panelId, showRows });
}

// ---------------------------------------------------------------------------------------------------------------
// Setup sheet.

function field(labelText, control, notes = []) {
  return el("label", { class: "fl-field" }, [el("span", { class: "fl-small-label" }, labelText), control, ...notes]);
}

/** A select: `options` (`[value, text]` pairs) first, then one `optgroup` per entry of `groups` (`{label, options}`). */
function selectControl({ key, name, value, options, groups = [], onChange }) {
  const option = ([v, text]) => el("option", { value: v }, text);
  const select = el(
    "select",
    { "aria-label": name, "data-focus-key": key, on: { change: (event) => onChange(event.target.value) } },
    [...options.map(option), ...groups.map((g) => el("optgroup", { label: g.label }, g.options.map(option)))],
  );
  select.value = value ?? "";
  return select;
}

function textControl({ key, name, value, onInput, type = "text", tag = "input", disabled = false }) {
  const control = el(tag, { type: tag === "input" ? type : null, "aria-label": name, "data-focus-key": key, disabled, on: { input: (event) => onInput(event.target.value) } });
  control.value = value;
  return control;
}

/** Text of an axis value in its input: integers and names as typed, `off` for null, absent values empty. */
function axisValueInput(value) {
  if (value === null) return labels.VALUE_WORDS.off;
  if (value === undefined) return "";
  return String(value);
}

/** An axis value typed as text: a whole number, `off`, or a named value. */
export function parseAxisValue(text) {
  const trimmed = String(text).trim();
  if (/^-?[0-9]+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

function scopeControls(ref, baselineScenario, keyPrefix, onScope) {
  const row = metricRow(ref.metric);
  if (row === null) return [];
  const scope = ref.scope ?? {};
  const set = (patch) => {
    const next = { ...scope, ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    onScope(next);
  };
  const out = [];
  if (row.scopes.includes("area")) {
    out.push(field(labels.EXPERIMENT_SETUP.area, selectControl({
      key: `${keyPrefix}-area`,
      name: `${labels.EXPERIMENT_SETUP.scope} ${labels.EXPERIMENT_SETUP.area}`,
      value: scope.area ?? "",
      options: [["", labels.EXPERIMENT_SETUP.allAreas], ...Object.entries(labels.MAP.areas).map(([id, name]) => [id, name])],
      onChange: (v) => set({ area: v === "" ? undefined : v }),
    })));
  }
  if (row.scopes.includes("depot")) {
    const depots = baselineScenario === null ? [] : baselineScenario.depots.map((d) => d.id);
    const options = row.requires.includes("depot") ? [] : [["", labels.EXPERIMENT_SETUP.allDepots]];
    out.push(field(labels.EXPERIMENT_SETUP.depot, selectControl({
      key: `${keyPrefix}-depot`,
      name: `${labels.EXPERIMENT_SETUP.scope} ${labels.EXPERIMENT_SETUP.depot}`,
      value: scope.depot ?? "",
      options: [...options, ...depots.map((id) => [id, id])],
      onChange: (v) => set({ depot: v === "" ? undefined : v }),
    })));
  }
  if (row.scopes.includes("window") && baselineScenario !== null) {
    const starts = [];
    for (let t = baselineScenario.warmup_end_s; t < baselineScenario.window.end_s; t += 3600) starts.push(t);
    const w = scope.window;
    out.push(field(labels.EXPERIMENT_SETUP.windowStart, selectControl({
      key: `${keyPrefix}-window-start`,
      name: `${labels.EXPERIMENT_SETUP.scope} ${labels.EXPERIMENT_SETUP.windowStart}`,
      value: w ? String(w.start_s) : "",
      options: [["", labels.EXPERIMENT_SETUP.wholeSpan], ...starts.map((t) => [String(t), format.clock(t)])],
      onChange: (v) => {
        if (v === "") return set({ window: undefined });
        const start_s = Number(v);
        const end_s = w && w.end_s > start_s ? w.end_s : Math.min(start_s + 3600, baselineScenario.window.end_s);
        return set({ window: { start_s, end_s } });
      },
    })));
    if (w) {
      const ends = [];
      for (let t = w.start_s + 3600; t <= baselineScenario.window.end_s; t += 3600) ends.push(t);
      if (!ends.includes(w.end_s)) ends.push(w.end_s);
      out.push(field(labels.EXPERIMENT_SETUP.windowEnd, selectControl({
        key: `${keyPrefix}-window-end`,
        name: `${labels.EXPERIMENT_SETUP.scope} ${labels.EXPERIMENT_SETUP.windowEnd}`,
        value: String(w.end_s),
        options: ends.sort((a, b) => a - b).map((t) => [String(t), format.clock(t)]),
        onChange: (v) => set({ window: { start_s: w.start_s, end_s: Number(v) } }),
      })));
    }
  }
  if (Object.keys(scope).length > 0) out.push(el("span", { class: "fl-small-label", "data-role": "grammar-tag" }, labels.HONESTY.teachingModelGrammar));
  return out;
}

const PRIMARY_METRICS = () => METRICS.filter((m) => m.direction !== null && !m.descriptive_only);

function metricOptions() {
  return [["", labels.EXPERIMENT_SETUP.chooseMetric], ...PRIMARY_METRICS().map((m) => [m.name, m.name])];
}

/** A fresh reference for a newly chosen metric: its registry direction and an empty scope, threshold kept as text. */
function withMetric(ref, metric, textKey) {
  const row = metricRow(metric);
  if (row === null) return null;
  const scope = {};
  if (row.requires.includes("depot")) scope.depot = "SJ-1";
  const next = { metric, scope, direction: row.direction };
  const previous = ref?.[textKey];
  if (typeof previous === "string") next[textKey] = previous;
  return next;
}

/** A reference's threshold as typed text: the text if present, else its integer units shown in the metric's unit. */
function thresholdInput(ref, textKey, unitsKey) {
  if (ref === null || ref === undefined) return "";
  if (typeof ref[textKey] === "string") return ref[textKey];
  return unitsAsText(ref.metric, ref[unitsKey]);
}

/** Copy of a reference with its threshold as typed text (the integer units dropped). */
function withThresholdText(ref, textKey, unitsKey, text) {
  const next = { ...ref, [textKey]: text };
  delete next[unitsKey];
  return next;
}

/** Every failing check's four-slot explanation, under the checks list. */
function checkErrors(errors) {
  if (errors.length === 0) return null;
  return el("ul", { class: "fl-error", "data-role": "check-errors" }, errors.map((e) =>
    el("li", {}, [
      el("span", { class: "fl-error__slot" }, `${labels.INVALID_COMBINATION.what}: ${e.what}`),
      el("span", { class: "fl-error__slot" }, ` ${labels.INVALID_COMBINATION.why}: ${e.why}`),
      el("span", { class: "fl-error__slot" }, ` ${labels.INVALID_COMBINATION.fix}: ${e.fix}`),
    ]),
  ));
}

function questionBlock(draft, dispatch) {
  return [
    textControl({
      key: "question",
      tag: "textarea",
      name: labels.EXPERIMENT_SETUP.blocks.question,
      value: draft.question,
      onInput: (v) => dispatch({ type: "experiment/draft", patch: { question: v } }),
    }),
  ];
}

function scenarioBlock(state, ui, rerender) {
  const draft = state.experiment.draft;
  // Differences from the preset the baseline was taken from, even when Sandbox has since moved to another preset.
  const preset = presetById(draft.baselineSource?.presetId ?? state.presetId);
  if (draft.baselineScenario === null || preset === null) {
    return [el("p", { class: "fl-absent" }, labels.absentValue(labels.ABSENT_REASONS.noBaselineScenario))];
  }
  const differences = describeDifferences(preset.scenario, draft.baselineScenario);
  const list = el("ul", { "data-role": "differences" }, differences.length === 0
    ? [el("li", { class: "fl-muted" }, labels.EXPERIMENT_SETUP.noDifferences)]
    : differences.map((d) => el("li", { "data-knob": d.knob }, differenceText(d))));
  return [
    el("p", { "data-role": "baseline-line" }, labels.baselineLine({ presetName: preset.title, changes: differences.length })),
    disclosure({
      key: "differences",
      open: ui.open.has("differences"),
      showText: labels.EXPERIMENT_SETUP.viewDifferences,
      hideText: labels.EXPERIMENT_SETUP.hideDifferences,
      target: list,
      onToggle: () => { toggle(ui.open, "differences"); rerender(); },
    }),
    list,
  ];
}

function axisBlock(draft, dispatch) {
  const plainAxis = draft.axis !== null && typeof draft.axis === "object" && !Array.isArray(draft.axis);
  const axis = plainAxis ? draft.axis : { id: "", baseline: undefined, candidate: undefined };
  const patchAxis = (patch) => dispatch({ type: "experiment/draft", patch: { axis: { id: axis.id, baseline: axis.baseline, candidate: axis.candidate, ...patch } } });
  let unit = null;
  try {
    const parsed = parseAxis(axis.id);
    const knob = KNOBS.find((k) => k.id === parsed.knob);
    unit = knob && parsed.valueType !== "enum" ? knob.engineUnit : null;
  } catch (error) {
    if (!(error instanceof AxisError)) throw error;
  }
  const valueField = (arm) => {
    const value = axis[arm];
    const layout = value !== null && typeof value === "object";
    const control = textControl({
      key: `axis-${arm}`,
      name: labels.EXPERIMENT_SETUP[arm],
      value: layout ? knobValueText(axis.id, value) : axisValueInput(value),
      disabled: layout,
      onInput: (v) => patchAxis({ [arm]: parseAxisValue(v) }),
    });
    const notes = [];
    if (layout) notes.push(el("span", { class: "fl-field__note" }, labels.EXPERIMENT_SETUP.layoutValue));
    else if (unit !== null) notes.push(el("span", { class: "fl-small-label" }, `${labels.EXPERIMENT_SETUP.engineUnit}: ${unit}`));
    return field(labels.EXPERIMENT_SETUP[arm], control, notes);
  };
  const notes = [];
  if (isTeachingModelAxis(axis.id)) notes.push(el("p", { class: "fl-small-label", "data-role": "axis-tag" }, labels.HONESTY.axisFleetLabCannotRun));
  // The note names the labelled null check itself (model isNullCheckDraft), not any draft whose axis happens to match.
  if (isNullCheckDraft(specDraftOf(draft))) {
    notes.push(el("p", { class: "fl-muted", "data-role": "null-check" }, labels.EXPERIMENT_SETUP.nullCheck));
  }
  return [
    field(labels.EXPERIMENT_SETUP.axis, textControl({ key: "axis-id", name: labels.EXPERIMENT_SETUP.axisId, value: axis.id, onInput: (v) => patchAxis({ id: v.trim() }) })),
    ...notes,
    valueField("baseline"),
    valueField("candidate"),
  ];
}

function referenceFields({ ref, keyPrefix, textKey, unitsKey, thresholdName, baselineScenario, onChange, extraNotes = [] }) {
  const row = ref ? metricRow(ref.metric) : null;
  const controls = [
    field(labels.EXPERIMENT_SETUP.metric, selectControl({
      key: `${keyPrefix}-metric`,
      name: `${thresholdName} ${labels.EXPERIMENT_SETUP.metric}`,
      value: ref?.metric ?? "",
      options: metricOptions(),
      onChange: (v) => onChange(v === "" ? null : withMetric(ref, v, textKey)),
    })),
  ];
  if (row !== null) {
    controls.push(el("p", { class: "fl-muted", "data-role": "direction" }, labels.directionUnit({ direction: labels.DIRECTIONS[row.direction] ?? labels.DIRECTIONS.neutral, unit: unitWord(row) })));
    controls.push(...scopeControls(ref, baselineScenario, keyPrefix, (scope) => onChange({ ...ref, scope })));
    controls.push(field(thresholdName, textControl({
      key: `${keyPrefix}-threshold`,
      name: thresholdName,
      value: thresholdInput(ref, textKey, unitsKey),
      onInput: (v) => onChange(withThresholdText(ref, textKey, unitsKey, v.trim())),
    }), [el("span", { class: "fl-small-label" }, textKey === "margin_text" ? labels.marginUnit(unitWord(row)) : unitWord(row)), ...extraNotes(row)]));
  }
  return controls;
}

function primaryBlock(draft, dispatch) {
  return [
    ...referenceFields({
      ref: draft.primary,
      keyPrefix: "primary",
      textKey: "margin_text",
      unitsKey: "margin_units",
      thresholdName: labels.EXPERIMENT_SETUP.marginLabel,
      baselineScenario: draft.baselineScenario,
      onChange: (primary) => dispatch({ type: "experiment/draft", patch: { primary } }),
      extraNotes: () => [el("span", { class: "fl-field__note", "data-role": "margin-hint" }, `"${labels.EXPERIMENT_SETUP.marginHint}"`)],
    }),
  ];
}

function guardrailsBlock(draft, dispatch) {
  const rows = draft.guardrails.map((g, i) =>
    el("fieldset", { "data-guardrail": String(i) }, [
      el("legend", { class: "fl-small-label" }, labels.guardrailNumber(i + 1)),
      ...referenceFields({
        ref: g,
        keyPrefix: `guardrail-${String(i)}`,
        textKey: "max_harm_text",
        unitsKey: "max_harm_units",
        thresholdName: labels.EXPERIMENT_SETUP.maxHarm,
        baselineScenario: draft.baselineScenario,
        onChange: (next) => {
          if (next === null) return;
          dispatch({ type: "experiment/guardrailUpdate", index: i, patch: { ...next, ...(next.max_harm_text === undefined ? {} : { max_harm_units: undefined }), ...(next.scope ? {} : { scope: {} }) } });
        },
        extraNotes: (row) => [el("span", { class: "fl-small-label", "data-role": "availability" }, row.absent_when === "never" ? labels.EXPERIMENT_SETUP.alwaysAvailable : labels.EXPERIMENT_SETUP.sometimesAbsent)],
      }),
      el("button", { type: "button", class: "fl-button", "data-focus-key": `guardrail-${String(i)}-remove`, on: { click: () => dispatch({ type: "experiment/guardrailRemove", index: i }) } }, labels.removeGuardrailNumber(i + 1)),
    ]),
  );
  return [
    rows.length === 0 ? el("p", { class: "fl-muted" }, labels.EXPERIMENT_SETUP.guardrailsNone) : null,
    ...rows,
    el("button", {
      type: "button",
      class: "fl-button",
      "data-focus-key": "guardrail-add",
      on: { click: () => dispatch({ type: "experiment/guardrailAdd", guardrail: { metric: "unserved.fraction", scope: {}, direction: "lower_is_better", max_harm_text: "0.02" } }) },
    }, labels.EXPERIMENT_SETUP.addGuardrail),
  ];
}

/** The run estimate line and, above 60 s, the fewer-seeds advice (design §7.2 seeds block, §7.7). */
function estimateLines(draft, { msPerSeed, phone }) {
  const estimate = runEstimate({ seedCount: draft.seedCount, msPerSeed, phone });
  if (estimate === null) {
    return [el("p", { class: "fl-absent", "data-role": "run-estimate" }, labels.absentValue(labels.ABSENT_REASONS.seedCountNotValid))];
  }
  const about = labels.aboutDuration(format.seconds(estimate.seconds));
  const lines = [el("p", { class: "fl-muted", "data-role": "run-estimate" }, about)];
  if (estimate.fewerSeeds !== null) {
    const widening = labels.timesAsWide(format.number(Math.sqrt(draft.seedCount / estimate.fewerSeeds), 1));
    lines.push(el("p", { "data-role": "slow-advice" }, labels.slowExperimentAdvice({ estimate: about, seeds: draft.seedCount, fewerSeeds: estimate.fewerSeeds, widening })));
  }
  return lines;
}

function seedsBlock(draft, dispatch, estimateOptions) {
  const numberPatch = (key) => (v) => dispatch({ type: "experiment/draft", patch: { [key]: /^[0-9]+$/.test(v.trim()) ? Number(v.trim()) : v } });
  const seeds = specDraftOf(draft).seeds;
  return [
    field(labels.EXPERIMENT_SETUP.pairedReplications, textControl({ key: "seed-count", type: "number", name: labels.EXPERIMENT_SETUP.pairedReplications, value: String(draft.seedCount), onInput: numberPatch("seedCount") })),
    seeds !== null && seeds.length > 0
      ? el("p", { class: "fl-mono", "data-role": "seed-set" }, labels.seedSetText({ seedSet: draft.seedSet, firstSeed: seeds[0], lastSeed: seeds[seeds.length - 1] }))
      : null,
    field(labels.EXPERIMENT_SETUP.resamples, textControl({ key: "resamples", type: "number", name: labels.EXPERIMENT_SETUP.resamples, value: String(draft.resamples), onInput: numberPatch("resamples") })),
    el("p", { class: "fl-muted" }, labels.EXPERIMENT_SETUP.frozenWhenYouRun),
    ...estimateLines(draft, estimateOptions),
  ];
}

/** "Start from a preset" (design §10.1): choosing one loads that preset's declared experiment into the sheet. */
function presetChooser(state, dispatch) {
  const source = state.experiment.draft.baselineSource?.presetId;
  const value = CHOOSER_PRESET_IDS.includes(source) ? source : "";
  const option = (id) => [id, labels.presetOption({ id, title: presetById(id).title })];
  return el("div", { "data-role": "preset-chooser" }, field(labels.EXPERIMENT_SETUP.startFromPreset, selectControl({
    key: "preset",
    name: labels.EXPERIMENT_SETUP.startFromPreset,
    value,
    options: [["", labels.EXPERIMENT_SETUP.choosePreset]],
    groups: CHOOSER_GROUPS.map((g) => ({ label: g.label, options: g.ids.map(option) })),
    onChange: (v) => {
      if (v !== "") startFromPreset(dispatch, v);
    },
  })));
}

/** The casebook preset the draft's baseline came from (else the Sandbox preset), or null when it is not one. */
function situationPreset(state) {
  const preset = presetById(state.experiment.draft.baselineSource?.presetId ?? state.presetId);
  return preset !== null && preset.kind === "ops" ? preset : null;
}

/** One proxy entry of a casebook preset: what it stands for, how it is set and what it misses, each under its label. */
function proxyEntry(entry, index) {
  const s = labels.SITUATION;
  const parts = [["standsFor", s.standsFor], ["setAs", s.setAs], ["misses", s.misses]];
  return el("li", { "data-proxy": String(index) }, el("dl", { class: "fl-situation__proxy" }, parts.flatMap(([key, name]) => [
    el("dt", { class: "fl-small-label" }, name),
    el("dd", { "data-part": key }, entry[key]),
  ])));
}

/**
 * Whether a draft is still the casebook preset's spec: the same scenario, axis, primary, guardrails, seeds and resamples.
 * The question is left out, because the proxy and watch lines do not depend on it. `ok` is the setup check result, so
 * an invalid draft never reaches freezeSpec and counts as edited.
 */
function draftMatchesPreset(draft, preset, ok) {
  if (!ok) return false;
  const spec = { ...specDraftOf(draft), question: preset.experiment.question };
  return freezeSpec(spec).digest === freezeSpec(preset.experiment).digest;
}

/**
 * The SITUATION block of a casebook preset (design section 4.4): the lead, the situation, the proxy, what lies outside the
 * model and what to watch. All of it is the preset's copy; nothing here names a verdict. Under an edited draft only the
 * lead and the situation stay, with one line saying the setup no longer matches the case.
 */
function situationBlock(preset, matches) {
  const s = labels.SITUATION;
  const head = [
    el("p", { class: "fl-muted", "data-role": "situation-lead" }, s.lead),
    el("p", { "data-role": "situation" }, preset.situation),
  ];
  if (!matches) return [...head, el("p", { class: "fl-muted", "data-role": "situation-edited" }, labels.situationEdited({ id: preset.id }))];
  return [
    ...head,
    heading(3, s.proxyHeading),
    el("ul", { class: "fl-list-plain", "data-role": "proxy" }, preset.proxy.map(proxyEntry)),
    heading(3, s.outsideHeading),
    el("ul", { "data-role": "outside-model" }, preset.outsideModel.map((text) => el("li", {}, text))),
    heading(3, s.watchHeading),
    el("p", { "data-role": "watch" }, preset.watch),
  ];
}

/**
 * The setup sheet (design §7.2): a casebook preset's SITUATION block, the six numbered blocks, the checks and Freeze and
 * run. `msPerSeed` is the last finished experiment's time per seed (null before any), for the run estimate.
 */
export function renderSetup(state, { dispatch, ui, rerender, onFreeze, phone = false, msPerSeed = null }) {
  const draft = state.experiment.draft;
  const { ok, checks, errors } = setupChecks(draft);
  const running = state.experiment.status === "running";
  const situation = situationPreset(state);
  // The SITUATION block exists only for a casebook preset (absent, not hidden, for every other one).
  const blocks = [
    situation === null ? null : ["situation", () => situationBlock(situation, draftMatchesPreset(draft, situation, ok))],
    ["question", () => questionBlock(draft, dispatch)],
    ["scenario", () => scenarioBlock(state, ui, rerender)],
    ["oneChange", () => axisBlock(draft, dispatch)],
    ["primary", () => primaryBlock(draft, dispatch)],
    ["guardrails", () => guardrailsBlock(draft, dispatch)],
    ["seeds", () => seedsBlock(draft, dispatch, { msPerSeed, phone })],
  ].filter((block) => block !== null);
  if (!ui.accordionReady) {
    ui.accordionReady = true;
    // Every block starts open on a desktop, the SITUATION block included for when a casebook preset is chosen later;
    // on a phone only the question does.
    ui.blocksOpen = new Set(phone ? ["question"] : Object.keys(labels.EXPERIMENT_SETUP.blocks));
  }
  const sections = blocks.map(([id, build]) => {
    const details = el("details", {
      "data-block": id,
      open: ui.blocksOpen.has(id),
      on: {
        toggle: (event) => {
          if (event.target.hasAttribute("open")) ui.blocksOpen.add(id);
          else ui.blocksOpen.delete(id);
        },
      },
    }, [el("summary", { class: "fl-title", "data-focus-key": `block-${id}` }, labels.EXPERIMENT_SETUP.blocks[id]), ...build()]);
    return details;
  });
  const checkList = el("ul", { "data-role": "checks" }, checks.map((c) =>
    el("li", { "data-check": c.id, "data-passes": c.passes ? "true" : "false", "aria-label": labels.checkState({ check: c.label, passes: c.passes }) }, [
      el("span", { "aria-hidden": "true" }, c.passes ? labels.EXPERIMENT_SETUP.checkGlyphs.passes : labels.EXPERIMENT_SETUP.checkGlyphs.fails),
      el("span", {}, ` ${c.label}`),
    ]),
  ));
  const freeze = el("button", {
    type: "button",
    class: "fl-button fl-button--primary",
    "data-role": "freeze",
    "data-focus-key": "freeze",
    disabled: !ok || running,
    on: { click: () => onFreeze() },
  }, labels.EXPERIMENT_SETUP.freezeAndRun);
  return el("section", { class: "fl-panel", "data-role": "setup", "aria-label": labels.EXPERIMENT_SETUP.heading }, [
    el("header", {}, [heading(2, labels.EXPERIMENT_SETUP.heading), el("p", { class: "fl-teaching-chip" }, labels.HONESTY.verdictChip)]),
    presetChooser(state, dispatch),
    ...sections,
    el("section", { "data-role": "checks-section" }, [heading(3, labels.EXPERIMENT_SETUP.checksHeading), checkList, checkErrors(errors)]),
    freeze,
    ok ? null : el("p", { class: "fl-muted", "data-role": "freeze-disabled" }, labels.EXPERIMENT_SETUP.freezeDisabled),
  ]);
}

// ---------------------------------------------------------------------------------------------------------------
// Session log and freeze notice.

/** The session log: every run with its seed set, spec label, outcome, recommendation and engine path. */
export function renderSessionLog(entries) {
  return el("section", { class: "fl-panel", "data-role": "session-log", "aria-label": labels.SESSION_LOG.heading }, [
    heading(2, labels.SESSION_LOG.heading),
    entries.length === 0
      ? el("p", { class: "fl-muted" }, labels.SESSION_LOG.empty)
      : el("ol", { class: "fl-list-plain" }, entries.map((entry, i) =>
        el("li", { class: "fl-mono", "data-entry": String(i), "data-seed-set": String(entry.seedSet) }, labels.sessionLogEntry({
          seedSet: entry.seedSet,
          firstSeed: entry.seeds[0],
          lastSeed: entry.seeds[entry.seeds.length - 1],
          label: entry.label,
          validity: entry.validity,
          outcome: entry.outcome,
          recommendation: entry.recommendation,
          engine: entry.engine,
        })),
      )),
  ]);
}

/** The freeze rule notices of a finished verdict (design §7.1): the frozen time, knobs changed since, out of date. */
function freezeNotices(state) {
  const ex = state.experiment;
  if (ex.frozen === null) return [];
  const out = [el("p", { class: "fl-muted", "data-role": "freeze-notice" }, labels.freezeNotice({ frozenAt: ex.frozen.frozenAt, changedKnobs: sandboxChangesSinceFreeze(state) }))];
  if (ex.verdictStale) {
    out.push(el("p", { "data-role": "verdict-stale" }, labels.FREEZE.verdictStale));
    out.push(el("p", { class: "fl-muted" }, labels.FREEZE.nothingRerunsSilently));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The view.

/** charts.js's verdict group for a valid verdict and its frozen spec, built once per verdict and spec and then reused. */
const verdictGroups = new WeakMap();
function chartsVerdictGroup(verdict, spec) {
  const cached = verdictGroups.get(verdict);
  if (cached !== undefined && cached.spec === spec) return cached.group;
  const group = verdictCharts({ verdict, declarations: verdictDeclarations(spec), seeds: spec.seeds.slice() });
  verdictGroups.set(verdict, { spec, group });
  return group;
}

/** charts.js's paired-delta strip for a valid verdict's primary, with its margin band; null for void evidence. */
export function chartsPrimaryStrip({ verdict, spec }) {
  if (verdict.validity !== "VALID") return null;
  return chartsVerdictGroup(verdict, spec).charts[0].node;
}

/**
 * charts.js's guardrail bullet rows (design §7.5, §7.2 verdict): one figure per guardrail in declared order, a mean harm
 * bar against a max harm tick; an empty list for void evidence.
 */
export function chartsGuardrailRows({ verdict, spec }) {
  if (verdict.validity !== "VALID") return [];
  return chartsVerdictGroup(verdict, spec).charts.slice(1).map((chart) => chart.node);
}

/** The page's media query, called on its window (an unbound matchMedia throws in browsers); null without one. */
function defaultMatchMedia(query) {
  return typeof globalThis.matchMedia === "function" ? globalThis.matchMedia(query) : null;
}

/** Milliseconds on the page's monotonic clock, for the run estimate. */
function monotonicMs() {
  return typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now();
}

/** The default session clock `14:02` from the page's wall clock. */
function wallClock() {
  const d = new Date();
  return format.sessionClock(d.getHours(), d.getMinutes());
}

/**
 * Mounts Experiment mode in `container`. Options: `store` (store.js), `host` (runtime host with `runExperiment`, `cancel`
 * and `path`), `copy(text)` (clipboard, may return a promise), `now()` (session clock text), `primaryStrip({view, verdict,
 * spec})` (the primary strip node; charts.js by default), `guardrailRows({view, verdict, spec})` (one bullet row node per
 * guardrail; charts.js by default), `onWatchSeed(seed)` (opens that seed's world), `matchMedia` (phone accordion),
 * `clock()` (milliseconds, for the run estimate). Returns `{render, freezeAndRun, useAnotherSeedSet, copySummary, destroy}`.
 */
export function mountExperiment(container, { store, host, copy = null, now = wallClock, clock = monotonicMs, primaryStrip = chartsPrimaryStrip, guardrailRows = chartsGuardrailRows, onWatchSeed = null, matchMedia = defaultMatchMedia } = {}) {
  if (!store || typeof store.dispatch !== "function") throw new TypeError("mountExperiment needs a store");
  const ui = { open: new Set(), copyStatus: null, accordionReady: false, blocksOpen: new Set(), pending: null, msPerSeed: null };
  const dispatch = (action) => store.dispatch(action);
  let counter = 0;

  const phone = () => typeof matchMedia === "function" && matchMedia(PHONE_QUERY)?.matches === true;

  async function freezeAndRun() {
    const state = store.getState();
    let frozen;
    try {
      frozen = freezeSpec(specDraftOf(state.experiment.draft));
    } catch (error) {
      if (error instanceof SpecError) return null;
      throw error;
    }
    return runFrozen(frozen);
  }

  /** Records `frozen` ({spec, digest, label}) as the frozen spec and runs it once; the verdict is kept for its digest only. */
  async function runFrozen(frozen) {
    counter += 1;
    const id = `experiment-${String(counter)}`;
    dispatch({ type: "experiment/freeze", spec: frozen.spec, digest: frozen.digest, label: frozen.label, frozenAt: now(), id });
    if (!host || typeof host.runExperiment !== "function") return null;
    const started = clock();
    const promise = host.runExperiment({ spec: frozen.spec }, { onProgress: (p) => dispatch({ type: "experiment/progress", id, done: p.done, total: p.total, label: p.label }) });
    ui.pending = promise;
    try {
      const payload = await promise;
      const elapsed = clock() - started;
      if (Number.isFinite(elapsed) && elapsed >= 0 && frozen.spec.seeds.length > 0) ui.msPerSeed = elapsed / frozen.spec.seeds.length;
      if (ENGINE_PATHS.includes(host.path) && store.getState().engine.path !== host.path) dispatch({ type: "engine/path", path: host.path });
      dispatch({ type: "experiment/verdict", id, payload });
      return payload;
    } catch (error) {
      if (error && error.name === "AbortError") dispatch({ type: "experiment/cancelled", id });
      else dispatch({ type: "experiment/error", id, message: String(error && error.message) });
      return null;
    } finally {
      if (ui.pending === promise) ui.pending = null;
    }
  }

  /**
   * "Use another seed set" (design §6): the frozen spec moved to seed set k + 1 becomes a new frozen spec, never the draft.
   * It does nothing while a run is going or the setup is out of date; otherwise the draft's seed set follows the new spec.
   */
  async function useAnotherSeedSet() {
    const ex = store.getState().experiment;
    if (ex.frozen === null || ex.status === "running" || ex.verdictStale) return null;
    const spec = ex.frozen.spec;
    const k = spec.seed_set + 1;
    let frozen;
    try {
      frozen = freezeSpec({ ...spec, seed_set: k, seeds: seedSet(k, spec.seeds.length) });
    } catch (error) {
      if (error instanceof SpecError) return null;
      throw error;
    }
    dispatch({ type: "experiment/nextSeedSet" });
    return runFrozen(frozen);
  }

  async function copySummary() {
    const ex = store.getState().experiment;
    if (ex.verdict === null || ex.frozen === null || typeof copy !== "function") return null;
    const spec = ex.frozen.spec;
    const summary = resultSummary(ex.verdict, {
      specDigest: ex.frozen.digest,
      modelVersion: spec.model_version,
      question: spec.question,
      axis: spec.axis.id,
      baselineValue: spec.axis.baseline,
      candidateValue: spec.axis.candidate,
      seedSet: { set: spec.seed_set, seeds: spec.seeds.slice() },
    });
    const text = summaryText(summary);
    try {
      await copy(text);
      ui.copyStatus = "copied";
    } catch {
      ui.copyStatus = "failed";
    }
    render();
    return text;
  }

  function watch(type) {
    dispatch({ type });
    const seed = store.getState().experiment.selectedSeed;
    if (seed !== null && typeof onWatchSeed === "function") onWatchSeed(seed);
  }

  function verdictActions(state, view) {
    const ex = state.experiment;
    const actions = [];
    if (view.validity === "VALID") {
      actions.push(el("button", { type: "button", class: "fl-button fl-button--primary", "data-role": "watch-median", "data-focus-key": "watch-median", on: { click: () => watch("experiment/watchMedian") } }, labels.SEED_WATCH.watchMedian));
      actions.push(el("button", { type: "button", class: "fl-button", "data-role": "watch-largest", "data-focus-key": "watch-largest", on: { click: () => watch("experiment/watchLargest") } }, labels.SEED_WATCH.watchLargest));
    }
    actions.push(el("button", { type: "button", class: "fl-button", "data-role": "back-to-setup", "data-focus-key": "back-to-setup", on: { click: () => focusKey("question") } }, labels.SEED_WATCH.backToSetup));
    actions.push(el("button", { type: "button", class: "fl-button", "data-role": "another-seed-set", "data-focus-key": "another-seed-set", disabled: ex.status === "running" || ex.verdictStale, on: { click: () => useAnotherSeedSet() } }, labels.SESSION_LOG.useAnotherSeedSet));
    if (ex.verdictStale) actions.push(el("p", { class: "fl-muted", "data-role": "another-seed-set-off" }, labels.SESSION_LOG.anotherSeedSetOff));
    actions.push(el("button", { type: "button", class: "fl-button", "data-role": "copy-summary", "data-focus-key": "copy-summary", disabled: typeof copy !== "function", on: { click: () => copySummary() } }, labels.VERDICT.copySummary));
    if (ex.selectedSeed !== null && view.validity === "VALID") {
      const seeds = ex.frozen.spec.seeds;
      actions.push(el("p", { "data-role": "now-watching" }, labels.nowWatching({ seed: ex.selectedSeed, index: seeds.indexOf(ex.selectedSeed) + 1, total: seeds.length })));
    }
    if (ex.largestWarning) actions.push(el("p", { "data-role": "largest-warning" }, labels.SEED_WATCH.largestWarning));
    if (ui.copyStatus !== null) actions.push(el("p", { role: "status", "data-role": "copy-status" }, ui.copyStatus === "copied" ? labels.VERDICT.copied : labels.VERDICT.copyFailed));
    return actions;
  }

  function progressView(state) {
    const ex = state.experiment;
    const children = [heading(2, labels.VERDICT.running), el("p", { class: "fl-teaching-chip" }, labels.HONESTY.verdictChip)];
    if (ex.progress !== null) {
      children.push(el("p", { role: "status", "data-role": "progress" }, labels.experimentRunProgress(ex.progress.done, ex.progress.total)));
    }
    children.push(el("button", {
      type: "button",
      class: "fl-button",
      "data-role": "cancel",
      on: { click: () => { if (host && ui.pending && ui.pending.id !== undefined) host.cancel(ui.pending.id); } },
    }, labels.STATES.cancel));
    return el("section", { class: "fl-panel", "data-role": "running" }, children);
  }

  function resultView(state) {
    const ex = state.experiment;
    if (ex.status === "running") return progressView(state);
    if (ex.status === "error") {
      return el("section", { class: "fl-panel fl-error", "data-role": "engine-stopped" }, [
        el("p", {}, labels.STATES.engineStopped),
        el("button", { type: "button", class: "fl-button", "data-role": "retry", on: { click: () => freezeAndRun() } }, labels.STATES.retry),
      ]);
    }
    if (ex.status === "cancelled") return el("p", { class: "fl-muted", "data-role": "cancelled" }, labels.STATES.cancelled);
    if (ex.verdict === null || ex.frozen === null) return null;
    const payload = { verdict: ex.verdict };
    const view = verdictView(payload, ex.frozen);
    const strip = view.validity === "VALID" && typeof primaryStrip === "function" ? primaryStrip({ view, verdict: ex.verdict, spec: ex.frozen.spec }) : null;
    const rails = view.validity === "VALID" && typeof guardrailRows === "function" ? (guardrailRows({ view, verdict: ex.verdict, spec: ex.frozen.spec }) ?? []) : [];
    const card = renderVerdictCard(view, { ui, rerender: render, strip, rails, notices: freezeNotices(state), actions: verdictActions(state, view) });
    if (ex.verdictStale) card.setAttribute("class", "fl-verdict fl-stale");
    return card;
  }

  function referenceList(state) {
    const buttons = REFERENCE_IDS.map((id) =>
      el("button", {
        type: "button",
        class: "fl-button",
        "data-reference": id,
        "aria-pressed": state.reference === id ? "true" : "false",
        on: { click: () => dispatch(state.reference === id ? { type: "reference/close" } : { type: "reference/open", id }) },
      }, labels.openReferencePanel(PANEL_TEXT[id].title())),
    );
    const panel = REFERENCE_IDS.includes(state.reference)
      ? renderReferencePanel(state.reference, { onClose: () => dispatch({ type: "reference/close" }), ui, rerender: render })
      : null;
    return el("section", { class: "fl-panel", "data-role": "references", "aria-label": labels.REFERENCE.heading }, [heading(2, labels.REFERENCE.heading), el("div", { role: "group" }, buttons), panel]);
  }

  function focusKey(key) {
    const target = container.querySelector(`[data-focus-key="${key}"]`);
    if (target && typeof target.focus === "function") target.focus();
  }

  function render() {
    const state = store.getState();
    const doc = container.ownerDocument ?? globalThis.document;
    const active = doc ? doc.activeElement : null;
    const activeKey = active && container.contains(active) ? active.getAttribute("data-focus-key") : null;
    const selection = active && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;
    container.replaceChildren(
      renderSetup(state, { dispatch, ui, rerender: render, onFreeze: () => freezeAndRun(), phone: phone(), msPerSeed: ui.msPerSeed }),
      resultView(state) ?? el("p", { class: "fl-muted", "data-role": "no-verdict" }, labels.SESSION_LOG.empty),
      renderSessionLog(state.experiment.sessionLog),
      referenceList(state),
    );
    if (activeKey !== null) {
      const again = container.querySelector(`[data-focus-key="${activeKey}"]`);
      if (again && typeof again.focus === "function") {
        again.focus();
        if (selection !== null && typeof again.setSelectionRange === "function") again.setSelectionRange(selection[0], selection[1]);
      }
    }
  }

  // A copy notice belongs to one verdict; a new verdict (or none) clears it.
  let shownVerdict = store.getState().experiment.verdict;
  const unsubscribe = store.subscribe((state) => {
    if (state.experiment.verdict !== shownVerdict) {
      shownVerdict = state.experiment.verdict;
      ui.copyStatus = null;
    }
    render();
  });
  render();
  return { render, freezeAndRun, useAnotherSeedSet, copySummary, destroy: () => unsubscribe() };
}
