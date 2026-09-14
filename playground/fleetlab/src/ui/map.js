// The schematic map (design §7.3, §8.2, §8.3, §7.7). Four area yards at fixed positions, a highway and a local route per
// area pair drawn as parallel paths, congestion as static chevrons and a neutral casing step (never a hue, never dashed),
// depot tiles with a three-part micro-bar over a lot fill, unit bars per yard, a flow band per route, the pinned car,
// unserved riders, the corner stamp, the THIS REPLAY chip and a table twin. Every number here is from this replay.
//
// The map reads a frame from playback.js and the run log; it never runs the model. Planned times for a departure now
// come from the declared profile through routes.js plannedLegSeconds, which is arithmetic on the scenario only.
//
// Where cars are counted (one partition, used by the yards, the flow bands and the table twin, so the counts sum to
// the fleet): a car standing at an area centre or at a depot counts in that area; a car on a leg counts on a route
// direction while its current segment is a route segment, and otherwise in the area of that segment (a trip or pickup
// inside an area, depot access, pull-out). A car whose leg has ended before the next snapshot counts at its leg's end.

import { el, setText } from "./dom.js";
import * as format from "./format.js";
import {
  ABSENT_REASONS,
  CHARTS,
  CHEVRON_LEVELS,
  MAP,
  STATES,
  depotName,
  lotFill,
  pinnedCarName,
  routeDirection,
  routeShield,
  routeTooltip,
  thisReplayChip,
  unservedCount,
  waitingRiders,
} from "./labels.js";
import { STATE_FAMILIES } from "../model/metrics.js";
import { depotArea, plannedLegSeconds } from "../model/routes.js";

/** SVG view box width and height in px of the wide map (768 px and wider, where the map box is at least 640 px). */
export const VIEW = Object.freeze({ width: 640, height: 500 });

/** Area order everywhere (contract 6.2). */
export const AREA_ORDER = Object.freeze(["SF", "PEN", "SJ", "EB"]);

/**
 * Yard centres of the wide map in view box px: SF north-west, EB north-east, PEN centre-west, SJ south (design §7.3).
 * PEN and SJ sit far enough apart that the H4 shield fits on its visible segment, clear of both yards.
 */
export const AREA_POSITIONS = Object.freeze({
  SF: Object.freeze({ x: 116, y: 88 }),
  EB: Object.freeze({ x: 524, y: 88 }),
  PEN: Object.freeze({ x: 116, y: 282 }),
  SJ: Object.freeze({ x: 420, y: 410 }),
});

/** Yard size of the wide map in px. */
export const YARD = Object.freeze({ width: 196, height: 144 });

/** Below this width the map uses its phone geometry (design §7.2: the phone is designed at 400 px). */
export const PHONE_QUERY = "(max-width: 767.98px)";

/**
 * The two map geometries. The wide one scales from 640 px; the phone one is a 340 by 400 view box, about one unit per
 * CSS pixel in a 400 px screen, so 11 px text, 7 px blocks and 10 px glyphs draw at their size. Text sizes are view box px;
 * a shield is `shieldPad + characters × charPx` wide.
 */
export const GEOMETRIES = Object.freeze({
  wide: Object.freeze({
    name: "wide",
    view: VIEW,
    positions: AREA_POSITIONS,
    yard: YARD,
    tile: Object.freeze({ width: 52, height: 40, bar: 40 }),
    // The wide map box is about 640 to 700 px, so 11 px text stays at 11 px or more on screen.
    text: Object.freeze({ name: 12, small: 11 }),
    charPx: 6.6,
    shieldPad: 6,
    maxWidthPx: null,
  }),
  phone: Object.freeze({
    name: "phone",
    view: Object.freeze({ width: 340, height: 400 }),
    positions: Object.freeze({
      SF: Object.freeze({ x: 65, y: 76 }),
      EB: Object.freeze({ x: 275, y: 76 }),
      PEN: Object.freeze({ x: 65, y: 324 }),
      SJ: Object.freeze({ x: 275, y: 324 }),
    }),
    yard: Object.freeze({ width: 122, height: 144 }),
    tile: Object.freeze({ width: 48, height: 40, bar: 36 }),
    text: Object.freeze({ name: 12, small: 11 }),
    charPx: 6.6,
    shieldPad: 6,
    // A phone-width screen up to 767 px would otherwise scale the 340 px drawing past twice its size.
    maxWidthPx: 440,
  }),
});

/** Cars per unit-bar block (design §7.3). */
export const CARS_PER_BLOCK = 5;

/** Chevron density is per this many px of visible route (design §7.3). */
export const CHEVRON_SPACING_PX = 40;

/** An unserved rider shows as a cross in its yard for this many simulated seconds, then folds into the tally. */
export const UNSERVED_FOLD_S = 600;

/** Arrow keys between areas at the area level of the roving focus. */
export const AREA_NEIGHBOURS = Object.freeze({
  SF: Object.freeze({ ArrowRight: "EB", ArrowDown: "PEN" }),
  EB: Object.freeze({ ArrowLeft: "SF", ArrowDown: "SJ" }),
  PEN: Object.freeze({ ArrowUp: "SF", ArrowRight: "SJ", ArrowDown: "SJ" }),
  SJ: Object.freeze({ ArrowUp: "EB", ArrowLeft: "PEN" }),
});

/** State families in stack order (design §8.2). */
export const FAMILY_ORDER = Object.freeze(["riderWork", "emptyDrive", "available", "atDepot"]);

/** Class per family; the first three are the only hues any route mark may use. */
export const FAMILY_CLASS = Object.freeze({
  riderWork: "fl-fam-rider",
  emptyDrive: "fl-fam-empty",
  available: "fl-fam-available",
  atDepot: "fl-fam-depot",
});

/** Families whose light hue is under 3:1 on the panel, so their marks carry the ink edge class (design §8.2). */
export const EDGE_FAMILIES = Object.freeze(["available", "atDepot"]);

const HIGHWAY_OFFSET_PX = -12;
const LOCAL_OFFSET_PX = 12;
const CHEVRON_SIDE_PX = 7;
const BLOCK_PX = 7;
const BLOCK_GAP_PX = 2;
/** Unit-bar rows start after an 8 px family key glyph: blocks begin this far into the yard. */
const BAR_START_PX = 22;
const FLOW_OFFSET_PX = 16;
const SHIELD_HEIGHT_PX = 16;

const FAMILY_BY_STATE = Object.freeze(
  Object.fromEntries(Object.entries(STATE_FAMILIES).flatMap(([family, states]) => states.map((s) => [s, family]))),
);

/** The state family of a car state (riderWork, emptyDrive, available or atDepot). */
export function familyOf(state) {
  const family = FAMILY_BY_STATE[state];
  if (family === undefined) throw new RangeError(`unknown car state ${String(state)}`);
  return family;
}

/**
 * Chevron level for a declared per-mille multiplier and the per-mille congestion threshold (RD-4), design §7.3:
 * 3 at ×2.0 or more; 2 from the threshold; 1 from ×1.2; 0 below ×1.2. The threshold test comes before ×1.2, so every
 * congested multiplier draws at least 2 even when the threshold is below ×1.2.
 */
export function chevronLevel(permille, thresholdPermille) {
  if (permille >= 2000) return 3;
  if (permille >= thresholdPermille) return 2;
  if (permille >= 1200) return 1;
  return 0;
}

/** Chevrons drawn on a visible route length in px: `level` per whole 40 px. */
export function chevronCount(level, lengthPx) {
  return level * Math.floor(lengthPx / CHEVRON_SPACING_PX);
}

