// The Analytics chapter's own content (src/ui/analytics.js; demo plan sections 1.1 beat 2.1 and 2.2, 4.7 and 5): the
// metric registry at eight rows with `all rows`, the two hourly charts at width, and the verdict readout composed from
// the verdict card's own builders. What these tests hold: every registry value is the value a summary already carries,
// never one this module computed a second way; the two registers stand in two columns under two chips and never share
// one; an absent value reads its reason and never a zero; and the readout says the same words as the card, with
// minutes written beside the seconds the card shows.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, test } from "node:test";

import { METRICS, metricRow } from "../src/model/metrics.js";
import * as analytics from "../src/ui/analytics.js";
import * as charts from "../src/ui/charts.js";
import * as experiment from "../src/ui/experiment.js";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import { experimentPayload, frozenExperiment, ops01Payload, presetScenario } from "./helpers/model-payloads.mjs";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const BANNED_WORDS = /\b(predict|forecast|live|real-time|realtime|real time|monitoring)\b|expected traffic/i;
const H6_WORDS = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const DASHES = /[–—]/;

const PRESET_ID = "OPS-01";
const REPLICATIONS = 10;

let payload;
let scenario;
let summaries;
let verdictPayload;
let frozen;

before(async () => {
  payload = await ops01Payload();
  scenario = presetScenario(PRESET_ID);
  summaries = payload.runs.map((r) => ({ seed: r.seed, world_digest: r.world_digest, metrics: r.metrics, series: r.series }));
  verdictPayload = await experimentPayload({ presetId: PRESET_ID, replications: REPLICATIONS });
  frozen = frozenExperiment({ presetId: PRESET_ID, replications: REPLICATIONS });
});

/** Runs `fn` with the fake DOM installed, and always uninstalls it. */
function withDom(fn) {
  const uninstall = installFakeDom(globalThis, { media: { "(min-width: 1280px)": true } });
  try {
    return fn(uninstall.dom);
  } finally {
    uninstall();
  }
}

/**
 * The formatter the registry reads a metric's values through: seconds as minutes, fractions as percent, else counts.
 * A count across replications is a percentile between two whole counts, so the spread keeps one decimal there.
 */
function formatterOf(name, across = false) {
  const row = metricRow(name);
  if (row.unit === "s") return format.minutes;
  if (row.unit === "fraction") return (v) => format.percent(v, 1);
  return across ? (v) => format.number(v, Number.isInteger(v) ? 0 : 1) : format.count;
}

const textOf = (root, selector) => root.querySelector(selector)?.textContent ?? null;
const allText = (root, selector) => root.querySelectorAll(selector).map((n) => n.textContent);

function everyReadable(root) {
  const out = [root.textContent];
  for (const node of [root, ...root.descendants()]) {
    for (const name of ["aria-label", "title"]) {
      const value = node.getAttribute?.(name);
      if (value) out.push(value);
    }
  }
  return out;
}

function assertCopyRules(root) {
  for (const text of everyReadable(root)) {
    assert.doesNotMatch(text, DASHES, text.slice(0, 80));
    assert.doesNotMatch(text, BANNED_WORDS, text.slice(0, 80));
    assert.doesNotMatch(text, H6_WORDS, text.slice(0, 80));
  }
}

function assertClassesDefined(root) {
  for (const node of [root, ...root.descendants()]) {
    for (const name of (node.getAttribute?.("class") ?? "").split(/\s+/).filter(Boolean)) {
      assert.match(CSS, new RegExp(`\\.${name}(?![\\w-])`), `styles.css defines .${name}`);
    }
  }
}

