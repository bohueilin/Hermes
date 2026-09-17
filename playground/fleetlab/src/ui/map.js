// The schematic map (design §7.3, §8.2, §8.3, §7.7). Four area yards at fixed positions, a highway and a local route per
// area pair drawn as parallel paths, congestion as static chevrons and a neutral casing step (never a hue, never dashed),
// depot tiles with a three-part micro-bar over a lot fill, unit bars per yard, a flow band per route, the pinned car,
// unserved riders, the corner stamp, the THIS REPLAY chip and a table twin. Every number here is from this replay.
//
// The map reads a frame from playback.js and the run log; it never runs the model. Planned times for a departure now
// come from the declared profile through routes.js plannedLegSeconds, which is arithmetic on the scenario only.
//
// A car driving a route is drawn as its own mark, at the progress placeCar reports along that route. A car standing in
// an area or sitting at a depot is not: the model gives an area no inside geography, so those cars stay unit bars and
// the depot tile's micro-bar rather than being given a place they do not have (design §8.5, H-2). Where a route is too
// short on this schematic to hold its own busiest moment, that direction keeps its flow band and says so in words.
//
// Where cars are counted (one partition, used by the yards, the flow bands and the table twin, so the counts sum to
// the fleet): a car standing at an area centre or at a depot counts in that area; a car on a leg counts on a route
// direction while its current segment is a route segment, and otherwise in the area of that segment (a trip or pickup
// inside an area, depot access, pull-out). A car whose leg has ended before the next snapshot counts at its leg's end.

import { el, keyedList, setText } from "./dom.js";
import * as format from "./format.js";
import {
  ABSENT_REASONS,
  CHARTS,
  CHEVRON_LEVELS,
  MAP,
  MODEL_LIMITS,
  STATES,
  depotName,
  lotFill,
  pickedLabel,
  pinnedCarName,
  presetOption,
  routeDirection,
  routeShield,
  routeTooltip,
  thisReplayChip,
  unservedCount,
  waitingRiders,
  worldLine,
} from "./labels.js";
import { STATE_FAMILIES } from "../model/metrics.js";
import { DEFAULT_PRESET_ID, presetById } from "../model/presets.js";
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

/**
 * How far a shield plate's nearest corner stands clear of the road it names, in view box px, when it is set off the
 * line: past the 9 px surface ring of a car mark, and past the flow band's lane beside the road (FLOW_OFFSET_PX, the
 * band's own 2 px half stroke and the 3 px margin flowSpan cuts with), so a plate that has left the line covers
 * neither the marks on that road nor the band next to it.
 */
export const SHIELD_GAP_PX = FLOW_OFFSET_PX + 5;

/**
 * How far one plate's nearest corner stands clear of another's, in view box px. Not overlapping is not enough: a
 * plate is stroked 1 px centred on its edge, so two plates half a px apart paint their outlines over each other and
 * two opaque rectangles carrying different route ids and different free-flow times render as one stacked block with
 * a single shared border, each with a hairline leader running off to a different road.
 *
 * Four px leaves two clear px between the two strokes, and at this scenario it is free: it moves the wide pair
 * H6 x H2 from 0.5 px apart to 5.0 px and changes no other plate, at either geometry or either fleet, and no
 * occlusion number anywhere. It is not to be raised past 4 without re-measuring, because the phone has no room to
 * pay for it: at a 6 px target phone car-frames hidden go 8.76% to 9.04% and the worst snapshot 20 to 22, and at
 * 8 px the 150-car reference reaches 26 marks hidden at one phone snapshot, past the bound map.test.mjs pins.
 */
export const PLATE_CLEAR_PX = 4;

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

/** The clear distance between two boxes that do not overlap, in view box px; 0 where they touch or overlap. */
const boxGap = (a, b) => Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.y0 - b.y1, b.y0 - a.y1, 0));

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

/** The length of segment p to q lying inside `box`, in view box px (the Liang-Barsky clip, exact and allocation free). */
function lengthInBox(p, q, box) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  for (const [d, lo, hi] of [[dx, box.x0 - p.x, box.x1 - p.x], [dy, box.y0 - p.y, box.y1 - p.y]]) {
    if (d === 0) {
      // Parallel to this pair of edges: either the whole segment is between them or none of it is.
      if (lo > 0 || hi < 0) return 0;
      continue;
    }
    t0 = Math.max(t0, Math.min(lo / d, hi / d));
    t1 = Math.min(t1, Math.max(lo / d, hi / d));
  }
  return t1 <= t0 ? 0 : (t1 - t0) * Math.hypot(dx, dy);
}

/** The side of its own line a route's flow band takes: highways one side, local routes the other (drawFlow). */
const flowSide = (route) => (route.cls === "HIGHWAY" ? -1 : 1);

/**
 * Every line of `geometry` that draws cars, as `[p, q]` pairs: each route's visible centre line, where one mark per
 * car rides, and the lane its flow band takes where its direction is banded. A plate over either hides work that a
 * reader is meant to see. Both are arithmetic on the scenario and the geometry: no log, clock or car is read here.
 */
function drawnLines(routes, geometry) {
  return routes.flatMap((route) => {
    const g = routeGeometry(route, geometry);
    const o = FLOW_OFFSET_PX * flowSide(route);
    return [
      [g.pA, g.pB],
      [{ x: g.pA.x + g.nx * o, y: g.pA.y + g.ny * o }, { x: g.pB.x + g.nx * o, y: g.pB.y + g.ny * o }],
    ];
  });
}

