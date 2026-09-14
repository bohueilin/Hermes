// Interface tests of src/ui/charts.js (design §7.5, §8.3, H-5, H-7, H-10) on the fake DOM with real engine payloads.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { experimentPayload, frozenExperiment, pairPayload, presetScenario, windowPayload } from "./helpers/model-payloads.mjs";
import { percentileFleetLab } from "../src/core/stats.js";
import { computeVerdict } from "../src/instrument/paired.js";
import { verdictDeclarations } from "../src/model/experiment.js";
import { computeMetric } from "../src/model/metrics.js";
import { DEFAULT_PRESET_ID } from "../src/model/presets.js";
import * as charts from "../src/ui/charts.js";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import { parseModule } from "../tools/pack.mjs";

const CHARTS_SOURCE = new URL("../src/ui/charts.js", import.meta.url);
const SEEDS = [1001, 1002, 1003];
const minutesText = (v) => `${format.number(v / 60, 1)} ${labels.UNITS.minutes}`;
const secondsSigned = (v) => `${format.signed(v, 1)} ${labels.UNITS.seconds}`;

let uninstall;
const built = []; // every chart handle built by any test, for the cross-cutting checks
const P = {};

function keep(handle) {
  const list = handle.charts ?? [handle];
  built.push(...list);
  return handle;
}

function all(node, selector) {
  return [...node.querySelectorAll(selector)];
}

function one(node, selector) {
  const found = all(node, selector);
  assert.equal(found.length, 1, `exactly one ${selector}`);
  return found[0];
}

/** Table body rows as arrays of cell text. */
function tableRows(chart) {
  return all(chart.node, "[data-view=\"table\"] tbody tr").map((tr) => tr.children.map((cell) => cell.textContent));
}

function summaryOf(chart) {
  return one(chart.node, "[data-role=\"summary\"]").textContent;
}

/** Copy of a run's series cut to its first `hours` buckets (every per-hour array sliced), for a shorter window. */
function cutSeries(value, hours) {
  if (Array.isArray(value)) return value.slice(0, hours);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cutSeries(v, hours)]));
  return value;
}

before(async () => {
  P.scenario = presetScenario(DEFAULT_PRESET_ID);
  P.window = P.scenario.window;
  P.win = await windowPayload({ seeds: SEEDS });
  // UC-01 over the Sandbox's five replications has hours a metric is absent in only some of them (review: tests lens).
  P.winUC01 = await windowPayload({ presetId: "UC-01", seeds: [1001, 1002, 1003, 1004, 1005] });
  P.windowUC01 = presetScenario("UC-01").window;
  P.pair = await pairPayload();
  P.expUC02 = await experimentPayload({ presetId: "UC-02" });
  P.expL3 = await experimentPayload({ presetId: "L3" });
  P.decUC02 = verdictDeclarations(frozenExperiment({ presetId: "UC-02" }).spec);
  P.decL3 = verdictDeclarations(frozenExperiment({ presetId: "L3" }).spec);
  uninstall = installFakeDom(globalThis);
});

after(() => uninstall());

describe("scales", () => {
  test("linearScale maps both ends and rounds to 0.01 px", () => {
    const x = charts.linearScale([-100, 300], [72, 624]);
    assert.equal(x(-100), 72);
    assert.equal(x(300), 624);
    // 72 + (0 + 100) * 552 / 400 = 72 + 138 = 210.
    assert.equal(x(0), 210);
    // 72 + 133.3 * 552 / 400 = 72 + 183.954 = 255.954, rounded to 255.95.
    assert.equal(x(33.3), 255.95);
    assert.equal(charts.linearScale([5, 5], [0, 10])(5), 5);
  });

  test("niceTicks covers the bounds with round steps", () => {
    assert.deepEqual(charts.niceTicks(0, 100, 4), { domain: [0, 100], ticks: [0, 25, 50, 75, 100], decimals: 0 });
    const t = charts.niceTicks(-133.36, 891.8, 4);
    assert.ok(t.domain[0] <= -133.36 && t.domain[1] >= 891.8);
    assert.deepEqual(t.ticks, [-500, 0, 500, 1000]);
    assert.deepEqual(charts.niceTicks(0, 0.043, 3).ticks, [0, 0.02, 0.04, 0.06]);
    assert.equal(charts.niceTicks(0, 0.043, 3).decimals, 2);
    assert.deepEqual(charts.niceTicks(0, 0, 3).domain[0], 0);
  });
});

describe("fleet state", () => {
  test("renders a 100% stack in family order with a 2 px surface gap, and the table holds the series", () => {
    const run = P.win.runs[0];
    const chart = keep(charts.fleetStateChart({ series: run.series, window: P.window, seed: run.seed }));
    const bands = all(chart.node, "path[data-series]");
    assert.deepEqual(bands.map((b) => b.getAttribute("data-series")), ["riderWork", "emptyDrive", "available", "atDepot"]);
    for (const band of bands) {
      assert.match(band.getAttribute("style"), /stroke: var\(--panel\); stroke-width: 2px/);
      assert.equal(band.getAttribute("fill"), "currentColor");
      assert.match(band.getAttribute("class"), /^fl-fam-(rider|empty|available|depot)$/);
    }
    const s = run.series.fleet_state;
    const rows = tableRows(chart);
    assert.equal(rows.length, s.starts_s.length);
    rows.forEach((row, i) => {
      const len = (s.starts_s[i + 1] ?? P.window.end_s) - s.starts_s[i];
      assert.deepEqual(row, [format.clock(s.starts_s[i]), ...charts.FAMILY_ORDER.map((f) => format.number(s.families[f][i] / len, 1))]);
    });
    assert.ok(summaryOf(chart).startsWith(`${labels.REGISTERS.thisReplaySentence}: `));
    assert.equal(one(chart.node, ".fl-chip-replay").textContent, labels.thisReplayChip(run.seed));
  });
});