/**
 * Unit-bar blocks for a car count. Rounding rule: none. Each 5 cars draw one full block and the remaining 1 to 4 cars
 * draw one partial block whose width is that many fifths of a block, so a single car is still visible and no count is
 * rounded up or down. Returns `{full, partialFifths}`.
 */
export function unitBlocks(count) {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("a car count is a non-negative integer");
  return { full: Math.floor(count / CARS_PER_BLOCK), partialFifths: count % CARS_PER_BLOCK };
}

/** The declared per-mille multiplier of a route direction for the hour holding `clock_s` (hours past 47 use hour 47). */
export function declaredMultiplier(scenario, route, dirKey, clock_s) {
  const hour = Math.min(47, Math.floor(clock_s / 3600));
  return scenario.congestion[route.cls][dirKey][hour];
}

/** Parameter along `p0 -> p1` where the segment leaves the `yard`-sized rectangle centred at `c`. */
function exitParameter(yard, c, p0, p1) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const hw = yard.width / 2;
  const hh = yard.height / 2;
  const tx = dx > 0 ? (c.x + hw - p0.x) / dx : dx < 0 ? (c.x - hw - p0.x) / dx : Infinity;
  const ty = dy > 0 ? (c.y + hh - p0.y) / dy : dy < 0 ? (c.y - hh - p0.y) / dy : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/**
 * Geometry of a route in view box px: `{pA, pB, ux, uy, nx, ny, length}` for the part outside both yards, drawn from
 * area `a` toward area `b`, offset sideways (highways one side, local routes the other), in `geometry` (wide by default).
 */
export function routeGeometry(route, geometry = GEOMETRIES.wide) {
  const ca = geometry.positions[route.a];
  const cb = geometry.positions[route.b];
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const d = Math.hypot(dx, dy);
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy;
  const ny = ux;
  const off = route.cls === "HIGHWAY" ? HIGHWAY_OFFSET_PX : LOCAL_OFFSET_PX;
  const p0 = { x: ca.x + nx * off, y: ca.y + ny * off };
  const p1 = { x: cb.x + nx * off, y: cb.y + ny * off };
  const t0 = exitParameter(geometry.yard, ca, p0, p1);
  const t1 = 1 - exitParameter(geometry.yard, cb, p1, p0);
  const pA = { x: p0.x + (p1.x - p0.x) * t0, y: p0.y + (p1.y - p0.y) * t0 };
  const pB = { x: p0.x + (p1.x - p0.x) * t1, y: p0.y + (p1.y - p0.y) * t1 };
  return { pA, pB, ux, uy, nx, ny, length: Math.hypot(pB.x - pA.x, pB.y - pA.y) };
}

/** Yard rectangles `{x0, y0, x1, y1}` of a geometry, in AREA_ORDER, grown by `pad` px on every side. */
export function yardRects(geometry, pad = 0) {
  return AREA_ORDER.map((id) => {
    const c = geometry.positions[id];
    return { id, x0: c.x - geometry.yard.width / 2 - pad, y0: c.y - geometry.yard.height / 2 - pad, x1: c.x + geometry.yard.width / 2 + pad, y1: c.y + geometry.yard.height / 2 + pad };
  });
}

const boxOverlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Whether segment p to q passes through the inside of `box` (sampled every 2 px or finer). */
function crossesBox(p, q, box) {
  const steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 2));
  for (let i = 0; i <= steps; i += 1) {
    const x = p.x + ((q.x - p.x) * i) / steps;
    const y = p.y + ((q.y - p.y) * i) / steps;
    if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) return true;
  }
  return false;
}

/**
 * Highway shield boxes in `geometry`: `Map(routeId -> {x, y, x0, y0, x1, y1, width})`, centred on the route's visible
 * segment (design §7.3). Each shield takes the first place along the segment, from the middle outwards, whose box clears
 * every yard (with a 2 px margin), every shield placed before it and the view box; failing that, the place with the
 * least overlap. Among clear places it prefers one that no other route line crosses. Shields draw above the yards, so
 * nothing covers the id.
 */
export function placeShields(routes, geometry) {
  const yards = yardRects(geometry, 2);
  const lines = routes.map((route) => ({ route, ...routeGeometry(route, geometry) }));
  const placed = new Map();
  for (const route of routes) {
    if (route.cls !== "HIGHWAY") continue;
    const g = routeGeometry(route, geometry);
    const text = routeShield({ routeId: route.id, freeFlow: format.minutes(route.free_flow_s) });
    const width = geometry.shieldPad + text.length * geometry.charPx;
    let best = null;
    for (let k = 0; k <= 16; k += 1) {
      const f = 0.5 + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 0.025;
      const x = g.pA.x + (g.pB.x - g.pA.x) * f;
      const y = g.pA.y + (g.pB.y - g.pA.y) * f;
      const box = { x, y, width, x0: x - width / 2, x1: x + width / 2, y0: y - SHIELD_HEIGHT_PX / 2, y1: y + SHIELD_HEIGHT_PX / 2 };
      const overlap = yards.reduce((n, r) => n + boxOverlap(box, r), 0) + [...placed.values()].reduce((n, r) => n + boxOverlap(box, r), 0);
      const outside = box.x0 < 0 || box.y0 < 0 || box.x1 > geometry.view.width || box.y1 > geometry.view.height;
      const samePair = (other) => (other.a === route.a && other.b === route.b) || (other.a === route.b && other.b === route.a);
      const crossings = lines.filter((l) => !samePair(l.route) && crossesBox(l.pA, l.pB, box)).length;
      const score = overlap * 1000 + (outside ? 1e9 : 0) + crossings * 10 + Math.abs(f - 0.5);
      if (best === null || score < best.score) best = { box, score };
    }
    placed.set(route.id, best.box);
  }
  return placed;
}

/**
 * The stretch of a route, as distances from `pA`, where its flow band may lie without passing under a shield: the whole
 * visible segment less 4 px at each end, cut around every shield box its band line would cross, keeping the longest piece.
 * Returns `{from, to}` in px.
 */
export function flowSpan(route, geometry, shields) {
  const g = routeGeometry(route, geometry);
  const side = route.cls === "HIGHWAY" ? -1 : 1;
  const at = (s) => ({ x: g.pA.x + g.ux * s + g.nx * FLOW_OFFSET_PX * side, y: g.pA.y + g.uy * s + g.ny * FLOW_OFFSET_PX * side });
  let spans = [{ from: 4, to: Math.max(4, g.length - 4) }];
  for (const box of shields.values()) {
    const grown = { x0: box.x0 - 3, y0: box.y0 - 3, x1: box.x1 + 3, y1: box.y1 + 3 };
    const next = [];
    for (const span of spans) {
      if (!crossesBox(at(span.from), at(span.to), grown)) {
        next.push(span);
        continue;
      }
      const corners = [[grown.x0, grown.y0], [grown.x1, grown.y0], [grown.x0, grown.y1], [grown.x1, grown.y1]].map(([x, y]) => (x - g.pA.x) * g.ux + (y - g.pA.y) * g.uy);
      const lo = Math.min(...corners);
      const hi = Math.max(...corners);
      if (lo > span.from) next.push({ from: span.from, to: Math.min(span.to, lo) });
      if (hi < span.to) next.push({ from: Math.max(span.from, hi), to: span.to });
    }
    spans = next;
  }
  if (spans.length === 0) return { from: g.length / 2, to: g.length / 2 };
  return spans.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
}

const intervalIndexes = new WeakMap();

