// The Analytics chapter's own content (demo plan sections 1.1 beats 2.1 and 2.2, 4.7 and 5): the metric registry in
// two registers, the two charts by hour at width, and the verdict readout.
//
// Nothing here computes a metric a second way. Every value is one a run already produced: the replay's own summary for
// THIS REPLAY, and the summaries of every replication for ACROSS, each formatted by the metric's registered unit. The
// two registers are two columns under two chips and never share a value (H-10); a value the run could not produce
// reads its own reason and never a zero or a blank (H-5).
//
// The readout is the verdict card's own builders (experiment.js `renderVerdictReadout`), so the walkthrough and
// Experiment cannot disagree on a word or a number; this module only chooses which verdict to compose and hands the
// strip and the guardrail rows charts.js drew for it.

import { metricRow } from "../model/metrics.js";
import { metricByHourChart, metricWords } from "./charts.js";
import { el } from "./dom.js";
import { chartsGuardrailRows, chartsPrimaryStrip, renderVerdictReadout, verdictView } from "./experiment.js";
import * as format from "./format.js";
import * as labels from "./labels.js";

const { PRESENT } = labels;

/**
 * The eight registry rows the chapter opens with: what the world asked of the fleet, what the riders got, the
 * population the wait percentiles count, how much of the fleet stood free, and the depot resource the frozen spec
 * watches. Every one is unscoped, so every replication carries it and both registers can be read side by side;
 * `all rows` opens the rest, depot scopes included.
 */
export const REGISTRY_PREVIEW = Object.freeze([
  "requests.total",
  "unserved.fraction",
  "wait.p50_s",
  "wait.p90_s",
  "wait.population_n",
  "fleet.available_fraction",
  "depot.bay_wait_p90_s",
  "depot.turnaround_p90_s",
]);

/** The registered metric name inside a metric key: `depot.parking_peak_fraction{depot=SF-2}` is that metric. */
const baseName = (key) => key.split("{")[0];

/**
 * How a metric's values read: seconds as minutes, fractions as a percentage, everything else as a count. A count taken
 * across replications is a percentile, which can land between two whole counts, so the spread keeps one decimal there
 * (the panel across replications reads its counts the same way).
 */
function formatterOf(name, { across = false } = {}) {
  const row = metricRow(name);
  if (row.unit === "s") return format.minutes;
  if (row.unit === "fraction") return (v) => format.percent(v, 1);
  return across ? (v) => format.number(v, Number.isInteger(v) ? 0 : 1) : format.count;
}

/** One metric across every replication as text, or the reason it cannot be read across them. */
function acrossValue(summaries, key, formatter) {
  const values = summaries.map((s) => s.metrics[key]);
  if (values.some((v) => v === undefined)) return labels.absentValue(labels.ABSENT_REASONS.onlyThisReplay);
  if (values.some((v) => "absent" in v)) return labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication);
  return format.acrossText(values.map((v) => v.value), formatter);
}

/**
 * The registry's rows: `{key, metric, words, facts, population, replay, across}` for the eight preview metrics, or for
 * every metric the replications carry when `all`. `replay` is the watched replay's own value and `across` the spread
 * over every replication, each already text.
 */
export function registryRows({ summaries, seed, all = false }) {
  if (summaries.length === 0) return [];
  const replay = summaries.find((s) => s.seed === seed) ?? summaries[0];
  const keys = all ? Object.keys(summaries[0].metrics) : [...REGISTRY_PREVIEW];
  return keys.map((key) => {
    const metric = baseName(key);
    const row = metricRow(metric);
    const formatter = formatterOf(metric);
    const own = replay.metrics[key];
    return {
      key,
      metric,
      words: metricWords(key),
      facts: labels.registryFacts({
        unit: row.unit,
        direction: labels.DIRECTIONS[row.direction] ?? labels.DIRECTIONS.neutral,
        status: labels.REGISTRY_STATUS[row.fleetlab_status] ?? labels.REGISTRY_STATUS.playground_only,
      }),
      population: row.population,
      replay: own === undefined ? labels.absentValue(labels.ABSENT_REASONS.notComputed) : format.valueText("absent" in own ? own : own.value, formatter),
      across: acrossValue(summaries, key, formatterOf(metric, { across: true })),
    };
  });
}