describe("metric by hour", () => {
  for (const chartId of charts.METRIC_CHART_IDS) {
    test(`${chartId} renders this replay over the band, and the table equals the series values`, () => {
      const replay = P.win.runs[1];
      const chart = keep(charts.metricByHourChart({ chart: chartId, runs: P.win.runs, seed: replay.seed, window: P.window }));
      const own = replay.series[chartId];
      const panels = chartId === "bay_wait_by_depot" ? Object.keys(own.depots) : chartId === "available_by_area" ? Object.keys(own.areas) : ["all"];
      const pick = (series, key) => (key === "all" ? series.all : (series.areas ?? series.depots)[key]);
      const fraction = chartId === "available_by_area";
      const text = fraction ? (v) => format.percent(v, 1) : minutesText;
      const expected = [];
      for (const key of panels) {
        pick(own, key).forEach((v, i) => {
          const across = P.win.runs.map((r) => pick(r.series[chartId], key)[i]);
          const row = [format.clock(own.starts_s[i])];
          if (panels.length > 1) row.push(key);
          row.push(format.valueText(v, text));
          if (across.every((x) => typeof x === "number")) {
            row.push(text(percentileFleetLab(across, 0.1)), text(percentileFleetLab(across, 0.9)));
          } else {
            const reasons = new Set(across.map((x) => x.absent));
            const reason = across.every((x) => typeof x !== "number") && reasons.size === 1 ? [...reasons][0] : labels.ABSENT_REASONS.metricAbsentInSomeReplication;
            row.push(labels.absentValue(reason), labels.absentValue(reason));
          }
          expected.push(row);
        });
      }
      assert.deepEqual(tableRows(chart), expected);
      assert.ok(all(chart.node, "path[data-series=\"replay\"]").length >= 1);
      assert.ok(all(chart.node, "path[data-series=\"band\"]").length >= 1);
      assert.equal(one(chart.node, ".fl-chip-across").textContent, labels.acrossReplicationsChip(SEEDS.length));
      assert.equal(one(chart.node, ".fl-chip-replay").textContent, labels.thisReplayChip(replay.seed));
      const legend = one(chart.node, "[data-role=\"legend\"]");
      assert.ok(legend.textContent.includes(labels.replicationBandLegend(SEEDS.length)));
    });
  }

  test("absent hours are focusable hatched gaps named by their reason, never 0 or blank", () => {
    const run = P.win.runs[0];
    const chart = keep(charts.metricByHourChart({ chart: "bay_wait_by_depot", runs: P.win.runs, seed: run.seed, window: P.window, panels: ["SJ-1"] }));
    const gaps = all(chart.node, "rect[data-role=\"absent\"]");
    assert.ok(gaps.length >= 2, "the warm-up hour and hours with no started task are gaps");
    for (const gap of gaps) {
      const text = labels.absentValue(gap.getAttribute("data-reason"));
      assert.equal(gap.getAttribute("aria-label"), text);
      assert.equal(gap.getAttribute("tabindex"), "0");
      assert.match(gap.getAttribute("fill"), /^url\(#fl-hatch-\d+\)$/);
      assert.equal(one(gap, "title").textContent, text);
    }
    const reasons = new Set(gaps.map((g) => g.getAttribute("data-reason")));
    assert.ok(reasons.has("warm-up, not counted"));
    for (const row of tableRows(chart)) for (const cell of row.slice(1)) assert.notEqual(cell.trim(), "");
    assert.ok(one(chart.node, "[data-role=\"legend\"]").textContent.includes(labels.CHARTS.hatchedGap));
  });

  test("an hour absent in only some replications draws no band and its table names why, never a band from the seeds with a value", () => {
    const runs = P.winUC01.runs;
    const pick = (run) => run.series.bay_wait_by_depot.depots["SF-1"];
    const n = pick(runs[0]).length;
    const numeric = (i) => runs.filter((r) => typeof pick(r)[i] === "number").length;
    const mixed = [];
    for (let i = 0; i < n; i += 1) if (numeric(i) > 0 && numeric(i) < runs.length) mixed.push(i);
    assert.ok(mixed.length > 0, "UC-01 over five seeds has SF-1 hours absent in some replications only");
    // A replay with a value at the first mixed hour, so the only gap there is the band's.
    const replay = runs.find((r) => typeof pick(r)[mixed[0]] === "number");
    const chart = keep(charts.metricByHourChart({ chart: "bay_wait_by_depot", runs, seed: replay.seed, window: P.windowUC01, panels: ["SF-1"] }));
    const starts = replay.series.bay_wait_by_depot.starts_s;
    const edges = [...starts, P.windowUC01.end_s];
    const cursor = one(chart.node, "[data-role=\"cursor\"]");
    const xAt = (t_s) => {
      assert.equal(chart.setCursor(t_s), true);
      return Number(/^translate\((-?[\d.]+) 0\)$/.exec(cursor.getAttribute("transform"))[1]);
    };
    const hourX = edges.map(xAt);
    // Every x a band path reaches: the M start and each H step.
    const bandSpans = all(chart.node, "path[data-series=\"band\"]").map((path) => {
      const tokens = path.getAttribute("d").split(" ");
      const xs = tokens.flatMap((tok, k) => (tok === "M" || tok === "H" ? [Number(tokens[k + 1])] : []));
      return [Math.min(...xs), Math.max(...xs)];
    });
    const covered = (i) => bandSpans.some(([x0, x1]) => Math.min(x1, hourX[i + 1]) - Math.max(x0, hourX[i]) > 0);
    for (let i = 0; i < n; i += 1) {
      if (numeric(i) === runs.length) assert.equal(covered(i), true, `hour ${String(i)} with a value in every replication has a band`);
      else assert.equal(covered(i), false, `hour ${String(i)} absent in some replication has no band`);
    }
    const text = labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication);
    const rows = tableRows(chart);
    for (const i of mixed) assert.deepEqual(rows[i].slice(-2), [text, text], `hour ${String(i)} p10 and p90 name the absence`);
    assert.equal(rows[mixed[0]].at(-3), minutesText(pick(replay)[mixed[0]]), "this replay keeps its own value at that hour");
    assert.equal(all(chart.node, "rect[data-role=\"absent\"]").some((gap) => Number(gap.getAttribute("x")) === hourX[mixed[0]]), false, "no hatch on the replay's own value");
  });

  test("panels of one metric share one y-axis group with the same ticks", () => {
    const run = P.win.runs[0];
    const chart = keep(charts.metricByHourChart({ chart: "bay_wait_by_depot", runs: P.win.runs, seed: run.seed, window: P.window }));
    const depots = Object.keys(run.series.bay_wait_by_depot.depots);
    assert.equal(all(chart.node, "[data-role=\"panel-label\"]").length, depots.length);
    const ticks = all(one(chart.node, "[data-axis=\"measure\"]"), "text").map((t) => t.textContent);
    assert.equal(ticks.length % depots.length, 0);
    const per = ticks.length / depots.length;
    for (let k = 1; k < depots.length; k += 1) assert.deepEqual(ticks.slice(k * per, (k + 1) * per), ticks.slice(0, per));
  });

  test("a summary with no value in any hour names the absence, not a number", () => {
    const run = P.win.runs[0];
    const cut = { seed: run.seed, series: cutSeries(run.series, 1) };
    const window = { start_s: P.window.start_s, end_s: P.window.start_s + 3600 };
    const chart = keep(charts.metricByHourChart({ chart: "wait_p90_by_hour", runs: [cut], seed: run.seed, window }));
    assert.equal(
      summaryOf(chart),
      // Changed with G5: chart summaries name the metric in words (labels.METRIC_WORDS), not by its key.
      labels.metricByHourSummary({ register: labels.REGISTERS.thisReplaySentence, metric: "wait p90", highest: { absent: "warm-up, not counted" }, absentHours: 1 }),
    );
    assert.deepEqual(tableRows(chart), [[format.clock(window.start_s), labels.absentValue("warm-up, not counted")]]);
    assert.equal(all(chart.node, ".fl-chip-across").length, 0, "one replication draws no band and no across chip");
    const available = keep(charts.metricByHourChart({ chart: "available_by_area", runs: [cut], seed: run.seed, window }));
    assert.equal(
      summaryOf(available),
      // Changed with G5: fleet.available_fraction reads "available share".
      labels.chartAbsentSummary({ register: labels.REGISTERS.thisReplaySentence, subject: "available share", reason: "warm-up, not counted" }),
    );
  });

  test("a summary reports the highest hour of this replay with its register", () => {
    const run = P.win.runs[0];
    const chart = keep(charts.metricByHourChart({ chart: "wait_p90_by_hour", runs: P.win.runs, seed: run.seed, window: P.window }));
    const values = run.series.wait_p90_by_hour.all;
    const numbers = values.filter((v) => typeof v === "number");
    const max = Math.max(...numbers);
    assert.equal(
      summaryOf(chart),
      labels.metricByHourSummary({
        register: labels.REGISTERS.thisReplaySentence,
        // Changed with G5: the metric in words.
        metric: "wait p90",
        highest: minutesText(max),
        clock: format.clock(run.series.wait_p90_by_hour.starts_s[values.indexOf(max)]),
        absentHours: values.length - numbers.length,
      }),
    );
  });
});

describe("metric names in charts (G5)", () => {
  test("metricWords names a metric and its scope in words; metricSubject keeps the name with readable scopes", () => {
    assert.equal(charts.metricWords("depot.bay_wait_p90_s{depot=SF-2}"), "bay wait p90 at SF-2");
    // 111,600 s is D2 07:00 and 118,800 s is D2 09:00 (86,400 + 25,200 and 86,400 + 32,400).
    assert.equal(charts.metricWords("wait.p90_s{area=SF,window=111600-118800}"), "wait p90 in San Francisco, D2 07:00 to 09:00");
    assert.equal(charts.metricWords("unserved.fraction"), "unserved share");
    assert.equal(charts.metricSubject("wait.p90_s{area=SF,window=111600-118800}"), "wait.p90_s · San Francisco · D2 07:00 to 09:00");
    assert.equal(charts.metricSubject("depot.bay_wait_p90_s{depot=SF-2}"), "depot.bay_wait_p90_s · SF-2");
    assert.equal(charts.metricSubject("unserved.fraction"), "unserved.fraction");
  });

  test("every Sandbox chart title and summary names metrics in words, never by key or in engine seconds", () => {
    const run = P.win.runs[0];
    const built = [
      charts.fleetStateChart({ series: run.series, window: P.window, seed: run.seed }),
      ...["wait_p90_by_hour", "bay_wait_by_depot", "available_by_area"].map((chart) => charts.metricByHourChart({ chart, runs: P.win.runs, seed: run.seed, window: P.window })),
    ].map(keep);
    const raw = /[a-z]+\.[a-z_0-9]+|\{|=|\b\d{5,}\b/;
    for (const chart of built) {
      const text = `${one(chart.node, "h3").textContent} ${summaryOf(chart)}`;
      assert.ok(!raw.test(text), `${chart.node.getAttribute("data-chart")}: ${text}`);
    }
    const bay = built.find((c) => c.node.getAttribute("data-chart") === "bay_wait_by_depot");
    assert.match(summaryOf(bay), /bay wait p90 at [A-Z]+-\d/);
  });
});

describe("demand and traffic strips", () => {
  test("the demand strip draws the declared profile and this replay's accepted requests", () => {
    const run = P.win.runs[0];
    const chart = keep(charts.demandStrip({ series: run.series, area: "SJ", seed: run.seed, window: P.window }));
    const d = run.series.demand_by_hour.areas.SJ;
    assert.deepEqual(tableRows(chart), run.series.demand_by_hour.starts_s.map((t, i) => [format.clock(t), format.number(d.declared_per_h[i], Number.isInteger(d.declared_per_h[i]) ? 0 : 1), format.count(d.accepted[i])]));
    assert.deepEqual(all(chart.node, "path[data-series]").map((p) => p.getAttribute("data-series")), ["declared", "accepted"]);
    assert.equal(
      summaryOf(chart),
      labels.demandSummary({ area: "San Jose", peakRate: format.number(Math.max(...d.declared_per_h), 0), accepted: format.count(d.accepted.reduce((a, b) => a + b, 0)) }),
    );
  });

  test("the traffic strip draws the declared multiplier for a route direction and for trips inside an area", () => {
    const run = P.win.runs[0];
    const route = keep(charts.trafficStrip({ series: run.series, roadClass: "HIGHWAY", direction: "SF>PEN", seed: run.seed, window: P.window }));
    const values = run.series.traffic_by_hour.HIGHWAY["SF>PEN"];
    assert.deepEqual(tableRows(route), run.series.traffic_by_hour.starts_s.map((t, i) => [format.clock(t), format.multiplier(values[i])]));
    // Default congestion, highway pair with SF, away from SF: 1600 in hours 16-18 (contract 6.2); the first run is D1.
    assert.equal(
      summaryOf(route),
      labels.trafficSummary({ roadClass: "highways", direction: "SF to PEN", factor: format.multiplier(1600), start: "D1 16:00", end: "D1 19:00" }),
    );
    const inArea = keep(charts.trafficStrip({ series: run.series, roadClass: "IN_AREA", seed: run.seed, window: P.window }));
    assert.equal(tableRows(inArea).length, values.length);
    assert.throws(() => charts.trafficStrip({ series: run.series, roadClass: "HIGHWAY", direction: "SF>XX", seed: 1, window: P.window }), TypeError);
  });
});

describe("arm comparison", () => {
  test("bars with whiskers across replications, and the table holds every seed", () => {
    const metric = P.decUC02.primary.name;
    const chart = keep(charts.armComparisonChart({ perSeed: P.expUC02.per_seed, metric }));
    const rows = tableRows(chart);
    P.expUC02.per_seed.forEach((p, i) => {
      assert.deepEqual(rows[i], [String(p.seed), minutesText(p.baseline_metrics[metric].value), minutesText(p.candidate_metrics[metric].value)]);
    });
    const base = P.expUC02.per_seed.map((p) => p.baseline_metrics[metric].value);
    const cand = P.expUC02.per_seed.map((p) => p.candidate_metrics[metric].value);
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.deepEqual(rows.at(-3), [labels.CHART_TEXT.heads.seedMean, minutesText(mean(base)), minutesText(mean(cand))]);
    assert.deepEqual(rows.at(-1), [labels.CHART_TEXT.heads.p90, minutesText(percentileFleetLab(base, 0.9)), minutesText(percentileFleetLab(cand, 0.9))]);
    assert.equal(all(chart.node, "[data-role=\"whisker\"]").length, 2);
    assert.equal(one(chart.node, ".fl-chip-across").textContent, labels.acrossReplicationsChip(P.expUC02.per_seed.length));
    assert.equal(all(chart.node, ".fl-chip-replay").length, 0);
    assert.equal(chart.setCursor(60000), false, "no time axis, so no cursor");
  });

  test("an arm with an absent seed shows a hatched gap and an absent summary", () => {
    const n = P.expL3.per_seed.length;
    let metric = Object.keys(P.expL3.per_seed[0].baseline_metrics).find((key) => P.expL3.per_seed.some((p) => "absent" in p.baseline_metrics[key]));
    let perSeed = P.expL3.per_seed;
    if (metric === undefined) {
      // No metric of this real payload is absent in a seed, so the first seed's turnaround is marked absent in a copy.
      metric = "depot.turnaround_p90_s";
      perSeed = perSeed.map((p, i) => (i === 0 ? { ...p, baseline_metrics: { ...p.baseline_metrics, [metric]: { absent: "3 visits unfinished at drain end" } } } : p));
    }
    const chart = keep(charts.armComparisonChart({ perSeed, metric }));
    assert.ok(all(chart.node, "rect[data-role=\"absent\"]").length >= 1);
    // Changed with G5: the absent summary names the metric in words (charts.metricWords), not by its key.
    assert.ok(summaryOf(chart).startsWith(`${labels.acrossReplications(n)}: ${charts.metricWords(metric)} had no value; ${labels.ABSENT_PREFIX}`));
    assert.ok(tableRows(chart).some((row) => row[1].startsWith(labels.ABSENT_PREFIX)));
  });
});

describe("car timeline, fork and depot board", () => {
  test("the car timeline draws one lane of state segments from the interval log", () => {
    const log = P.win.log;
    const chart = keep(charts.carTimelineChart({ log, scenario: P.scenario, car: "SF-017", seed: log.seed }));
    const intervals = log.intervals["SF-017"];
    const inWindow = intervals.filter((iv) => Math.min(iv.t1, P.window.end_s) > Math.max(iv.t0, P.window.start_s));
    assert.equal(all(chart.node, "rect[data-state]").length, inWindow.length);
    assert.deepEqual(tableRows(chart).map((r) => r[0]), inWindow.map((iv) => labels.MAP.carStates[iv.state]));
    assert.equal(one(chart.node, "[data-axis=\"measure\"]").getAttribute("data-scale"), "lanes");
    assert.ok(summaryOf(chart).startsWith("This replay: SF-017 spent "));
  });

  test("the fork draws lanes A and B and an SF available-cars strip on one clock, with the fork caption", () => {
    const group = keep(charts.carForkCharts({ pair: P.pair, baselineScenario: P.scenario, car: "SF-017", seed: 1001 }));
    assert.equal(group.charts.length, 2);
    assert.equal(one(group.node, "[data-role=\"fork-caption\"]").textContent, labels.HONESTY.forkCaption);
    const [lanes, strip] = group.charts;
    assert.deepEqual(all(lanes.node, "[data-axis=\"measure\"] text").map((t) => t.textContent), [labels.INSPECTOR.forkArms.A, labels.INSPECTOR.forkArms.B]);
    const sfA = P.pair.baseline.series.available_by_area.areas.SF;
    const fleetA = P.pair.baseline.series.fleet_state.fleet;
    tableRows(strip).forEach((row, i) => {
      assert.equal(row[1], format.valueText(typeof sfA[i] === "number" ? sfA[i] * fleetA : sfA[i], (v) => format.number(v, 1)));
    });
    assert.equal(group.setCursor(66600), true);
    for (const cursor of all(group.node, "[data-role=\"cursor\"]")) {
      assert.equal(cursor.getAttribute("visibility"), "visible");
      assert.match(cursor.getAttribute("transform"), /^translate\([\d.]+ 0\)$/);
    }
    const xs = all(group.node, "[data-role=\"cursor\"]").map((c) => c.getAttribute("transform"));
    assert.equal(new Set(xs).size, 1, "both charts put the cursor at one x on one clock");
    assert.equal(group.setCursor(P.window.end_s + 10), false);
  });

  test("the depot board shows bay lanes and lot held and queue for both depots of a move on one clock", () => {
    const log = P.win.log;
    const group = keep(charts.depotBoardCharts({ log, scenario: P.scenario, depots: ["SJ-1", "SF-1"], seed: log.seed }));
    assert.deepEqual(group.charts.map((c) => c.chartId), ["bay_lanes", "lot_and_queue", "bay_lanes", "lot_and_queue"]);
    const sj = log.depots.find((d) => d.id === "SJ-1");
    const laneNames = all(group.charts[0].node, "[data-axis=\"measure\"] text").map((t) => t.textContent);
    assert.deepEqual(laneNames.slice(0, sj.cleaning_bays), Array.from({ length: sj.cleaning_bays }, (_, i) => labels.bayLane({ task: "CLEAN", index: i + 1 })));
    // Busy blocks never overlap inside one lane.
    const byLane = new Map();
    for (const rect of all(group.charts[0].node, "rect[data-task]")) {
      const lane = rect.getAttribute("data-lane");
      const x0 = Number(rect.getAttribute("x"));
      const x1 = x0 + Number(rect.getAttribute("width"));
      for (const [a, b] of byLane.get(lane) ?? []) assert.ok(x1 <= a + 0.02 || x0 >= b - 0.02, `overlap in lane ${lane}`);
      byLane.set(lane, [...(byLane.get(lane) ?? []), [x0, x1]]);
    }
    const [it, ih, iq] = ["t", "stalls_held", "queue"].map((f) => sj.series_fields.indexOf(f));
    const inside = sj.series.filter((row) => row[it] < P.window.end_s);
    const rows = tableRows(group.charts[1]);
    assert.deepEqual(rows.at(-1), [format.clock(inside.at(-1)[it]), format.count(inside.at(-1)[ih]), format.count(inside.at(-1)[iq])]);
    const maxHeld = Math.max(...rows.map((r) => Number(r[1])));
    assert.ok(summaryOf(group.charts[1]).startsWith(`This replay: SJ-1 held at most ${String(maxHeld)} of ${String(sj.parking)} stalls`));
    assert.equal(setCursorCount(group, 66600), 4);
  });
});

function setCursorCount(group, t) {
  return charts.setCursorAll(group.charts, t);
}

describe("verdict", () => {
  test("the primary strip puts dots, interval ends, mean and margin band on one linear scale", () => {
    const seeds = P.expUC02.per_seed.map((p) => p.seed);
    const group = keep(charts.verdictCharts({ verdict: P.expUC02.verdict, declarations: P.decUC02, seeds }));
    const strip = group.charts[0];
    const primary = P.expUC02.verdict.primary;
    const margin = P.decUC02.primary.equivalence_margin;
    const ticks = all(one(strip.node, "[data-axis=\"measure\"]"), "text[data-value]").map((t) => ({ v: Number(t.getAttribute("data-value")), x: Number(t.getAttribute("x")) }));
    assert.ok(ticks.length >= 3);
    const slope = (ticks.at(-1).x - ticks[0].x) / (ticks.at(-1).v - ticks[0].v);
    const at = (v) => ticks[0].x + (v - ticks[0].v) * slope;
    for (const t of ticks) assert.ok(Math.abs(t.x - at(t.v)) <= 0.02, "ticks are linear");
    const close = (actual, v, what) => assert.ok(Math.abs(Number(actual) - at(v)) <= 0.02, `${what}: ${actual} vs ${String(at(v))}`);
    const dots = all(strip.node, "circle[data-role=\"seed-dot\"]");
    assert.equal(dots.length, primary.paired_deltas.length);
    for (const dot of dots) close(dot.getAttribute("cx"), primary.paired_deltas[Number(dot.getAttribute("data-index"))], "seed dot");
    const interval = one(strip.node, "line[data-role=\"interval\"]");
    close(interval.getAttribute("x1"), primary.ci_low, "interval low");
    close(interval.getAttribute("x2"), primary.ci_high, "interval high");
    close(one(strip.node, "[data-role=\"interval-low\"]").getAttribute("x1"), primary.ci_low, "low cap");
    close(one(strip.node, "[data-role=\"interval-high\"]").getAttribute("x1"), primary.ci_high, "high cap");
    close(one(strip.node, "circle[data-role=\"mean\"]").getAttribute("cx"), primary.mean_delta, "mean");
    const band = one(strip.node, "rect[data-role=\"margin-band\"]");
    close(band.getAttribute("x"), -margin, "band left");
    close(Number(band.getAttribute("x")) + Number(band.getAttribute("width")), margin, "band right");
    // The scope is named on the simulated clock (design §7.2 setup), never in engine seconds; the table keeps the key.
    // UC-02's primary moved to the day 1 morning peak (07:00 = 25200, 09:00 = 32400; was 16:00 to 19:00 = 57600 to 68400)
    // because San Jose had no free car in either arm in the evening (review: teaching-value lens, see presets.js).
    assert.equal(primary.metric, "wait.p90_s{area=SJ,window=25200-32400}");
    // Changed with G5: the verdict card keeps the metric name and names the area scope by its label (SJ is San Jose).
    assert.equal(charts.metricSubject(primary.metric), "wait.p90_s · San Jose · D1 07:00 to 09:00");
    assert.equal(
      summaryOf(strip),
      labels.verdictStripSummary({ count: seeds.length, metric: "wait.p90_s · San Jose · D1 07:00 to 09:00", low: secondsSigned(primary.ci_low), high: secondsSigned(primary.ci_high), outcome: P.expUC02.verdict.outcome }),
    );
    assert.equal(one(strip.node, "h3").textContent, labels.chartTitle({ title: labels.VERDICT.primary, subject: "wait.p90_s · San Jose · D1 07:00 to 09:00" }));
    assert.ok(!/\{|window=/.test(summaryOf(strip) + one(strip.node, "h3").textContent), "no raw key in the title or summary");
    const rows = tableRows(strip);
    seeds.forEach((seed, i) => assert.deepEqual(rows[i], [String(seed), secondsSigned(primary.paired_deltas[i])]));
    assert.deepEqual(rows.slice(-5).map((r) => r[1]), [secondsSigned(primary.mean_delta), secondsSigned(primary.median_delta), secondsSigned(primary.ci_low), secondsSigned(primary.ci_high), labels.marginBand(`${String(margin)} s`)]);
    const outcome = one(strip.node, "[data-role=\"outcome\"]");
    assert.ok(outcome.textContent.includes(labels.OUTCOME_SENTENCES[P.expUC02.verdict.outcome]));
  });

  test("guardrail bullet rows carry status words with glyphs, and descriptive rows are a table", () => {
    const group = keep(charts.verdictCharts({ verdict: P.expL3.verdict, declarations: P.decL3 }));
    const statuses = P.expL3.verdict.guardrail_statuses;
    const rails = group.charts.filter((c) => c.chartId === "verdict_guardrail");
    assert.equal(rails.length, statuses.length);
    rails.forEach((rail, i) => {
      const entry = labels.STATUS_WORDS.guardrail[statuses[i].status];
      const chip = one(rail.node, ".fl-verdict-chip");
      assert.equal(chip.getAttribute("data-status"), entry.status);
      assert.equal(one(chip, ".fl-verdict-chip__glyph").textContent, entry.glyph);
      assert.equal(one(chip, ".fl-verdict-chip__word").textContent, entry.word);
      assert.equal(tableRows(rail)[0][0], statuses[i].metric);
      assert.equal(all(rail.node, "[data-role=\"harm-bar\"]").length, 1);
    });
    const descriptive = one(group.node, "[data-role=\"descriptive\"]");
    assert.equal(all(descriptive, "tbody tr").length, P.expL3.verdict.descriptives.length);
    assert.ok(all(descriptive, ".fl-limits-chip").length === 1);
  });

  test("a NOT_EVALUABLE guardrail is a hatched row with its text, never a pass", () => {
    const verdict = {
      ...P.expUC02.verdict,
      guardrail_statuses: [{ metric: "depot.bay_wait_p90_s", status: "NOT_EVALUABLE", harm: null, max_harm: 60 }],
    };
    const group = keep(charts.verdictCharts({ verdict, declarations: P.decUC02 }));
    const rail = group.charts[1];
    assert.equal(summaryOf(rail), labels.notEvaluableSummary({ count: verdict.primary.paired_deltas.length, metric: "depot.bay_wait_p90_s" }));
    assert.equal(one(rail.node, ".fl-verdict-chip").getAttribute("data-status"), "cond");
    assert.equal(one(rail.node, "rect[data-role=\"absent\"]").getAttribute("aria-label"), labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication));
    assert.equal(tableRows(rail)[0][1], labels.NOT_EVALUABLE_TEXT);
  });

  test("an invalid verdict draws no strip, no interval and no outcome", () => {
    const verdict = computeVerdict({
      primary: { name: "wait.p90_s{area=SJ}", direction: "lower_is_better", equivalence_margin: 60 },
      baselineRuns: [{ "wait.p90_s": 1 }],
      candidateRuns: [{ "wait.p90_s": 2 }],
      resamples: 1000,
      key: P.expUC02.digest,
      precheckMatched: true,
    });
    assert.equal(verdict.invalidity_reason, "NOT_COMPARABLE");
    const group = keep(charts.verdictCharts({ verdict, declarations: P.decUC02 }));
    assert.equal(group.charts.length, 0);
    assert.equal(all(group.node, "svg").length, 0);
    assert.ok(group.node.textContent.includes(labels.SEED_WATCH.voidEvidence));
    assert.equal(one(group.node, ".fl-verdict-chip").getAttribute("data-status"), "invalid");
  });
});

describe("rules on every chart built above", () => {
  test("charts were built", () => assert.ok(built.length >= 20, `only ${String(built.length)} charts`));

  test("every chart has exactly one measure axis, a summary, a register chip, a model-limits chip and a table toggle", () => {
    for (const chart of built) {
      assert.equal(chart.node.getAttribute("class"), "fl-chart");
      assert.equal(all(chart.node, "[data-axis=\"measure\"]").length, 1, chart.chartId);
      assert.ok(all(chart.node, "[data-axis=\"time\"]").length <= 1, chart.chartId);
      const summary = summaryOf(chart);
      assert.ok(summary.endsWith("."), `${chart.chartId}: ${summary}`);
      const registers = all(chart.node, "[data-register]");
      assert.ok(registers.length >= 1 && registers.length <= 2, chart.chartId);
      const chip = one(chart.node, ".fl-limits-chip");
      const items = all(chip, "li");
      assert.ok(items.length >= 1, chart.chartId);
      const texts = Object.entries(labels.MODEL_LIMITS).filter(([k]) => k !== "heading");
      for (const item of items) {
        assert.equal(item.textContent, labels.MODEL_LIMITS[item.getAttribute("data-limit")]);
        assert.ok(texts.some(([, t]) => t === item.textContent));
      }
      assert.deepEqual(items.map((i) => i.getAttribute("data-limit")), [...charts.CHART_LIMITS[chart.chartId], ...items.slice(charts.CHART_LIMITS[chart.chartId].length).map((i) => i.getAttribute("data-limit"))]);
      one(chart.node, "[data-role=\"table-toggle\"]");
    }
  });

  test("summaries name their register (design H-10, §7.7)", () => {
    for (const chart of built) {
      const summary = summaryOf(chart);
      if (chart.chartId === "demand_by_hour" || chart.chartId === "traffic_by_hour") {
        assert.ok(summary.startsWith("Profile you set for "), summary);
      } else {
        assert.ok(/^(This replay|Across \d+ (replications|paired seeds?)): /.test(summary), summary);
      }
    }
  });

  test("the Table toggle swaps the plot for a table holding the numbers, and back", () => {
    for (const chart of built) {
      const toggle = one(chart.node, "[data-role=\"table-toggle\"]");
      const table = one(chart.node, "[data-view=\"table\"]");
      const plot = one(chart.node, "[data-view=\"chart\"]");
      assert.equal(table.hidden, true);
      toggle.click();
      assert.equal(table.hidden, false);
      assert.equal(plot.hidden, true);
      assert.equal(toggle.getAttribute("aria-pressed"), "true");
      assert.equal(toggle.getAttribute("aria-controls"), table.getAttribute("id"));
      toggle.click();
      assert.equal(table.hidden, true);
      assert.equal(plot.hidden, false);
      assert.ok(tableRows(chart).length >= 1, chart.chartId);
    }
  });

  test("a chart with more than one series has a legend", () => {
    for (const chart of built) {
      const series = new Set(all(chart.node, "[data-view=\"chart\"] [data-series]").map((n) => n.getAttribute("data-series")));
      const multi = series.size > 1 || all(chart.node, "[data-role=\"seed-dot\"]").length > 0 || all(chart.node, "[data-role=\"harm-bar\"], [data-role=\"whisker\"]").length > 0;
      if (multi) assert.equal(all(chart.node, "[data-role=\"legend\"]").length, 1, chart.chartId);
      const legend = all(chart.node, "[data-role=\"legend\"] li");
      if (legend.length > 0) for (const li of legend) assert.ok(li.textContent.trim().length > 0);
    }
  });

  test("gridlines are solid: no dash array anywhere, as an attribute or a style", () => {
    let gridlines = 0;
    for (const chart of built) {
      for (const node of all(chart.node, "*")) {
        assert.equal(node.hasAttribute("stroke-dasharray"), false);
        assert.ok(!/dasharray/i.test(node.getAttribute("style") ?? ""));
        if (node.getAttribute("class") === "fl-chart__grid") gridlines += 1;
      }
    }
    assert.ok(gridlines > 0);
  });

  test("colours come only from classes and CSS variables; status colours sit only on verdict chips with glyph and word", () => {
    const statusTokens = /var\(--(pass|cond|hold|invalid)(-bg)?\)/;
    for (const chart of built) {
      for (const node of all(chart.node, "*")) {
        const style = node.getAttribute("style") ?? "";
        assert.ok(!/#[0-9a-f]{3,8}\b|rgb|hsl/i.test(style), style);
        assert.ok(!statusTokens.test(style), style);
        for (const attr of ["fill", "stroke"]) {
          const value = node.getAttribute(attr);
          if (value !== null) assert.ok(/^(currentColor|none|url\(#fl-hatch-\d+\))$/.test(value), `${attr}=${value}`);
        }
        if (node.hasAttribute("data-status")) {
          assert.equal(node.getAttribute("class"), "fl-verdict-chip");
          one(node, ".fl-verdict-chip__glyph");
          one(node, ".fl-verdict-chip__word");
        }
      }
    }
  });

  test("motion is transform only: the cursor moves by transform and nothing animates", () => {
    for (const chart of built) {
      for (const node of all(chart.node, "animate, animateTransform, set")) assert.fail(`animation element ${node.tagName}`);
      const cursors = all(chart.node, "[data-role=\"cursor\"]");
      assert.ok(cursors.length <= 1);
      if (cursors.length === 1) {
        // D1 05:30 lies inside every time chart's clock, including the one-hour cut window.
        assert.equal(chart.setCursor(P.window.start_s + 1800), true);
        assert.ok(!cursors[0].getAttribute("style"));
        assert.match(cursors[0].getAttribute("transform"), /^translate\(/);
      }
    }
  });

  test("copy rules hold on every text node: no dash, no banned or winner words, absence spelled out", () => {
    const banned = /\b(predict|forecast|live|real-time|realtime|monitoring)\b|expected traffic/i;
    const h6 = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
    for (const chart of built) {
      const texts = [chart.node.textContent, ...all(chart.node, "[aria-label]").map((n) => n.getAttribute("aria-label"))];
      for (const text of texts) {
        assert.ok(!/[\u2013\u2014]/.test(text), text);
        assert.ok(!banned.test(text), text);
        assert.ok(!h6.test(text), text);
      }
      for (const cell of all(chart.node, "td, th")) assert.ok(cell.textContent.trim().length > 0, "no blank table cell");
      for (const cell of all(chart.node, "td.fl-absent, th.fl-absent")) assert.ok(cell.textContent.startsWith(labels.ABSENT_PREFIX));
    }
  });
});

describe("plots draw in real pixels at their box width (design §8.1, §8.3; review: 640-unit charts scaled to a third)", () => {
  /** Installs a recording ResizeObserver for `fn`, then removes it. */
  function withObservers(fn) {
    const observers = [];
    globalThis.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
        this.targets = [];
        observers.push(this);
      }
      observe(target) {
        this.targets.push(target);
      }
      unobserve() {}
      disconnect() {}
    };
    try {
      return fn(observers);
    } finally {
      delete globalThis.ResizeObserver;
    }
  }
  const plotOf = (chart) => one(chart.node, "[data-view=\"chart\"] > svg");

  test("drawn widths snap to 4 px with a 160 px floor, and time labels stay at least 48 px apart at every width", () => {
    assert.equal(charts.drawWidthFor(0), null);
    assert.equal(charts.drawWidthFor(Number.NaN), null);
    assert.equal(charts.drawWidthFor(undefined), null);
    assert.equal(charts.drawWidthFor(100), charts.MIN_DRAW_WIDTH);
    assert.equal(charts.drawWidthFor(211), 208);
    assert.equal(charts.drawWidthFor(1280), 1280);
    assert.equal(charts.timeTickStep([18000, 122400], 552), 21600, "6 hours at the 640 px drawing");
    for (let width = charts.MIN_DRAW_WIDTH; width <= 1600; width += 4) {
      const plotWidth = width - 72 - 16;
      const step = charts.timeTickStep([18000, 122400], plotWidth);
      assert.equal(step % 21600, 0);
      assert.ok((plotWidth * step) / 104400 >= charts.MIN_TIME_TICK_GAP_PX || step >= 104400, `width ${String(width)}`);
    }
  });

  test("a ResizeObserver width redraws the plot at that width and keeps names, table and cursor", () => {
    withObservers((observers) => {
      const run = P.win.runs[0];
      const chart = charts.fleetStateChart({ series: run.series, window: P.window, seed: run.seed });
      const before = plotOf(chart);
      assert.equal(before.getAttribute("viewBox"), `0 0 ${String(charts.CHART_WIDTH)} 176`);
      assert.equal(observers.length, 1);
      const box = one(chart.node, "[data-view=\"chart\"]");
      assert.deepEqual(observers[0].targets, [box]);
      const t = P.window.start_s + 7 * 3600;
      assert.equal(chart.setCursor(t), true);
      const rows = tableRows(chart);
      const summary = summaryOf(chart);

      observers[0].callback([{ target: box, contentRect: { width: 211 } }]);
      const after = plotOf(chart);
      assert.notEqual(after, before, "the plot SVG is replaced");
      assert.equal(after.getAttribute("viewBox"), "0 0 208 176", "one view box unit is one CSS pixel");
      assert.equal(after.getAttribute("aria-labelledby"), before.getAttribute("aria-labelledby"));
      assert.equal(after.getAttribute("role"), "group");
      assert.equal(after.getAttribute("style"), "overflow: visible", "end tick labels are not clipped at the plot edge");
      assert.deepEqual(tableRows(chart), rows);
      assert.equal(summaryOf(chart), summary);
      assert.equal(one(after, "[data-role=\"cursor\"]").getAttribute("visibility"), "visible", "the cursor is redrawn where it was");
      const xs = all(one(after, "[data-axis=\"time\"]"), "text").map((n) => Number(n.getAttribute("x")));
      assert.ok(xs.length >= 2);
      for (let i = 1; i < xs.length; i += 1) assert.ok(xs[i] - xs[i - 1] >= charts.MIN_TIME_TICK_GAP_PX, `time labels ${String(xs)}`);
      assert.ok(Math.max(...xs) <= 208);
      assert.equal(chart.setCursor(t + 3600), true);
      assert.match(one(after, "[data-role=\"cursor\"]").getAttribute("transform"), /^translate\(/);

      // The same snapped width, or a hidden box, keeps the drawing.
      observers[0].callback([{ target: box, contentRect: { width: 208 } }, { target: box, contentRect: { width: 0 } }]);
      assert.equal(plotOf(chart), after);
    });
  });

  test("a group redraws every chart it holds, once per width, from one observer", () => {
    withObservers((observers) => {
      const group = charts.verdictCharts({ verdict: P.expL3.verdict, declarations: P.decL3 });
      assert.equal(observers.length, 1, "nested builders share the outer observer");
      assert.equal(observers[0].targets.length, group.charts.length);
      observers[0].callback(observers[0].targets.map((target) => ({ target, contentRect: { width: 500 } })));
      for (const chart of group.charts) {
        assert.equal(plotOf(chart).getAttribute("viewBox").split(" ")[2], "500", chart.chartId);
        assert.equal(all(chart.node, "[data-view=\"chart\"] > svg").length, 1);
      }
      assert.equal(all(group.charts[0].node, "circle[data-role=\"seed-dot\"]").length, P.expL3.verdict.primary.paired_deltas.length);
    });
  });

  test("legend swatches keep their 24 px size in a narrow card, so their 2 px lines are not squeezed", () => {
    const run = P.win.runs[0];
    const chart = charts.metricByHourChart({ chart: "wait_p90_by_hour", runs: P.win.runs, seed: run.seed, window: P.window });
    const swatches = all(chart.node, "[data-role=\"legend\"] svg");
    assert.ok(swatches.length > 0);
    for (const swatch of swatches) {
      assert.equal(swatch.getAttribute("width"), "24");
      assert.match(swatch.getAttribute("style") ?? "", /flex: none/);
    }
  });

  test("without a ResizeObserver the plot keeps its 640 px drawing", () => {
    assert.equal(globalThis.ResizeObserver, undefined);
    const run = P.win.runs[0];
    const chart = charts.fleetStateChart({ series: run.series, window: P.window, seed: run.seed });
    assert.equal(plotOf(chart).getAttribute("viewBox"), `0 0 ${String(charts.CHART_WIDTH)} 176`);
  });
});

describe("source rules", () => {
  test("charts.js parses under the packer's rules and holds no REQUIRED_LABELS-like copy outside labels.js", () => {
    const source = readFileSync(CHARTS_SOURCE, "utf8");
    const parsed = parseModule(source, "src/ui/charts.js");
    assert.ok(parsed.exports.length > 5);
    assert.ok(!/[\u2013\u2014]/.test(source));
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|fetch\(|eval\(/.test(source));
    const svgNamespace = source.match(/http:\/\/www\.w3\.org\/2000\/svg/g) ?? [];
    assert.equal(svgNamespace.length, 1);
    assert.ok(source.includes('createElementNS("http://www.w3.org/2000/svg"'));
  });
});

describe("honesty copy in charts (review: honesty-copy lens)", () => {
  test("the traffic strip lists the §1.3 traffic labels of the profile you set, naming each direction when they differ", () => {
    const run = P.win.runs[0];
    const traffic = run.series.traffic_by_hour;
    const label = (period, roadClass, parts, start, end) => labels.trafficLabel({ period, roadClass, parts, start: format.hourClock(start), end: format.hourClock(end) });
    // Default congestion (contract 6.2): highways away from SF ×1.2 at 07-09 and ×1.6 at 16-19; toward SF ×1.6 and ×1.2;
    // every highway ×1.3 at 19-20. The window D1 05:00 to D2 10:00 repeats the morning on day 2, listed once.
    const sf = [
      label("morning", "highway", [{ awayFrom: "SF", factor: "×1.2" }, { toward: "SF", factor: "×1.6" }], 7, 9),
      label("evening", "highway", [{ awayFrom: "SF", factor: "×1.6" }, { toward: "SF", factor: "×1.2" }], 16, 19),
      label("late", "highway", [{ factor: "×1.3" }], 19, 20),
    ];
    assert.deepEqual(charts.slowdownLabels({ traffic, roadClass: "HIGHWAY", area: "SF" }), sf);
    assert.equal(sf[1], "Evening slowdown you set: highways away from SF ×1.6, toward SF ×1.2, 16:00 to 19:00", "the design §1.3 traffic label");
    const strip = keep(charts.trafficStrip({ series: run.series, roadClass: "HIGHWAY", direction: "SJ>SF", seed: run.seed, window: P.window }));
    assert.deepEqual(all(strip.node, "[data-role=\"traffic-labels\"] li").map((li) => li.textContent), sf);
    // In-area trips: ×1.3 at 07-09 and 16-19 in every area.
    assert.deepEqual(charts.slowdownLabels({ traffic, roadClass: "IN_AREA" }), [
      label("morning", "in_area", [{ factor: "×1.3" }], 7, 9),
      label("evening", "in_area", [{ factor: "×1.3" }], 16, 19),
    ]);
    // Toward PEN the evening highways differ by route (from SF ×1.6, from SJ ×1.2), so each route direction is named.
    const pen = charts.slowdownLabels({ traffic, roadClass: "HIGHWAY", area: "PEN" }).find((t) => t.startsWith("Evening"));
    assert.ok(pen.includes("from SF to PEN ×1.6") && pen.includes("from SJ to PEN ×1.2"), pen);
  });

  test("the fork draws a depot's lot held and queue in lane A and lane B on the fork's clock", () => {
    const depots = ["SJ-1"];
    const group = keep(charts.carForkCharts({ pair: P.pair, baselineScenario: P.scenario, car: "SF-017", seed: 1001, depots }));
    assert.equal(all(group.node, "[data-role=\"fork-caption\"]").length, 1);
    const lots = group.charts.slice(2);
    assert.deepEqual(lots.map((c) => [c.chartId, c.node.getAttribute("data-lane"), c.node.getAttribute("data-depot")]), [["lot_and_queue", "A", "SJ-1"], ["lot_and_queue", "B", "SJ-1"]]);
    for (const [chart, lane, arm] of [[lots[0], "A", P.pair.baseline], [lots[1], "B", P.pair.candidate]]) {
      const name = labels.INSPECTOR.forkArms[lane];
      assert.equal(one(chart.node, "h3").textContent, labels.chartTitle({ title: labels.chartTitle({ title: labels.CHART_TEXT.titles.lot_and_queue, subject: "SJ-1" }), subject: name }));
      const depot = arm.log.depots.find((d) => d.id === "SJ-1");
      const [it, iHeld] = ["t", "stalls_held"].map((f) => depot.series_fields.indexOf(f));
      const held = Math.max(...depot.series.filter((row) => row[it] < P.window.end_s).map((row) => row[iHeld]));
      const lead = labels.forkDepotSummary({ lane: name, depot: "SJ-1", held, stalls: depot.parking, bayWait: "\u0000" }).split("\u0000")[0];
      assert.ok(summaryOf(chart).startsWith(lead), summaryOf(chart));
      assert.equal(one(chart.node, ".fl-chip-replay").textContent, labels.thisReplayChip(1001));
    }
    assert.equal(group.setCursor(70200), true);
    assert.equal(new Set(all(group.node, "[data-role=\"cursor\"]").map((c) => c.getAttribute("transform"))).size, 1, "every lane chart shares the clock");
    assert.throws(() => charts.carForkCharts({ pair: P.pair, baselineScenario: P.scenario, car: "SF-017", seed: 1001, depots: ["XX-9"] }), RangeError);
  });

  test("the wait chart summary puts this replay's completed rides beside its wait value", () => {
    const log = P.win.log;
    const window = P.window;
    const chart = keep(charts.metricByHourChart({ chart: "wait_p90_by_hour", runs: P.win.runs, seed: log.seed, window, population: { log, scenario: P.scenario } }));
    const plain = keep(charts.metricByHourChart({ chart: "wait_p90_by_hour", runs: P.win.runs, seed: log.seed, window }));
    // The summary may end with "; N hours had no value", after the wait value.
    const match = summaryOf(plain).match(/in the hour from (D[12] \d{2}:\d{2}), at ([^;]+?)(; [^.]+)?\.$/);
    assert.ok(match, summaryOf(plain));
    const run = P.win.runs.find((r) => r.seed === log.seed);
    const i = run.series.wait_p90_by_hour.starts_s.findIndex((t) => format.clock(t) === match[1]);
    const start = run.series.wait_p90_by_hour.starts_s[i];
    const count = computeMetric({ ...log, scenario: P.scenario, window: P.scenario.window }, { metric: "wait.population_n", scope: { window: { start_s: start, end_s: start + 3600 } } });
    assert.equal(summaryOf(chart), summaryOf(plain).replace(`at ${match[2]}`, `at ${labels.withWaitPopulation({ value: match[2], population: labels.waitPopulation(format.count(count.value)) })}`));
    assert.throws(() => charts.metricByHourChart({ chart: "wait_p90_by_hour", runs: P.win.runs, seed: log.seed, window, population: { log: { ...log, seed: log.seed + 1 }, scenario: P.scenario } }), RangeError);
  });
});