/** The interval of a car that a snapshot leg belongs to (same start second and state), or null. */
function legInterval(log, car) {
  const intervals = log.intervals?.[car.id];
  if (!Array.isArray(intervals)) return null;
  let cache = intervalIndexes.get(log);
  if (cache === undefined) {
    cache = new Map();
    intervalIndexes.set(log, cache);
  }
  const key = `${car.id}|${String(car.leg.t0)}|${car.state}`;
  if (cache.has(key)) return cache.get(key);
  let lo = 0;
  let hi = intervals.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (intervals[mid].t0 <= car.leg.t0) lo = mid;
    else hi = mid - 1;
  }
  let found = null;
  for (let i = lo; i >= 0 && intervals[i].t0 === car.leg.t0; i -= 1) {
    if (intervals[i].state === car.state && Array.isArray(intervals[i].segments)) {
      found = intervals[i];
      break;
    }
  }
  cache.set(key, found);
  return found;
}

/**
 * Where a frame car is: `{kind: "area", area}`, `{kind: "depot", depot, area}` or
 * `{kind: "route", route, dir, fraction}` (fraction of the route segment done, 0..1). `at_s` is the frame's second
 * (clamped to the leg); without it the leg second is `t0 + done_permille × (t1 - t0) / 1000`. A frame's `at_s` and its
 * `done_permille` describe the same second in both motion modes, so reduced motion places cars at their snapshot positions.
 */
export function placeCar(log, car, at_s = null) {
  if (car.leg === undefined) {
    if (typeof car.location?.depot === "string") return { kind: "depot", depot: car.location.depot, area: depotArea(car.location.depot) };
    return { kind: "area", area: car.location.area };
  }
  const leg = car.leg;
  const t = at_s === null ? leg.t0 + (leg.done_permille * (leg.t1 - leg.t0)) / 1000 : Math.min(leg.t1, Math.max(leg.t0, at_s));
  const endArea = () => (typeof leg.to.depot === "string" ? depotArea(leg.to.depot) : leg.to.area);
  const interval = legInterval(log, car);
  const segments = interval?.segments ?? [];
  let segment = null;
  for (const s of segments) {
    if (s.t0 <= t && t < s.t1) {
      segment = s;
      break;
    }
  }
  if (segment === null) {
    if (segments.length > 0 && t < segments[0].t0) segment = segments[0];
    else return { kind: "area", area: endArea() };
  }
  switch (segment.kind) {
    case "ROUTE":
      return { kind: "route", route: segment.key, dir: segment.dir, fraction: Math.min(1, Math.max(0, (t - segment.t0) / (segment.t1 - segment.t0))) };
    case "IN_AREA":
      return { kind: "area", area: segment.key.slice(3) };
    case "ACCESS":
      return { kind: "area", area: depotArea(segment.key.slice(4)) };
    default:
      return { kind: "area", area: typeof leg.from.depot === "string" ? depotArea(leg.from.depot) : leg.from.area };
  }
}

/** Depots to draw: the log's when a run exists (it names what ran), else the scenario's; each `{id, area, parking}`. */
function depotList(scenario, log) {
  const source = log?.depots ?? scenario.depots;
  return source.map((d) => ({ id: d.id, area: d.area, parking: d.parking }));
}

/**
 * Every number the map and its table twin show, from this replay: `{hasLog, clock_s, at_s, hour, areas, depots,
 * routes}`. Areas hold `families` (car counts by family), `waiting`, `unservedLastHour` and `unservedRecent`; depots
 * hold `held`, `parking`, `queued` (queue plus gate), `inBays` (cleaning and service bays busy, blocked cars included)
 * and `ready`; each route holds `directions` with `multiplier`, `level`, `planned_s`, `riderWork` and `emptyDrive`.
 * Without a log, every replay number is null. Replay numbers use `frame.at_s`; planned times and chevrons use the clock.
 */
export function mapModel({ scenario, log = null, frame = null, clock_s }) {
  const hasLog = log !== null && frame !== null;
  const at_s = hasLog ? frame.at_s : clock_s;
  const threshold = scenario.congestion_threshold_permille;
  const areas = {};
  for (const id of AREA_ORDER) {
    areas[id] = hasLog
      ? { families: { riderWork: 0, emptyDrive: 0, available: 0, atDepot: 0 }, waiting: 0, unservedLastHour: 0, unservedRecent: 0 }
      : { families: null, waiting: null, unservedLastHour: null, unservedRecent: null };
  }
  const routes = scenario.routes.map((route) => ({
    id: route.id,
    cls: route.cls,
    a: route.a,
    b: route.b,
    free_flow_s: route.free_flow_s,
    directions: [
      [route.a, route.b],
      [route.b, route.a],
    ].map(([from, to]) => {
      const dir = `${from}>${to}`;
      const multiplier = declaredMultiplier(scenario, route, dir, clock_s);
      return {
        dir,
        from,
        to,
        multiplier,
        level: chevronLevel(multiplier, threshold),
        planned_s: plannedLegSeconds(scenario, { kind: "ROUTE", route_id: route.id, from, to }, clock_s),
        riderWork: hasLog ? 0 : null,
        emptyDrive: hasLog ? 0 : null,
      };
    }),
  }));
  const depots = depotList(scenario, log).map((d) => ({ ...d, held: null, queued: null, inBays: null, ready: null }));
  if (hasLog) {
    const routeDirs = new Map();
    for (const r of routes) for (const d of r.directions) routeDirs.set(`${r.id}|${d.dir}`, d);
    for (const car of frame.cars) {
      const family = familyOf(car.state);
      const place = placeCar(log, car, at_s);
      if (place.kind === "route") {
        const d = routeDirs.get(`${place.route}|${place.dir}`);
        if (d !== undefined && (family === "riderWork" || family === "emptyDrive")) d[family] += 1;
        continue;
      }
      if (areas[place.area] !== undefined) areas[place.area].families[family] += 1;
    }
    for (const r of log.requests) {
      if (r.time_s > at_s) continue;
      const area = areas[r.origin];
      if (area === undefined) continue;
      const assigned = r.assigned_s !== null && r.assigned_s <= at_s;
      const unserved = r.unserved_s !== null && r.unserved_s <= at_s;
      if (!assigned && !unserved) area.waiting += 1;
      if (unserved && r.unserved_s > at_s - 3600) area.unservedLastHour += 1;
      if (unserved && r.unserved_s > at_s - UNSERVED_FOLD_S) area.unservedRecent += 1;
    }
    const views = new Map(frame.depots.map((d) => [d.id, d]));
    for (const d of depots) {
      const v = views.get(d.id);
      if (v === undefined) continue;
      d.held = v.stalls_held;
      d.queued = v.queue + v.gate;
      d.inBays = v.clean_busy + v.service_busy;
      d.ready = v.ready;
    }
  }
  return { hasLog, clock_s, at_s, hour: Math.min(47, Math.floor(clock_s / 3600)), areas, depots, routes };
}

// ---------------------------------------------------------------------------------------------------------------
// Drawing.

/** An SVG element with attributes set through setAttribute. */
function svg(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(name, String(value));
  }
  return node;
}

/** SVG text holding `text` through textContent, filled with a token colour. */
function svgText(text, attrs, colour = "var(--ink)") {
  const node = svg("text", attrs);
  node.style.fill = colour;
  node.textContent = text;
  return node;
}

const round = (n) => Math.round(n * 10) / 10;

/** Percent text for a CSS position from a fraction. */
function pct(fraction) {
  return `${String(Math.round(fraction * 10000) / 100)}%`;
}

