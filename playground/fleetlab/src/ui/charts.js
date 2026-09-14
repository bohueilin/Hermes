// Charts of design §7.5 with the encodings of §8.3, built as SVG with createElementNS from real engine payloads
// (contract section 7: run_window, run_pair and run_experiment). No motion, no tooltips. The only layout input is the
// width a ResizeObserver reports for each plot box: the plot is redrawn at that width in real pixels, so 12 px text,
// 2 px lines and 8 px markers draw at their declared size (design §8.1, §8.3) instead of scaling with a fixed view box.
//
// Every chart is one `figure.fl-chart[data-chart]` holding, in order: a header (title, register chips, a Table toggle),
// a one-sentence summary that names its register (H-10), a model-limits chip listing the §5.8 simplifications that
// apply (H-7), a legend when it draws more than one series, the axis unit, the plot, and a table holding the same
// numbers (hidden until the toggle is pressed). Each builder returns `{node, chartId, setCursor(t_s), showTable(on)}`;
// group builders return `{node, charts, setCursor(t_s)}`.
//
// Decisions this file makes where the design is silent:
// - Every chart has exactly one `g[data-axis="measure"]`: the y-axis of a time chart, the lane names of a lane chart and
//   the value axis of a verdict strip, which runs horizontally. Two measures make two charts on one clock (§8.3): the
//   depot board is a bay-lanes chart plus a lot-and-queue chart, and the fork is a lanes chart plus an available-cars
//   strip. Time charts add one `g[data-axis="time"]` and the clock cursor, moved only through `transform`.
// - Arm comparison and verdict charts have no time axis, so their `setCursor` does nothing and returns false.
// - Descriptive delta rows are a table, not a chart: their metrics have different units and make no claim.
// - Metric-by-hour charts show seconds in minutes and fractions in percent, one decimal; verdict strips show seconds in
//   seconds and fractions as fractions, as the design's verdict layout does.
// - A replications band is drawn only from two replications; an hour where some replication is absent has no band
//   and its table cell reads `not available: metric absent in some replication`.

import { meanFleetLab, percentileFleetLab } from "../core/stats.js";
import { computeMetric, metricRow, STATE_FAMILIES } from "../model/metrics.js";
import { el } from "./dom.js";
import * as format from "./format.js";
import * as labels from "./labels.js";

/** Plot width in px before a width is known (tests, or a browser without ResizeObserver); the SVG scales to its box. */
export const CHART_WIDTH = 640;

/** Narrowest width a plot is drawn at; a narrower box scales it down. */
export const MIN_DRAW_WIDTH = 160;

/** Closest two time-axis labels may sit, in px: the 6-hour step doubles until labels are at least this far apart. */
export const MIN_TIME_TICK_GAP_PX = 48;

/** Drawn widths snap down to this step, so a one-pixel change does not redraw. */
const WIDTH_STEP_PX = 4;

/** The width createPlot draws at; responsive() sets it while it redraws a chart at its box width. */
let drawWidth = CHART_WIDTH;

/** Frames built by the outermost builder call in progress, in build order, or null outside a build. */
let building = null;

/**
 * The px width to draw a plot at for a box `boxWidth` px wide: snapped down to 4 px and at least MIN_DRAW_WIDTH; null
 * for a box with no width (hidden), which keeps the current drawing.
 */
export function drawWidthFor(boxWidth) {
  if (typeof boxWidth !== "number" || !(boxWidth >= 1)) return null;
  return Math.max(MIN_DRAW_WIDTH, Math.floor(boxWidth / WIDTH_STEP_PX) * WIDTH_STEP_PX);
}

/**
 * Runs a public builder and, where ResizeObserver exists, redraws each of its plots at the width of the box it sits in.
 * A redraw runs the same builder again at that width and swaps only the plot SVG, so the header, summary, table and
 * cursor position stay. A builder called from inside another build passes straight through.
 */
function responsive(build, options) {
  if (building !== null) return build(options);
  const frames = [];
  building = frames;
  let handle;
  try {
    handle = build(options);
  } finally {
    building = null;
  }
  const Observer = globalThis.ResizeObserver;
  if (frames.length === 0 || typeof Observer !== "function") return handle;
  const observer = new Observer((entries) => {
    const byWidth = new Map();
    for (const entry of entries) {
      const index = frames.findIndex((f) => f.plotBox === entry.target);
      const width = drawWidthFor(entry.contentRect?.width);
      if (index === -1 || width === null || width === frames[index].width) continue;
      byWidth.set(width, [...(byWidth.get(width) ?? []), index]);
    }
    for (const [width, indexes] of byWidth) {
      const fresh = [];
      const previous = drawWidth;
      building = fresh;
      drawWidth = width;
      try {
        build(options);
      } finally {
        building = null;
        drawWidth = previous;
      }
      if (fresh.length !== frames.length) continue;
      for (const i of indexes) frames[i].replot(fresh[i], width);
    }
  });
  for (const frame of frames) observer.observe(frame.plotBox);
  return handle;
}

const MARGIN = Object.freeze({ left: 72, right: 16, top: 12, bottom: 28 });
const WARM_UP_REASON = "warm-up, not counted";
const HOUR_S = 3600;

/** Stack order of the state families (design §8.2) and the class that sets each family's colour. */
export const FAMILY_ORDER = Object.freeze(["riderWork", "emptyDrive", "available", "atDepot"]);
const FAMILY_CLASS = Object.freeze({
  riderWork: "fl-fam-rider",
  emptyDrive: "fl-fam-empty",
  available: "fl-fam-available",
  atDepot: "fl-fam-depot",
});

/** The §5.8 simplifications (keys of labels.MODEL_LIMITS) that apply to each chart. */
export const CHART_LIMITS = Object.freeze({
  fleet_state: Object.freeze(["warmUp", "areasArePoints", "dispatchBaseline", "noRetasking", "noBattery", "oneSeedAnimated"]),
  wait_p90_by_hour: Object.freeze(["warmUp", "waitCountsCompleted", "assignedRiderWaits", "areasArePoints", "arrivals", "dispatchBaseline", "oneSeedAnimated"]),
  congested_empty_by_hour: Object.freeze(["warmUp", "hourlyTraffic", "areasArePoints", "noRetasking", "oneSeedAnimated"]),
  turnaround_by_arrival_hour: Object.freeze(["warmUp", "fixedTaskTimes", "noStaff", "oneSeedAnimated"]),
  bay_wait_by_depot: Object.freeze(["warmUp", "fixedTaskTimes", "noStaff", "oneSeedAnimated"]),
  available_by_area: Object.freeze(["warmUp", "areasArePoints", "dispatchBaseline", "noRetasking", "noBattery", "oneSeedAnimated"]),
  demand_by_hour: Object.freeze(["arrivals", "oneSeedAnimated"]),
  traffic_by_hour: Object.freeze(["hourlyTraffic"]),
  arm_comparison: Object.freeze(["intervalIsSimulationOnly", "arrivals", "dispatchBaseline"]),
  car_timeline: Object.freeze(["areasArePoints", "hourlyTraffic", "fixedTaskTimes", "noRetasking", "noBattery", "oneSeedAnimated"]),
  available_strip: Object.freeze(["warmUp", "areasArePoints", "dispatchBaseline", "noRetasking", "oneSeedAnimated"]),
  bay_lanes: Object.freeze(["fixedTaskTimes", "noStaff", "oneSeedAnimated"]),
  lot_and_queue: Object.freeze(["fixedTaskTimes", "noStaff", "oneSeedAnimated"]),
  verdict_primary: Object.freeze(["intervalIsSimulationOnly", "arrivals", "dispatchBaseline"]),
  verdict_guardrail: Object.freeze(["arrivals", "dispatchBaseline"]),
  verdict_descriptive: Object.freeze(["arrivals", "dispatchBaseline"]),
});

/** Extra simplifications by metric family, added to a chart's own list when it shows that metric. */
const METRIC_LIMITS = Object.freeze({
  wait: ["waitCountsCompleted", "assignedRiderWaits"],
  unserved: ["assignedRiderWaits"],
  requests: ["assignedRiderWaits"],
  depot: ["fixedTaskTimes", "noStaff"],
  exposure: ["hourlyTraffic"],
  vehicle: ["areasArePoints"],
  fleet: ["noRetasking"],
});

// ---------------------------------------------------------------------------------------------------------------
// Scales and small helpers.

let idCounter = 0;

function uid(prefix) {
  idCounter += 1;
  return `fl-${prefix}-${String(idCounter)}`;
}

function round2(x) {
  const r = Math.round(x * 100) / 100;
  return r === 0 ? 0 : r;
}

/** A linear map from domain [d0, d1] to pixels [r0, r1], rounded to 0.01 px; a zero-width domain maps to the middle. */
export function linearScale([d0, d1], [r0, r1]) {
  if (d1 === d0) return () => round2((r0 + r1) / 2);
  return (v) => round2(r0 + ((v - d0) * (r1 - r0)) / (d1 - d0));
}

/** Round tick values covering [min, max] with about `count` steps: `{domain, ticks, decimals}` (unit of the values). */
export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new TypeError("tick bounds must be finite numbers");
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= lo === 0 ? 0 : pad;
    hi += pad;
  }
  const raw = (hi - lo) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const multiple = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw - raw * 1e-12);
  const step = multiple * power;
  const ticks = [];
  for (let i = Math.floor(lo / step + 1e-9); i <= Math.ceil(hi / step - 1e-9); i += 1) {
    const t = Number((i * step).toFixed(10));
    ticks.push(t === 0 ? 0 : t);
  }
  const decimals = Math.max(0, Math.min(6, Math.ceil(-Math.log10(step) + (multiple === 2.5 ? 1 : 0) - 1e-9)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, decimals };
}