/**
 * Highway shield boxes in `geometry`: `Map(routeId -> {x, y, x0, y0, x1, y1, width, anchor, off})`, anchored on the
 * route's visible segment (design §7.3) and set off it, to the side that covers least of the drawing. `anchor` is the
 * point of the route line the plate names and `off` its signed offset along that route's normal, so the drawing can
 * put a leader between the two; `off` is 0 where the plate keeps the line.
 *
 * Why the plate leaves the line. A shield is opaque (`--panel` filled) and the cars layer paints below the shields
 * layer, so a plate on the line hides the marks under it: measured over the whole run of the default preset, the
 * centre of a drawn mark lay inside a plate on 18.42% of car-frames wide and 37.24% on the phone. The car is not what
 * moves, here or anywhere: a mark sits at the progress the model reports, and nudging one clear of a label would
 * invent a place (design §8.5). Neither does the paint order change (design §7.3: nothing covers a shield id).
 *
 * Each shield takes the place, from the middle of the segment outwards and on either side of the line, whose box
 * clears every yard (with a 2 px margin), every shield placed before it by PLATE_CLEAR_PX, and the view box; among
 * those it takes the one covering the fewest px of `drawnLines`, then the one nearest its own road, then the one
 * nearest the middle. Where nothing off the line clears, the plate keeps the line, as it always did. This is a pure
 * function of (routes, geometry): nothing here reads the run log, the clock or a car, so a shield never moves while
 * a run lands or a replay plays.
 *
 * **A bound this scorer does not clear, recorded rather than hidden.** `drawnLines` counts a local route exactly as
 * it counts a highway, because `drawCars` filters on the routes the map built and not on class, so a car driving a
 * local would be hidden under a plate just as a highway car was. It is still the least-bad placement available, not
 * an oversight: three of the six wide plates end nearer a local line than their own highway, and two sit on one
 * (H1's plate covers 16.0 px of L1, H4's 22.0 px of L2, and H2's nearest line is L5 at 18.6 px against its own road
 * at 21.0); on the phone H1's covers 16.0 px of L1, H6's 16.0 px of L6, and H2's and H5's 12.6 px each of L5 and L2.
 * Nothing is hidden by this today, and the measurement says so rather than assuming it: over every snapshot of both
 * payloads, at both geometries, every drawn mark is on H1..H6 and not one is on a local. This placement is in fact
 * the better of the two on that count, since the plates it replaced sat on four wide local lines (53.3 px) against
 * these two (38.0 px). But the occlusion bounds below hold only for runs that keep their cars on the highways: a
 * scenario or ops preset that routed cars over a local would reintroduce the defect, and would do it silently. The
 * honest form of this is the recorded bound, not a weight: weighting a line by whether any preset's run draws marks
 * on it would mean reading a log, which is exactly what this function must never do.
 */