/** A value cell that takes the absent style when it carries a reason instead of a number. */
function valueCell(role, text) {
  return el("td", { class: text.startsWith(labels.ABSENT_PREFIX) ? "fl-absent" : null, "data-role": role }, text);
}

/**
 * The registry: every row's name, unit, direction, FleetLab status and population, then its value in each register
 * under that register's chip. `onToggleAll` is handed the reader's choice; the caller keeps it and renders again.
 * A scenario whose travel variation is 0 says why its replications repeat each other.
 */
export function renderRegistry({ summaries, seed, all = false, onToggleAll = () => {}, scenario = null }) {
  const rows = registryRows({ summaries, seed, all });
  const heads = el("tr", {}, [
    el("th", { scope: "col" }, labels.CHART_TEXT.heads.metric),
    el("th", { scope: "col" }, el("span", { class: "fl-chip-replay", "data-role": "registry-replay-chip" }, labels.thisReplayChip(seed))),
    el("th", { scope: "col" }, el("span", { class: "fl-chip-across", "data-role": "registry-across-chip" }, labels.acrossReplicationsChip(summaries.length))),
  ]);
  const body = rows.map((row) =>
    el("tr", { "data-metric": row.metric, "data-key": row.key }, [
      el("th", { scope: "row" }, [
        el("span", { "data-role": "metric-name" }, row.words),
        el("span", { class: "fl-small-label", "data-role": "metric-facts" }, row.facts),
        el("span", { class: "fl-muted", "data-role": "metric-population" }, row.population),
      ]),
      valueCell("replay-value", row.replay),
      valueCell("across-value", row.across),
    ]),
  );
  return el("section", { class: "fl-registry", "data-role": "registry", "aria-label": PRESENT.registry.heading }, [
    el("h3", { class: "fl-title" }, PRESENT.registry.heading),
    scenario !== null && scenario.sigma_permille === 0
      ? el("p", { class: "fl-limits-chip", "data-role": "registry-no-variation" }, labels.MODEL_LIMITS.noTravelVariation)
      : null,
    el("div", { class: "fl-scroll" }, el("table", { class: "fl-table" }, [el("thead", {}, heads), el("tbody", {}, body)])),
    el("button", {
      type: "button",
      class: "fl-button",
      "data-role": "registry-all",
      "data-focus-key": "registry-all",
      "aria-expanded": all ? "true" : "false",
      on: { click: () => onToggleAll(!all) },
    }, all ? labels.VERDICT.fewerRows : labels.VERDICT.allRows),
  ]);
}

/**
 * The two charts by hour, side by side where there is room: the rider wait p90 of the area the primary is scoped to,
 * and the bay wait p90 of the depot its guardrail names. Each is charts.js's own metric-by-hour chart on one panel,
 * so its step line, its band across replications, its hatched absent hours and its summary are the ones the Sandbox
 * chart row draws.
 */
export function renderHourly({ summaries, seed, scenario, log = null, area, depot }) {
  const window = scenario.window;
  const population = log !== null && log.seed === seed ? { log, scenario } : null;
  const wait = metricByHourChart({ chart: "wait_p90_by_hour", runs: summaries, seed, window, panels: [area], population });
  const bay = metricByHourChart({ chart: "bay_wait_by_depot", runs: summaries, seed, window, panels: [depot] });
  return el("div", { class: "fl-hourly", "data-role": "hourly-pair", "aria-label": PRESENT.registry.hourly }, [wait.node, bay.node]);
}

/**
 * The verdict readout of a finished run under its frozen spec: the verdict card's own gate chain, primary rows, seed
 * dots, guardrail table and bullet rows, with minutes written beside the seconds the card shows. Void evidence draws
 * no strip and no interval, as the card does not.
 */
export function renderReadout({ verdict, frozen }) {
  const view = verdictView({ verdict }, frozen);
  const valid = verdict.validity === "VALID";
  const strip = valid ? chartsPrimaryStrip({ verdict, spec: frozen.spec }) : null;
  const rails = valid ? chartsGuardrailRows({ verdict, spec: frozen.spec }) : [];
  return renderVerdictReadout(view, { strip, rails });
}