/** Glyph nodes of a car state centred on 0,0 (design §8.2); the caller sets the family class and heading. */
export function glyphFor(state) {
  const edge = (node) => {
    node.setAttribute("class", "fl-glyph-edge");
    return node;
  };
  switch (state) {
    case "ENROUTE_PICKUP":
      return [svg("polygon", { points: "6,0 -5,-5 -5,5", fill: "none", stroke: "currentColor", "stroke-width": 2 })];
    case "ON_TRIP":
      return [svg("polygon", { points: "6,0 -5,-5 -5,5", fill: "currentColor" })];
    case "TO_DEPOT":
      return [svg("polygon", { points: "0,-6 6,0 0,6 -6,0", fill: "currentColor" })];
    case "REPOSITIONING":
      return [svg("polygon", { points: "0,-6 6,0 0,6 -6,0", fill: "none", stroke: "currentColor", "stroke-width": 2 })];
    case "IDLE":
      return [svg("circle", { r: 5, fill: "currentColor" }), edge(svg("circle", { r: 5 }))];
    case "INTAKE":
      return [svg("rect", { x: -5, y: 0, width: 10, height: 5, fill: "currentColor" }), edge(svg("rect", { x: -5, y: -5, width: 10, height: 10 }))];
    case "QUEUED_SERVICE":
    case "GATE_WAIT":
      return [
        svg("rect", { x: -4, y: -4, width: 8, height: 8, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-dasharray": "2 2" }),
        edge(svg("rect", { x: -6, y: -6, width: 12, height: 12 })),
      ];
    case "IN_SERVICE":
      return [svg("rect", { x: -5, y: -5, width: 10, height: 10, fill: "currentColor" }), edge(svg("rect", { x: -5, y: -5, width: 10, height: 10 }))];
    case "READY_AT_DEPOT":
      return [svg("circle", { r: 4, fill: "none", stroke: "currentColor", "stroke-width": 2 }), edge(svg("circle", { r: 6 }))];
    default:
      throw new RangeError(`unknown car state ${String(state)}`);
  }
}

/** The page's media query list for `query`, or null without matchMedia. */
function defaultMatchMedia(query) {
  return typeof globalThis.matchMedia === "function" ? globalThis.matchMedia(query) : null;
}

/** The 8 px key glyph of a family at 0,0: the §8.2 shape of ON_TRIP, TO_DEPOT, IDLE and IN_SERVICE, edged where §8.2 edges. */
export function familyKey(family) {
  switch (family) {
    case "riderWork":
      return [svg("polygon", { points: "4,0 -4,-4 -4,4", fill: "currentColor" })];
    case "emptyDrive":
      return [svg("polygon", { points: "0,-4 4,0 0,4 -4,0", fill: "currentColor" })];
    case "available":
      return [svg("circle", { r: 4, fill: "currentColor" }), svg("circle", { r: 4, class: "fl-glyph-edge" })];
    case "atDepot":
      return [svg("rect", { x: -4, y: -4, width: 8, height: 8, fill: "currentColor" }), svg("rect", { x: -4, y: -4, width: 8, height: 8, class: "fl-glyph-edge" })];
    default:
      throw new RangeError(`unknown family ${String(family)}`);
  }
}

/**
 * The rect nodes of one unit block (or legend bar) of a family at `attrs`: empty drive hollow, the others filled, and the
 * under-3:1 families with the ink edge. `extra` attributes go on the painted rect only.
 */
function blockNodes(family, attrs, extra = {}) {
  const nodes = [family === "emptyDrive"
    ? svg("rect", { ...attrs, fill: "none", stroke: "currentColor", "stroke-width": 1.5, ...extra })
    : svg("rect", { ...attrs, fill: "currentColor", ...extra })];
  if (EDGE_FAMILIES.includes(family)) nodes.push(svg("rect", { ...attrs, class: "fl-glyph-edge" }));
  return nodes;
}

/** A legend swatch: the family's key glyph, then its block as the yards draw it (hollow for empty driving). */
function familySwatch(family) {
  // flex: none keeps the swatch at its size when the legend row is narrow.
  const box = svg("svg", { width: 32, height: 12, viewBox: "0 0 32 12", "aria-hidden": "true", focusable: "false", class: FAMILY_CLASS[family], "data-role": "swatch", style: "flex: none" });
  const key = svg("g", { transform: "translate(6 6)" });
  key.append(...familyKey(family));
  box.append(key, ...blockNodes(family, { x: 14, y: 2.5, width: 16, height: 7 }));
  return box;
}

/** Absent text for a table cell before any run. */
const notRun = () => format.absent(ABSENT_REASONS.notRunYet);
const countOrAbsent = (value) => (value === null ? notRun() : format.count(value));

/**
 * Creates the map. Options: `onKey(event)` for playback shortcuts while the map has focus (returns true when handled),
 * `onInspect(target)` with `{depot}` or `{car}`, `onSelect(selection)` with `{depot}`. Returns
 * `{element, svg, table, update(input), focusState()}`; `update` takes `{scenario, log, frame, clock_s, pinnedCar,
 * seed, stale}`.
 */
export function createMap({ onKey = () => false, onInspect = () => {}, onSelect = () => {}, matchMedia = defaultMatchMedia } = {}) {
  const chip = el("span", { class: "fl-chip-replay", "data-role": "replay-chip" }, "");
  const tableToggle = el(
    "button",
    { type: "button", class: "fl-button", "aria-pressed": "false", "aria-label": MAP.tableToggle, on: { click: () => setTableOpen(!tableOpen) } },
    CHARTS.table,
  );
  const header = el("div", { class: "fl-now__row" }, [chip, tableToggle]);
  const nothingRun = el("p", { class: "fl-muted", "data-role": "nothing-run" }, STATES.nothingRun);

  // Below 768 px the map switches to its phone geometry, so its text and glyphs keep their size (design §7.2, §8.2).
  const media = typeof matchMedia === "function" ? matchMedia(PHONE_QUERY) : null;
  const geometryNow = () => (media?.matches === true ? GEOMETRIES.phone : GEOMETRIES.wide);
  let geometry = geometryNow();
  // An explicit tabindex of -1: without it Chromium makes the overflow-hidden svg a focusable scroller, a second tab stop
  // before the roving area group (design §7.7: the map is one focusable region).
  const root = svg("svg", { width: "100%", role: "group", "aria-label": MAP.name, tabindex: -1 });
  const routesLayer = svg("g", { "data-layer": "routes" });
  const yardsLayer = svg("g", { "data-layer": "yards" });
  // Shields paint after the yards and every route (design §7.3: a shield with its id), so nothing covers or strikes one.
  const shieldsLayer = svg("g", { "data-layer": "shields" });
  const pinnedLayer = svg("g", { "data-layer": "pinned" });
  root.append(routesLayer, yardsLayer, shieldsLayer, pinnedLayer);

  const tooltip = el("div", { class: "fl-tooltip", role: "tooltip", id: "fleetlab-map-tooltip", "data-open": "false" });
  const stage = el("div", { "data-role": "stage" }, [root, tooltip]);
  stage.style.position = "relative";

  // One swatch and word per family, in unit-bar row order: the key glyph and the block as drawn, so hue is never the only
  // cue (design §8.2). The unit legend is its own line.
  const legend = el("div", { class: "fl-small-label", "data-role": "legend" }, [
    el("p", { "data-role": "unit-legend", style: "margin: 0" }, MAP.unitBarLegend),
    el("ul", { class: "fl-map-legend", "data-role": "family-legend" }, FAMILY_ORDER.map((family) =>
      el("li", { "data-family": family }, [familySwatch(family), el("span", {}, MAP.families[family])]))),
  ]);
  const stamp = el("span", { class: "fl-map__stamp" }, MAP.cornerStamp);

  const table = el("table", { class: "fl-table" });
  const tableWrap = el("div", { class: "fl-sr-only", "data-role": "table-twin" }, table);
  const element = el("div", { "data-role": "map" }, [header, nothingRun, stage, legend, tableWrap, stamp]);

  let tableOpen = false;
  function setTableOpen(open) {
    tableOpen = open;
    tableToggle.setAttribute("aria-pressed", open ? "true" : "false");
    tableWrap.setAttribute("class", open ? "fl-scroll" : "fl-sr-only");
  }

  // Static structure, rebuilt when the scenario or the depot list changes.
  let built = null;
  let focus = { level: "areas", area: "SF", index: 0 };
  let lastInput = null;

  function build(scenario, log) {
    routesLayer.replaceChildren();
    yardsLayer.replaceChildren();
    shieldsLayer.replaceChildren();
    const { view, yard, tile, text } = geometry;
    root.setAttribute("viewBox", `0 0 ${String(view.width)} ${String(view.height)}`);
    root.setAttribute("data-geometry", geometry.name);
    root.style.maxWidth = geometry.maxWidthPx === null ? "" : `${String(geometry.maxWidthPx)}px`;
    const shields = placeShields(scenario.routes, geometry);
    const routes = new Map();
    for (const route of scenario.routes) {
      const geo = routeGeometry(route, geometry);
      const { pA, pB } = geo;
      const d = `M${String(round(pA.x))} ${String(round(pA.y))} L${String(round(pB.x))} ${String(round(pB.y))}`;
      const shield = routeShield({ routeId: route.id, freeFlow: format.minutes(route.free_flow_s) });
      const group = svg("g", {
        class: route.cls === "HIGHWAY" ? "fl-route fl-route--highway" : "fl-route fl-route--local",
        "data-route": route.id,
        "data-focus-key": `route:${route.id}`,
        tabindex: -1,
        "aria-label": shield,
        "aria-roledescription": route.cls === "HIGHWAY" ? MAP.highwayRoute : MAP.localRoute,
        "aria-describedby": "fleetlab-map-tooltip",
      });
      if (route.cls === "HIGHWAY") {
        group.append(svg("path", { class: "fl-route-highway__casing", d }), svg("path", { class: "fl-route-highway__centre", d }));
      } else {
        group.append(svg("path", { class: "fl-route-local", d }));
      }
      const chevrons = svg("g", { "data-role": "chevrons" });
      const flow = svg("g", { "data-role": "flow" });
      group.append(chevrons, flow);
      const mid = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
      const show = () => showRoute(route.id, true);
      const hide = () => showRoute(route.id, false);
      let label;
      if (route.cls === "HIGHWAY") {
        // The shield lives in the shields layer, painted after every route and yard, so nothing covers its id. The route
        // group already carries the same words as its name, so the shield is hidden from assistive technology.
        const box = shields.get(route.id);
        const shieldGroup = svg("g", { "data-role": "shield", "data-route-id": route.id, "aria-hidden": "true", transform: `translate(${String(round(box.x))} ${String(round(box.y))})` });
        const rect = svg("rect", { x: round(-box.width / 2), y: -SHIELD_HEIGHT_PX / 2, width: round(box.width), height: SHIELD_HEIGHT_PX, rx: 3 });
        rect.style.fill = "var(--panel)";
        rect.style.stroke = "var(--ink)";
        shieldGroup.append(rect, svgText(shield, { class: "fl-mono", "text-anchor": "middle", y: Math.round(text.small * 0.4), "font-size": text.small }));
        shieldGroup.addEventListener("pointerenter", show);
        shieldGroup.addEventListener("pointerleave", hide);
        shieldsLayer.append(shieldGroup);
        label = shieldGroup;
      } else {
        label = svgText(shield, {
          class: "fl-mono",
          "data-role": "local-label",
          "text-anchor": "middle",
          x: round(mid.x + geo.nx * 16),
          y: round(mid.y + geo.ny * 16),
          "font-size": text.small,
          visibility: "hidden",
        });
        group.append(label);
      }
      group.addEventListener("pointerenter", show);
      group.addEventListener("pointerleave", hide);
      group.addEventListener("focus", show);
      group.addEventListener("blur", hide);
      routesLayer.append(group);
      routes.set(route.id, { route, geometry: geo, span: flowSpan(route, geometry, shields), group, chevrons, flow, label, mid, chevronKey: null, flowKey: null });
    }

    const areas = new Map();
    const depots = new Map();
    const depotRows = depotList(scenario, log);
    for (const id of AREA_ORDER) {
      const c = geometry.positions[id];
      const x0 = c.x - yard.width / 2;
      const y0 = c.y - yard.height / 2;
      const group = svg("g", { class: "fl-area", "data-area": id, "data-focus-key": `area:${id}`, tabindex: -1, "aria-label": MAP.areas[id] });
      group.append(svg("rect", { class: "fl-yard", x: x0, y: y0, width: yard.width, height: yard.height, rx: 12 }));
      group.append(svgText(MAP.areas[id], { x: x0 + 10, y: y0 + 16, "font-size": text.name, "font-weight": 600 }));
      const bars = svg("g", { "data-role": "unit-bars" });
      // A family key glyph starts each unit-bar row, in the legend's order, so a row is named by shape as well as hue.
      const keys = svg("g", { "data-role": "row-keys", "aria-hidden": "true" });
      FAMILY_ORDER.forEach((family, row) => {
        const key = svg("g", { class: FAMILY_CLASS[family], "data-family": family, transform: `translate(${String(x0 + 14)} ${String(y0 + 24 + row * 10 + 3.5)})` });
        key.append(...familyKey(family));
        keys.append(key);
      });
      const waiting = svg("g", { "data-role": "waiting" });
      waiting.append(svg("circle", { class: "fl-rider-ring", cx: x0 + 15, cy: y0 + 77, r: 4 }));
      const waitingText = svgText("", { x: x0 + 24, y: y0 + 81, "font-size": text.small });
      waiting.append(waitingText);
      const unserved = svg("g", { class: "fl-unserved", "data-role": "unserved" });
      unserved.append(
        svg("path", { d: `M${x0 + 11} ${y0 + 87} L${x0 + 19} ${y0 + 95} M${x0 + 19} ${y0 + 87} L${x0 + 11} ${y0 + 95}`, stroke: "currentColor", "stroke-width": 2, fill: "none" }),
      );
      const unservedText = svgText("", { x: x0 + 24, y: y0 + 95, "font-size": text.small }, "currentColor");
      unserved.append(unservedText);
      group.append(keys, bars, waiting, unserved);
      const inArea = depotRows.filter((d) => d.area === id).sort((a, b) => (a.id < b.id ? -1 : 1));
      inArea.forEach((depot, i) => {
        const tx = x0 + yard.width - 8 - (inArea.length - i) * (tile.width + 6) + 6;
        const ty = y0 + yard.height - tile.height - 4;
        const tileGroup = svg("g", {
          class: "fl-depot",
          "data-depot": depot.id,
          "data-focus-key": `depot:${depot.id}`,
          tabindex: -1,
          "aria-label": depotName({ depotId: depot.id, areaName: MAP.areas[id] }),
        });
        tileGroup.append(svg("rect", { class: "fl-depot-tile", x: tx, y: ty, width: tile.width, height: tile.height }));
        tileGroup.append(svgText(depot.id, { class: "fl-mono", x: tx + 6, y: ty + 12, "font-size": text.small }));
        const micro = svg("g", { "data-role": "micro-bar", class: "fl-fam-depot" });
        const lot = svg("g", { "data-role": "lot" });
        tileGroup.append(micro, lot);
        group.append(tileGroup);
        depots.set(depot.id, { depot, tile: tileGroup, micro, lot, x: tx, y: ty, key: null });
      });
      yardsLayer.append(group);
      areas.set(id, { group, bars, keys, waiting, waitingText, unserved, unservedText, x0, y0, barsKey: null, depots: inArea.map((d) => d.id) });
    }
    built = { scenario, geometry, depotKey: depotRows.map((d) => `${d.id}:${String(d.parking)}`).join(","), routes, areas, depots, shields };
    applyRoving(false);
  }

  function showRoute(routeId, open) {
    const entry = built?.routes.get(routeId);
    if (entry === undefined) return;
    if (entry.route.cls === "LOCAL") entry.label.setAttribute("visibility", open ? "visible" : "hidden");
    if (!open) {
      tooltip.setAttribute("data-open", "false");
      tooltip.hidden = true;
      return;
    }
    const model = lastModel;
    const r = model?.routes.find((x) => x.id === routeId);
    if (r === undefined) return;
    tooltip.replaceChildren(
      ...r.directions.map((d) =>
        el("div", { "data-dir": d.dir }, [
          el("div", {}, routeDirection({ routeId: r.id, from: MAP.areas[d.from], to: MAP.areas[d.to] })),
          el(
            "div",
            {},
            routeTooltip({
              clock: format.clock(model.clock_s),
              planned: format.minutes(d.planned_s),
              freeFlow: format.minutes(r.free_flow_s),
              slowed: d.planned_s !== r.free_flow_s,
            }),
          ),
        ]),
      ),
    );
    tooltip.style.left = pct(entry.mid.x / geometry.view.width);
    tooltip.style.top = pct(entry.mid.y / geometry.view.height);
    tooltip.hidden = false;
    tooltip.setAttribute("data-open", "true");
    tooltip.setAttribute("data-route", routeId);
  }

  function drawChevrons(entry, r) {
    const key = r.directions.map((d) => String(d.level)).join("|");
    if (entry.chevronKey === key) return;
    entry.chevronKey = key;
    const { pA, ux, uy, nx, ny, length } = entry.geometry;
    const nodes = [];
    r.directions.forEach((d, side) => {
      const count = chevronCount(d.level, length);
      const sign = side === 0 ? 1 : -1; // travel a>b sits on one side, b>a on the other
      for (let i = 1; i <= count; i += 1) {
        const s = (length * i) / (count + 1);
        const cx = pA.x + ux * s + nx * CHEVRON_SIDE_PX * sign;
        const cy = pA.y + uy * s + ny * CHEVRON_SIDE_PX * sign;
        const hx = ux * sign;
        const hy = uy * sign;
        const tip = `${String(round(cx + hx * 2.5))} ${String(round(cy + hy * 2.5))}`;
        const arm1 = `${String(round(cx - hx * 2.5 + nx * 3))} ${String(round(cy - hy * 2.5 + ny * 3))}`;
        const arm2 = `${String(round(cx - hx * 2.5 - nx * 3))} ${String(round(cy - hy * 2.5 - ny * 3))}`;
        nodes.push(svg("path", { class: "fl-chevron", "data-dir": d.dir, d: `M${arm1} L${tip} L${arm2}` }));
      }
    });
    entry.chevrons.replaceChildren(...nodes);
    const congested = r.directions.some((d) => d.level >= 2);
    entry.group.setAttribute("class", `${entry.route.cls === "HIGHWAY" ? "fl-route fl-route--highway" : "fl-route fl-route--local"}${congested ? " fl-route--congested" : ""}`);
  }

  function drawFlow(entry, r) {
    const rider = r.directions.reduce((n, d) => n + (d.riderWork ?? 0), 0);
    const empty = r.directions.reduce((n, d) => n + (d.emptyDrive ?? 0), 0);
    const key = `${String(rider)}|${String(empty)}`;
    if (entry.flowKey === key) return;
    entry.flowKey = key;
    const { pA, ux, uy, nx, ny } = entry.geometry;
    const side = entry.route.cls === "HIGHWAY" ? -1 : 1;
    // The band keeps to the stretch of its route that no shield covers (map.js flowSpan).
    const { from, to } = entry.span;
    const cars = rider + empty;
    const perCar = Math.min(4, Math.max(0, to - from) / Math.max(1, cars));
    const along = (from + to) / 2 - (perCar * cars) / 2;
    const start = { x: pA.x + ux * along + nx * FLOW_OFFSET_PX * side, y: pA.y + uy * along + ny * FLOW_OFFSET_PX * side };
    const segment = (p, count, family) => {
      const q = { x: p.x + ux * perCar * count, y: p.y + uy * perCar * count };
      const attrs = { class: FAMILY_CLASS[family], "data-family": family, "data-cars": count };
      // Rider work is a solid 4 px band; empty driving is the same band drawn hollow, so hue is never the only cue (§8.2).
      const node = family === "riderWork"
        ? svg("line", { ...attrs, x1: round(p.x), y1: round(p.y), x2: round(q.x), y2: round(q.y), stroke: "currentColor", "stroke-width": 4 })
        : svg("path", {
          ...attrs,
          "data-shape": "hollow",
          d: `M${String(round(p.x + nx * 1.5))} ${String(round(p.y + ny * 1.5))} L${String(round(q.x + nx * 1.5))} ${String(round(q.y + ny * 1.5))} L${String(round(q.x - nx * 1.5))} ${String(round(q.y - ny * 1.5))} L${String(round(p.x - nx * 1.5))} ${String(round(p.y - ny * 1.5))} Z`,
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 1.5,
        });
      return { node, to: q };
    };
    const nodes = [];
    if (rider > 0) nodes.push(segment(start, rider, "riderWork"));
    const emptyStart = rider > 0 ? nodes[0].to : start;
    if (empty > 0) nodes.push(segment(emptyStart, empty, "emptyDrive"));
    entry.flow.replaceChildren(...nodes.map((n) => n.node));
  }

  function drawBars(area, families) {
    const key = families === null ? "none" : FAMILY_ORDER.map((f) => String(families[f])).join("|");
    if (area.barsKey === key) return;
    area.barsKey = key;
    area.keys.toggleAttribute("hidden", families === null);
    if (families === null) {
      area.bars.replaceChildren();
      return;
    }
    const rowWidth = geometry.yard.width - BAR_START_PX - 10;
    const rows = FAMILY_ORDER.map((family, row) => {
      const { full, partialFifths } = unitBlocks(families[family]);
      const blocks = full + (partialFifths > 0 ? 1 : 0);
      const size = blocks * (BLOCK_PX + BLOCK_GAP_PX) - BLOCK_GAP_PX > rowWidth ? (rowWidth + BLOCK_GAP_PX) / blocks - BLOCK_GAP_PX : BLOCK_PX;
      const g = svg("g", { class: FAMILY_CLASS[family], "data-family": family, "data-cars": families[family] });
      const y = area.y0 + 24 + row * 10;
      for (let i = 0; i < blocks; i += 1) {
        const width = i < full ? size : (size * partialFifths) / CARS_PER_BLOCK;
        const x = area.x0 + BAR_START_PX + i * (size + BLOCK_GAP_PX);
        g.append(...blockNodes(family, { x: round(x), y, width: round(width), height: BLOCK_PX }, { "data-block": i < full ? "full" : `fifths-${String(partialFifths)}` }));
      }
      return g;
    });
    area.bars.replaceChildren(...rows);
  }

  function drawDepot(entry, d) {
    const key = `${String(d.held)}|${String(d.queued)}|${String(d.inBays)}|${String(d.ready)}`;
    if (entry.key === key) return;
    entry.key = key;
    const x = entry.x + 6;
    if (d.held === null) {
      entry.micro.replaceChildren();
      entry.lot.replaceChildren();
      return;
    }
    const total = d.queued + d.inBays + d.ready;
    const { tile } = geometry;
    const scale = tile.bar / Math.max(1, d.parking, total);
    const parts = [];
    let cursor = x;
    const part = (name, cars, paint) => {
      const width = cars * scale;
      const attrs = { x: round(cursor), y: entry.y + 18, width: round(width), height: 6 };
      const nodes = [];
      if (paint === "fill") nodes.push(svg("rect", { ...attrs, fill: "currentColor", "data-part": name, "data-cars": cars }));
      else if (paint === "muted") {
        const r = svg("rect", { ...attrs, "data-part": name, "data-cars": cars });
        r.style.fill = "var(--muted)";
        nodes.push(r);
      } else nodes.push(svg("rect", { ...attrs, fill: "none", "data-part": name, "data-cars": cars }));
      nodes.push(svg("rect", { ...attrs, class: "fl-glyph-edge" }));
      cursor += width;
      parts.push(...nodes);
    };
    // Queued is an outline, in a bay is the at-depot hue, ready is muted ink: order and shape tell them apart.
    part("queued", d.queued, "outline");
    part("inBays", d.inBays, "fill");
    part("ready", d.ready, "muted");
    entry.micro.replaceChildren(...parts);
    const lotOutline = svg("rect", { class: "fl-glyph-edge", x, y: entry.y + 28, width: tile.bar, height: 6 });
    const lotFillRect = svg("rect", { "data-part": "lot", "data-held": d.held, x, y: entry.y + 28, width: round((tile.bar * Math.min(d.held, d.parking)) / d.parking), height: 6 });
    lotFillRect.style.fill = "var(--ink)";
    const title = svg("title");
    title.textContent = `${depotName({ depotId: d.id, areaName: MAP.areas[d.area] })} ${lotFill(d.held, d.parking)}`;
    entry.lot.replaceChildren(lotFillRect, lotOutline, title);
  }

  function drawPinned(input, model) {
    pinnedLayer.replaceChildren();
    const { frame, log, pinnedCar } = input;
    if (!model.hasLog || typeof pinnedCar !== "string") return;
    const car = frame.cars.find((c) => c.id === pinnedCar);
    if (car === undefined) return;
    const place = placeCar(log, car, frame.at_s);
    let x;
    let y;
    let angle = 0;
    if (place.kind === "route" && built.routes.has(place.route)) {
      const entry = built.routes.get(place.route);
      const forward = place.dir === `${entry.route.a}>${entry.route.b}`;
      const { pA, pB, ux, uy } = entry.geometry;
      const f = forward ? place.fraction : 1 - place.fraction;
      x = pA.x + (pB.x - pA.x) * f;
      y = pA.y + (pB.y - pA.y) * f;
      angle = (Math.atan2(forward ? uy : -uy, forward ? ux : -ux) * 180) / Math.PI;
    } else if (place.kind === "depot" && built.depots.has(place.depot)) {
      const entry = built.depots.get(place.depot);
      x = entry.x + geometry.tile.width - 10;
      y = entry.y + 10;
    } else {
      const c = geometry.positions[place.area];
      x = c.x + geometry.yard.width / 2 - 16;
      y = c.y - geometry.yard.height / 2 + 14;
    }
    const family = familyOf(car.state);
    const group = svg("g", {
      "data-car": car.id,
      "data-state": car.state,
      transform: `translate(${String(round(x))} ${String(round(y))})`,
      role: "img",
      "aria-label": pinnedCarName({ car: car.id, state: MAP.carStates[car.state] }),
    });
    const ring = svg("circle", { class: "fl-glyph-ring", r: 9, "data-role": "surface-ring" });
    const focusRing = svg("circle", { r: 11, fill: "none", "stroke-width": 2, "data-role": "focus-ring" });
    focusRing.style.stroke = "var(--accent)";
    const glyph = svg("g", {
      class: FAMILY_CLASS[family],
      transform: car.state === "ENROUTE_PICKUP" || car.state === "ON_TRIP" ? `rotate(${String(round(angle))})` : null,
    });
    glyph.append(...glyphFor(car.state));
    group.append(ring, focusRing, glyph);
    pinnedLayer.append(group);
  }

  function drawTable(model, seed) {
    const cell = (tag, text, attrs = {}) => el(tag, attrs, text);
    const head = (cells) => el("tr", {}, cells);
    const areaHead = [
      head([
        cell("th", MAP.tableHeads.area, { rowspan: 2, scope: "col" }),
        cell("th", MAP.tableHeads.carsByFamily, { colspan: 4, scope: "colgroup" }),
        cell("th", MAP.tableHeads.waitingRiders, { rowspan: 2, scope: "col" }),
        cell("th", MAP.tableHeads.unservedLastHour, { rowspan: 2, scope: "col" }),
      ]),
      head(FAMILY_ORDER.map((f) => cell("th", MAP.families[f], { scope: "col" }))),
    ];
    const areaRows = AREA_ORDER.map((id) => {
      const a = model.areas[id];
      return el("tr", { "data-area": id }, [
        cell("th", MAP.areas[id], { scope: "row" }),
        ...FAMILY_ORDER.map((f) => cell("td", a.families === null ? notRun() : format.count(a.families[f]), { "data-family": f })),
        cell("td", countOrAbsent(a.waiting), { "data-col": "waiting" }),
        cell("td", countOrAbsent(a.unservedLastHour), { "data-col": "unserved" }),
      ]);
    });
    const depotHead = head(
      [MAP.tableHeads.depot, MAP.tableHeads.stallsHeld, MAP.tableHeads.queue, MAP.tableHeads.inBays, MAP.tableHeads.ready].map((t) => cell("th", t, { scope: "col" })),
    );
    const depotRows = model.depots.map((d) =>
      el("tr", { "data-depot": d.id }, [
        cell("th", d.id, { scope: "row", class: "fl-mono" }),
        cell("td", d.held === null ? notRun() : lotFill(d.held, d.parking), { "data-col": "held" }),
        cell("td", countOrAbsent(d.queued), { "data-col": "queue" }),
        cell("td", countOrAbsent(d.inBays), { "data-col": "inBays" }),
        cell("td", countOrAbsent(d.ready), { "data-col": "ready" }),
      ]),
    );
    const routeHead = [
      head([
        cell("th", MAP.tableHeads.route, { rowspan: 2, scope: "col" }),
        cell("th", MAP.tableHeads.plannedNow, { rowspan: 2, scope: "col" }),
        cell("th", MAP.tableHeads.chevrons, { rowspan: 2, scope: "col" }),
        cell("th", MAP.tableHeads.carsOnRoute, { colspan: 2, scope: "colgroup" }),
      ]),
      head(["riderWork", "emptyDrive"].map((f) => cell("th", MAP.families[f], { scope: "col" }))),
    ];
    const routeRows = model.routes.flatMap((r) =>
      r.directions.map((d) =>
        el("tr", { "data-route": r.id, "data-dir": d.dir }, [
          cell("th", routeDirection({ routeId: r.id, from: MAP.areas[d.from], to: MAP.areas[d.to] }), { scope: "row" }),
          cell("td", format.minutes(d.planned_s), { "data-col": "planned" }),
          cell("td", CHEVRON_LEVELS[d.level], { "data-col": "level", "data-level": d.level }),
          cell("td", countOrAbsent(d.riderWork), { "data-family": "riderWork" }),
          cell("td", countOrAbsent(d.emptyDrive), { "data-family": "emptyDrive" }),
        ]),
      ),
    );
    const caption = el("caption", {}, [
      el("span", {}, MAP.tableTwin),
      model.hasLog && Number.isSafeInteger(seed) ? el("span", { class: "fl-chip-replay" }, thisReplayChip(seed)) : null,
    ]);
    table.replaceChildren(
      caption,
      el("thead", { "data-section": "areas" }, areaHead),
      el("tbody", { "data-section": "areas" }, areaRows),
      el("thead", { "data-section": "depots" }, depotHead),
      el("tbody", { "data-section": "depots" }, depotRows),
      el("thead", { "data-section": "routes" }, routeHead),
      el("tbody", { "data-section": "routes" }, routeRows),
    );
  }

  let lastModel = null;
  let tableKey = null;

  /** Draw `input`: `{scenario, log, frame, clock_s, pinnedCar, seed, stale}` (log and frame null before a run). */
  function update(input) {
    const { scenario, log = null, frame = null, clock_s, pinnedCar = null, seed = null, stale = false } = input;
    const depotKey = depotList(scenario, log).map((d) => `${d.id}:${String(d.parking)}`).join(",");
    if (built === null || built.scenario !== scenario || built.depotKey !== depotKey || built.geometry !== geometry) build(scenario, log);
    const model = mapModel({ scenario, log, frame, clock_s });
    lastModel = model;
    lastInput = input;

    nothingRun.hidden = model.hasLog;
    chip.hidden = !(model.hasLog && Number.isSafeInteger(seed));
    if (!chip.hidden) setText(chip, thisReplayChip(seed));
    stage.setAttribute("class", stale ? "fl-stale" : "");

    for (const r of model.routes) {
      const entry = built.routes.get(r.id);
      drawChevrons(entry, r);
      drawFlow(entry, r);
    }
    for (const id of AREA_ORDER) {
      const a = model.areas[id];
      const area = built.areas.get(id);
      drawBars(area, a.families);
      area.waiting.toggleAttribute("hidden", a.waiting === null);
      if (a.waiting !== null) setText(area.waitingText, waitingRiders(a.waiting));
      const recent = a.unservedRecent ?? 0;
      area.unserved.toggleAttribute("hidden", recent === 0);
      if (recent > 0) setText(area.unservedText, unservedCount(recent));
    }
    for (const d of model.depots) drawDepot(built.depots.get(d.id), d);
    drawPinned(input, model);

    const key = JSON.stringify([model.areas, model.depots, model.routes.map((r) => r.directions), seed]);
    if (key !== tableKey) {
      tableKey = key;
      drawTable(model, seed);
    }
    if (tooltip.getAttribute("data-open") === "true") showRoute(tooltip.getAttribute("data-route"), true);
    return model;
  }

  // Roving focus (design §7.7): one tab stop; arrows between areas; Enter into an area's depots and routes; Escape out.

  function innerItems(areaId) {
    if (built === null) return [];
    const depotKeys = built.areas.get(areaId).depots.map((id) => `depot:${id}`);
    const routeKeys = built.scenario.routes.filter((r) => r.a === areaId || r.b === areaId).map((r) => `route:${r.id}`);
    return [...depotKeys, ...routeKeys];
  }

  function currentKey() {
    if (focus.level === "areas") return `area:${focus.area}`;
    const items = innerItems(focus.area);
    return items[Math.min(focus.index, items.length - 1)];
  }

  function nodeFor(key) {
    return root.querySelector(`[data-focus-key="${key}"]`);
  }

  function applyRoving(moveFocus) {
    const key = currentKey();
    for (const node of root.querySelectorAll("[data-focus-key]")) node.setAttribute("tabindex", node.getAttribute("data-focus-key") === key ? "0" : "-1");
    if (moveFocus) nodeFor(key)?.focus();
  }

  root.addEventListener("focusin", (event) => {
    const node = event.target?.closest?.("[data-focus-key]");
    if (!node) return;
    const [kind, id] = node.getAttribute("data-focus-key").split(/:(.*)/s);
    if (kind === "area") focus = { level: "areas", area: id, index: 0 };
    else {
      const area = kind === "depot" ? built.depots.get(id).depot.area : focus.area;
      const items = innerItems(area);
      const index = items.indexOf(`${kind}:${id}`);
      if (index >= 0) focus = { level: "inner", area, index };
    }
    applyRoving(false);
  });

  root.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key;
    let handled = true;
    if (focus.level === "areas" && AREA_NEIGHBOURS[focus.area][key] !== undefined) {
      focus = { level: "areas", area: AREA_NEIGHBOURS[focus.area][key], index: 0 };
      applyRoving(true);
    } else if (focus.level === "areas" && key.startsWith("Arrow")) {
      // No area in that direction: stay.
    } else if (focus.level === "areas" && key === "Enter") {
      focus = { level: "inner", area: focus.area, index: 0 };
      applyRoving(true);
    } else if (focus.level === "inner" && key.startsWith("Arrow")) {
      const items = innerItems(focus.area);
      const by = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
      focus = { ...focus, index: (focus.index + by + items.length) % items.length };
      applyRoving(true);
    } else if (focus.level === "inner" && key === "Enter") {
      const [kind, id] = currentKey().split(/:(.*)/s);
      if (kind === "depot") onSelect({ depot: id });
      else showRoute(id, tooltip.getAttribute("data-open") !== "true");
    } else if (focus.level === "inner" && key === "Escape") {
      const [kind, id] = currentKey().split(/:(.*)/s);
      if (kind === "route") showRoute(id, false);
      focus = { level: "areas", area: focus.area, index: 0 };
      applyRoving(true);
    } else if (key === "i" || key === "I") {
      const [kind, id] = currentKey().split(/:(.*)/s);
      if (kind === "depot") onInspect({ depot: id });
      else if (typeof lastInput?.pinnedCar === "string") onInspect({ car: lastInput.pinnedCar });
      else handled = false;
    } else {
      handled = onKey(event) === true;
      return;
    }
    if (handled) event.preventDefault();
  });

  const onMedia = () => {
    const next = geometryNow();
    if (next === geometry) return;
    geometry = next;
    if (lastInput !== null) update(lastInput);
  };
  media?.addEventListener?.("change", onMedia);

  return {
    element,
    svg: root,
    table,
    update,
    /** The geometry in use: "wide" or "phone". */
    geometry: () => geometry.name,
    /** Stops following the phone media query. */
    destroy() {
      media?.removeEventListener?.("change", onMedia);
    },
    /** The roving focus position: `{level, area, index, key}`. */
    focusState: () => ({ ...focus, key: currentKey() }),
    /** Whether the table twin is shown. */
    tableOpen: () => tableOpen,
  };
}