function isValue(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function isAbsent(v) {
  return v !== null && typeof v === "object" && typeof v.absent === "string";
}

/** Throws unless every entry is a finite number or `{absent: reason}`: nothing else may reach a chart. */
function checkValues(values, what) {
  if (!Array.isArray(values)) throw new TypeError(`${what} must be an array`);
  for (const v of values) {
    if (!isValue(v) && !isAbsent(v)) throw new TypeError(`${what} holds a value that is neither a number nor {absent}`);
  }
  return values;
}

/** The metric name of a metric key: `wait.p90_s{area=SJ}` gives `wait.p90_s`. */
function baseName(metricKey) {
  const brace = metricKey.indexOf("{");
  return brace === -1 ? metricKey : metricKey.slice(0, brace);
}

/**
 * A metric key as a chart names it (design §7.2 setup): the metric name, then each scope value, the window on the
 * simulated clock. `wait.p90_s{area=SF,window=111600-118800}` gives `wait.p90_s · SF · D2 07:00 to 09:00`. Tables keep
 * the key itself.
 */
export function metricSubject(metricKey) {
  const brace = metricKey.indexOf("{");
  if (brace === -1 || !metricKey.endsWith("}")) return metricKey;
  const scopes = metricKey.slice(brace + 1, -1).split(",").map((part) => {
    const [name, value] = part.split("=");
    if (name !== "window") return value;
    const [start, end] = value.split("-").map(Number);
    const startText = format.clock(start);
    const endText = format.clock(end);
    const sameDay = startText.split(" ")[0] === endText.split(" ")[0];
    return labels.windowScope({ start: startText, end: sameDay ? endText.split(" ")[1] : endText });
  });
  return labels.scopedMetric({ metric: metricKey.slice(0, brace), scopes });
}

function registryRow(metricKey) {
  const row = metricRow(baseName(metricKey));
  if (row === null) throw new RangeError(`unknown metric ${metricKey}`);
  return row;
}

/** Display rules of a metric on a time or arm chart: seconds as minutes, fractions as percent, counts as counts. */
function chartUnit(metricKey) {
  const row = registryRow(metricKey);
  if (row.engine_unit === "s") {
    return {
      scale: (v) => v / 60,
      text: (v) => `${format.number(v / 60, 1)} ${labels.UNITS.minutes}`,
      tick: (t, d) => format.number(t, d),
      unit: labels.UNITS.minutes,
    };
  }
  if (row.engine_unit === "ppm") {
    return {
      scale: (v) => v * 100,
      text: (v) => format.percent(v, 1),
      tick: (t, d) => `${format.number(t, d)}${labels.UNITS.percent}`,
      unit: labels.UNITS.percent,
    };
  }
  return {
    scale: (v) => v,
    text: (v) => format.number(v, Number.isInteger(v) ? 0 : 1),
    tick: (t, d) => format.number(t, d),
    unit: row.unit,
  };
}

/** A threshold without trailing zeros, up to six decimals: 0.02, 30, 0.1. */
function trimmed(v) {
  const text = format.number(v, 6);
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}

/** Display rules of a metric on a verdict strip: seconds in seconds, fractions as fractions (design §7.2 verdict). */
function verdictUnit(metricKey) {
  const row = registryRow(metricKey);
  if (row.engine_unit === "s") {
    return {
      signed: (v) => `${format.signed(v, 1)} ${labels.UNITS.seconds}`,
      plain: (v) => `${format.number(v, 1)} ${labels.UNITS.seconds}`,
      threshold: (v) => `${trimmed(v)} ${labels.UNITS.seconds}`,
      tick: (t, d) => format.signed(t, d),
      unit: labels.UNITS.seconds,
    };
  }
  if (row.engine_unit === "ppm") {
    return { signed: (v) => format.signed(v, 3), plain: (v) => format.number(v, 3), threshold: trimmed, tick: (t, d) => format.signed(t, d), unit: "" };
  }
  return {
    signed: (v) => format.signed(v, 1),
    plain: (v) => format.number(v, 1),
    threshold: trimmed,
    tick: (t, d) => format.signed(t, d),
    unit: row.unit,
  };
}

/** Model-limits keys for a chart, plus those of the metric it shows, without repeats. */
function limitsFor(chartKey, metricKey = null) {
  const keys = [...CHART_LIMITS[chartKey]];
  if (metricKey !== null) keys.push(...(METRIC_LIMITS[baseName(metricKey).split(".")[0]] ?? []));
  return [...new Set(keys)];
}

/** Hour edges of an hourly series: its bucket starts, then the window end (seconds). */
function hourEdges(starts, window) {
  if (!Array.isArray(starts) || starts.length === 0) throw new TypeError("a series needs at least one bucket");
  if (starts[0] !== window.start_s) throw new RangeError("series starts must begin at the window start");
  return [...starts, window.end_s];
}

/** Index ranges `[from, to)` of consecutive entries for which `keyOf(i)` returns the same non-null key. */
function runsOf(length, keyOf) {
  const runs = [];
  for (let i = 0; i < length; i += 1) {
    const key = keyOf(i);
    if (key === null) continue;
    const last = runs[runs.length - 1];
    if (last && last.to === i && last.key === key) last.to = i + 1;
    else runs.push({ from: i, to: i + 1, key });
  }
  return runs;
}

/** Path of a step line over entries [from, to) with x edges `xs` and pixel values `ys`. */
function stepPath(xs, ys, from, to) {
  let d = `M ${xs[from]} ${ys[from]} H ${xs[from + 1]}`;
  for (let i = from + 1; i < to; i += 1) d += ` V ${ys[i]} H ${xs[i + 1]}`;
  return d;
}

/** Closed path of a stepped band over entries [from, to): along `upper`, then back along `lower`. */
function stepBandPath(xs, upper, lower, from, to) {
  let d = stepPath(xs, upper, from, to);
  d += ` V ${lower[to - 1]} H ${xs[to - 1]}`;
  for (let i = to - 2; i >= from; i -= 1) d += ` V ${lower[i]} H ${xs[i]}`;
  return `${d} Z`;
}

function overlap(a0, a1, b0, b1) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function familyOf(state) {
  for (const family of FAMILY_ORDER) if (STATE_FAMILIES[family].includes(state)) return family;
  throw new RangeError(`state ${String(state)} has no family`);
}

function areaName(id) {
  const name = labels.MAP.areas[id];
  if (typeof name !== "string") throw new RangeError(`unknown area ${String(id)}`);
  return name;
}

// ---------------------------------------------------------------------------------------------------------------
// SVG and chart furniture.

function svg(tag, attrs = {}, text = undefined) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgText(x, y, text, attrs = {}) {
  return svg("text", { x, y, class: "fl-small-label", fill: "currentColor", ...attrs }, text);
}

/** Seconds between time-axis labels: 6 hours, doubled until labels sit at least MIN_TIME_TICK_GAP_PX apart. */
export function timeTickStep(timeDomain, plotWidthPx) {
  const span = timeDomain[1] - timeDomain[0];
  let step = 6 * HOUR_S;
  while (span > 0 && step < span && (plotWidthPx * step) / span < MIN_TIME_TICK_GAP_PX) step *= 2;
  return step;
}

/** How many value ticks fit across `plotWidthPx`: one per 72 px, between 2 and `most`. */
function valueTickCount(plotWidthPx, most) {
  return Math.max(2, Math.min(most, Math.floor(plotWidthPx / 72)));
}

/** The plot: an SVG with a hatch pattern, grid, marks, one measure axis, an optional time axis and clock cursor. */
function createPlot({ height, plotTop, plotBottom, timeDomain = null, left = MARGIN.left }) {
  const width = drawWidth;
  const root = svg("svg", { viewBox: `0 0 ${String(width)} ${String(height)}`, width: "100%", preserveAspectRatio: "xMinYMin meet", "data-draw-width": width, style: "overflow: visible" });
  // overflow: visible lets an end tick label centred on the plot edge spill into the card padding instead of being cut.
  const hatchId = uid("hatch");
  const pattern = svg("pattern", { id: hatchId, patternUnits: "userSpaceOnUse", width: 6, height: 6, patternTransform: "rotate(45)" });
  pattern.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "fl-hatch-line" }));
  const defs = svg("defs");
  defs.appendChild(pattern);
  const grid = svg("g", { "data-role": "grid" });
  const marks = svg("g", { "data-role": "marks" });
  const measureAxis = svg("g", { "data-axis": "measure" });
  for (const node of [defs, grid, marks, measureAxis]) root.appendChild(node);
  const plot = { root, grid, marks, measureAxis, hatchId, left, right: width - MARGIN.right, plotTop, plotBottom, x: null };
  plot.setCursor = () => false;
  if (timeDomain !== null) {
    const x = linearScale(timeDomain, [left, plot.right]);
    plot.x = x;
    const timeAxis = svg("g", { "data-axis": "time" });
    timeAxis.appendChild(svg("line", { x1: left, x2: plot.right, y1: plotBottom, y2: plotBottom, class: "fl-chart__axis" }));
    const step = timeTickStep(timeDomain, plot.right - left);
    const firstTick = Math.ceil(timeDomain[0] / step) * step;
    for (let t = firstTick; t <= timeDomain[1]; t += step) {
      timeAxis.appendChild(svg("line", { x1: x(t), x2: x(t), y1: plotBottom, y2: plotBottom + 4, class: "fl-chart__axis" }));
      timeAxis.appendChild(svgText(x(t), plotBottom + 18, format.clockHour(t), { "text-anchor": "middle", "data-value": t }));
    }
    root.appendChild(timeAxis);
    const cursor = svg("line", {
      x1: 0, x2: 0, y1: plotTop, y2: plotBottom, class: "fl-chart__cursor", "data-role": "cursor", visibility: "hidden", "aria-hidden": "true",
    });
    root.appendChild(cursor);
    plot.setCursor = (t_s) => {
      if (!isValue(t_s) || t_s < timeDomain[0] || t_s > timeDomain[1]) {
        cursor.setAttribute("visibility", "hidden");
        return false;
      }
      cursor.setAttribute("transform", `translate(${String(x(t_s))} 0)`);
      cursor.setAttribute("visibility", "visible");
      return true;
    };
  }
  return plot;
}

/** Horizontal gridlines and tick labels of a vertical measure scale between `top` and `bottom`. */
function drawVerticalTicks(plot, y, ticks, tickText) {
  for (const t of ticks) {
    plot.grid.appendChild(svg("line", { x1: plot.left, x2: plot.right, y1: y(t), y2: y(t), class: "fl-chart__grid" }));
    plot.measureAxis.appendChild(svgText(plot.left - 6, y(t) + 4, tickText(t), { "text-anchor": "end", "data-value": t }));
  }
}

/** A focusable hatched gap whose name is the absent text (design §8.3), drawn over [x0, x1] and [top, bottom]. */
function hatch(plot, x0, x1, top, bottom, reason) {
  const text = labels.absentValue(reason);
  const rect = svg("rect", {
    x: x0, y: top, width: round2(Math.max(0, x1 - x0)), height: round2(bottom - top), fill: `url(#${plot.hatchId})`,
    tabindex: 0, role: "img", "aria-label": text, "data-role": "absent", "data-reason": reason,
  });
  rect.appendChild(svg("title", {}, text));
  plot.marks.appendChild(rect);
  return rect;
}

const SWATCH_STYLE = Object.freeze({
  ink: "fill: var(--ink)",
  muted: "fill: var(--muted)",
  inkStroke: "stroke: var(--ink); stroke-width: 2px",
  mutedStroke: "stroke: var(--muted); stroke-width: 2px",
});