describe("the registry (demo plan beat 2.1)", () => {
  test("the preview is eight registered metrics, in the registry's own order, each unscoped so every replication has it", () => {
    assert.equal(analytics.REGISTRY_PREVIEW.length, 8);
    const order = METRICS.map((m) => m.name);
    const places = analytics.REGISTRY_PREVIEW.map((name) => order.indexOf(name));
    assert.ok(places.every((i) => i >= 0), analytics.REGISTRY_PREVIEW.join(", "));
    assert.deepEqual(places, [...places].sort((a, b) => a - b), "the preview follows the registry's order");
    for (const name of analytics.REGISTRY_PREVIEW) {
      assert.ok(!metricRow(name).requires.includes("depot"), `${name} needs no depot scope`);
      for (const summary of summaries) assert.ok(summary.metrics[name] !== undefined, `${name} in seed ${String(summary.seed)}`);
    }
  });

  test("every row's two values are the values the summaries already carry, one register each", () => {
    const rows = analytics.registryRows({ summaries, seed: payload.log.seed });
    assert.equal(rows.length, 8);
    for (const row of rows) {
      const formatter = formatterOf(row.metric);
      const replay = summaries.find((s) => s.seed === payload.log.seed).metrics[row.metric];
      assert.equal(row.replay, format.valueText("absent" in replay ? replay : replay.value, formatter), `${row.metric} this replay`);
      const values = summaries.map((s) => s.metrics[row.metric]);
      const expected = values.some((v) => "absent" in v)
        ? labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication)
        : format.acrossText(values.map((v) => v.value), formatterOf(row.metric, true));
      assert.equal(row.across, expected, `${row.metric} across`);
      // The two registers are two columns, never one value carrying both.
      assert.notEqual(row.replay, undefined);
      assert.notEqual(row.across, undefined);
    }
  });

  test("all rows opens every metric the replications carry, and fewer rows closes it again", () => {
    const all = analytics.registryRows({ summaries, seed: payload.log.seed, all: true });
    const keys = Object.keys(summaries[0].metrics);
    assert.equal(all.length, keys.length, "every key of a summary is a row");
    assert.deepEqual(new Set(all.map((r) => r.key)), new Set(keys));
    assert.ok(all.length > 8, `${String(all.length)} rows is more than the preview`);
    // A depot-scoped row keeps its scope in the name a reader sees, and its key in the row.
    const scoped = all.find((r) => r.key.includes("{"));
    assert.ok(scoped, "a scoped row is among them");
    assert.equal(scoped.words, charts.metricWords(scoped.key));
  });

  test("an absent value reads its reason in the absent style, never a zero and never a blank", () => {
    const short = [{ ...summaries[0], metrics: { ...summaries[0].metrics, "wait.p90_s": { absent: labels.ABSENT_REASONS.noCompletedRequest } } }];
    const rows = analytics.registryRows({ summaries: short, seed: short[0].seed });
    const row = rows.find((r) => r.metric === "wait.p90_s");
    assert.equal(row.replay, labels.absentValue(labels.ABSENT_REASONS.noCompletedRequest));
    assert.ok(row.replay.startsWith(labels.ABSENT_PREFIX));
    withDom(() => {
      const node = analytics.renderRegistry({ summaries: short, seed: short[0].seed });
      const cell = node.querySelector('tr[data-metric="wait.p90_s"] [data-role="replay-value"]');
      assert.equal(cell.textContent, row.replay);
      assert.equal(cell.getAttribute("class"), "fl-absent");
    });
  });

  test("the table stands under two chips, names each metric's unit, direction and population, and toggles all rows", () => {
    withDom(() => {
      let all = false;
      const build = () => analytics.renderRegistry({ summaries, seed: payload.log.seed, all, onToggleAll: () => { all = !all; } });
      const node = build();
      assert.equal(textOf(node, '[data-role="registry-replay-chip"]'), labels.thisReplayChip(payload.log.seed));
      assert.equal(textOf(node, '[data-role="registry-across-chip"]'), labels.acrossReplicationsChip(summaries.length));
      assert.equal(node.querySelectorAll("tbody tr").length, 8);
      const first = node.querySelector("tbody tr");
      const row = metricRow(analytics.REGISTRY_PREVIEW[0]);
      assert.equal(textOf(first, '[data-role="metric-name"]'), charts.metricWords(analytics.REGISTRY_PREVIEW[0]));
      assert.equal(textOf(first, '[data-role="metric-facts"]'), labels.registryFacts({
        unit: row.unit,
        direction: labels.DIRECTIONS[row.direction] ?? labels.DIRECTIONS.neutral,
        status: labels.REGISTRY_STATUS[row.fleetlab_status],
      }));
      assert.equal(textOf(first, '[data-role="metric-population"]'), row.population);
      const toggle = node.querySelector('[data-role="registry-all"]');
      assert.equal(toggle.textContent, labels.VERDICT.allRows);
      assert.equal(toggle.getAttribute("aria-expanded"), "false");
      toggle.click();
      assert.equal(all, true, "the control hands the choice back to the caller");
      const opened = build();
      assert.equal(opened.querySelectorAll("tbody tr").length, Object.keys(summaries[0].metrics).length);
      assert.equal(textOf(opened, '[data-role="registry-all"]'), labels.VERDICT.fewerRows);
      assertCopyRules(node);
      assertClassesDefined(node);
    });
  });

  test("a preset whose travel variation is 0 says why every replication repeats the first", () => {
    withDom(() => {
      const varied = analytics.renderRegistry({ summaries, seed: payload.log.seed, scenario });
      assert.equal(scenario.sigma_permille > 0, true, "OPS-01 varies travel time");
      assert.equal(varied.querySelector('[data-role="registry-no-variation"]'), null);
      const flat = analytics.renderRegistry({ summaries, seed: payload.log.seed, scenario: { ...scenario, sigma_permille: 0 } });
      assert.equal(textOf(flat, '[data-role="registry-no-variation"]'), labels.MODEL_LIMITS.noTravelVariation);
    });
  });
});