/**
 * Mounts the map in the map region, following `store` and the `playback` controller. `onShortcuts` opens the shortcut
 * list for `?`. Returns the map object with a `destroy()`.
 */
export function mountMap(region, { store, playback, onShortcuts = null }) {
  const map = createMap({
    onKey: (event) => playback.handleKey(event, { arrows: false, onShortcuts }),
    onInspect: (target) => store.dispatch({ type: "inspector/open", target }),
    onSelect: (selection) => store.dispatch({ type: "selection/set", selection }),
  });
  region.replaceChildren(map.element);
  const render = () => {
    const s = store.getState();
    const log = s.run.log;
    // A result drawn after a knob change keeps the scenario it ran on (the store marks it out of date).
    const scenario = log !== null && s.run.scenarioAtQueue !== null ? s.run.scenarioAtQueue : s.scenario;
    map.update({
      scenario,
      log,
      frame: playback.frame(),
      clock_s: s.clock_s,
      pinnedCar: s.fork.pinnedCar ?? s.selection?.car ?? null,
      seed: s.run.selectedSeed,
      stale: s.run.stale,
    });
  };
  const unsubscribeStore = store.subscribe(render);
  const unsubscribePlayback = playback.onChange(render);
  render();
  return {
    ...map,
    destroy() {
      unsubscribeStore();
      unsubscribePlayback();
      map.destroy();
    },
  };
}