function swatch(kind) {
  // flex: none keeps the swatch at 24 px in a narrow legend row, so its 2 px line is not squeezed thinner.
  const box = svg("svg", { width: 24, height: 12, viewBox: "0 0 24 12", "aria-hidden": "true", focusable: "false", style: "flex: none" });
  const add = (node) => box.appendChild(node);
  if (kind === "line") add(svg("line", { x1: 1, x2: 23, y1: 6, y2: 6, class: "fl-chart__line" }));
  else if (kind === "line-muted") add(svg("line", { x1: 1, x2: 23, y1: 6, y2: 6, class: "fl-chart__line", style: SWATCH_STYLE.mutedStroke }));
  else if (kind === "band-line") {
    add(svg("rect", { x: 1, y: 1, width: 22, height: 10, class: "fl-chart__band" }));
    add(svg("line", { x1: 1, x2: 23, y1: 6, y2: 6, class: "fl-chart__line" }));
  } else if (kind === "band") add(svg("rect", { x: 1, y: 1, width: 22, height: 10, class: "fl-chart__band" }));
  else if (kind === "hatch") {
    const id = uid("hatch");
    const pattern = svg("pattern", { id, patternUnits: "userSpaceOnUse", width: 6, height: 6, patternTransform: "rotate(45)" });
    pattern.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "fl-hatch-line" }));
    const defs = svg("defs");
    defs.appendChild(pattern);
    add(defs);
    add(svg("rect", { x: 1, y: 1, width: 22, height: 10, fill: `url(#${id})` }));
  } else if (kind === "dot") add(svg("circle", { cx: 12, cy: 6, r: 4, style: SWATCH_STYLE.ink }));
  else if (kind === "bar-hollow") add(svg("rect", { x: 4, y: 1, width: 16, height: 10, class: "fl-chart__band", style: "stroke: var(--ink); stroke-width: 1px" }));
  else if (kind === "bar-muted") add(svg("rect", { x: 4, y: 1, width: 16, height: 10, style: SWATCH_STYLE.muted }));
  else if (kind === "bar-ink") add(svg("rect", { x: 1, y: 3, width: 22, height: 6, style: SWATCH_STYLE.ink }));
  else if (kind === "tick" || kind === "whisker") add(svg("line", { x1: 12, x2: 12, y1: 0, y2: 12, class: "fl-chart__line" }));
  else if (kind.startsWith("family:")) {
    const family = kind.slice("family:".length);
    add(svg("rect", { x: 1, y: 1, width: 22, height: 10, class: FAMILY_CLASS[family], fill: "currentColor" }));
    add(svg("rect", { x: 1, y: 1, width: 22, height: 10, class: "fl-glyph-edge" }));
  } else throw new RangeError(`unknown legend swatch ${kind}`);
  return box;
}

function legendNode(items) {
  return el(
    "ul",
    { "data-role": "legend", style: "display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 4px 0; padding: 0; list-style: none" },
    items.map((item) => el("li", { "data-swatch": item.swatch, style: "display: inline-flex; align-items: center; gap: 4px" }, [swatch(item.swatch), el("span", { class: "fl-small-label" }, item.label)])),
  );
}

function chipNode(chip) {
  if (chip.kind === "replay") return el("span", { class: "fl-chip-replay", "data-register": "replay" }, labels.thisReplayChip(chip.seed));
  if (chip.kind === "across") return el("span", { class: "fl-chip-across", "data-register": "across" }, labels.acrossReplicationsChip(chip.count));
  throw new RangeError(`unknown register ${String(chip.kind)}`);
}

/** The model-limits chip (design H-7): its heading, then every applicable §5.8 caveat as visible list text. */
function limitsChip(keys) {
  const items = keys.map((key) => {
    const text = labels.MODEL_LIMITS[key];
    if (typeof text !== "string" || key === "heading") throw new RangeError(`unknown model limit ${key}`);
    return el("li", { "data-limit": key }, text);
  });
  return el("details", { class: "fl-limits-chip", "data-role": "model-limits" }, [
    el("summary", {}, labels.MODEL_LIMITS.heading),
    el("ul", { style: "margin: 4px 0 0; padding-inline-start: 16px" }, items),
  ]);
}

/** A status word with its glyph (design §8.1): only verdict words and guardrails reach this. */
function statusChip(entry) {
  return el("span", { class: "fl-verdict-chip", "data-status": entry.status }, [
    el("span", { class: "fl-verdict-chip__glyph", "aria-hidden": "true" }, entry.glyph),
    el("span", { class: "fl-verdict-chip__word" }, entry.word),
  ]);
}

function tableNode(heads, rows) {
  const cell = (tag, text, attrs = {}) => {
    const absent = text.startsWith(labels.ABSENT_PREFIX);
    return el(tag, { ...attrs, class: absent ? "fl-absent" : null }, text);
  };
  return el("table", { class: "fl-table" }, [
    el("thead", {}, el("tr", {}, heads.map((h) => el("th", { scope: "col" }, h)))),
    el("tbody", {}, rows.map((cells) => el("tr", {}, cells.map((c, i) => (i === 0 ? cell("th", c, { scope: "row" }) : cell("td", c)))))),
  ]);
}

/** Assembles one chart figure and returns its handle. */
function chartFrame({ chartId, title, chips, summary, limits, legend = [], axisUnit = null, extras = [], plot, heads, rows }) {
  const id = uid("chart");
  const titleId = `${id}-title`;
  const summaryId = `${id}-summary`;
  const tableId = `${id}-table`;
  const toggle = el("button", { type: "button", class: "fl-button", "aria-pressed": "false", "aria-controls": tableId, "data-role": "table-toggle" }, labels.CHARTS.table);
  const header = el("div", { style: "display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px" }, [
    el("h3", { class: "fl-title", id: titleId, style: "margin: 0" }, title),
    chips.map(chipNode),
    toggle,
  ]);
  // A group, not an img, so the focusable hatched gaps inside keep their names for assistive technology.
  plot.root.setAttribute("role", "group");
  plot.root.setAttribute("aria-labelledby", `${titleId} ${summaryId}`);
  const plotBox = el("div", { "data-view": "chart" }, plot.root);
  const tableBox = el("div", { class: "fl-scroll", id: tableId, "data-view": "table" }, tableNode(heads, rows));
  tableBox.hidden = true;
  const node = el("figure", { class: "fl-chart", "data-chart": chartId, "aria-labelledby": titleId, style: "margin: 0" }, [
    header,
    el("p", { class: "fl-chart__summary", id: summaryId, "data-role": "summary", style: "margin: 4px 0" }, summary),
    limitsChip(limits),
    extras,
    legend.length > 0 ? legendNode(legend) : null,
    axisUnit ? el("p", { class: "fl-small-label", "data-role": "axis-unit", style: "margin: 0" }, axisUnit) : null,
    plotBox,
    tableBox,
  ]);
  const showTable = (on) => {
    tableBox.hidden = !on;
    plotBox.hidden = on;
    toggle.setAttribute("aria-pressed", on ? "true" : "false");
  };
  toggle.addEventListener("click", () => showTable(tableBox.hidden));
  let current = plot;
  let cursorAt = null;
  const setCursor = (t_s) => {
    cursorAt = t_s;
    return current.setCursor(t_s);
  };
  const frame = {
    plotBox,
    plot,
    width: plot.right + MARGIN.right,
    /** Swaps in the plot of the same chart redrawn at `width`, keeping this figure's names and cursor. */
    replot(fresh, width) {
      fresh.plot.root.setAttribute("aria-labelledby", `${titleId} ${summaryId}`);
      plotBox.replaceChildren(fresh.plot.root);
      current = fresh.plot;
      frame.width = width;
      if (cursorAt !== null) current.setCursor(cursorAt);
    },
  };
  if (building !== null) building.push(frame);
  return { node, chartId, setCursor, showTable };
}

function group(kind, nodes, charts) {
  return {
    node: el("div", { "data-chart-group": kind, style: "display: grid; gap: 12px" }, nodes),
    charts,
    setCursor: (t_s) => charts.map((c) => c.setCursor(t_s)).some(Boolean),
  };
}

/** Moves the clock cursor of every chart or group handle to `t_s` (seconds); returns how many drew it. */
export function setCursorAll(handles, t_s) {
  let drawn = 0;
  for (const handle of handles) if (handle.setCursor(t_s)) drawn += 1;
  return drawn;
}

// ---------------------------------------------------------------------------------------------------------------
// Fleet state: 100% stacked area by hour (P15: every hour sums to the fleet).