describe("the hourly pair (demo plan beat 2.1)", () => {
  test("two charts at width: San Francisco wait p90 by hour, then the watched depot's bay wait by hour", () => {
    withDom(() => {
      const node = analytics.renderHourly({ summaries, seed: payload.log.seed, scenario, log: payload.log, area: "SF", depot: "SF-2" });
      const figures = node.querySelectorAll("figure.fl-chart");
      assert.equal(figures.length, 2);
      assert.deepEqual(figures.map((f) => f.getAttribute("data-chart")), ["wait_p90_by_hour", "bay_wait_by_depot"]);
      // One panel each: the area the primary is scoped to, and the depot the guardrail names.
      assert.deepEqual(allText(figures[0], '[data-role="panel-label"]'), []);
      for (const figure of figures) {
        assert.ok(figure.querySelector('[data-role="summary"]').textContent.length > 0, "each chart says what it shows");
        assert.ok(figure.querySelector('[data-role="model-limits"]'), "each chart carries its model limits");
      }
      assertCopyRules(node);
      assertClassesDefined(node);
    });
  });

  test("the charts read the same replay and the same replications the registry reads", () => {
    withDom(() => {
      const node = analytics.renderHourly({ summaries, seed: payload.log.seed, scenario, log: payload.log, area: "SF", depot: "SF-2" });
      for (const figure of node.querySelectorAll("figure.fl-chart")) {
        assert.equal(figure.querySelector(".fl-chip-replay").textContent, labels.thisReplayChip(payload.log.seed));
        assert.equal(figure.querySelector(".fl-chip-across").textContent, labels.acrossReplicationsChip(summaries.length));
      }
    });
  });
});