export function placeShields(routes, geometry) {
  const yards = yardRects(geometry, 2);
  const lines = drawnLines(routes, geometry);
  const placed = new Map();
  for (const route of routes) {
    if (route.cls !== "HIGHWAY") continue;
    const g = routeGeometry(route, geometry);
    const text = routeShield({ routeId: route.id, freeFlow: format.minutes(route.free_flow_s) });
    const width = geometry.shieldPad + text.length * geometry.charPx;
    // A plate is drawn axis aligned, so how far it reaches along the route's normal is set by the road's heading:
    // half the plate's width for a road drawn up the page, half its height for one drawn across it. Offsetting by
    // that reach plus the gap stands the plate's nearest corner SHIELD_GAP_PX clear of the road, whichever way it runs.
    const reach = Math.abs(g.nx) * (width / 2) + Math.abs(g.ny) * (SHIELD_HEIGHT_PX / 2);
    const offsets = [0, reach + SHIELD_GAP_PX, -(reach + SHIELD_GAP_PX)];
    let best = null;
    for (let k = 0; k <= 16; k += 1) {
      const f = 0.5 + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 0.025;
      const anchor = { x: g.pA.x + (g.pB.x - g.pA.x) * f, y: g.pA.y + (g.pB.y - g.pA.y) * f };
      for (const off of offsets) {
        const x = anchor.x + g.nx * off;
        const y = anchor.y + g.ny * off;
        const box = { x, y, width, x0: x - width / 2, x1: x + width / 2, y0: y - SHIELD_HEIGHT_PX / 2, y1: y + SHIELD_HEIGHT_PX / 2, anchor, off };
        const overlap = yards.reduce((n, r) => n + boxOverlap(box, r), 0) + [...placed.values()].reduce((n, r) => n + boxOverlap(box, r), 0);
        const outside = box.x0 < 0 || box.y0 < 0 || box.x1 > geometry.view.width || box.y1 > geometry.view.height;
        // Px of drawn line under the plate, its own road's included. This replaces a count of the other route lines
        // the box crossed, which weighed a plate straddling a whole corridor the same as one clipping a corner, and
        // which excused a plate from covering the local route of its own area pair.
        const covered = lines.reduce((n, [p, q]) => n + lengthInBox(p, q, box), 0);
        // Clearance from the plates already placed, on the same footing as the yard term above: two plates that only
        // just miss each other read as one block with a shared border, which the overlap term alone permits.
        const gap = [...placed.values()].reduce((m, r) => Math.min(m, boxGap(box, r)), Infinity);
        const crowd = Math.max(0, PLATE_CLEAR_PX - gap) * 50;
        const score = overlap * 1000 + (outside ? 1e9 : 0) + covered * 4 + crowd + Math.abs(off) * 0.05 + Math.abs(f - 0.5);
        if (best === null || score < best.score) best = { box, score };
      }
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

/**
 * Visible route a car needs before its direction draws marks instead of a band. Measured on this preset: at 3 units a
 * car the busiest wide moment draws 104 of its 110 driving cars as marks, and marks overlap by about seven tenths,
 * which is what a convoy looks like; at 6 the phone bands four directions and that moment collapses to 62 marks.
 */
export const FLOOR_UNITS_PER_CAR = 3;

const bandedByLog = new WeakMap();
const peaksByLog = new WeakMap();

/**
 * The most cars each route direction holds at one snapshot of a run: `Map("H1|SF>PEN" -> cars)`, walked once per
 * log and kept. Both pictures decide their band fallback from it, each against its own route lengths.
 */
export function peakConcurrency(log) {
  const kept = peaksByLog.get(log);
  if (kept !== undefined) return kept;
  const peak = new Map();
  for (const snap of log.snapshots) {
    const counts = new Map();
    for (const car of snap.cars) {
      const place = placeCar(log, car, snap.t);
      if (place.kind !== "route") continue;
      const key = `${place.route}|${place.dir}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, cars] of counts) if (cars > (peak.get(key) ?? 0)) peak.set(key, cars);
  }
  peaksByLog.set(log, peak);
  return peak;
}

/**
 * The route directions that keep today's flow band instead of drawing one mark per car: those whose busiest snapshot
 * of the whole run holds more cars than the route has room for at `FLOOR_UNITS_PER_CAR` units each. Keys are
 * `"H1|SF>PEN"`. Decided from the run's own snapshots and kept for the whole run, so no direction flips mid-playback;
 * a direction the run never puts a car on is never banded. The routes of a log are fixed by the run that made it, so
 * the answer is kept per log and geometry, and `routes` is deliberately not part of the key. That rests on one thing:
 * every scenario of this preset draws its routes at the same lengths, so the same log and geometry give the same
 * answer whichever scenario's routes are handed in. `test/map.test.mjs` asserts those lengths are equal, so a scenario
 * that ever moved a route's endpoints fails there instead of silently being answered with a kept set.
 */
export function bandedDirections(log, routes, geometry = GEOMETRIES.wide) {
  if (log === null) return new Set();
  let byGeometry = bandedByLog.get(log);
  if (byGeometry === undefined) {
    byGeometry = new Map();
    bandedByLog.set(log, byGeometry);
  }
  const kept = byGeometry.get(geometry);
  if (kept !== undefined) return kept;
  const peak = peakConcurrency(log);
  const room = new Map(routes.map((route) => [route.id, routeGeometry(route, geometry).length]));
  const banded = new Set();
  for (const [key, cars] of peak) {
    const length = room.get(key.slice(0, key.indexOf("|")));
    if (length !== undefined && length < FLOOR_UNITS_PER_CAR * cars) banded.add(key);
  }
  byGeometry.set(geometry, banded);
  return banded;
}

/**
 * Depots to draw: the log's when a run exists (it names what ran), else the scenario's; each `{id, area, parking,
 * cleaning_bays, service_bays}` (the bays are what the isometric block draws as cells).
 */
function depotList(scenario, log) {
  const source = log?.depots ?? scenario.depots;
  return source.map((d) => ({ id: d.id, area: d.area, parking: d.parking, cleaning_bays: d.cleaning_bays, service_bays: d.service_bays }));
}

/**
 * Every number the map and its table twin show, from this replay: `{hasLog, clock_s, at_s, hour, areas, depots,
 * routes, onRoutes}`. `onRoutes` holds every driving car as `{id, state, family, route, dir, fraction}`, in frame
 * order, so the drawing places each car from the one pass that already called `placeCar` for the counts.
 * Areas hold `families` (car counts by family), `waiting`, `unservedLastHour` and `unservedRecent`; depots
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
  const onRoutes = [];
  if (hasLog) {
    const routeDirs = new Map();
    for (const r of routes) for (const d of r.directions) routeDirs.set(`${r.id}|${d.dir}`, d);
    for (const car of frame.cars) {
      const family = familyOf(car.state);
      const place = placeCar(log, car, at_s);
      if (place.kind === "route") {
        onRoutes.push({ id: car.id, state: car.state, family, route: place.route, dir: place.dir, fraction: place.fraction });
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
  return { hasLog, clock_s, at_s, hour: Math.min(47, Math.floor(clock_s / 3600)), areas, depots, routes, onRoutes };
}

/** What `frameModel` computed and what it handed back unchanged, so a test can hold one page frame to one model. */
export const frameModelCounts = { computed: 0, reused: 0 };

let sharedModel = { scenario: null, log: null, frame: null, clock_s: null, model: null };

/**
 * `mapModel` for the frame the whole page is drawing. The map, the NOW panel and the announcer describe the same
 * second, and the model walks every car in the fleet, so the first of them computes it and the others are handed that
 * same model (design §5.9: one frame's work is done once). The key is the identity of the four inputs `mapModel`
 * reads, and playback builds a fresh frame for every second it draws, so a new second is never answered with the
 * model of the one before it.
 */
export function frameModel({ scenario, log = null, frame = null, clock_s }) {
  const last = sharedModel;
  if (last.model !== null && last.scenario === scenario && last.log === log && last.frame === frame && last.clock_s === clock_s) {
    frameModelCounts.reused += 1;
    return last.model;
  }
  const model = mapModel({ scenario, log, frame, clock_s });
  sharedModel = { scenario, log, frame, clock_s, model };
  frameModelCounts.computed += 1;
  return model;
}

/**
 * Drops the memoised frame and its model. The map calls this as it is torn down, so the run's log stops being reachable
 * from this module once nothing is drawing it. One map is mounted at a time; were there a second, releasing one would
 * leave the other a model to recompute, never a wrong one, because a hand-back is checked against all four inputs.
 */
export function releaseFrameModel() {
  sharedModel = { scenario: null, log: null, frame: null, clock_s: null, model: null };
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

/**
 * Where a car on a route sits and which way it is pointing: `{x, y, angle}` in view box px, from the route's own
 * visible segment. One arithmetic for the car layer and the pinned glyph, so a pinned car sits exactly on its mark.
 */
function routePoint(entry, dir, fraction) {
  const forward = dir === `${entry.route.a}>${entry.route.b}`;
  const { pA, pB, ux, uy } = entry.geometry;
  const f = forward ? fraction : 1 - fraction;
  return {
    x: pA.x + (pB.x - pA.x) * f,
    y: pA.y + (pB.y - pA.y) * f,
    angle: (Math.atan2(forward ? uy : -uy, forward ? ux : -ux) * 180) / Math.PI,
  };
}

/** Absent text for a table cell before any run. */
const notRun = () => format.absent(ABSENT_REASONS.notRunYet);
const countOrAbsent = (value) => (value === null ? notRun() : format.count(value));

/**
 * Creates the map. Options: `onKey(event)` for playback shortcuts while the map has focus (returns true when handled),
 * `onInspect(target)` with `{depot}` or `{car}`, `onSelect(selection)` with `{depot}`, `onPin(car)` from the
 * isometric picture's pick output; `view` is `"flat"` (the SVG schematic, the default, so every test that built the
 * map before the isometric picture existed still builds exactly that) or `"iso"`, which mounts the picture `isoView`
 * makes (src/ui/iso.js createIsoView, handed in so this module never imports the one that imports it) and adds the
 * `Isometric | Flat` group to the header; when the picture cannot be made (no 2D context) the flat one stays and the
 * status line says why. `context2d` and `theme` are seams the isometric picture takes for tests. Returns
 * `{element, svg, table, update(input), focusState(), iso()}`; `update` takes `{scenario, log, frame, clock_s,
 * pinnedCar, seed, stale, world, still}`.
 */
export function createMap({ onKey = () => false, onInspect = () => {}, onSelect = () => {}, onPin = () => {}, matchMedia = defaultMatchMedia, view = "flat", isoView = null, context2d, theme } = {}) {
  if (view !== "flat" && view !== "iso") throw new TypeError(`a map view is "flat" or "iso", got ${String(view)}`);
  const chip = el("span", { class: "fl-chip-replay", "data-role": "replay-chip" }, "");
  // The world line under the chip names the preset and its changed-knob count, so a chip that names a seed can never
  // pass off one world as another (the slug rule).
  const world = el("p", { class: "fl-small-label", "data-role": "world-line", style: "margin: 0" });
  world.hidden = true;
  const tableToggle = el(
    "button",
    { type: "button", class: "fl-button", "aria-pressed": "false", "aria-label": MAP.tableToggle, on: { click: () => setTableOpen(!tableOpen) } },
    CHARTS.table,
  );
  const controls = el("div", { class: "fl-group" }, [tableToggle]);
  const header = el("div", { class: "fl-now__row" }, [el("div", {}, [chip, world]), controls]);
  const nothingRun = el("p", { class: "fl-muted", "data-role": "nothing-run" }, STATES.nothingRun);
  const viewStatus = el("p", { class: "fl-muted", "data-role": "view-status" });
  viewStatus.hidden = true;

  // Below 768 px the map switches to its phone geometry, so its text and glyphs keep their size (design §7.2, §8.2).
  const media = typeof matchMedia === "function" ? matchMedia(PHONE_QUERY) : null;
  const geometryNow = () => (media?.matches === true ? GEOMETRIES.phone : GEOMETRIES.wide);
  let geometry = geometryNow();
  // An explicit tabindex of -1: without it Chromium makes the overflow-hidden svg a focusable scroller, a second tab stop
  // before the roving area group (design §7.7: the map is one focusable region).
  const root = svg("svg", { width: "100%", role: "group", "aria-label": MAP.name, tabindex: -1 });
  const routesLayer = svg("g", { "data-layer": "routes" });
  const yardsLayer = svg("g", { "data-layer": "yards" });
  // Cars paint above the yards they have left and below the shields. The layer holds no name, no tab stop and nothing
  // focusable: what it draws is arrangement, and every number in it is already a row of the table twin (design §7.7).
  // What that paint order cost, measured over the whole run rather than left to be noticed: a shield is an opaque
  // plate, and while every plate sat on its route line the centre of a drawn mark fell inside one on 18.42% of
  // car-frames wide and 37.24% on the phone (default preset; 17.85% and 38.07% at the 150-car reference). Worst
  // single snapshot, 26 of 99 marks wide and 49 of 106 on the phone; one phone mark stayed under a plate for 14
  // snapshots, because a plate is 78.6 units wide and the phone draws H3 and H4 at 88. Neither the paint order
  // (design §7.3: nothing covers a shield id) nor the mark (design §8.5: a nudge would invent a place) is what
  // changed: placeShields now stands the plate SHIELD_GAP_PX clear of the road, on the side covering least of the
  // drawing, and a leader ties it back to the point it names. That leaves 0.00% wide and 8.76% on the phone (0.00%
  // and 8.36% at the reference).
  // What is left, and the half of it that is this placement's own doing. The phone's two vertical corridors are the
  // whole remainder: a 78.6 unit plate has nowhere to stand in the 88 unit gutter between a yard and the view edge,
  // so H1 and H6 keep their line and each takes 16 px of its own road. That accounts for 500 of the 998 residual
  // car-frames. The other 498 are a cost this placement added, and naming only the first half would be the more
  // comfortable half: stepping H5's plate aside put it across the H1 corridor at (98.5,178.9) and H2's across the
  // H6 corridor at (241.5,178.9), each covering 16.0 px of a road it does not name. Per corridor, against the
  // placement this replaced, H1 goes 13.53% to 27.25% and H6 15.26% to 30.04%: each roughly doubles, and half of
  // each doubling is another route's plate. The enumeration of candidate placements found none that clears every
  // phone plate of every other route's line, so this is a genuine cost of setting plates off the line, not a slip
  // left in. test/map.test.mjs pins the aggregate, the worst snapshot, the longest streak and both per-corridor
  // shares, so a later placement cannot quietly move more occlusion onto these two and still pass.
  const carsLayer = svg("g", { "data-layer": "cars", "aria-hidden": "true" });
  // Shields paint after the yards and every route (design §7.3: a shield with its id), so nothing covers or strikes one.
  const shieldsLayer = svg("g", { "data-layer": "shields" });
  const pinnedLayer = svg("g", { "data-layer": "pinned" });
  root.append(routesLayer, yardsLayer, carsLayer, shieldsLayer, pinnedLayer);

  const tooltip = el("div", { class: "fl-tooltip", role: "tooltip", id: "fleetlab-map-tooltip", "data-open": "false" });
  const stage = el("div", { "data-role": "stage" }, [root]);
  // The isometric picture, when asked for and when the browser gives a 2D context; otherwise the flat picture is all
  // there is and the status line says so. The two pictures share the tooltip, the table twin, the chip, the legend
  // and the limits chip; only one of them is visible, and only the visible one draws.
  const iso = view === "iso" && typeof isoView === "function"
    ? isoView({
      context2d,
      theme,
      matchMedia,
      onInspect,
      onSelect,
      onPin,
      onRoute: (routeId, open) => showRoute(routeId, open),
      onLabel: (text) => writeLabelPick(text),
    })
    : null;
  const pictures = el("div", { "data-role": "pictures" }, [stage, iso === null ? null : iso.element, tooltip]);
  pictures.style.position = "relative";
  let isoShown = iso !== null;
  const viewButtons = iso === null ? [] : [["iso", MAP.viewIso], ["flat", MAP.viewFlat]].map(([which, text]) =>
    el("button", { type: "button", class: "fl-button", "data-view": which, "aria-pressed": "false", on: { click: () => setView(which) } }, text));
  if (iso !== null) controls.append(el("div", { class: "fl-group", role: "group", "aria-label": MAP.viewName, "data-role": "view-group" }, viewButtons));
  if (view === "iso" && iso === null) {
    viewStatus.hidden = false;
    setText(viewStatus, MAP.isoFallback);
  }

  // One swatch and word per family, in unit-bar row order: the key glyph and the block as drawn, so hue is never the only
  // cue (design §8.2). The unit legend is its own line, and the mark legend beside it, because the map draws two
  // encodings of one quantity at once and neither may be left to be guessed (design §7.3 as amended, motion plan H-c).
  // The isometric picture swaps the line: one body is one car or carries a count, and a cube is a tally of five.
  const unitLegend = el("p", { "data-role": "unit-legend", style: "margin: 0" }, MAP.unitBarLegend);
  const markLegend = el("p", { "data-role": "mark-legend", style: "margin: 0" }, MAP.oneMarkOneCar);
  const legend = el("div", { class: "fl-small-label", "data-role": "legend" }, [
    unitLegend,
    markLegend,
    el("ul", { class: "fl-map-legend", "data-role": "family-legend" }, FAMILY_ORDER.map((family) =>
      el("li", { "data-family": family }, [familySwatch(family), el("span", {}, MAP.families[family])]))),
  ]);
  const stamp = el("span", { class: "fl-map__stamp" }, MAP.cornerStamp);

  // The written reason each banded direction owes, where the drawing it explains is (motion plan H-d).
  const crowded = el("div", { class: "fl-small-label", "data-role": "crowded-routes" });
  // The map's first model-limits chip (design §5.8, H-7). Marks that move make two limits easy to misread: a car on a
  // leg never re-plans, so cars of different leg times share a stretch; and an area keeps no place inside it, which is
  // why its cars are still bars. Both sentences are visible text, never a tooltip, and the chip takes no tab stop.
  // The isometric picture owes five more (design §5.8 as amended): the geometry is an invented sketch, a body's shape
  // is a convention and its motion an interpolation, and the block's bay cells are neither numbered nor staffed.
  const isoLimits = iso === null ? [] : ["isoSketch", "bodyIsConvention", "fixedTaskTimes", "noStaff", "baysNotNumbered"].map((key) => el("span", { "data-limit": key }, MODEL_LIMITS[key]));
  const limits = el("p", { class: "fl-limits-chip", "data-role": "model-limits", style: "margin: 4px 0 0" }, el("span", {}, [
    el("span", { "data-limit": "hourlyTraffic" }, MODEL_LIMITS.hourlyTraffic),
    " ",
    el("span", { "data-limit": "areasArePoints" }, MODEL_LIMITS.areasArePoints),
    ...isoLimits.flatMap((node) => [" ", node]),
  ]));

  const table = el("table", { class: "fl-table" });
  const tableWrap = el("div", { class: "fl-sr-only", "data-role": "table-twin" }, table);
  // The legend stays the last visible block, where the corner stamp has always sat beside its short last row.
  const element = el("div", { "data-role": "map" }, [header, viewStatus, nothingRun, pictures, crowded, limits, legend, tableWrap, stamp]);

  let tableOpen = false;
  function setTableOpen(open) {
    tableOpen = open;
    tableToggle.setAttribute("aria-pressed", open ? "true" : "false");
    tableWrap.setAttribute("class", open ? "fl-scroll" : "fl-sr-only");
  }

  /** The pick output of the isometric picture says when a click landed on a label rather than a body. */
  function writeLabelPick(text) {
    if (iso === null) return;
    iso.output.replaceChildren(el("span", {}, pickedLabel(text)));
  }

  /**
   * Shows one picture and hides the other with `hidden` and `inert`, so the hidden one's stops leave the tab order
   * and the map stays one tab stop; the legend line and the limits chip follow the picture; the visible one redraws.
   */
  function setView(which) {
    isoShown = iso !== null && which === "iso";
    stage.hidden = isoShown;
    stage.toggleAttribute("inert", isoShown);
    if (iso !== null) iso.setHidden(!isoShown);
    for (const b of viewButtons) b.setAttribute("aria-pressed", (b.getAttribute("data-view") === "iso") === isoShown ? "true" : "false");
    unitLegend.hidden = isoShown;
    setText(markLegend, isoShown ? MAP.oneBodyOneCar : MAP.oneMarkOneCar);
    for (const node of isoLimits) node.hidden = !isoShown;
    crowdedKey = null;
    if (lastInput !== null) update(lastInput);
    applyRoving(false);
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
        // A plate standing off its road carries a leader back to the point of the line it names, so which road a
        // shield belongs to is never a guess. It is appended first, so the opaque plate covers all of it but the gap,
        // and it is one hairline: it meets the road at the anchor and hides no mark.
        if (box.off !== 0) {
          const leader = svg("line", { "data-role": "shield-leader", x1: round(box.anchor.x - box.x), y1: round(box.anchor.y - box.y), x2: 0, y2: 0 });
          leader.style.stroke = "var(--ink)";
          shieldGroup.append(leader);
        }
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
        // Pointer and touch open the depot's drawer; the keyboard path stays Enter to select and I to inspect.
        tileGroup.addEventListener("click", () => onInspect({ depot: depot.id }));
        group.append(tileGroup);
        depots.set(depot.id, { depot, tile: tileGroup, micro, lot, x: tx, y: ty, key: null });
      });
      yardsLayer.append(group);
      areas.set(id, { group, bars, keys, waiting, waitingText, unserved, unservedText, x0, y0, barsKey: null, depots: inArea.map((d) => d.id) });
    }
    built = { scenario, geometry, depotKey: depotRows.map((d) => `${d.id}:${String(d.parking)}`).join(","), routes, areas, depots, shields };
    // The isometric picture is built on the same scenario, geometry and depot list, so the two pictures and the twin
    // can never name different depots.
    if (iso !== null) iso.build({ scenario, geometry, depots: depotRows });
    crowdedKey = null;
    // The table twin names its rows from the depots and routes just built, and those names are not numbers, so a
    // rebuild always redraws it rather than waiting for one of its numbers to move.
    tableRebuilt = true;
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
    const mid = isoShown ? iso.routeMid(routeId) : null;
    tooltip.style.left = pct(mid === null ? entry.mid.x / geometry.view.width : mid.x);
    tooltip.style.top = pct(mid === null ? entry.mid.y / geometry.view.height : mid.y);
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

  function drawFlow(entry, r, banded) {
    // Only a banded direction still draws a band. Everywhere else its cars are marks of their own, so one quantity is
    // drawn once and the band and the marks can never contradict each other on the same stretch of road.
    const shown = r.directions.filter((d) => banded.has(`${r.id}|${d.dir}`));
    const rider = shown.reduce((n, d) => n + (d.riderWork ?? 0), 0);
    const empty = shown.reduce((n, d) => n + (d.emptyDrive ?? 0), 0);
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

  /** The nodes of one car mark: the surface ring design §8.2 asks for, then the glyph of the car's own state. */
  function carNodes(state) {
    return [svg("circle", { class: "fl-glyph-ring", r: 9 }), ...glyphFor(state)];
  }

  /** `translate(x y) rotate(a)`: one composed attribute, so a car that has moved is one write and never half a move. */
  function carTransform(car) {
    const { x, y, angle } = routePoint(built.routes.get(car.route), car.dir, car.fraction);
    return `translate(${String(round(x))} ${String(round(y))}) rotate(${String(round(angle))})`;
  }

  /**
   * One mark per car on a route direction that draws marks, at the progress `placeCar` reports and pointing the way
   * it is going. Cars standing in an area and cars at a depot are not drawn here, and that is the line this drawing
   * does not cross: a mark would give them a place inside an area that the model does not have.
   * A mark is built once and afterwards only its transform is written, and only when its rounded place has changed.
   */
  function drawCars(model, banded) {
    const cars = model.onRoutes.filter((car) => built.routes.has(car.route) && !banded.has(`${car.route}|${car.dir}`));
    keyedList(carsLayer, cars, {
      key: (car) => car.id,
      create: (car) => {
        const group = svg("g", { class: `fl-car ${FAMILY_CLASS[car.family]}`, "data-car": car.id, "data-state": car.state, transform: carTransform(car) });
        group.append(...carNodes(car.state));
        return group;
      },
      update: (group, car) => {
        if (group.getAttribute("data-state") !== car.state) {
          group.setAttribute("class", `fl-car ${FAMILY_CLASS[car.family]}`);
          group.setAttribute("data-state", car.state);
          group.replaceChildren(...carNodes(car.state));
        }
        const transform = carTransform(car);
        if (group.getAttribute("transform") !== transform) group.setAttribute("transform", transform);
      },
    });
  }

  // The pinned glyph is kept between frames and only moved, so a click or tap that lands during playback reaches one
  // element; it is rebuilt when the car or its state changes.
  let pinned = null;
  pinnedLayer.addEventListener("click", (event) => {
    const node = event.target?.closest?.("[data-car]");
    if (node) onInspect({ car: node.getAttribute("data-car") });
  });

  function drawPinned(input, model) {
    const { frame, log, pinnedCar } = input;
    const car = model.hasLog && typeof pinnedCar === "string" ? frame.cars.find((c) => c.id === pinnedCar) : undefined;
    if (car === undefined) {
      pinnedLayer.replaceChildren();
      pinned = null;
      return;
    }
    const place = placeCar(log, car, frame.at_s);
    let x;
    let y;
    let angle = 0;
    if (place.kind === "route" && built.routes.has(place.route)) {
      const point = routePoint(built.routes.get(place.route), place.dir, place.fraction);
      x = point.x;
      y = point.y;
      angle = point.angle;
    } else if (place.kind === "depot" && built.depots.has(place.depot)) {
      const entry = built.depots.get(place.depot);
      x = entry.x + geometry.tile.width - 10;
      y = entry.y + 10;
    } else {
      const c = geometry.positions[place.area];
      x = c.x + geometry.yard.width / 2 - 16;
      y = c.y - geometry.yard.height / 2 + 14;
    }
    const transform = `translate(${String(round(x))} ${String(round(y))})`;
    // A car on a route points the way it is going, here as in the car layer, so the pinned glyph covers its own mark
    // exactly. Off a route there is no heading to draw: the model gives an area and a depot no direction.
    const rotation = place.kind === "route" ? `rotate(${String(round(angle))})` : null;
    if (pinned !== null && pinned.id === car.id && pinned.state === car.state && pinned.group.parentNode === pinnedLayer) {
      pinned.group.setAttribute("transform", transform);
      if (rotation === null) pinned.glyph.removeAttribute("transform");
      else pinned.glyph.setAttribute("transform", rotation);
      return;
    }
    const family = familyOf(car.state);
    const group = svg("g", {
      class: "fl-pinned-car",
      "data-car": car.id,
      "data-state": car.state,
      transform,
      role: "img",
      "aria-label": pinnedCarName({ car: car.id, state: MAP.carStates[car.state] }),
    });
    // A transparent 44 px circle under the glyph is the pointer and touch target (design §7.7).
    const hit = svg("circle", { class: "fl-hit", r: 22, "data-role": "hit" });
    const ring = svg("circle", { class: "fl-glyph-ring", r: 9, "data-role": "surface-ring" });
    const focusRing = svg("circle", { r: 11, fill: "none", "stroke-width": 2, "data-role": "focus-ring" });
    focusRing.style.stroke = "var(--accent)";
    const glyph = svg("g", { class: FAMILY_CLASS[family], transform: rotation });
    glyph.append(...glyphFor(car.state));
    group.append(hit, ring, focusRing, glyph);
    pinnedLayer.replaceChildren(group);
    pinned = { id: car.id, state: car.state, group, glyph };
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
  // The table twin stays in the DOM for a screen reader whether or not the Table toggle shows it, so its numbers are
  // kept current on every frame. They are compared in place in one reused array, because stringifying the whole model
  // sixty times a second costs more than the drawing it guards (design §5.9).
  let tableNumbers = [];
  let tableRebuilt = true;

  /** Whether a number the table twin shows has moved since it was drawn; records the new ones. Absent stays null. */
  function tableChanged(model, seed) {
    let i = 0;
    let changed = tableRebuilt;
    tableRebuilt = false;
    const put = (value) => {
      // Kept as it stands, with no sentinel for absent: a seed is an integer like any other, so a stand-in number
      // would collide with the value it stands for. Comparing with !== already separates null from every number,
      // and the first undefined from both.
      if (tableNumbers[i] !== value) {
        tableNumbers[i] = value;
        changed = true;
      }
      i += 1;
    };
    for (const id of AREA_ORDER) {
      const a = model.areas[id];
      for (const family of FAMILY_ORDER) put(a.families === null ? null : a.families[family]);
      put(a.waiting);
      put(a.unservedLastHour);
    }
    for (const d of model.depots) {
      put(d.held);
      put(d.parking);
      put(d.queued);
      put(d.inBays);
      put(d.ready);
    }
    for (const r of model.routes) {
      for (const d of r.directions) {
        put(d.planned_s);
        put(d.level);
        put(d.riderWork);
        put(d.emptyDrive);
      }
    }
    put(seed);
    if (tableNumbers.length !== i) {
      tableNumbers.length = i;
      changed = true;
    }
    return changed;
  }

  // Which directions draw a band, for the run being drawn. It is not decided in build(): a result arrives on the very
  // scenario the map was built on, so build() does not run again for it, and the decision needs the run's snapshots.
  let bands = { log: null, geometry: null, set: new Set() };
  // The written reasons follow the picture on screen: each picture bands against its own route lengths.
  let crowdedKey = null;

  /** The banded directions of `log` at this geometry, walked once for a run and then kept (motion plan §3.4). */
  function bandsFor(log) {
    if (bands.log === log && bands.geometry === geometry) return bands.set;
    const set = bandedDirections(log, built.scenario.routes, geometry);
    bands = { log, geometry, set };
    return set;
  }

  /**
   * The reason each banded direction owes, one paragraph per direction, in the scenario's own route and direction
   * order. Per direction and not per route, because that is how the fallback decides: at the default preset H1 bands
   * the way to San Francisco and draws marks the way back, so a reason written for the route would contradict half of
   * what is drawn on it. Naming the direction is also what tells the reader which way the band counts.
   */
  function drawCrowded(banded) {
    const reasons = [];
    for (const route of built.scenario.routes) {
      for (const [from, to] of [[route.a, route.b], [route.b, route.a]]) {
        const dir = `${from}>${to}`;
        if (!banded.has(`${route.id}|${dir}`)) continue;
        const text = MAP.crowdedRoute({ routeId: route.id, from: MAP.areas[from], to: MAP.areas[to] });
        reasons.push(el("p", { "data-role": "crowded-route", "data-route": route.id, "data-dir": dir, style: "margin: 4px 0 0" }, text));
      }
    }
    crowded.replaceChildren(...reasons);
  }

  /** The pinned car's place for the isometric picture: `{car, place, family}`, or null when nothing is pinned. */
  function pinnedFor(input, model) {
    const { frame, log, pinnedCar } = input;
    const car = model.hasLog && typeof pinnedCar === "string" ? frame.cars.find((c) => c.id === pinnedCar) : undefined;
    if (car === undefined) return null;
    return { car, place: placeCar(log, car, frame.at_s), family: familyOf(car.state) };
  }

  /**
   * Draw `input`: `{scenario, log, frame, clock_s, pinnedCar, seed, stale, world, still}` (log and frame null before a
   * run; `world` is `{name, changes}` for the world line; `still` is whether the picture is at rest, when the
   * isometric canvas writes its accessible name). Only the visible picture draws; the table twin always does.
   */
  function update(input) {
    const { scenario, log = null, frame = null, clock_s, pinnedCar = null, seed = null, stale = false, world: worldOf = null, still = true } = input;
    const depotKey = depotList(scenario, log).map((d) => `${d.id}:${String(d.parking)}`).join(",");
    if (built === null || built.scenario !== scenario || built.depotKey !== depotKey || built.geometry !== geometry) build(scenario, log);
    const model = frameModel({ scenario, log, frame, clock_s });
    lastModel = model;
    lastInput = input;

    nothingRun.hidden = model.hasLog;
    chip.hidden = !(model.hasLog && Number.isSafeInteger(seed));
    if (!chip.hidden) setText(chip, thisReplayChip(seed));
    world.hidden = worldOf === null;
    if (worldOf !== null) setText(world, worldLine(worldOf));
    stage.setAttribute("class", stale ? "fl-stale" : "");
    if (iso !== null) iso.stage.classList.toggle("fl-stale", stale);

    let banded;
    if (isoShown) {
      iso.update({ model, frame, log, scenario, pinned: pinnedFor(input, model), still, peaks: log === null ? null : peakConcurrency(log), floorUnitsPerCar: FLOOR_UNITS_PER_CAR });
      banded = iso.banded();
    } else {
      banded = bandsFor(log);
      for (const r of model.routes) {
        const entry = built.routes.get(r.id);
        drawChevrons(entry, r);
        drawFlow(entry, r, banded);
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
      drawCars(model, banded);
      drawPinned(input, model);
    }
    if (crowdedKey !== banded) {
      crowdedKey = banded;
      drawCrowded(banded);
    }

    if (tableChanged(model, seed)) drawTable(model, seed);
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

  /** The picture that holds the roving stops now: the isometric overlay or the SVG root. */
  const pictureNode = () => (isoShown ? iso.overlay : root);

  function nodeFor(key) {
    return pictureNode().querySelector(`[data-focus-key="${key}"]`);
  }

  function applyRoving(moveFocus) {
    const key = currentKey();
    for (const node of pictureNode().querySelectorAll("[data-focus-key]")) node.setAttribute("tabindex", node.getAttribute("data-focus-key") === key ? "0" : "-1");
    if (moveFocus) nodeFor(key)?.focus();
  }

  // Both pictures share one roving grammar (design §7.7): the listeners bind to whichever holds the stops.
  const onFocusIn = (event) => {
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
  };

  const onKeyDown = (event) => {
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
  };
  for (const node of iso === null ? [root] : [root, iso.overlay]) {
    node.addEventListener("focusin", onFocusIn);
    node.addEventListener("keydown", onKeyDown);
  }
  setView(isoShown ? "iso" : "flat");

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
    /** The isometric picture (src/ui/iso.js), or null when the map draws the flat one only. */
    iso: () => iso,
    /** Which picture is on screen: "iso" or "flat". */
    view: () => (isoShown ? "iso" : "flat"),
    /** Stops following the phone media query, and drops the frame this map was drawing. */
    destroy() {
      media?.removeEventListener?.("change", onMedia);
      iso?.destroy();
      releaseFrameModel();
    },
    /** The roving focus position: `{level, area, index, key}`. */
    focusState: () => ({ ...focus, key: currentKey() }),
    /** Whether the table twin is shown. */
    tableOpen: () => tableOpen,
    /** How many numbers the table twin is watched by: one for every number it draws. */
    tableValues: () => tableNumbers.length,
  };
}

/**
 * The world the picture is drawing, for the world line: the preset's name and the changed-knob count. It comes from
 * the run whenever a replay is on screen, because a finished run survives a preset switch or a knob change (the store
 * only marks it out of date), and a line naming the world now in the knobs over a picture of another world would be
 * the misattribution the line exists to prevent.
 */
function worldOf(state) {
  const world = state.run.log !== null && state.run.worldAtQueue !== null ? state.run.worldAtQueue : { presetId: state.presetId, changes: state.changes.length };
  const preset = presetById(world.presetId);
  const name = preset === null ? String(world.presetId) : preset.id === DEFAULT_PRESET_ID ? preset.title : presetOption({ id: preset.id, title: preset.title });
  return { name, changes: world.changes };
}

/** Whether a store action landed the clock on a step or a jump, which the picture treats as a rest (design §7.7). */
function stepped(action) {
  if (action === null || action === undefined) return false;
  return action.type === "clock/step" || action.type === "clock/jump" || (action.type === "clock/set" && action.reason === "step");
}

/**
 * Mounts the map in the map region, following `store` and the `playback` controller. `onShortcuts` opens the shortcut
 * list for `?`. `frame()` gives the frame to draw, so a caller that already took one for the whole page hands the map
 * that one instead of a second (the default takes playback's own). `isoView` is src/ui/iso.js createIsoView when the
 * page wants the isometric picture (the flat one stays the fallback and the test default). Returns the map object
 * with a `destroy()`.
 */
export function mountMap(region, { store, playback, onShortcuts = null, frame = () => playback.frame(), isoView = null }) {
  const map = createMap({
    view: isoView === null ? "flat" : "iso",
    isoView,
    onKey: (event) => playback.handleKey(event, { arrows: false, onShortcuts }),
    onInspect: (target) => store.dispatch({ type: "inspector/open", target }),
    onSelect: (selection) => store.dispatch({ type: "selection/set", selection }),
    onPin: (car) => store.dispatch({ type: "fork/pin", car }),
  });
  region.replaceChildren(map.element);
  const render = (state = store.getState(), action = null) => {
    const s = state;
    const log = s.run.log;
    // A result drawn after a knob change keeps the scenario it ran on (the store marks it out of date).
    const scenario = log !== null && s.run.scenarioAtQueue !== null ? s.run.scenarioAtQueue : s.scenario;
    map.update({
      scenario,
      log,
      frame: frame(),
      clock_s: s.clock_s,
      pinnedCar: s.fork.pinnedCar ?? s.selection?.car ?? null,
      seed: s.run.selectedSeed,
      stale: s.run.stale,
      world: worldOf(s),
      // At rest (paused, or a step just landed) the isometric canvas writes its name; while playing it never does.
      still: !s.playing || stepped(action),
    });
  };
  const unsubscribeStore = store.subscribe((state, action) => render(state, action));
  const unsubscribePlayback = playback.onChange(() => render());
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