/** Fleet state chart for one replay from `series.fleet_state`; `window` is the scenario window in seconds. */
function buildFleetStateChart({ series, window, seed }) {
  const s = series.fleet_state;
  const edges = hourEdges(s.starts_s, window);
  const n = s.starts_s.length;
  for (const family of FAMILY_ORDER) checkValues(s.families[family], `fleet_state.${family}`);
  const totals = s.starts_s.map((_, i) => FAMILY_ORDER.reduce((sum, f) => sum + s.families[f][i], 0));
  const height = 176;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;
  const plot = createPlot({ height, plotTop, plotBottom, timeDomain: [edges[0], edges[n]] });
  const y = linearScale([0, 100], [plotBottom, plotTop]);
  drawVerticalTicks(plot, y, [0, 25, 50, 75, 100], (t) => `${format.number(t, 0)}${labels.UNITS.percent}`);
  const xs = edges.map((t) => plot.x(t));
  let cumulative = new Array(n).fill(0);
  for (const family of FAMILY_ORDER) {
    const share = (c, i) => (totals[i] === 0 ? 0 : (100 * c) / totals[i]);
    const upper = cumulative.map((c, i) => y(100 - share(c, i)));
    cumulative = cumulative.map((c, i) => c + s.families[family][i]);
    const lower = cumulative.map((c, i) => y(100 - share(c, i)));
    plot.marks.appendChild(svg("path", {
      d: stepBandPath(xs, upper, lower, 0, n), class: FAMILY_CLASS[family], fill: "currentColor",
      style: "stroke: var(--panel); stroke-width: 2px", "data-series": family,
    }));
  }
  const cars = (family, i) => s.families[family][i] / (edges[i + 1] - edges[i]);
  let busiest = 0;
  for (let i = 1; i < n; i += 1) if (cars("atDepot", i) > cars("atDepot", busiest)) busiest = i;
  return chartFrame({
    chartId: "fleet_state",
    title: labels.CHARTS.titles.fleet_state,
    chips: [{ kind: "replay", seed }],
    summary: labels.fleetStateHourSummary({
      register: labels.REGISTERS.thisReplaySentence,
      clock: format.clock(s.starts_s[busiest]),
      atDepot: format.number(cars("atDepot", busiest), 1),
      fleet: s.fleet,
    }),
    limits: limitsFor("fleet_state"),
    legend: FAMILY_ORDER.map((f) => ({ swatch: `family:${f}`, label: labels.MAP.families[f] })),
    axisUnit: labels.CHART_TEXT.axes.shareOfFleetTime,
    plot,
    heads: [labels.CHART_TEXT.heads.hour, ...FAMILY_ORDER.map((f) => labels.MAP.families[f])],
    rows: s.starts_s.map((t, i) => [format.clock(t), ...FAMILY_ORDER.map((f) => format.number(cars(f, i), 1))]),
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Metric by hour: a step line for this replay over a 10th to 90th percentile band across replications.

const METRIC_CHARTS = Object.freeze({
  wait_p90_by_hour: { metric: "wait.p90_s", group: "areas", scopeKey: "area", panels: ["all"] },
  congested_empty_by_hour: { metric: "exposure.congested_empty_s", group: "areas", scopeKey: "area", panels: ["all"] },
  turnaround_by_arrival_hour: { metric: "depot.turnaround_p90_s", group: "depots", scopeKey: "depot", panels: ["all"] },
  bay_wait_by_depot: { metric: "depot.bay_wait_p90_s", group: "depots", scopeKey: "depot", panels: null },
  available_by_area: { metric: "fleet.available_fraction", group: "areas", scopeKey: "area", panels: null },
});

/** Chart ids metricByHourChart draws. */
export const METRIC_CHART_IDS = Object.freeze(Object.keys(METRIC_CHARTS));

/** The band of one hour across replications: `{p10, p90}` or `{absent: reason}` (values in the metric's unit). */
function bandAt(values) {
  if (values.every(isValue)) return { p10: percentileFleetLab(values, 0.1), p90: percentileFleetLab(values, 0.9) };
  const reasons = new Set(values.filter(isAbsent).map((v) => v.absent));
  if (values.every(isAbsent) && reasons.size === 1) return { absent: [...reasons][0] };
  return { absent: labels.ABSENT_REASONS.metricAbsentInSomeReplication };
}

/** First absence reason in a list that is not the warm-up, else the warm-up reason (null when nothing is absent). */
function telling(values) {
  const absent = values.filter(isAbsent).map((v) => v.absent);
  return absent.find((r) => r !== WARM_UP_REASON) ?? absent[0] ?? null;
}

/**
 * One metric by hour from a run_window payload's `runs`: this replay (`seed`) as a step line, the band across every run,
 * one panel per key of `panels` ("all", an area id or a depot id) on one shared y-axis. `window` in seconds. `population`
 * (`{log, scenario}` of the replay `seed`) puts the completed rides a wait value counts beside the summary's wait (§5.8).
 */
function buildMetricByHourChart({ chart, runs, seed, window, panels = null, population = null }) {
  const def = METRIC_CHARTS[chart];
  if (def === undefined) throw new RangeError(`unknown metric-by-hour chart ${String(chart)}`);
  const replayRun = runs.find((r) => r.seed === seed);
  if (replayRun === undefined) throw new RangeError(`no run for seed ${String(seed)}`);
  const own = replayRun.series[chart];
  const keys = panels ?? def.panels ?? Object.keys(own[def.group]);
  const pick = (series, key) => {
    const values = key === "all" ? series.all : series[def.group]?.[key];
    return checkValues(values, `${chart}.${key}`);
  };
  const unit = chartUnit(def.metric);
  const edges = hourEdges(own.starts_s, window);
  const n = own.starts_s.length;
  const withBand = runs.length >= 2;
  const data = keys.map((key) => {
    const replay = pick(own, key);
    if (replay.length !== n) throw new RangeError(`${chart}.${key} does not match its hours`);
    const band = withBand ? replay.map((_, i) => bandAt(runs.map((r) => pick(r.series[chart], key)[i]))) : null;
    return { key, metric: key === "all" ? def.metric : `${def.metric}{${def.scopeKey}=${key}}`, replay, band };
  });

  const displayed = data.flatMap((p) => [...p.replay.filter(isValue), ...(p.band ?? []).filter((b) => isValue(b.p90)).map((b) => b.p90)]);
  const ticks = niceTicks(0, displayed.length === 0 ? 1 : Math.max(...displayed.map(unit.scale)), 3);
  const panelHeight = 64;
  const gap = 16;
  const plotTop = MARGIN.top;
  const plotBottom = plotTop + keys.length * (panelHeight + gap) - gap;
  const plot = createPlot({ height: plotBottom + MARGIN.bottom, plotTop, plotBottom, timeDomain: [edges[0], edges[n]] });
  const xs = edges.map((t) => plot.x(t));
  data.forEach((panel, k) => {
    const top = plotTop + k * (panelHeight + gap);
    const y = linearScale(ticks.domain, [top + panelHeight, top]);
    drawVerticalTicks(plot, y, ticks.ticks, (t) => unit.tick(t, ticks.decimals));
    if (keys.length > 1) {
      const name = panel.key === "all" ? labels.CHART_TEXT.wholeFleet : panel.key;
      plot.marks.appendChild(svgText(plot.left + 4, top + 12, name, { "data-role": "panel-label" }));
    }
    const py = (v) => y(unit.scale(v));
    if (panel.band !== null) {
      const upper = panel.band.map((b) => (isValue(b.p90) ? py(b.p90) : 0));
      const lower = panel.band.map((b) => (isValue(b.p10) ? py(b.p10) : 0));
      for (const run of runsOf(n, (i) => (isValue(panel.band[i].p90) ? "band" : null))) {
        plot.marks.appendChild(svg("path", { d: stepBandPath(xs, upper, lower, run.from, run.to), class: "fl-chart__band", "data-series": "band", "data-panel": panel.key }));
      }
    }
    const ys = panel.replay.map((v) => (isValue(v) ? py(v) : 0));
    for (const run of runsOf(n, (i) => (isValue(panel.replay[i]) ? "line" : null))) {
      plot.marks.appendChild(svg("path", { d: stepPath(xs, ys, run.from, run.to), class: "fl-chart__line", "data-series": "replay", "data-panel": panel.key }));
    }
    for (const run of runsOf(n, (i) => (isAbsent(panel.replay[i]) ? panel.replay[i].absent : null))) {
      hatch(plot, xs[run.from], xs[run.to], top, top + panelHeight, run.key).setAttribute("data-panel", panel.key);
    }
  });

  const register = labels.REGISTERS.thisReplaySentence;
  let summary;
  if (chart === "available_by_area") {
    let lowest = null;
    for (const panel of data) {
      panel.replay.forEach((v, i) => {
        if (isValue(v) && (lowest === null || v < lowest.v)) lowest = { v, i, key: panel.key };
      });
    }
    summary = lowest === null
      ? labels.chartAbsentSummary({ register, subject: def.metric, reason: telling(data.flatMap((p) => p.replay)) })
      : labels.availableSummary({ register, area: areaName(lowest.key), lowest: unit.text(lowest.v), clock: format.clock(own.starts_s[lowest.i]) });
  } else {
    let highest = null;
    for (const panel of data) {
      panel.replay.forEach((v, i) => {
        if (isValue(v) && (highest === null || v > highest.v)) highest = { v, i, panel };
      });
    }
    const target = highest === null ? data[0] : highest.panel;
    const absentHours = target.replay.filter(isAbsent).length;
    let highestText = highest === null ? null : unit.text(highest.v);
    if (highest !== null && def.metric === "wait.p90_s" && population !== null) {
      if (population.log.seed !== seed) throw new RangeError("the population log is not the replay's log");
      const scope = { window: { start_s: own.starts_s[highest.i], end_s: edges[highest.i + 1] } };
      if (highest.panel.key !== "all") scope.area = highest.panel.key;
      const count = computeMetric({ ...population.log, scenario: population.scenario, window: population.scenario.window }, { metric: "wait.population_n", scope });
      highestText = labels.withWaitPopulation({ value: highestText, population: isAbsent(count) ? format.valueText(count, format.count) : labels.waitPopulation(format.count(count.value)) });
    }
    summary = labels.metricByHourSummary({
      register,
      metric: metricSubject(target.metric),
      highest: highest === null ? { absent: telling(data.flatMap((p) => p.replay)) } : highestText,
      clock: highest === null ? undefined : format.clock(own.starts_s[highest.i]),
      absentHours,
    });
  }

  const anyAbsent = data.some((p) => p.replay.some(isAbsent));
  const legend = [];
  if (withBand) legend.push({ swatch: "band-line", label: labels.replicationBandLegend(runs.length) });
  if (anyAbsent) legend.push({ swatch: "hatch", label: labels.CHARTS.hatchedGap });
  const multi = keys.length > 1;
  const heads = [labels.CHART_TEXT.heads.hour];
  if (multi) heads.push(labels.CHART_TEXT.heads.panel);
  heads.push(labels.CHART_TEXT.heads.thisReplay);
  if (withBand) heads.push(labels.CHART_TEXT.heads.p10, labels.CHART_TEXT.heads.p90);
  const rows = [];
  for (const panel of data) {
    panel.replay.forEach((v, i) => {
      const row = [format.clock(own.starts_s[i])];
      if (multi) row.push(panel.key === "all" ? labels.CHART_TEXT.wholeFleet : panel.key);
      row.push(format.valueText(v, unit.text));
      if (withBand) {
        const b = panel.band[i];
        row.push(isAbsent(b) ? format.valueText(b, unit.text) : unit.text(b.p10), isAbsent(b) ? format.valueText(b, unit.text) : unit.text(b.p90));
      }
      rows.push(row);
    });
  }
  const chips = [{ kind: "replay", seed }];
  if (withBand) chips.push({ kind: "across", count: runs.length });
  return chartFrame({
    chartId: chart,
    title: labels.CHARTS.titles[chart],
    chips,
    summary,
    limits: limitsFor(chart, def.metric),
    legend,
    axisUnit: unit.unit,
    plot,
    heads,
    rows,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Demand and traffic strips under the scrubber.

function rateText(v) {
  return format.number(v, Number.isInteger(v) ? 0 : 1);
}

/** Demand strip for one area: the declared requests per hour and this replay's accepted requests (series of a run). */
function buildDemandStrip({ series, area, seed, window }) {
  const d = series.demand_by_hour.areas[area];
  if (d === undefined) throw new RangeError(`no demand series for area ${String(area)}`);
  const declared = checkValues(d.declared_per_h, "declared_per_h");
  const accepted = checkValues(d.accepted, "accepted");
  const starts = series.demand_by_hour.starts_s;
  const edges = hourEdges(starts, window);
  const n = starts.length;
  const height = 104;
  const plotTop = 8;
  const plotBottom = height - MARGIN.bottom;
  const plot = createPlot({ height, plotTop, plotBottom, timeDomain: [edges[0], edges[n]] });
  const ticks = niceTicks(0, Math.max(1, ...declared, ...accepted), 2);
  const y = linearScale(ticks.domain, [plotBottom, plotTop]);
  drawVerticalTicks(plot, y, ticks.ticks, (t) => format.number(t, ticks.decimals));
  const xs = edges.map((t) => plot.x(t));
  plot.marks.appendChild(svg("path", { d: stepPath(xs, declared.map(y), 0, n), class: "fl-chart__line", style: SWATCH_STYLE.mutedStroke, "data-series": "declared" }));
  plot.marks.appendChild(svg("path", { d: stepPath(xs, accepted.map(y), 0, n), class: "fl-chart__line", "data-series": "accepted" }));
  return chartFrame({
    chartId: "demand_by_hour",
    title: labels.chartTitle({ title: labels.CHARTS.titles.demand_by_hour, subject: areaName(area) }),
    chips: [{ kind: "replay", seed }],
    summary: labels.demandSummary({
      area: areaName(area),
      peakRate: rateText(Math.max(...declared)),
      accepted: format.count(accepted.reduce((a, b) => a + b, 0)),
    }),
    limits: limitsFor("demand_by_hour"),
    legend: [
      { swatch: "line-muted", label: labels.CHART_TEXT.legend.demandDeclared },
      { swatch: "line", label: labels.CHART_TEXT.legend.demandAccepted },
    ],
    axisUnit: labels.UNITS.requestsPerHour,
    plot,
    heads: [labels.CHART_TEXT.heads.hour, labels.CHART_TEXT.heads.declaredRate, labels.CHART_TEXT.heads.acceptedRequests],
    rows: starts.map((t, i) => [format.clock(t), rateText(declared[i]), format.count(accepted[i])]),
  });
}

const LABEL_ROAD_CLASS = Object.freeze({ HIGHWAY: "highway", LOCAL: "local", IN_AREA: "in_area" });

/** Slowdown period of an hour of day: morning before 12:00, evening from 12:00 to 19:00, late from 19:00. */
function slowdownPeriod(hourOfDay) {
  if (hourOfDay < 12) return "morning";
  return hourOfDay < 19 ? "evening" : "late";
}

/**
 * The §1.3 traffic labels of a run's declared profile (`series.traffic_by_hour`) for one road class and, for a route class,
 * the routes touching `area`: one label per run of slowed hours with the same multipliers, naming each direction whenever
 * the directions differ (`away from SF` and `toward SF` when every route of a direction shares its profile, else each
 * route direction). A repeated label (the same slowdown on day 2) is listed once.
 */
export function slowdownLabels({ traffic, roadClass, area = null }) {
  const classWord = LABEL_ROAD_CLASS[roadClass];
  if (classWord === undefined) throw new RangeError(`unknown road class ${String(roadClass)}`);
  let parts;
  if (roadClass === "IN_AREA") {
    parts = [{ part: {}, row: checkValues(traffic.IN_AREA, "traffic IN_AREA") }];
  } else {
    const table = traffic[roadClass];
    const keys = Object.keys(table ?? {});
    const away = keys.filter((k) => k.split(">")[0] === area);
    const toward = keys.filter((k) => k.split(">")[1] === area);
    if (away.length === 0 || toward.length === 0) throw new RangeError(`no ${roadClass} routes touch area ${String(area)}`);
    const rowOf = (k) => checkValues(table[k], `traffic ${roadClass} ${k}`);
    const shared = (group) => group.every((k) => rowOf(k).every((v, i) => v === rowOf(group[0])[i]));
    parts = shared(away) && shared(toward)
      ? [{ part: { awayFrom: area }, row: rowOf(away[0]) }, { part: { toward: area }, row: rowOf(toward[0]) }]
      : [...away, ...toward].map((k) => ({ part: { from: k.split(">")[0], to: k.split(">")[1] }, row: rowOf(k) }));
  }
  const starts = traffic.starts_s;
  const bucket = starts.length > 1 ? starts[1] - starts[0] : 3600;
  const factorsAt = (i) => parts.map((p) => p.row[i]);
  const out = [];
  let i = 0;
  while (i < starts.length) {
    const factors = factorsAt(i);
    if (factors.every((f) => f === 1000)) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < starts.length && factorsAt(j + 1).every((f, k) => f === factors[k])) j += 1;
    const startHour = Math.floor(starts[i] / 3600) % 24;
    const endHour = Math.floor((starts[j] + bucket) / 3600) % 24;
    const same = factors.every((f) => f === factors[0]);
    const labelled = same ? [{ factor: format.multiplier(factors[0]) }] : parts.map((p, k) => ({ ...p.part, factor: format.multiplier(factors[k]) }));
    const text = labels.trafficLabel({ period: slowdownPeriod(startHour), roadClass: classWord, parts: labelled, start: format.hourClock(startHour), end: format.hourClock(endHour) });
    if (!out.includes(text)) out.push(text);
    i = j + 1;
  }
  return out;
}

/**
 * Traffic strip: the declared per-mille multiplier by hour for `roadClass` (HIGHWAY, LOCAL or IN_AREA) and, for a route
 * class, one `direction` key such as `SF>PEN`. Its header lists the §1.3 traffic labels for the area the direction leads to.
 */
function buildTrafficStrip({ series, roadClass, direction = null, seed, window }) {
  const t = series.traffic_by_hour;
  const inArea = roadClass === "IN_AREA";
  const values = checkValues(inArea ? t.IN_AREA : t[roadClass]?.[direction], `traffic ${String(roadClass)} ${String(direction)}`);
  const classWords = labels.CHART_TEXT.roadClasses[roadClass];
  if (classWords === undefined) throw new RangeError(`unknown road class ${String(roadClass)}`);
  const directionWords = inArea ? labels.CHART_TEXT.inEveryArea : labels.trafficDirection({ from: direction.split(">")[0], to: direction.split(">")[1] });
  const edges = hourEdges(t.starts_s, window);
  const n = t.starts_s.length;
  const height = 104;
  const plotTop = 8;
  const plotBottom = height - MARGIN.bottom;
  const plot = createPlot({ height, plotTop, plotBottom, timeDomain: [edges[0], edges[n]] });
  const ticks = niceTicks(Math.min(1000, ...values), Math.max(1200, ...values), 2);
  const y = linearScale(ticks.domain, [plotBottom, plotTop]);
  drawVerticalTicks(plot, y, ticks.ticks, (v) => format.multiplier(Math.round(v)));
  const xs = edges.map((x) => plot.x(x));
  plot.marks.appendChild(svg("path", { d: stepPath(xs, values.map(y), 0, n), class: "fl-chart__line", "data-series": "declared" }));
  const max = Math.max(...values);
  const first = values.indexOf(max);
  let last = first;
  while (last + 1 < n && values[last + 1] === max) last += 1;
  const declared = slowdownLabels({ traffic: t, roadClass, area: inArea ? null : direction.split(">")[1] });
  const labelList = declared.length === 0 ? [] : [el("ul", { class: "fl-small-label", "data-role": "traffic-labels", style: "margin: 0; padding-inline-start: 16px" }, declared.map((text) => el("li", {}, text)))];
  return chartFrame({
    chartId: "traffic_by_hour",
    title: labels.chartTitle({ title: labels.CHARTS.titles.traffic_by_hour, subject: labels.chartTitle({ title: classWords, subject: directionWords }) }),
    chips: [{ kind: "replay", seed }],
    summary: labels.trafficSummary({
      roadClass: classWords,
      direction: directionWords,
      factor: format.multiplier(max),
      start: format.clock(edges[first]),
      end: format.clock(edges[last + 1]),
    }),
    limits: limitsFor("traffic_by_hour"),
    extras: labelList,
    axisUnit: labels.CHART_TEXT.heads.multiplier,
    plot,
    heads: [labels.CHART_TEXT.heads.hour, labels.CHART_TEXT.heads.multiplier],
    rows: t.starts_s.map((s, i) => [format.clock(s), format.multiplier(values[i])]),
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Arm comparison across replications.

function armStats(cells) {
  for (const cell of cells) {
    if (cell === undefined || (!(cell !== null && typeof cell === "object" && isValue(cell.value)) && !isAbsent(cell))) {
      throw new TypeError("a per-seed metric must be {value} or {absent}");
    }
  }
  const present = cells.filter((c) => isValue(c.value)).map((c) => c.value);
  if (present.length !== cells.length) {
    const reasons = new Set(cells.filter(isAbsent).map((c) => c.absent));
    const reason = present.length === 0 && reasons.size === 1 ? [...reasons][0] : labels.ABSENT_REASONS.metricAbsentInSomeReplication;
    return { absent: reason };
  }
  return { mean: meanFleetLab(present), p10: percentileFleetLab(present, 0.1), p90: percentileFleetLab(present, 0.9) };
}

/** Arm comparison for one metric key from a run_experiment payload's `per_seed`: seed means with 10th to 90th whiskers. */
function buildArmComparisonChart({ perSeed, metric }) {
  if (!Array.isArray(perSeed) || perSeed.length === 0) throw new TypeError("perSeed must list at least one seed");
  const unit = chartUnit(metric);
  const n = perSeed.length;
  const arms = ["baseline", "candidate"].map((arm) => {
    const cells = perSeed.map((p) => p[`${arm}_metrics`][metric]);
    return { arm, cells, stats: armStats(cells) };
  });
  const height = 184;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;
  const plot = createPlot({ height, plotTop, plotBottom });
  const tops = arms.flatMap((a) => (isAbsent(a.stats) ? [] : [a.stats.p90, a.stats.mean]));
  const ticks = niceTicks(0, tops.length === 0 ? 1 : Math.max(...tops.map(unit.scale)), 3);
  const y = linearScale(ticks.domain, [plotBottom, plotTop]);
  drawVerticalTicks(plot, y, ticks.ticks, (t) => unit.tick(t, ticks.decimals));
  const slot = (plot.right - plot.left) / 2;
  arms.forEach(({ arm, stats }, k) => {
    const centre = round2(plot.left + slot * (k + 0.5));
    const half = Math.min(48, slot / 3);
    const category = svgText(centre, plotBottom + 18, labels.CHARTS[arm], { "text-anchor": "middle", "data-role": "category" });
    plot.marks.appendChild(category);
    if (isAbsent(stats)) {
      hatch(plot, round2(centre - half), round2(centre + half), plotTop, plotBottom, stats.absent).setAttribute("data-series", arm);
      return;
    }
    const top = y(unit.scale(stats.mean));
    plot.marks.appendChild(svg("rect", {
      x: round2(centre - half), y: top, width: round2(2 * half), height: round2(plotBottom - top), "data-series": arm,
      ...(arm === "baseline" ? { class: "fl-chart__band", style: "stroke: var(--ink); stroke-width: 1px" } : { style: SWATCH_STYLE.muted }),
    }));
    const y10 = y(unit.scale(stats.p10));
    const y90 = y(unit.scale(stats.p90));
    plot.marks.appendChild(svg("line", { x1: centre, x2: centre, y1: y10, y2: y90, class: "fl-chart__line", "data-role": "whisker", "data-series": arm }));
    for (const yy of [y10, y90]) {
      plot.marks.appendChild(svg("line", { x1: round2(centre - 8), x2: round2(centre + 8), y1: yy, y2: yy, class: "fl-chart__line", "data-role": "whisker-cap" }));
    }
  });
  plot.root.appendChild(svg("line", { x1: plot.left, x2: plot.right, y1: plotBottom, y2: plotBottom, class: "fl-chart__axis" }));
  const [base, cand] = arms.map((a) => a.stats);
  const register = labels.acrossReplications(n);
  const summary = isAbsent(base) || isAbsent(cand)
    ? labels.chartAbsentSummary({ register, subject: metricSubject(metric), reason: isAbsent(base) ? base.absent : cand.absent })
    : labels.armComparisonSummary({ count: n, metric: metricSubject(metric), baseline: unit.text(base.mean), candidate: unit.text(cand.mean) });
  const statCell = (stats, key) => (isAbsent(stats) ? labels.absentValue(stats.absent) : unit.text(stats[key]));
  const rows = perSeed.map((p, i) => [String(p.seed), ...arms.map((a) => format.valueText(isAbsent(a.cells[i]) ? a.cells[i] : a.cells[i].value, unit.text))]);
  rows.push([labels.CHART_TEXT.heads.seedMean, statCell(base, "mean"), statCell(cand, "mean")]);
  rows.push([labels.CHART_TEXT.heads.p10, statCell(base, "p10"), statCell(cand, "p10")]);
  rows.push([labels.CHART_TEXT.heads.p90, statCell(base, "p90"), statCell(cand, "p90")]);
  const legend = [
    { swatch: "bar-hollow", label: labels.CHARTS.baseline },
    { swatch: "bar-muted", label: labels.CHARTS.candidate },
    { swatch: "whisker", label: labels.CHARTS.whisker },
  ];
  if (isAbsent(base) || isAbsent(cand)) legend.push({ swatch: "hatch", label: labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication) });
  return chartFrame({
    chartId: "arm_comparison",
    title: labels.chartTitle({ title: labels.CHARTS.titles.arm_comparison, subject: metricSubject(metric) }),
    chips: [{ kind: "across", count: n }],
    summary,
    limits: limitsFor("arm_comparison", metric),
    legend,
    axisUnit: unit.unit,
    plot,
    heads: [labels.CHART_TEXT.heads.seed, labels.CHARTS.baseline, labels.CHARTS.candidate],
    rows,
  });
}

/** One arm comparison chart per metric key, stacked. */
function buildArmComparisonCharts({ perSeed, metrics }) {
  const charts = metrics.map((metric) => armComparisonChart({ perSeed, metric }));
  return group("arm-comparison", charts.map((c) => c.node), charts);
}

// ---------------------------------------------------------------------------------------------------------------
// Car timeline and the fork.

/** Seconds of a car's intervals in the at-depot family, clipped to the window. */
function atDepotSeconds(intervals, window) {
  let total = 0;
  for (const iv of intervals) if (familyOf(iv.state) === "atDepot") total += overlap(iv.t0, iv.t1, window.start_s, window.end_s);
  return total;
}

/** Empty driving seconds on segments whose declared multiplier of the hour is at least the RD-4 threshold, in the window. */
function congestedEmptySeconds(intervals, scenario) {
  const { start_s, end_s } = scenario.window;
  let total = 0;
  for (const iv of intervals) {
    for (const seg of iv.segments ?? []) {
      if (seg.loaded || seg.kind === "PULL_OUT") continue;
      const table = seg.cls === "HIGHWAY" || seg.cls === "LOCAL" ? scenario.congestion[seg.cls][seg.dir] : scenario.congestion.IN_AREA;
      if (!Array.isArray(table)) throw new RangeError(`no congestion row for ${String(seg.cls)} ${String(seg.dir)}`);
      const lo = Math.max(seg.t0, start_s);
      const hi = Math.min(seg.t1, end_s);
      for (let h = Math.floor(lo / HOUR_S); h * HOUR_S < hi; h += 1) {
        if (table[Math.min(h, 47)] >= scenario.congestion_threshold_permille) total += overlap(lo, hi, h * HOUR_S, (h + 1) * HOUR_S);
      }
    }
  }
  return total;
}

/** A lanes plot: each lane `{name, blocks: [{t0, t1, family, attrs}]}` on the window's clock; lane names are the axis. */
function lanesPlot(lanes, window) {
  const laneHeight = 20;
  const gap = 8;
  const plotTop = MARGIN.top;
  const plotBottom = plotTop + lanes.length * (laneHeight + gap) - gap;
  const plot = createPlot({ height: plotBottom + MARGIN.bottom, plotTop, plotBottom, timeDomain: [window.start_s, window.end_s], left: 96 });
  plot.measureAxis.setAttribute("data-scale", "lanes");
  lanes.forEach((lane, k) => {
    const top = plotTop + k * (laneHeight + gap);
    plot.grid.appendChild(svg("line", { x1: plot.left, x2: plot.right, y1: top + laneHeight, y2: top + laneHeight, class: "fl-chart__grid" }));
    plot.measureAxis.appendChild(svgText(plot.left - 6, top + 14, lane.name, { "text-anchor": "end", "data-lane": lane.name }));
    for (const block of lane.blocks) {
      const t0 = Math.max(block.t0, window.start_s);
      const t1 = Math.min(block.t1, window.end_s);
      if (t1 <= t0) continue;
      const x0 = plot.x(t0);
      plot.marks.appendChild(svg("rect", {
        x: x0, y: top, width: round2(plot.x(t1) - x0), height: laneHeight, class: FAMILY_CLASS[block.family], fill: "currentColor",
        "data-lane": lane.name, ...block.attrs,
      }));
    }
  });
  return plot;
}

function intervalBlocks(intervals) {
  return intervals.map((iv) => ({
    t0: iv.t0, t1: iv.t1, family: familyOf(iv.state),
    attrs: { "data-state": iv.state, style: "stroke: var(--panel); stroke-width: 1px" },
  }));
}

function intervalRows(intervals, window, prefix = []) {
  return intervals
    .filter((iv) => overlap(iv.t0, iv.t1, window.start_s, window.end_s) > 0)
    .map((iv) => {
      const t0 = Math.max(iv.t0, window.start_s);
      const t1 = Math.min(iv.t1, window.end_s);
      return [...prefix, labels.MAP.carStates[iv.state], format.clock(t0), format.clock(t1), format.hoursMinutes(t1 - t0)];
    });
}

function carIntervals(log, car) {
  const intervals = log.intervals[car];
  if (!Array.isArray(intervals)) throw new RangeError(`no interval log for car ${String(car)}`);
  return intervals;
}

const FAMILY_LEGEND = Object.freeze(FAMILY_ORDER.map((f) => ({ swatch: `family:${f}`, label: labels.MAP.families[f] })));

/** Car timeline for one replay: one lane of state segments from `log.intervals[car]`, on the scenario window. */
function buildCarTimelineChart({ log, scenario, car, seed }) {
  const intervals = carIntervals(log, car);
  const window = scenario.window;
  const plot = lanesPlot([{ name: car, blocks: intervalBlocks(intervals) }], window);
  return chartFrame({
    chartId: "car_timeline",
    title: labels.chartTitle({ title: labels.CHARTS.titles.car_timeline, subject: car }),
    chips: [{ kind: "replay", seed }],
    summary: labels.carTimelineSummary({
      car,
      atDepots: format.hoursMinutes(atDepotSeconds(intervals, window)),
      congestedEmpty: format.hoursMinutes(congestedEmptySeconds(intervals, scenario)),
    }),
    limits: limitsFor("car_timeline"),
    legend: FAMILY_LEGEND,
    plot,
    heads: [labels.CHART_TEXT.heads.state, labels.CHART_TEXT.heads.from, labels.CHART_TEXT.heads.to, labels.CHART_TEXT.heads.duration],
    rows: intervalRows(intervals, window),
  });
}

/** Available cars in an area by hour for one arm: the area's available fraction times that arm's fleet. */
function availableCars(series, area) {
  const fractions = checkValues(series.available_by_area.areas[area], `available_by_area.${String(area)}`);
  return fractions.map((v) => (isValue(v) ? v * series.fleet_state.fleet : v));
}

/**
 * The fork (design D-10): two lanes for one car in the baseline (A) and candidate (B) of a run_pair payload, a strip of an
 * area's available cars in both arms, and for each id in `depots` that depot's lot held and queue in lane A and in lane B
 * (design UC-07: SJ-1's lot in B), all on one clock. Returns a group handle.
 */
function buildCarForkCharts({ pair, baselineScenario, candidateScenario = baselineScenario, car, seed, area = "SF", depots = [] }) {
  const window = baselineScenario.window;
  const a = carIntervals(pair.baseline.log, car);
  const b = carIntervals(pair.candidate.log, car);
  const armA = labels.INSPECTOR.forkArms.A;
  const armB = labels.INSPECTOR.forkArms.B;
  const lanes = chartFrame({
    chartId: "car_timeline",
    title: labels.chartTitle({ title: labels.CHARTS.titles.car_timeline, subject: car }),
    chips: [{ kind: "replay", seed }],
    summary: labels.forkTimelineSummary({
      car,
      atDepotsA: format.hoursMinutes(atDepotSeconds(a, window)),
      atDepotsB: format.hoursMinutes(atDepotSeconds(b, candidateScenario.window)),
    }),
    limits: limitsFor("car_timeline"),
    legend: FAMILY_LEGEND,
    plot: lanesPlot([{ name: armA, blocks: intervalBlocks(a) }, { name: armB, blocks: intervalBlocks(b) }], window),
    heads: [labels.CHART_TEXT.heads.lane, labels.CHART_TEXT.heads.state, labels.CHART_TEXT.heads.from, labels.CHART_TEXT.heads.to, labels.CHART_TEXT.heads.duration],
    rows: [...intervalRows(a, window, [armA]), ...intervalRows(b, window, [armB])],
  });

  const starts = pair.baseline.series.available_by_area.starts_s;
  const edges = hourEdges(starts, window);
  const n = starts.length;
  const carsA = availableCars(pair.baseline.series, area);
  const carsB = availableCars(pair.candidate.series, area);
  const height = 132;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;
  const plot = createPlot({ height, plotTop, plotBottom, timeDomain: [edges[0], edges[n]], left: 96 });
  const present = [...carsA, ...carsB].filter(isValue);
  const ticks = niceTicks(0, present.length === 0 ? 1 : Math.max(...present), 3);
  const y = linearScale(ticks.domain, [plotBottom, plotTop]);
  drawVerticalTicks(plot, y, ticks.ticks, (t) => format.number(t, ticks.decimals));
  const xs = edges.map((t) => plot.x(t));
  for (const [values, name, style] of [[carsA, "A", null], [carsB, "B", SWATCH_STYLE.mutedStroke]]) {
    const ys = values.map((v) => (isValue(v) ? y(v) : 0));
    for (const run of runsOf(n, (i) => (isValue(values[i]) ? "line" : null))) {
      plot.marks.appendChild(svg("path", { d: stepPath(xs, ys, run.from, run.to), class: "fl-chart__line", style, "data-series": name }));
    }
  }
  const gapReason = (i) => (isAbsent(carsA[i]) ? carsA[i].absent : isAbsent(carsB[i]) ? carsB[i].absent : null);
  for (const run of runsOf(n, gapReason)) hatch(plot, xs[run.from], xs[run.to], plotTop, plotBottom, run.key);
  const lowest = (values) => {
    let best = null;
    values.forEach((v, i) => {
      if (isValue(v) && (best === null || v < best.v)) best = { v, i };
    });
    return best;
  };
  const lowA = lowest(carsA);
  const lowB = lowest(carsB);
  const register = labels.REGISTERS.thisReplaySentence;
  const title = labels.availableCarsTitle(areaName(area));
  const summary = lowA === null || lowB === null
    ? labels.chartAbsentSummary({ register, subject: title, reason: telling([...carsA, ...carsB]) })
    : labels.forkAvailableSummary({
      area: areaName(area),
      lowestA: format.number(lowA.v, 1), clockA: format.clock(starts[lowA.i]),
      lowestB: format.number(lowB.v, 1), clockB: format.clock(starts[lowB.i]),
    });
  const legend = [{ swatch: "line", label: armA }, { swatch: "line-muted", label: armB }];
  if (runsOf(n, gapReason).length > 0) legend.push({ swatch: "hatch", label: labels.CHARTS.hatchedGap });
  const carText = (v) => format.number(v, 1);
  const strip = chartFrame({
    chartId: "available_strip",
    title,
    chips: [{ kind: "replay", seed }],
    summary,
    limits: limitsFor("available_strip"),
    legend,
    axisUnit: labels.CHART_TEXT.axes.availableCars,
    plot,
    heads: [labels.CHART_TEXT.heads.hour, armA, armB],
    rows: starts.map((t, i) => [format.clock(t), format.valueText(carsA[i], carText), format.valueText(carsB[i], carText)]),
  });
  const depotCharts = [];
  for (const id of depots) {
    for (const [lane, arm, scenario] of [["A", pair.baseline, baselineScenario], ["B", pair.candidate, candidateScenario]]) {
      const depot = arm.log.depots.find((d) => d.id === id);
      if (depot === undefined) throw new RangeError(`no depot ${String(id)} in lane ${lane}`);
      const chart = lotQueueChart({ log: arm.log, scenario, depot, window, seed, lane: labels.INSPECTOR.forkArms[lane] });
      chart.node.setAttribute("data-lane", lane);
      chart.node.setAttribute("data-depot", id);
      depotCharts.push(chart);
    }
  }
  const caption = el("p", { class: "fl-muted", "data-role": "fork-caption", style: "margin: 0" }, labels.HONESTY.forkCaption);
  return group("fork", [caption, lanes.node, strip.node, ...depotCharts.map((c) => c.node)], [lanes, strip, ...depotCharts]);
}

// ---------------------------------------------------------------------------------------------------------------
// Depot board.

/** Bay tasks of one depot's visits, each assigned to the first bay lane free at its start (lane per task kind). */
function bayTasks(visits, depot) {
  const tasks = [];
  for (const v of visits) {
    if (v.depot !== depot.id) continue;
    if (v.clean_start_s !== null) tasks.push({ task: "CLEAN", car: v.car, start: v.clean_start_s, end: v.clean_end_s });
    if (v.service_start_s !== null) tasks.push({ task: "SERVICE", car: v.car, start: v.service_start_s, end: v.service_end_s });
  }
  tasks.sort((p, q) => p.start - q.start || (p.car < q.car ? -1 : p.car > q.car ? 1 : 0));
  const laneEnds = { CLEAN: [], SERVICE: [] };
  for (const task of tasks) {
    const ends = laneEnds[task.task];
    let lane = ends.findIndex((end) => end <= task.start);
    if (lane === -1) {
      lane = ends.length;
      ends.push(0);
    }
    ends[lane] = task.end === null ? Infinity : task.end;
    task.lane = lane + 1;
  }
  const counts = {
    CLEAN: Math.max(depot.cleaning_bays, laneEnds.CLEAN.length),
    SERVICE: Math.max(depot.service_bays, laneEnds.SERVICE.length),
  };
  return { tasks, counts };
}

function bayLanesChart({ log, depot, window, seed }) {
  const { tasks, counts } = bayTasks(log.visits, depot);
  const drainEnd = log.drain_end_s;
  const lanes = [];
  for (const task of ["CLEAN", "SERVICE"]) {
    for (let index = 1; index <= counts[task]; index += 1) {
      const name = labels.bayLane({ task, index });
      lanes.push({
        name,
        blocks: tasks.filter((t) => t.task === task && t.lane === index).map((t) => ({
          t0: t.start, t1: t.end ?? drainEnd, family: "atDepot",
          attrs: { "data-task": t.task, "data-car": t.car, "data-censored": t.end === null ? "true" : null, style: "stroke: var(--ink); stroke-width: 1px" },
        })),
      });
    }
  }
  const inWindow = tasks.filter((t) => t.start < window.end_s && (t.end ?? Infinity) > window.start_s);
  return chartFrame({
    chartId: "bay_lanes",
    title: labels.chartTitle({ title: labels.CHARTS.titles.depot_board, subject: depot.id }),
    chips: [{ kind: "replay", seed }],
    summary: labels.bayLanesSummary({ depot: depot.id, bays: lanes.length, tasks: inWindow.length }),
    limits: limitsFor("bay_lanes"),
    plot: lanesPlot(lanes, window),
    heads: [labels.CHART_TEXT.heads.lane, labels.CHART_TEXT.heads.car, labels.CHART_TEXT.heads.task, labels.CHART_TEXT.heads.from, labels.CHART_TEXT.heads.to],
    rows: inWindow.map((t) => [
      labels.bayLane({ task: t.task, index: t.lane }),
      t.car,
      labels.MAP.tasks[t.task],
      format.clock(t.start),
      t.end === null ? labels.absentValue(labels.visitsUnfinished(1)) : format.clock(t.end),
    ]),
  });
}

/** Step points of a depot series inside the window: the value in force at the start, then every change before the end. */
function depotSteps(depot, window) {
  const fields = depot.series_fields;
  const [it, iHeld, iQueue] = ["t", "stalls_held", "queue"].map((f) => fields.indexOf(f));
  if (it < 0 || iHeld < 0 || iQueue < 0) throw new RangeError(`depot ${depot.id} series lacks t, stalls_held or queue`);
  const steps = [];
  for (const row of depot.series) {
    const t = row[it];
    if (t >= window.end_s) break;
    const point = { t: Math.max(t, window.start_s), held: row[iHeld], queue: row[iQueue] };
    if (steps.length > 0 && steps[steps.length - 1].t === point.t) steps[steps.length - 1] = point;
    else steps.push(point);
  }
  if (steps.length === 0 || steps[0].t !== window.start_s) throw new RangeError(`depot ${depot.id} series does not cover the window start`);
  return steps;
}

function lotQueueChart({ log, scenario, depot, window, seed, lane = null }) {
  const steps = depotSteps(depot, window);
  const edges = [...steps.map((p) => p.t), window.end_s];
  const n = steps.length;
  const height = 132;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;
  const plot = createPlot({ height, plotTop, plotBottom, timeDomain: [window.start_s, window.end_s], left: 96 });
  const maxHeld = Math.max(...steps.map((p) => p.held));
  const maxQueue = Math.max(...steps.map((p) => p.queue));
  const ticks = niceTicks(0, Math.max(depot.parking, maxHeld, maxQueue, 1), 3);
  const y = linearScale(ticks.domain, [plotBottom, plotTop]);
  drawVerticalTicks(plot, y, ticks.ticks, (t) => format.number(t, ticks.decimals));
  const xs = edges.map((t) => plot.x(t));
  plot.marks.appendChild(svg("path", { d: stepPath(xs, steps.map((p) => y(p.held)), 0, n), class: "fl-chart__line", "data-series": "stalls_held" }));
  plot.marks.appendChild(svg("path", { d: stepPath(xs, steps.map((p) => y(p.queue)), 0, n), class: "fl-chart__line", style: SWATCH_STYLE.mutedStroke, "data-series": "queue" }));
  const bayWait = computeMetric({ ...log, scenario, window: scenario.window }, { metric: "depot.bay_wait_p90_s", scope: { depot: depot.id } });
  const minutesText = (v) => `${format.number(v / 60, 1)} ${labels.UNITS.minutes}`;
  const title = labels.chartTitle({ title: labels.CHART_TEXT.titles.lot_and_queue, subject: depot.id });
  const facts = { depot: depot.id, held: maxHeld, stalls: depot.parking, bayWait: format.valueText(isAbsent(bayWait) ? bayWait : bayWait.value, minutesText) };
  return chartFrame({
    chartId: "lot_and_queue",
    title: lane === null ? title : labels.chartTitle({ title, subject: lane }),
    chips: [{ kind: "replay", seed }],
    summary: lane === null ? labels.depotBoardSummary(facts) : labels.forkDepotSummary({ lane, ...facts }),
    limits: limitsFor("lot_and_queue"),
    legend: [
      { swatch: "line", label: labels.CHART_TEXT.legend.stallsHeld },
      { swatch: "line-muted", label: labels.CHART_TEXT.legend.queue },
    ],
    axisUnit: labels.UNITS.cars,
    plot,
    heads: [labels.CHART_TEXT.heads.time, labels.CHART_TEXT.legend.stallsHeld, labels.CHART_TEXT.legend.queue],
    rows: steps.map((p) => [format.clock(p.t), format.count(p.held), format.count(p.queue)]),
  });
}

/**
 * Depot board for one replay: for each depot id in `depots` (one, or both depots of a move), its bay lanes and its lot
 * held and queue, all on the scenario window's clock. Returns a group handle.
 */
function buildDepotBoardCharts({ log, scenario, depots, seed }) {
  const charts = [];
  for (const id of depots) {
    const depot = log.depots.find((d) => d.id === id);
    if (depot === undefined) throw new RangeError(`no depot ${String(id)} in the log`);
    charts.push(bayLanesChart({ log, depot, window: scenario.window, seed }));
    charts.push(lotQueueChart({ log, scenario, depot, window: scenario.window, seed }));
  }
  return group("depot-board", charts.map((c) => c.node), charts);
}

// ---------------------------------------------------------------------------------------------------------------
// Verdict: the primary's paired-delta strip, guardrail bullet rows and descriptive delta rows (design §6, §7.2).

function primaryStrip({ verdict, declaration, seeds }) {
  const primary = verdict.primary;
  if (declaration.name !== primary.metric) throw new RangeError("the declaration does not name the verdict's primary metric");
  const vu = verdictUnit(primary.metric);
  const n = primary.paired_deltas.length;
  const sign = declaration.direction === "higher_is_better" ? -1 : 1;
  const deltas = primary.paired_deltas.map((d) => sign * d);
  const [low, high] = sign === 1 ? [primary.ci_low, primary.ci_high] : [-primary.ci_high, -primary.ci_low];
  const mean = sign * primary.mean_delta;
  const margin = declaration.equivalence_margin;
  const extent = [...deltas, low, high, -margin, margin, 0];
  const height = 150;
  const plotTop = 8;
  const plotBottom = 108;
  const plot = createPlot({ height, plotTop, plotBottom, left: 104 });
  const ticks = niceTicks(Math.min(...extent), Math.max(...extent), valueTickCount(plot.right - plot.left, 4));
  const x = linearScale(ticks.domain, [plot.left, plot.right]);
  plot.x = x;
  for (const t of ticks.ticks) {
    plot.grid.appendChild(svg("line", { x1: x(t), x2: x(t), y1: plotTop, y2: plotBottom, class: "fl-chart__grid" }));
  }
  plot.marks.appendChild(svg("rect", {
    x: x(-margin), y: plotTop, width: round2(x(margin) - x(-margin)), height: plotBottom - plotTop, class: "fl-chart__band", "data-role": "margin-band",
  }));
  const rowInterval = 28;
  plot.marks.appendChild(svgText(4, rowInterval + 4, labels.VERDICT.interval95, { "data-role": "row-label" }));
  plot.marks.appendChild(svg("line", { x1: x(low), x2: x(high), y1: rowInterval, y2: rowInterval, class: "fl-chart__line", "data-role": "interval" }));
  plot.marks.appendChild(svg("line", { x1: x(low), x2: x(low), y1: rowInterval - 6, y2: rowInterval + 6, class: "fl-chart__line", "data-role": "interval-low" }));
  plot.marks.appendChild(svg("line", { x1: x(high), x2: x(high), y1: rowInterval - 6, y2: rowInterval + 6, class: "fl-chart__line", "data-role": "interval-high" }));
  plot.marks.appendChild(svg("circle", { cx: x(mean), cy: rowInterval, r: 5, style: "fill: var(--ink); stroke: var(--panel); stroke-width: 2px", "data-role": "mean" }));
  const rowSeeds = 60;
  plot.marks.appendChild(svgText(4, rowSeeds + 4, labels.VERDICT.seeds, { "data-role": "row-label" }));
  const order = deltas.map((d, i) => ({ px: x(d), i })).sort((p, q) => p.px - q.px || p.i - q.i);
  const rowLast = [];
  for (const dot of order) {
    let row = rowLast.findIndex((last) => dot.px - last >= 9);
    if (row === -1) row = rowLast.length < 4 ? rowLast.length : rowLast.indexOf(Math.min(...rowLast));
    rowLast[row] = dot.px;
    plot.marks.appendChild(svg("circle", {
      cx: dot.px, cy: rowSeeds + row * 11, r: 4, style: "fill: var(--ink); stroke: var(--panel); stroke-width: 2px", "data-role": "seed-dot", "data-index": dot.i,
    }));
  }
  plot.measureAxis.appendChild(svg("line", { x1: plot.left, x2: plot.right, y1: plotBottom, y2: plotBottom, class: "fl-chart__axis" }));
  for (const t of ticks.ticks) {
    plot.measureAxis.appendChild(svg("line", { x1: x(t), x2: x(t), y1: plotBottom, y2: plotBottom + 4, class: "fl-chart__axis" }));
    plot.measureAxis.appendChild(svgText(x(t), plotBottom + 18, vu.tick(t, ticks.decimals), { "text-anchor": "middle", "data-value": t }));
  }
  const caption = labels.primaryDeltaCaption(declaration.direction);
  const outcomeEntry = labels.STATUS_WORDS.outcome[verdict.outcome];
  const outcomeLine = el("p", { "data-role": "outcome", style: "display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0" }, [
    statusChip(outcomeEntry),
    el("span", {}, labels.OUTCOME_SENTENCES[verdict.outcome]),
  ]);
  const rows = primary.paired_deltas.map((d, i) => [seeds === null ? String(i + 1) : String(seeds[i]), vu.signed(d)]);
  rows.push([labels.CHART_TEXT.heads.meanDelta, vu.signed(primary.mean_delta)]);
  rows.push([labels.CHART_TEXT.heads.medianDelta, vu.signed(primary.median_delta)]);
  rows.push([labels.CHART_TEXT.heads.intervalLow, vu.signed(primary.ci_low)]);
  rows.push([labels.CHART_TEXT.heads.intervalHigh, vu.signed(primary.ci_high)]);
  rows.push([labels.CHART_TEXT.heads.margin, labels.marginBand(vu.threshold(margin))]);
  return chartFrame({
    chartId: "verdict_primary",
    title: labels.chartTitle({ title: labels.VERDICT.primary, subject: metricSubject(primary.metric) }),
    chips: [{ kind: "across", count: n }],
    summary: labels.verdictStripSummary({ count: n, metric: metricSubject(primary.metric), low: vu.signed(primary.ci_low), high: vu.signed(primary.ci_high), outcome: verdict.outcome }),
    limits: limitsFor("verdict_primary", primary.metric),
    legend: [
      { swatch: "band", label: labels.marginBand(vu.threshold(margin)) },
      { swatch: "line", label: labels.VERDICT.interval95 },
      { swatch: "dot", label: labels.CHART_TEXT.legend.meanDelta },
      { swatch: "dot", label: labels.CHART_TEXT.legend.seedDots },
    ],
    axisUnit: vu.unit === "" ? caption : labels.chartTitle({ title: caption, subject: vu.unit }),
    extras: [outcomeLine],
    plot,
    heads: [labels.CHART_TEXT.heads.seed, labels.CHART_TEXT.heads.delta],
    rows,
  });
}

function guardrailRow({ status, count }) {
  const vu = verdictUnit(status.metric);
  const entry = labels.STATUS_WORDS.guardrail[status.status];
  if (entry === undefined) throw new RangeError(`unknown guardrail status ${String(status.status)}`);
  const evaluable = status.status !== "NOT_EVALUABLE";
  const height = 76;
  const plotTop = 8;
  const plotBottom = 40;
  const plot = createPlot({ height, plotTop, plotBottom, left: 104 });
  const extent = evaluable ? [0, status.harm, status.max_harm] : [0, status.max_harm];
  const ticks = niceTicks(Math.min(...extent), Math.max(...extent), valueTickCount(plot.right - plot.left, 3));
  const x = linearScale(ticks.domain, [plot.left, plot.right]);
  for (const t of ticks.ticks) plot.grid.appendChild(svg("line", { x1: x(t), x2: x(t), y1: plotTop, y2: plotBottom, class: "fl-chart__grid" }));
  if (evaluable) {
    const x0 = x(Math.min(0, status.harm));
    plot.marks.appendChild(svg("rect", { x: x0, y: 16, width: round2(x(Math.max(0, status.harm)) - x0), height: 16, style: SWATCH_STYLE.ink, "data-role": "harm-bar" }));
  } else {
    hatch(plot, plot.left, plot.right, plotTop, plotBottom, labels.ABSENT_REASONS.metricAbsentInSomeReplication);
  }
  plot.marks.appendChild(svg("line", { x1: x(status.max_harm), x2: x(status.max_harm), y1: plotTop, y2: plotBottom, class: "fl-chart__line", "data-role": "max-harm" }));
  plot.measureAxis.appendChild(svg("line", { x1: plot.left, x2: plot.right, y1: plotBottom, y2: plotBottom, class: "fl-chart__axis" }));
  for (const t of ticks.ticks) {
    plot.measureAxis.appendChild(svgText(x(t), plotBottom + 18, vu.tick(t, ticks.decimals), { "text-anchor": "middle", "data-value": t }));
  }
  const legend = [{ swatch: "tick", label: labels.CHART_TEXT.legend.maxHarmTick }];
  legend.unshift(evaluable ? { swatch: "bar-ink", label: labels.CHART_TEXT.legend.harmBar } : { swatch: "hatch", label: labels.NOT_EVALUABLE_TEXT });
  return chartFrame({
    chartId: "verdict_guardrail",
    title: labels.chartTitle({ title: labels.VERDICT.guardrails, subject: metricSubject(status.metric) }),
    chips: [{ kind: "across", count }],
    summary: evaluable
      ? labels.guardrailRowSummary({ count, metric: metricSubject(status.metric), harm: vu.signed(status.harm), maxHarm: vu.threshold(status.max_harm), status: entry.word })
      : labels.notEvaluableSummary({ count, metric: metricSubject(status.metric) }),
    limits: limitsFor("verdict_guardrail", status.metric),
    legend,
    axisUnit: vu.unit === "" ? labels.VERDICT.meanHarm : labels.chartTitle({ title: labels.VERDICT.meanHarm, subject: vu.unit }),
    extras: [el("p", { "data-role": "guardrail-status", style: "margin: 4px 0" }, statusChip(entry))],
    plot,
    heads: [labels.CHART_TEXT.heads.metric, labels.VERDICT.meanHarm, labels.VERDICT.maxHarm, labels.VERDICT.status],
    rows: [[status.metric, evaluable ? vu.signed(status.harm) : labels.NOT_EVALUABLE_TEXT, vu.threshold(status.max_harm), entry.word]],
  });
}

function descriptiveRows({ verdict, count }) {
  const rows = verdict.descriptives.map((d) => {
    const vu = verdictUnit(d.metric);
    return [d.metric, vu.plain(d.baseline_mean), vu.plain(d.candidate_mean), vu.signed(d.mean_delta)];
  });
  return el("section", { class: "fl-panel", "data-role": "descriptive", style: "padding: 12px" }, [
    el("div", { style: "display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px" }, [
      el("h3", { class: "fl-title", style: "margin: 0" }, labels.VERDICT.descriptive),
      chipNode({ kind: "across", count }),
    ]),
    limitsChip(limitsFor("verdict_descriptive")),
    el("div", { class: "fl-scroll" }, tableNode(
      [labels.CHART_TEXT.heads.metric, labels.CHART_TEXT.heads.baselineMean, labels.CHART_TEXT.heads.candidateMean, labels.CHART_TEXT.heads.meanDelta],
      rows,
    )),
  ]);
}

/**
 * Verdict charts from a run_experiment payload's `verdict` and `verdictDeclarations(spec)` (primary margin and
 * directions in the metric's unit); `seeds` lists the paired seeds in order, or null. An invalid verdict draws no strip,
 * no interval and no outcome, only its reason (design §7.2). Returns a group handle.
 */
function buildVerdictCharts({ verdict, declarations, seeds = null }) {
  if (verdict.validity !== "VALID") {
    const reason = labels.STATUS_WORDS.invalidityReason[verdict.invalidity_reason];
    if (reason === undefined) throw new RangeError(`unknown invalidity reason ${String(verdict.invalidity_reason)}`);
    const node = el("section", { "data-role": "verdict-void", style: "display: grid; gap: 4px" }, [
      el("p", { style: "margin: 0" }, statusChip(reason)),
      el("p", { style: "margin: 0" }, labels.INVALIDITY_TEXT[verdict.invalidity_reason]),
      el("p", { style: "margin: 0" }, labels.SEED_WATCH.voidEvidence),
      el("p", { class: "fl-muted", style: "margin: 0" }, labels.VERDICT.noStrip),
    ]);
    return group("verdict", [node], []);
  }
  const count = verdict.primary.paired_deltas.length;
  if (seeds !== null && seeds.length !== count) throw new RangeError("seeds must match the paired deltas");
  const primary = primaryStrip({ verdict, declaration: declarations.primary, seeds });
  const rails = verdict.guardrail_statuses.map((status) => guardrailRow({ status, count }));
  const charts = [primary, ...rails];
  return group("verdict", [...charts.map((c) => c.node), descriptiveRows({ verdict, count })], charts);
}

// ---------------------------------------------------------------------------------------------------------------
// Public builders: each one draws at the width of the box its plots sit in (see responsive above).

/** Fleet state chart; see buildFleetStateChart. */
export function fleetStateChart(options) {
  return responsive(buildFleetStateChart, options);
}

/** One metric by hour; see buildMetricByHourChart. */
export function metricByHourChart(options) {
  return responsive(buildMetricByHourChart, options);
}

/** Demand strip for one area; see buildDemandStrip. */
export function demandStrip(options) {
  return responsive(buildDemandStrip, options);
}

/** Traffic strip for one road class and direction; see buildTrafficStrip. */
export function trafficStrip(options) {
  return responsive(buildTrafficStrip, options);
}

/** Arm comparison for one metric key; see buildArmComparisonChart. */
export function armComparisonChart(options) {
  return responsive(buildArmComparisonChart, options);
}

/** One arm comparison chart per metric key; see buildArmComparisonCharts. */
export function armComparisonCharts(options) {
  return responsive(buildArmComparisonCharts, options);
}

/** Car timeline for one replay; see buildCarTimelineChart. */
export function carTimelineChart(options) {
  return responsive(buildCarTimelineChart, options);
}

/** The car fork in both arms; see buildCarForkCharts. */
export function carForkCharts(options) {
  return responsive(buildCarForkCharts, options);
}

/** Depot board for one replay; see buildDepotBoardCharts. */
export function depotBoardCharts(options) {
  return responsive(buildDepotBoardCharts, options);
}

/** Verdict charts: the primary strip, then one guardrail bullet row per guardrail; see buildVerdictCharts. */
export function verdictCharts(options) {
  return responsive(buildVerdictCharts, options);
}