describe("the verdict readout (demo plan beat 2.2)", () => {
  /** The readout and the full card of the same verdict, built from one payload. */
  function both() {
    const view = experiment.verdictView({ verdict: verdictPayload.verdict }, frozen);
    return {
      view,
      readout: analytics.renderReadout({ verdict: verdictPayload.verdict, frozen }),
      card: experiment.renderVerdictCard(view),
    };
  }

  test("the readout's gate chain, primary rows and guardrail rows are the card's own, word for word", () => {
    withDom(() => {
      const { readout, card } = both();
      const words = (root, gate) => root.querySelectorAll(`[data-gate="${gate}"] .fl-verdict-chip__word`).map((n) => n.textContent);
      for (const gate of ["validity", "guardrails", "primary", "recommendation"]) {
        assert.deepEqual(words(readout, gate), words(card, gate), gate);
      }
      for (const field of ["primary.mean_delta", "primary.median_delta", "primary.ci_low", "primary.ci_high", "primary.equivalence_margin"]) {
        const inReadout = readout.querySelector(`[data-field="${field}"]`);
        const inCard = card.querySelector(`[data-field="${field}"]`);
        assert.equal(inReadout.getAttribute("data-value"), inCard.getAttribute("data-value"), field);
      }
      const rails = (root) => root.querySelectorAll('[data-section="guardrails"] tbody tr').map((r) => [r.getAttribute("data-metric"), r.getAttribute("data-status")]);
      assert.deepEqual(rails(readout), rails(card));
    });
  });

  test("a value in seconds carries its minutes beside it, never instead of it", () => {
    withDom(() => {
      const { readout, view } = both();
      const delta = readout.querySelector('[data-field="primary.mean_delta"]');
      const seconds = experiment.metricValueText(view.primary.metric, view.primary.mean_delta, { withSign: true });
      assert.ok(delta.textContent.startsWith(seconds), `${delta.textContent} keeps the card's seconds`);
      assert.equal(delta.textContent, labels.withMinutes({ seconds, minutes: format.signed(view.primary.mean_delta / 60, 1) }));
      assert.match(delta.textContent, /min/);
    });
  });

  test("the teaching chip stands inside the border and the instrument sentence at its foot", () => {
    withDom(() => {
      const { readout, view } = both();
      assert.equal(textOf(readout, '[data-role="teaching-chip"]'), labels.verdictHeader(view.replications));
      assert.equal(readout.lastChild.getAttribute("class"), "fl-verdict__footer");
      assert.equal(readout.lastChild.textContent, labels.HONESTY.verdictFooter);
      assert.equal(textOf(readout, '[data-role="register"]'), labels.acrossReplicationsChip(view.replications));
      assertCopyRules(readout);
      assertClassesDefined(readout);
    });
  });

  test("the seed dots and the guardrail bullet rows are charts.js's own, one dot per paired seed", () => {
    withDom(() => {
      const readout = analytics.renderReadout({ verdict: verdictPayload.verdict, frozen });
      const strip = readout.querySelector('[data-section="primary"] figure.fl-chart');
      assert.ok(strip, "the paired-delta strip is drawn");
      assert.match(strip.getAttribute("data-chart"), /^verdict/);
      assert.equal(readout.querySelectorAll('[data-section="guardrail-rows"] figure.fl-chart').length, frozen.spec.guardrails.length);
    });
  });

  test("the classes these views set are defined in styles.css, listed in its header inventory, and carry no motion", () => {
    const sources = ["analytics.js", "present.js", "experiment.js"]
      .map((name) => readFileSync(new URL(`../src/ui/${name}`, import.meta.url), "utf8"))
      .join("\n");
    const classes = new Set([...sources.matchAll(/fl-(?:registry|hourly|readout|refusals)[\w-]*/g)].map((m) => m[0]));
    assert.deepEqual([...classes].sort(), ["fl-hourly", "fl-readout", "fl-refusals", "fl-registry"]);
    const header = CSS.slice(0, CSS.indexOf("*/"));
    for (const name of classes) {
      assert.match(CSS, new RegExp(`\\.${name}(?![\\w-])`), `styles.css defines .${name}`);
      assert.match(header, new RegExp(`\\.${name}(?![\\w-])`), `the header inventory lists .${name}`);
    }
    // A beat change is instant, so nothing a beat puts on screen may animate. Comments go first: one of them says the
    // word "transition" to explain why there is none.
    const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = declarations.split("}").filter((rule) => /\.fl-(?:registry|hourly|readout|refusals)/.test(rule));
    assert.ok(rules.length >= 4, `only ${String(rules.length)} rules`);
    for (const rule of rules) assert.doesNotMatch(rule, /transition|animation|will-change/, rule.trim().slice(0, 80));
  });

  test("void evidence draws no strip and no interval, and says so", () => {
    withDom(() => {
      const voided = { ...verdictPayload.verdict, validity: "INVALID_EXPERIMENT", invalidity_reason: "NOT_COMPARABLE" };
      const readout = analytics.renderReadout({ verdict: voided, frozen });
      assert.equal(readout.querySelector('[data-field="primary.mean_delta"]'), null);
      assert.equal(readout.querySelector('[data-section="primary"]'), null);
      assert.equal(textOf(readout, '[data-role="invalid-meaning"]'), labels.INVALIDITY_TEXT.NOT_COMPARABLE);
    });
  });
});
