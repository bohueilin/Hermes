// The isometric world (design §7.3 as amended by the demo plan, ARCHITECTURE decision 43). A Canvas 2D schematic of the
// four areas drawn from the interval log alone: flat grey platforms at the schematic's own area centres, twelve
// ribbons with the declared congestion as ink chevrons, one shaded body per car on a route pointing along its
// ribbon, a cube per five cars standing in an area, a white block per depot whose lot fill climbs its sides and whose
// bay cells, queue bar and ready bar stand on top, and HTML labels over the canvas that carry every word: area names,
// depot ids and route shields as the map's roving focus stops, the numbers under each block, a count wherever bodies
// coincide, and the pinned car's plate.
//
// Position comes only from the frame model the page computes once per frame (map.js mapModel through frameModel,
// decision 42): `onRoutes` places a body at placeCar's fraction along its ribbon, `areas[].families` counts the
// cubes, and the frame's depot views with log.visits fill the block. Nothing here runs the model, and nothing here has
// an arithmetic of its own for where a car is. Every word is DOM: the canvas never draws a letter.
//
// Honesty (design §1.3, §8.5, H-2, H-5): the geometry is invented and the limits chip says so; platforms are flat, the
// camera is fixed, there is no lighting, texture, street or building; a cube's place on its platform means nothing;
// a body that stands for several cars carries their count, grouped in model space by (route, dir, fraction) so the
// count is a fact of the log and not of the screen; before a run every number reads `not available`, never a zero.
// Hues are read from the stylesheet's tokens at mount and on a theme change, so nothing here spells a colour.

import { el, keyedList, setText } from "./dom.js";
import * as format from "./format.js";
import {
  ABSENT_REASONS,
  MAP,
  absentValue,
  carHere,
  carStateText,
  countPlate,
  depotName,
  inspectCar,
  isoLabel,
  numbersLines,
  numbersWords,
  pickedCar,
  pickedLabel,
  pinCarNamed,
  pinnedCarName,
  routeShield,
  unservedCount,
  waitingRiders,
  withOthers,
} from "./labels.js";

/** Plan units and pixel floors of the world (design §7.3 and §8.2 as amended; one unit is one CSS px at scale 1.0). */
export const PLAN = Object.freeze({
  half: Object.freeze({ wide: 49, phone: 31 }),
  road: Object.freeze({ HIGHWAY: Object.freeze({ width: 7, offset: -8 }), LOCAL: Object.freeze({ width: 3.5, offset: 8 }) }),
  body: Object.freeze({ length: 10, width: 7, height: 4 }),
  bodyFloorPx: Object.freeze({ long: 12, short: 8 }),
  cube: 6,
  cubeGap: 2,
  rowGap: 4,
  cubeInset: 8,
  block: Object.freeze({ wide: Object.freeze({ side: 24, height: 20 }), phone: Object.freeze({ side: 18, height: 16 }) }),
  blockInset: 6,
  blockGap: 8,
  cell: Object.freeze({ maxWidth: 5, depth: 4, free: 0.6, busy: 3 }),
  bar: Object.freeze({ base: 5, perCar: 1.5, cap: 12 }),
  ring: Object.freeze({ r: 4, max: 8 }),
  pickPx: Object.freeze({ wide: 22, phone: 28 }),
  chevronSpacing: 40,
  maxBackingPx: 1600,
  plateClearPx: 4,
});

/** Per-face factors on a hue: the top face keeps it, the +y and +x sides darken on the light theme and lighten on the dark. */
export const SHADES = Object.freeze({
  light: Object.freeze({ top: 1, sideY: 0.84, sideX: 0.68 }),
  dark: Object.freeze({ top: 1, sideY: 1.14, sideX: 1.28 }),
});

/** The stylesheet tokens the canvas reads, by the name used here. */
const TOKENS = Object.freeze({
  ground: "--ground", panel: "--panel", panelAlt: "--panel-alt", ink: "--ink", muted: "--muted", faint: "--faint",
  rule: "--rule", ruleStrong: "--rule-strong", accent: "--accent",
  carRider: "--car-rider", carEmpty: "--car-empty", carAvailable: "--car-available", carDepot: "--car-depot",
});

const DARK_QUERY = "(prefers-color-scheme: dark)";
const HOLLOW_STATES = new Set(["ENROUTE_PICKUP", "REPOSITIONING"]);
const CUBE_FAMILIES = Object.freeze(["riderWork", "emptyDrive", "available"]);
/** Estimated advances of the overlay's type, for placement only: 12 px monospace and the 14 px area name. */
const MONO_PX = 7.2;
const NAME_PX = 8.4;
const TARGET = 44;

// ---------------------------------------------------------------------------------------------------------------
// Projection and hues.

/** Plan (x, y, z) to screen: the 2:1 dimetric projection. Larger x + y is nearer the viewer. */
export function project(x, y, z = 0) {
  return { sx: x - y, sy: (x + y) / 2 - z };
}

/** Screen to plan at the ground. */
export function unproject(sx, sy) {
  return { x: sx / 2 + sy, y: sy - sx / 2 };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** A #rrggbb hue multiplied by `k` per channel, clamped; a value that is not a six-digit hex comes back unchanged. */
export function shadeHex(hex, k) {
  if (!HEX.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.round(Math.min(255, ((n >> shift) & 255) * k)).toString(16).padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** The hue of one face (top, sideY or sideX) of a box in `hex`, on the dark theme when `dark`. */
export function faceHue(hex, face, dark) {
  return shadeHex(hex, (dark ? SHADES.dark : SHADES.light)[face]);
}

/** WCAG relative luminance of a hex hue (0 for a value that is not hex). */
function luminance(hex) {
  if (!HEX.test(hex)) return 0;
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift) => {
    const c = ((n >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** The page's tokens from the root element's computed style, or null where there is no computed style (a fake DOM). */
function defaultTheme() {
  const doc = globalThis.document;
  const style = typeof globalThis.getComputedStyle === "function" && doc?.documentElement ? globalThis.getComputedStyle(doc.documentElement) : null;
  if (style === null) return null;
  return Object.fromEntries(Object.values(TOKENS).map((name) => [name, style.getPropertyValue(name).trim()]));
}

function defaultMatchMedia(query) {
  return typeof globalThis.matchMedia === "function" ? globalThis.matchMedia(query) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Invented geometry: the schematic stood up.

/** Parameter along p0 -> p1 at which the segment leaves the square of half-side `h` centred at `c` (plan space). */
function exitParam(h, c, p0, p1) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const tx = dx > 0 ? (c.x + h - p0.x) / dx : dx < 0 ? (c.x - h - p0.x) / dx : Infinity;
  const ty = dy > 0 ? (c.y + h - p0.y) / dy : dy < 0 ? (c.y - h - p0.y) / dy : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/**
 * The plan geometry of one SVG geometry (map.js GEOMETRIES): platform centres pulled back through the inverse
 * projection so the tilted picture is the same diagram stood up, plan squares of half-side 49 (31 phone), ribbons as
 * the centre line moved along its normal by the class offset and clipped at both platforms' edges, and one block per
 * depot at its platform's +x corner, a second depot of the same area one block gap below the first. Pure: the
 * scenario's routes and `depots` (`{id, area, cleaning_bays, service_bays, parking}`) and the geometry only.
 */
export function planGeometry(scenario, geometry, depots) {
  const phone = geometry.name === "phone";
  const half = phone ? PLAN.half.phone : PLAN.half.wide;
  const centres = {};
  const platforms = {};
  // In the scenario's own area order, which is the order the flat picture and the table twin use.
  const areaIds = [...scenario.areas.map((a) => a.id).filter((id) => geometry.positions[id] !== undefined), ...Object.keys(geometry.positions).filter((id) => !scenario.areas.some((a) => a.id === id))];
  for (const id of areaIds) {
    const p = geometry.positions[id];
    const c = unproject(p.x, p.y);
    centres[id] = c;
    const corners = [[c.x - half, c.y - half], [c.x + half, c.y - half], [c.x + half, c.y + half], [c.x - half, c.y + half]];
    platforms[id] = { corners, screen: corners.map(([x, y]) => project(x, y, 0)) };
  }
  const routes = {};
  for (const route of scenario.routes) {
    const ca = centres[route.a];
    const cb = centres[route.b];
    const dx = cb.x - ca.x;
    const dy = cb.y - ca.y;
    const d = Math.hypot(dx, dy);
    const ux = dx / d;
    const uy = dy / d;
    const nx = -uy;
    const ny = ux;
    const off = PLAN.road[route.cls].offset;
    const p0 = { x: ca.x + nx * off, y: ca.y + ny * off };
    const p1 = { x: cb.x + nx * off, y: cb.y + ny * off };
    const t0 = exitParam(half, ca, p0, p1);
    const t1 = 1 - exitParam(half, cb, p1, p0);
    const pA = { x: p0.x + (p1.x - p0.x) * t0, y: p0.y + (p1.y - p0.y) * t0 };
    const pB = { x: p0.x + (p1.x - p0.x) * t1, y: p0.y + (p1.y - p0.y) * t1 };
    const mid = project((pA.x + pB.x) / 2, (pA.y + pB.y) / 2, 0);
    routes[route.id] = { route, pA, pB, ux, uy, nx, ny, width: PLAN.road[route.cls].width, length: Math.hypot(pB.x - pA.x, pB.y - pA.y), mid };
  }
  const block = phone ? PLAN.block.phone : PLAN.block.wide;
  const perArea = {};
  const blocks = {};
  for (const depot of depots) {
    const c = centres[depot.area];
    if (c === undefined) continue;
    const k = perArea[depot.area] ?? 0;
    perArea[depot.area] = k + 1;
    blocks[depot.id] = {
      depot,
      area: depot.area,
      order: k,
      cx: c.x + half - block.side / 2 - PLAN.blockInset,
      cy: c.y - half + block.side / 2 + PLAN.blockInset + k * (block.side + PLAN.blockGap),
      side: block.side,
      height: block.height,
    };
  }
  return { name: geometry.name, phone, half, view: geometry.view, centres, platforms, routes, depots: blocks, block, maxWidthPx: geometry.maxWidthPx };
}

/** Visible ribbon length per route id, in plan units. */
export function ribbonLengths(plan) {
  return Object.fromEntries(Object.entries(plan.routes).map(([id, r]) => [id, r.length]));
}

/**
 * The route directions that keep a band instead of bodies on this plan geometry: those whose busiest snapshot
 * (`peaks`, map.js peakConcurrency: `"H1|SF>PEN" -> cars`) holds more cars than the ribbon has room for at
 * `floorUnitsPerCar` units each. The same rule as map.js bandedDirections, against the ribbon's own length.
 */
export function isoBandedDirections(peaks, plan, floorUnitsPerCar) {
  const banded = new Set();
  const lengths = ribbonLengths(plan);
  for (const [key, cars] of peaks) {
    const length = lengths[key.slice(0, key.indexOf("|"))];
    if (length !== undefined && length < floorUnitsPerCar * cars) banded.add(key);
  }
  return banded;
}

/** Body size in plan units at `scale` CSS px a unit: 10 x 7 x 4, held to 12 px long and 8 px wide on screen. */
export function bodySize(scale) {
  const l = Math.max(PLAN.body.length, PLAN.bodyFloorPx.long / scale);
  const w = Math.max(PLAN.body.width, PLAN.bodyFloorPx.short / scale);
  return { l, w, h: (PLAN.body.height * l) / PLAN.body.length };
}

// ---------------------------------------------------------------------------------------------------------------
// The frame reading: what one clock holds, from the model alone.

/**
 * Bodies to draw at one frame: `model.onRoutes` grouped in model space by (route, dir, fraction) equality, so cars
 * whose legs coincide exactly are one group whatever the screen size. Each group is a place and heading on its ribbon
 * and one entry per state family present (`{family, state, hollow, ids}`): one body and one count per family, so a
 * mixed group draws two bodies and never one body in one hue. Fraction is placeCar's, from the leg's own seconds.
 */
export function bodyGroups(model, plan) {
  const groups = new Map();
  for (const car of model.onRoutes) {
    const entry = plan.routes[car.route];
    if (entry === undefined) continue;
    const key = `${car.route}|${car.dir}|${String(car.fraction)}`;
    let group = groups.get(key);
    if (group === undefined) {
      const forward = car.dir === `${entry.route.a}>${entry.route.b}`;
      const f = forward ? car.fraction : 1 - car.fraction;
      group = {
        key,
        route: car.route,
        dir: car.dir,
        fraction: car.fraction,
        x: entry.pA.x + (entry.pB.x - entry.pA.x) * f,
        y: entry.pA.y + (entry.pB.y - entry.pA.y) * f,
        hx: forward ? entry.ux : -entry.ux,
        hy: forward ? entry.uy : -entry.uy,
        families: [],
      };
      groups.set(key, group);
    }
    let family = group.families.find((g) => g.family === car.family);
    if (family === undefined) {
      family = { family: car.family, state: car.state, hollow: HOLLOW_STATES.has(car.state), ids: [] };
      group.families.push(family);
    }
    family.ids.push(car.id);
  }
  return [...groups.values()];
}

/**
 * One cube per five cars standing in an area, by family, in rows from the platform's back corner: rider work, then
 * empty drive, then available. A row that outgrows the platform continues on the next line. A tally, not a car park.
 */
export function cubeRows(model, plan) {
  const out = [];
  const step = PLAN.cube + PLAN.cubeGap;
  const line = PLAN.cube + PLAN.rowGap;
  const perLine = Math.max(1, Math.floor((2 * plan.half - 2 * PLAN.cubeInset) / step));
  for (const [area, a] of Object.entries(model.areas)) {
    if (a.families === null) continue;
    const c = plan.centres[area];
    if (c === undefined) continue;
    let row = 0;
    for (const family of CUBE_FAMILIES) {
      const cubes = Math.ceil(a.families[family] / 5);
      for (let i = 0; i < cubes; i += 1) {
        out.push({
          area,
          family,
          cx: c.x - plan.half + PLAN.cubeInset + (i % perLine) * step + PLAN.cube / 2,
          cy: c.y - plan.half + PLAN.cubeInset + 2 + (row + Math.floor(i / perLine)) * line + PLAN.cube / 2,
        });
      }
      row += Math.max(1, Math.ceil(cubes / perLine));
    }
  }
  return out;
}

const openVisitCache = new WeakMap();

/** The visits open at a depot at snapshot second `t` (arrived, not yet ready), kept per log for the last snapshot asked. */
function openVisits(log, depotId, t) {
  let byDepot = openVisitCache.get(log);
  if (byDepot === undefined) {
    byDepot = new Map();
    openVisitCache.set(log, byDepot);
  }
  const kept = byDepot.get(depotId);
  if (kept !== undefined && kept.t === t) return kept.visits;
  const visits = (log.visits ?? []).filter((v) => v.depot === depotId && v.arrival_s <= t && (v.ready_s === null || v.ready_s > t));
  byDepot.set(depotId, { t, visits });
  return visits;
}

/**
 * The bay cells of one depot at a frame: `cleaning_bays` cells then `service_bays`, each `{task, busy, fraction,
 * blocked, car}`. The cars in bays are the frame's own (IN_SERVICE at this depot, the state the snapshot asserts), in
 * the order their task started as inspector.js flowStages reads them from log.visits, and a busy cell's fill is
 * elapsed over the task time you set, clamped to 1: a car finished with no stall free stays full and says so.
 */
export function bayCells({ frame, log, scenario, depot }) {
  const t = frame.snapshot_t ?? frame.at_s;
  const here = frame.cars.filter((c) => c.state === "IN_SERVICE" && c.location?.depot === depot.id);
  const visits = openVisits(log, depot.id, t);
  const cells = [];
  for (const [task, bays, startKey, seconds] of [["CLEAN", depot.cleaning_bays, "clean_start_s", scenario.clean_s], ["SERVICE", depot.service_bays, "service_start_s", scenario.service_s]]) {
    const busy = here
      .filter((c) => c.task === task)
      .map((car) => ({ car, start: visits.find((v) => v.car === car.id)?.[startKey] ?? t }))
      .sort((a, b) => a.start - b.start || (a.car.id < b.car.id ? -1 : 1));
    for (let i = 0; i < bays; i += 1) {
      const entry = busy[i];
      if (entry === undefined) cells.push({ task, busy: false, fraction: 0, blocked: false, car: null });
      else {
        const blocked = entry.car.blocked === true;
        cells.push({ task, busy: true, fraction: blocked ? 1 : Math.min(1, Math.max(0, (frame.at_s - entry.start) / seconds)), blocked, car: entry.car.id });
      }
    }
  }
  return cells;
}

/**
 * Per area, the elapsed-over-patience fraction of up to PLAN.ring.max waiting riders (the longest waiting first) at
 * second `at_s`, from the log's requests: a rider is waiting from its request second until it is assigned or unserved.
 */
export function waitingByArea(log, scenario, at_s) {
  const waiting = {};
  for (const r of log.requests) {
    if (r.time_s > at_s) continue;
    if (r.assigned_s !== null && r.assigned_s <= at_s) continue;
    if (r.unserved_s !== null && r.unserved_s <= at_s) continue;
    (waiting[r.origin] ??= []).push(at_s - r.time_s);
  }
  const out = {};
  for (const id of Object.keys(waiting)) {
    out[id] = waiting[id].sort((a, b) => b - a).slice(0, PLAN.ring.max).map((elapsed) => Math.min(1, elapsed / scenario.patience_s));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Placement of the overlay's static labels: once per geometry, a pure function of the scenario and the plan.

const box = (cx, cy, w, h) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
const boxOverlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const boxGap = (a, b) => Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.y0 - b.y1, b.y0 - a.y1, 0));
const insideView = (b, view) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= view.width && b.y1 <= view.height;

/** Whether screen point (x, y) lies inside a polygon of `{sx, sy}` vertices. */
function inPolygon(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.sy > y !== b.sy > y && x < ((b.sx - a.sx) * (y - a.sy)) / (b.sy - a.sy) + a.sx) inside = !inside;
  }
  return inside;
}

/** How much of a plate lies on a polygon: the share of a 5 by 3 grid of its points inside, times its area. */
function polygonCover(b, polygon) {
  let hits = 0;
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      if (inPolygon(polygon, b.x0 + ((b.x1 - b.x0) * (i + 0.5)) / 5, b.y0 + ((b.y1 - b.y0) * (j + 0.5)) / 3)) hits += 1;
    }
  }
  return (hits / 15) * (b.x1 - b.x0) * (b.y1 - b.y0);
}

/** Px of a screen segment lying inside a box, sampled every 2 px. */
function coveredLength(p, q, b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(q.sx - p.sx, q.sy - p.sy) / 2));
  let hits = 0;
  for (let i = 0; i <= steps; i += 1) {
    const x = p.sx + ((q.sx - p.sx) * i) / steps;
    const y = p.sy + ((q.sy - p.sy) * i) / steps;
    if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) hits += 1;
  }
  return (hits * 2 * Math.hypot(q.sx - p.sx, q.sy - p.sy)) / (steps * 2);
}

/** The screen bounding box of a block, base to top. */
function blockBox(d) {
  const pts = [];
  for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    for (const z of [0, d.height]) pts.push(project(d.cx + (ax * d.side) / 2, d.cy + (ay * d.side) / 2, z));
  }
  return { x0: Math.min(...pts.map((p) => p.sx)), y0: Math.min(...pts.map((p) => p.sy)), x1: Math.max(...pts.map((p) => p.sx)), y1: Math.max(...pts.map((p) => p.sy)) };
}

/**
 * The best of `candidates` (boxes in preference order, each optionally carrying a smaller visible `plate`) for one
 * label: inside the view; never overlapping a `placed` box (two overlapping targets are one target with a dead zone,
 * so any overlap is refused before anything else is weighed); clear of them by PLAN.plateClearPx; then off the
 * `polygons` (platforms, cube rows) and the `lines` (ribbons and rider edges: the drawing under a plate), then nearest
 * its preferred spot. The scoring is map.js placeShields' idea on the plan geometry.
 */
/** The cost of standing a label at `b` (its `plate` the visible part), `index` its place in the preference order. */
function placementScore(b, index, { view, placed, soft = [], polygons = [], lines = [] }) {
  const plate = b.plate ?? b;
  const outside = insideView(b, view) ? 0 : 1e9;
  const overlap = placed.reduce((n, p) => n + boxOverlap(b, p), 0);
  const gap = placed.reduce((m, p) => Math.min(m, boxGap(b, p)), Infinity);
  const crowd = Math.max(0, PLAN.plateClearPx - gap) * 50;
  // A transparent target under an opaque plate keeps its clicks, so it costs like drawing, not like a collision.
  const onSoft = soft.reduce((n, p) => n + boxOverlap(plate, p), 0);
  const onPolygon = polygons.reduce((n, poly) => n + polygonCover(plate, poly), 0);
  const covered = lines.reduce((n, [p, q, weight]) => n + coveredLength(p, q, plate) * weight, 0);
  return outside + collision(overlap) + crowd + (onSoft + onPolygon) * 20 + covered + index;
}

/** What two labels that overlap cost: refused before anything else is weighed, then by how much. */
const collision = (overlap) => (overlap > 0 ? 1e6 + overlap * 1000 : 0);

function bestPlacement(candidates, context) {
  let best = null;
  candidates.forEach((b, index) => {
    const score = placementScore(b, index, context);
    if (best === null || score < best.score) best = { box: b, score, index };
  });
  return best;
}

/** The screen polygon of a plan rectangle. */
const planRect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => project(x, y, 0));

/**
 * Where every static overlay element stands, in view units at scale 1.0, as boxes `{x0, y0, x1, y1}` with the point
 * the element is anchored on: `areas[id]` (name, waiting and unserved texts), `depots[id]` (the id plate, the numbers
 * line under its block, the block's own box), `routes[id]` (the 44 px target of every route; a highway's visible plate
 * with its anchor on the road and its offset along the road's normal, 0 where it keeps the line). A plate is at least
 * a 44 px target. Numbers lines and shields are placed by the scorer; no two targets overlap, which iso.test.mjs
 * asserts at both geometries.
 */
export function overlayPlacements(plan, scenario) {
  const view = plan.view;
  const placed = [];
  const platforms = Object.values(plan.platforms).map((p) => p.screen);
  // What a plate must not cover, weighted by what a reader loses: a highway's bodies most, a local's or the rider
  // edge's rings less (in this preset every car on a route is on a highway at every clock measured).
  const lines = Object.values(plan.routes).map((r) => [project(r.pA.x, r.pA.y, 0), project(r.pB.x, r.pB.y, 0), r.route.cls === "HIGHWAY" ? 4 : 2]);
  // The rows of cubes at each platform's back corner and the rider rings along its front edge are drawing too.
  const cubeZones = [];
  for (const c of Object.values(plan.centres)) {
    cubeZones.push(planRect(c.x - plan.half + PLAN.cubeInset, c.y - plan.half + PLAN.cubeInset, c.x + plan.half - PLAN.cubeInset, c.y - plan.half + PLAN.cubeInset + 4 * (PLAN.cube + PLAN.rowGap)));
    lines.push([project(c.x - plan.half, c.y + plan.half - 5, 0), project(c.x + plan.half, c.y + plan.half - 5, 0), 2]);
  }
  const drawing = { view, placed, polygons: [...platforms, ...cubeZones], lines };
  // A block's own labels may stand on the platform's empty face; only the cube rows and the rider edge are drawing there.
  const onPlatform = { view, placed, polygons: cubeZones, lines };
  // 1. Area names, fixed on each platform's face toward the viewer, kept inside the stage; the waiting riders text
  //    under the name and the unserved text (rare, and gone after ten minutes) above it. `box` is the 44 px target;
  //    `text`, `waitingBox` and `unservedBox` are the words a plate must not cover.
  const areas = {};
  for (const [id, c] of Object.entries(plan.centres)) {
    const p = project(c.x - 4, c.y + plan.half * 0.45, 0);
    const name = MAP.areas[id];
    const width = Math.max(TARGET, name.length * NAME_PX + 12);
    const x = Math.min(view.width - width / 2, Math.max(width / 2, p.sx));
    // Six units up from the face's own point, so the name's 44 px target ends above a second block's foot.
    const y = p.sy - 6;
    const entry = { name: { x, y }, box: box(x, y, width, TARGET), text: box(x, y, width, 20), waiting: { x, y: y + 15 }, unserved: { x, y: y - 15 } };
    entry.waitingBox = box(x, y + 15, 17 * 6.6, 14);
    entry.unservedBox = box(x, y - 15, 12 * 6.6, 14);
    areas[id] = entry;
    placed.push(entry.box, entry.waitingBox, entry.unservedBox);
  }
  // 2. The blocks, whose id plates are placed with everything else below: the first depot of an area above its
  //    block, a second below or beside its own.
  const depots = {};
  const blocks = Object.values(plan.depots).map(blockBox);
  const plateAt = (id, plate) => {
    depots[id].plate = plate;
    depots[id].plateAnchor = { x: (plate.x0 + plate.x1) / 2, y: (plate.y0 + plate.y1) / 2 };
    // The words on the plate: what a tag must not cover; the target around them is transparent.
    depots[id].plateWords = box(depots[id].plateAnchor.x, depots[id].plateAnchor.y, id.length * MONO_PX + 14, 24);
    placed.push(plate);
  };
  for (const d of Object.values(plan.depots)) depots[d.depot.id] = { block: blockBox(d) };
  // 3. Local targets at their ribbon's midpoint: transparent, taking no room from the drawing. Placed with the rest
  //    below, so one may slide along its ribbon where a collision at the midpoint leaves nothing else clear.
  const routes = {};
  // 4. Everything else moves: a second depot's id plate below or beside its own block (the two blocks stand in a row
  //    and overlap on screen), the numbers under every block, one fact a line (a two-line plate measured 202 px wide:
  //    60 percent of the phone stage, and no place at the wide geometry's San Francisco corner that cleared its two
  //    blocks and four ribbons), and the highway shields beside their roads, scored as map.js placeShields scores
  //    them. Each label's candidates are scored once against the fixed labels and the drawing; a greedy pass then
  //    three repair sweeps let every label re-choose its spot given the others, so a corner that no single order can
  //    clear (San Francisco's: two blocks, two tags, three highways leaving) settles where the labels cost each other
  //    least. Every visible plate is a hard obstacle; a transparent local target costs a tag like drawing.
  const numbersW = 12 * MONO_PX + 8;
  // Four lines of 12 px mono at line-height 1.2 plus 2 px of padding above and below: the box the tag draws. A
  // blocked car adds a fifth line, and the tag hangs from its bottom edge (styles.css translate(-50%, -100%)) so
  // that line grows up into the 4-unit gap under its own block. Measured: anchored at its top instead, SJ-1's fifth
  // line ends at 502 of the 500-unit wide stage and 413 of the 400-unit phone stage, where the overlay's
  // `contain: layout paint` clips it; reserving five lines here instead moves the whole search and costs four
  // overlapping targets and SJ-1's tag on H6's shield at the phone geometry, which is the proof this file rests on.
  const numbersH = 4 * 14.4 + 4;
  const fixed = Object.values(areas).flatMap((x) => [x.box, x.waitingBox, x.unservedBox]);
  const fixedWords = Object.values(areas).flatMap((x) => [x.text, x.waitingBox, x.unservedBox]);
  const others = (d) => blocks.filter((other) => other !== depots[d.depot.id].block);
  const movable = [];
  const scored = (candidates, context) => candidates.map((c, index) => ({ box: c, score: placementScore(c, index, context) })).filter((c) => c.score < 1e9);
  for (const d of Object.values(plan.depots)) {
    const b = depots[d.depot.id].block;
    const cx = (b.x0 + b.x1) / 2;
    let plates;
    if (d.order === 0) {
      // Above its block, at a few offsets along the top, so a shield can pass beside it where the top is crowded.
      const top = project(d.cx - d.side / 2, d.cy - d.side / 2, d.height);
      const below = (x) => box(x, b.y1 + TARGET / 2 + 2, TARGET, TARGET);
      plates = [
        ...[0, -TARGET / 2, TARGET / 2, -TARGET, TARGET].map((dx) => box(top.sx + d.side / 2 + dx, top.sy - TARGET / 2 - 2, TARGET, TARGET)),
        ...[cx, b.x0 + TARGET / 2, b.x1 - TARGET / 2, b.x1 + TARGET / 2, b.x0 - TARGET / 2].map(below),
      ];
    } else {
      const below = (x, drop) => box(x, b.y1 + TARGET / 2 + 2 + drop, TARGET, TARGET);
      const xs = [cx, b.x0 + TARGET / 2, b.x1 - TARGET / 2, b.x1 + TARGET / 2, b.x0 - TARGET / 2, b.x1 + TARGET * 1.5, b.x0 - TARGET * 1.5];
      plates = [...xs.map((x) => below(x, 0)), box(b.x0 - TARGET / 2 - 4, (b.y0 + b.y1) / 2, TARGET, TARGET), ...xs.map((x) => below(x, TARGET))];
    }
    movable.push({ kind: "plate", d, options: scored(plates, { ...onPlatform, placed: [...fixed, ...others(d)] }) });
    const gap = 4;
    const at = (x, y0) => ({ x0: x - numbersW / 2, y0, x1: x + numbersW / 2, y1: y0 + numbersH });
    const xs = [cx, b.x1 - numbersW / 2, b.x0 + numbersW / 2, b.x1 - numbersW / 4, b.x0 + numbersW / 4, b.x1 + numbersW / 2 + gap];
    const candidates = [];
    for (let step = 0; step <= 8; step += 1) for (const x of xs) candidates.push(at(x, b.y1 + gap + (numbersH * step) / 8));
    for (const side of [b.x0 - gap - numbersW, b.x1 + gap]) candidates.push({ x0: side, y0: (b.y0 + b.y1) / 2 - numbersH / 2, x1: side + numbersW, y1: (b.y0 + b.y1) / 2 + numbersH / 2 });
    for (const rise of [0, numbersH / 2]) for (const x of xs) candidates.push(at(x, b.y0 - gap - numbersH - rise));
    // A tag beside a block on the stage's right edge would spill past the stage; the view bound refuses it, so a tag
    // stands to a block's right only where the stage has room.
    movable.push({ kind: "tag", d, options: scored(candidates, { ...onPlatform, placed: [...fixedWords, ...others(d)] }) });
  }
  for (const route of scenario.routes.filter((r) => r.cls !== "HIGHWAY")) {
    const r = plan.routes[route.id];
    const candidates = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].map((f) => {
      const p = project(r.pA.x + (r.pB.x - r.pA.x) * f, r.pA.y + (r.pB.y - r.pA.y) * f, 0);
      return { ...box(p.sx, p.sy, TARGET, TARGET), x: p.sx, y: p.sy };
    });
    movable.push({ kind: "local", route, options: scored(candidates, { view, placed: fixed }) });
  }
  for (const route of scenario.routes.filter((r) => r.cls === "HIGHWAY")) {
    const r = plan.routes[route.id];
    const text = routeShield({ routeId: route.id, freeFlow: format.minutes(route.free_flow_s) });
    const width = text.length * MONO_PX + 14;
    const height = 24;
    const a = project(r.pA.x, r.pA.y, 0);
    const b = project(r.pB.x, r.pB.y, 0);
    const len = Math.hypot(b.sx - a.sx, b.sy - a.sy);
    const ux = (b.sx - a.sx) / len;
    const uy = (b.sy - a.sy) / len;
    const nx = -uy;
    const ny = ux;
    // The plate's reach along the road's normal plus the gap stands its nearest corner clear of the road.
    const reach = Math.abs(nx) * (width / 2) + Math.abs(ny) * (height / 2);
    const gap = 21;
    const candidates = [];
    for (let k = 0; k <= 36; k += 1) {
      const f = 0.5 + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 0.025;
      const anchor = { sx: a.sx + (b.sx - a.sx) * f, sy: a.sy + (b.sy - a.sy) * f };
      for (const off of [0, reach + gap, -(reach + gap)]) {
        const x = anchor.sx + nx * off;
        const y = anchor.sy + ny * off;
        candidates.push({ ...box(x, y, Math.max(TARGET, width), TARGET), plate: box(x, y, width, height), anchor, off, x, y });
      }
    }
    movable.push({ kind: "shield", route, options: scored(candidates, { ...drawing, placed: [...fixed, ...blocks] }) });
  }
  // What two movable labels cost each other: a collision, refused before anything else, then closeness under the
  // gap. A tag against a plate or a shield is held to that label's words, not its transparent target.
  const wordsOf = (label, option) => (label.kind === "tag" ? option.box : label.kind === "plate" ? box((option.box.x0 + option.box.x1) / 2, (option.box.y0 + option.box.y1) / 2, label.d.depot.id.length * MONO_PX + 14, 24) : label.kind === "local" ? option.box : option.box.plate);
  const pairCost = (a, b) => collision(boxOverlap(a, b)) + Math.max(0, PLAN.plateClearPx - boxGap(a, b)) * 50;
  // Targets first: the plates and shields a reader clicks or tabs to take their spots before the tags, which are
  // words only, then everything is polished in place.
  const rank = { local: 0, plate: 1, shield: 2, tag: 3 };
  movable.sort((a, b) => rank[a.kind] - rank[b.kind]);
  const chosen = new Array(movable.length).fill(null);
  const between = (i, a, j, b) => {
    const kinds = [movable[i].kind, movable[j].kind];
    // A transparent local target under a tag's words keeps its clicks: drawing, not a collision.
    if (kinds.includes("tag") && kinds.includes("local")) return boxOverlap(a.box, b.box) * 20;
    const tag = kinds.includes("tag");
    return tag && kinds[0] !== kinds[1] ? pairCost(wordsOf(movable[i], a), wordsOf(movable[j], b)) : pairCost(a.box, b.box);
  };
  const choose = (i) => {
    let best = null;
    for (const option of movable[i].options) {
      let total = option.score;
      for (let j = 0; j < movable.length; j += 1) if (j !== i && chosen[j] !== null) total += between(i, option, j, chosen[j]);
      if (best === null || total < best.total) best = { option, total };
    }
    chosen[i] = best.option;
  };
  for (let i = 0; i < movable.length; i += 1) choose(i);
  // Two labels can block each other's better spots in a way no single move undoes (a plate one row down leaves a tag
  // nowhere clean), so every pair that can touch is re-chosen together, given the rest; then each label once more.
  const withOthers = (i, option, skip) => {
    let total = 0;
    for (let k = 0; k < movable.length; k += 1) if (k !== i && k !== skip) total += between(i, option, k, chosen[k]);
    return total;
  };
  const choosePair = (i, j) => {
    let best = null;
    for (const a of movable[i].options) {
      const costA = a.score + withOthers(i, a, j);
      if (best !== null && costA >= best.total) continue;
      for (const b of movable[j].options) {
        const total = costA + b.score + withOthers(j, b, i) + between(i, a, j, b);
        if (best === null || total < best.total) best = { a, b, total };
      }
    }
    chosen[i] = best.a;
    chosen[j] = best.b;
  };
  for (let round = 0; round < 2; round += 1) {
    for (let i = 0; i < movable.length; i += 1) {
      for (let j = i + 1; j < movable.length; j += 1) {
        if (movable[i].options.some((a) => movable[j].options.some((b) => boxOverlap(a.box, b.box) > 0))) choosePair(i, j);
      }
    }
    for (let i = 0; i < movable.length; i += 1) choose(i);
  }
  // A plate or tag the search stood clear of its block (half a target or more away) carries a leader back to the
  // block's foot, so which block a label names is never a guess (the shields' rule, here for the depots).
  const clear = TARGET / 2;
  const foot = (d) => {
    const p = project(d.cx, d.cy + d.side / 2, 0);
    return { x: p.sx, y: p.sy };
  };
  movable.forEach((label, i) => {
    const b = chosen[i].box;
    if (label.kind === "plate") {
      plateAt(label.d.depot.id, b);
      if (boxGap(b, depots[label.d.depot.id].block) > clear) depots[label.d.depot.id].plateLeader = foot(label.d);
    } else if (label.kind === "tag") {
      depots[label.d.depot.id].numbers = b;
      // The bottom edge: the tag hangs from it, so a fifth line grows up and never off the stage.
      depots[label.d.depot.id].numbersAnchor = { x: (b.x0 + b.x1) / 2, y: b.y1 };
      if (boxGap(b, depots[label.d.depot.id].block) > clear) depots[label.d.depot.id].numbersLeader = foot(label.d);
    } else if (label.kind === "local") {
      routes[label.route.id] = { anchor: { x: b.x, y: b.y }, box: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }, off: 0 };
    } else {
      routes[label.route.id] = { anchor: { x: b.x, y: b.y }, box: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }, plate: b.plate, road: { x: b.anchor.sx, y: b.anchor.sy }, off: b.off };
    }
  });
  return { areas, depots, routes };
}

// ---------------------------------------------------------------------------------------------------------------
// Boxes: a centre, a base z, a size, a heading; eight corners; the three faces the camera sees.

function boxCorners(cx, cy, z0, l, w, h, hx, hy) {
  const px = -hy;
  const py = hx;
  const c = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    c.push([cx + hx * ((a * l) / 2) + px * ((b * w) / 2), cy + hy * ((a * l) / 2) + py * ((b * w) / 2), z0]);
  }
  for (let i = 0; i < 4; i += 1) c.push([c[i][0], c[i][1], z0 + h]);
  return c;
}

// Faces as corner indexes with their outward normal in the box's own frame.
const FACES = [
  { idx: [4, 5, 6, 7], n: [0, 0, 1] },
  { idx: [0, 1, 5, 4], n: [0, -1, 0] },
  { idx: [1, 2, 6, 5], n: [1, 0, 0] },
  { idx: [2, 3, 7, 6], n: [0, 1, 0] },
  { idx: [3, 0, 4, 7], n: [-1, 0, 0] },
];
// The direction toward the viewer in plan space: +x, +y and +z all face the camera.
const VIEW_DIR = [1, 1, 0.7];

/** The faces of a box with heading (hx, hy) the camera sees, each with the shade it takes. */
function visibleFaces(hx, hy) {
  const out = [];
  for (const f of FACES) {
    const nx = f.n[0] * hx - f.n[1] * hy;
    const ny = f.n[0] * hy + f.n[1] * hx;
    if (nx * VIEW_DIR[0] + ny * VIEW_DIR[1] + f.n[2] * VIEW_DIR[2] > 0) out.push({ idx: f.idx, shade: f.n[2] > 0 ? "top" : ny > nx ? "sideY" : "sideX" });
  }
  return out;
}

const pct = (fraction) => `${String(Math.round(fraction * 10000) / 100)}%`;
const round = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------------------------------------------
// The view.

/**
 * Creates the isometric picture: `{element, stage, canvas, overlay, output, build, update, resize, setHidden, banded,
 * plan, scale, lastDraw, destroy}`, or null when `context2d(canvas)` gives no 2D context (the caller then keeps the
 * flat picture and says why). Options: `context2d`, `theme` (a function giving the stylesheet tokens by name) and
 * `matchMedia` are seams for tests; `onInspect({depot} | {car})`, `onSelect({depot})`, `onPin(car)`, `onRoute(id,
 * open)` and `onLabel(text)` report what the overlay and the pick output did.
 */
export function createIsoView({
  context2d = (canvas) => (typeof canvas.getContext === "function" ? canvas.getContext("2d", { alpha: false }) : null),
  theme = defaultTheme,
  matchMedia = defaultMatchMedia,
  devicePixelRatio = () => globalThis.devicePixelRatio ?? 1,
  onInspect = () => {},
  onSelect = () => {},
  onPin = () => {},
  onRoute = () => {},
  onLabel = () => {},
} = {}) {
  const canvas = el("canvas", { class: "fl-iso__canvas", role: "img", tabindex: -1 });
  const ctx = context2d(canvas);
  if (ctx === null || ctx === undefined) return null;
  const overlay = el("div", { class: "fl-iso__overlay", role: "group", "aria-label": MAP.isoName });
  const stage = el("div", { class: "fl-iso", "data-role": "iso-stage" }, [canvas, overlay]);
  const output = el("output", { class: "fl-iso__pick", "data-role": "pick" });
  const element = el("div", { "data-role": "iso" }, [stage, output]);
  ctx.lineJoin = "round";

  // Hues: the stylesheet's tokens, read at mount and again on a theme change. Shaded faces are cached per read.
  let hues = null;
  let dark = false;
  let shadeCache = new Map();
  function readHues() {
    const table = theme() ?? {};
    hues = Object.fromEntries(Object.entries(TOKENS).map(([key, name]) => [key, table[name] ?? ""]));
    dark = luminance(hues.panel) < luminance(hues.ink);
    shadeCache = new Map();
  }
  const shaded = (hue, face) => {
    const key = `${hue}|${face}`;
    let v = shadeCache.get(key);
    if (v === undefined) {
      v = faceHue(hue, face, dark);
      shadeCache.set(key, v);
    }
    return v;
  };
  readHues();

  // Size: the CSS width sets the scale; the backing store is that width times the device pixel ratio, capped.
  let scale = 1;
  let backing = { width: 0, height: 0 };
  let plan = null;
  let placed = null;
  let view = null;
  let hidden = false;
  let dirty = true;
  let lastKey = null;
  let lastInput = null;
  let lastGroups = [];
  let report = { bodies: 0, cubes: 0, blocks: 0, cells: 0, raised: 0, bars: [], lots: [], rings: 0, plates: 0 };
  let banded = { peaks: null, set: new Set() };
  const chevronCache = new Map();
  const nodes = { areas: {}, depots: {}, routes: {}, counts: null, pin: null };

  function resize({ cssWidth, devicePixelRatio: dpr = devicePixelRatio() } = {}) {
    if (view === null) return;
    const width = cssWidth > 0 ? cssWidth : view.width;
    scale = width / view.width;
    const ratio = Math.min(dpr, PLAN.maxBackingPx / width);
    backing = { width: Math.round(width * ratio), height: Math.round((width * ratio * view.height) / view.width) };
    canvas.setAttribute("width", String(backing.width));
    canvas.setAttribute("height", String(backing.height));
    dirty = true;
  }

  // ---- overlay ----------------------------------------------------------------------------------------------------

  const place = (node, x, y) => {
    node.style.left = pct(x / view.width);
    node.style.top = pct(y / view.height);
  };

  /** A 1 px hairline from `from` to `to` (view units), placed once: its length and angle are the geometry's. */
  function leader(from, to, attrs) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const line = el("span", { class: "fl-iso__leader", "aria-hidden": "true", ...attrs });
    place(line, from.x, from.y);
    line.style.height = pct(Math.hypot(dx, dy) / view.height);
    line.style.transform = `rotate(${String(round((Math.atan2(-dx, dy) * 180) / Math.PI))}deg)`;
    return line;
  }

  function labelButton(classes, attrs, text) {
    const button = el("button", { type: "button", class: `fl-iso__label ${classes}`, tabindex: -1, ...attrs }, el("span", { class: "fl-iso__plate" }, text));
    return button;
  }

  function build({ scenario, geometry, depots }) {
    plan = planGeometry(scenario, geometry, depots);
    view = plan.view;
    placed = overlayPlacements(plan, scenario);
    stage.style.maxWidth = plan.maxWidthPx === null || plan.maxWidthPx === undefined ? "" : `${String(plan.maxWidthPx)}px`;
    chevronCache.clear();
    banded = { peaks: null, set: new Set() };
    resize({ cssWidth: stage.clientWidth > 0 ? stage.clientWidth : view.width });
    const children = [];
    nodes.areas = {};
    for (const [id, a] of Object.entries(placed.areas)) {
      const name = labelButton("fl-iso__label--area", { "data-focus-key": `area:${id}`, "data-area": id, on: { click: () => onLabel(MAP.areas[id]) } }, MAP.areas[id]);
      place(name, a.name.x, a.name.y);
      const waiting = el("span", { class: "fl-iso__text", "data-role": "waiting", "data-area": id });
      place(waiting, a.waiting.x, a.waiting.y);
      waiting.hidden = true;
      const unserved = el("span", { class: "fl-iso__text fl-unserved", "data-role": "unserved", "data-area": id });
      place(unserved, a.unserved.x, a.unserved.y);
      unserved.hidden = true;
      nodes.areas[id] = { name, waiting, unserved };
      children.push(name, waiting, unserved);
    }
    nodes.depots = {};
    for (const d of Object.values(plan.depots)) {
      const id = d.depot.id;
      const p = placed.depots[id];
      const plate = labelButton("fl-iso__label--depot", {
        "data-focus-key": `depot:${id}`,
        "data-depot": id,
        "aria-label": depotName({ depotId: id, areaName: MAP.areas[d.area] }),
        on: { click: () => { onLabel(id); onInspect({ depot: id }); } },
      }, id);
      place(plate, p.plateAnchor.x, p.plateAnchor.y);
      // role="img" because the name below is the full words: a paragraph is name-prohibited in ARIA, so an
      // aria-label on a bare <p> is invalid and a reader would hear the abbreviated lines and never the blocked
      // reason. The flat picture names its pinned glyph the same way (map.js drawPinned).
      const numbers = el("p", { class: "fl-iso__numbers", role: "img", "data-role": "numbers", "data-depot": id });
      place(numbers, p.numbersAnchor.x, p.numbersAnchor.y);
      nodes.depots[id] = { plate, numbers };
      for (const [from, to] of [[p.plateLeader, p.plateAnchor], [p.numbersLeader, { x: p.numbersAnchor.x, y: p.numbers.y0 + 2 }]]) {
        if (from !== undefined) children.push(leader(from, to, { "data-role": "depot-leader", "data-depot": id }));
      }
      children.push(plate, numbers);
    }
    nodes.routes = {};
    for (const route of scenario.routes) {
      const r = placed.routes[route.id];
      const text = routeShield({ routeId: route.id, freeFlow: format.minutes(route.free_flow_s) });
      const highway = route.cls === "HIGHWAY";
      const button = labelButton(highway ? "fl-iso__label--route" : "fl-iso__label--route fl-iso__label--local", {
        "data-focus-key": `route:${route.id}`,
        "data-route": route.id,
        "aria-label": highway ? null : text,
        "aria-roledescription": highway ? MAP.highwayRoute : MAP.localRoute,
        "aria-describedby": "fleetlab-map-tooltip",
        on: {
          click: () => onLabel(text),
          pointerenter: () => onRoute(route.id, true),
          pointerleave: () => onRoute(route.id, false),
          focus: () => onRoute(route.id, true),
          blur: () => onRoute(route.id, false),
        },
      }, text);
      place(button, r.anchor.x, r.anchor.y);
      // A plate standing off its road carries a leader back to the point of the line it names.
      if (highway && r.off !== 0) children.push(leader(r.road, r.anchor, { "data-role": "shield-leader", "data-route-id": route.id }));
      nodes.routes[route.id] = button;
      children.push(button);
    }
    nodes.counts = el("div", { "data-role": "counts" });
    // The pinned car's plate is a pointer target only (`I` from any stop is the keyboard path), so the map's stop
    // count never changes with the pinned state. It carries its own name, as the flat picture's pinned glyph does
    // (map.js drawPinned): this is the only surface that reports the pinned car's stack, so hiding it from a reader
    // would lose information the flat picture gives. A span is not focusable, so the name adds no stop.
    nodes.pin = el("span", { class: "fl-iso__pin", "data-role": "pinned", role: "img", on: { click: () => { if (nodes.pin.getAttribute("data-car")) onInspect({ car: nodes.pin.getAttribute("data-car") }); } } });
    nodes.pin.hidden = true;
    children.push(nodes.counts, nodes.pin);
    overlay.replaceChildren(...children);
    dirty = true;
    lastKey = null;
  }

  // ---- the frame reading and the drawing ------------------------------------------------------------------------

  const cssPx = (n) => n / scale;

  function fillPoly(points) {
    ctx.beginPath();
    points.forEach(([x, y, z], i) => {
      const p = project(x, y, z);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    });
    ctx.closePath();
  }

  /**
   * Draws a box's visible faces; `edge` strokes them in ink, `hollow` paints the top face panel, `sidesOnly` skips
   * the top. Returns the corners and the number of faces actually painted, so a caller reports what it drew rather
   * than what it meant to draw.
   */
  function drawBox(b) {
    const corners = boxCorners(b.cx, b.cy, b.z, b.l, b.w, b.h, b.hx, b.hy);
    let faces = 0;
    for (const face of visibleFaces(b.hx, b.hy)) {
      if (b.sidesOnly && face.shade === "top") continue;
      ctx.fillStyle = b.hollow && face.shade === "top" ? hues.panel : shaded(b.hue, face.shade);
      fillPoly(face.idx.map((i) => corners[i]));
      ctx.fill();
      if (b.edge) {
        ctx.strokeStyle = hues.ink;
        ctx.stroke();
      }
      faces += 1;
    }
    return { corners, faces };
  }

  /** Chevron strokes of one route direction at one level, cached: arm, tip, arm in screen space along the ribbon half. */
  function chevrons(entry, dirIndex, level) {
    const key = `${entry.route.id}|${String(dirIndex)}|${String(level)}`;
    let list = chevronCache.get(key);
    if (list !== undefined) return list;
    list = [];
    const count = level * Math.floor(entry.length / PLAN.chevronSpacing);
    const sign = dirIndex === 0 ? 1 : -1;
    const { pA, ux, uy, nx, ny, length, width } = entry;
    for (let i = 1; i <= count; i += 1) {
      const s = (length * i) / (count + 1);
      const cx = pA.x + ux * s + nx * (width / 4) * sign;
      const cy = pA.y + uy * s + ny * (width / 4) * sign;
      const hx = ux * sign;
      const hy = uy * sign;
      list.push([project(cx - hx * 2 + nx * 1.5, cy - hy * 2 + ny * 1.5), project(cx + hx * 2, cy + hy * 2), project(cx - hx * 2 - nx * 1.5, cy - hy * 2 - ny * 1.5)]);
    }
    chevronCache.set(key, list);
    return list;
  }

  /** One ribbon half as a flat quad: the a>b direction on the +n side of the centre line, b>a on the other. */
  function halfQuad(entry, dirIndex) {
    const { pA, pB, nx, ny, width } = entry;
    const sign = dirIndex === 0 ? 1 : -1;
    return [[pA.x, pA.y, 0], [pB.x, pB.y, 0], [pB.x + nx * (width / 2) * sign, pB.y + ny * (width / 2) * sign, 0], [pA.x + nx * (width / 2) * sign, pA.y + ny * (width / 2) * sign, 0]];
  }

  /** A banded direction keeps a flat band on its ribbon half: rider work solid, empty drive hollow, at most 4 units a car. */
  function drawBand(entry, dirIndex, direction) {
    const cars = (direction.riderWork ?? 0) + (direction.emptyDrive ?? 0);
    if (cars === 0) return;
    const { pA, ux, uy, nx, ny, length, width } = entry;
    const sign = dirIndex === 0 ? 1 : -1;
    const perCar = Math.min(4, Math.max(0, length - 8) / cars);
    let along = length / 2 - (perCar * cars) / 2;
    const side = (width / 4) * sign;
    const part = (count, hue, hollow) => {
      const s0 = along;
      const s1 = along + perCar * count;
      along = s1;
      fillPoly([[pA.x + ux * s0 + nx * (side - 1), pA.y + uy * s0 + ny * (side - 1), 0.2], [pA.x + ux * s1 + nx * (side - 1), pA.y + uy * s1 + ny * (side - 1), 0.2], [pA.x + ux * s1 + nx * (side + 1), pA.y + uy * s1 + ny * (side + 1), 0.2], [pA.x + ux * s0 + nx * (side + 1), pA.y + uy * s0 + ny * (side + 1), 0.2]]);
      if (hollow) {
        ctx.strokeStyle = hue;
        ctx.stroke();
      } else {
        ctx.fillStyle = hue;
        ctx.fill();
      }
    };
    if (direction.riderWork > 0) part(direction.riderWork, hues.carRider, false);
    if (direction.emptyDrive > 0) part(direction.emptyDrive, hues.carEmpty, true);
  }

  /** The block of one depot and everything standing on it, drawn back to front as one item of the painter's sort. */
  function drawBlock(d, viewOf, cells, out) {
    const { cx, cy, side, height } = d;
    drawBox({ cx, cy, z: 0, l: side, w: side, h: height, hx: 1, hy: 0, hue: hues.panel, edge: true });
    // The lot fill climbs the two visible side faces, never the top: a painter's sort cannot interpenetrate a box.
    const fraction = viewOf === null ? 0 : Math.max(0, Math.min(1, viewOf.stalls_held / Math.max(1, d.depot.parking)));
    if (fraction > 0) {
      const { corners, faces } = drawBox({ cx, cy, z: 0, l: side + 0.6, w: side + 0.6, h: height * fraction, hx: 1, hy: 0, hue: hues.carDepot, edge: false, sidesOnly: true });
      // The band's top edge carries the ink line every under-3:1 mark on the page carries.
      ctx.strokeStyle = hues.ink;
      for (const [a, b] of [[7, 6], [6, 5]]) {
        ctx.beginPath();
        const p = project(...corners[a]);
        const q = project(...corners[b]);
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(q.sx, q.sy);
        ctx.stroke();
      }
      // The faces the painter actually filled: 2 while the top is skipped, which is what keeps the fill from capping
      // the block and interpenetrating the cells and bars standing on it.
      out.lots.push({ depot: d.depot.id, fraction, faces });
    }
    // Queue and ready bars at the back corners of the top, capped; the numbers line carries the count.
    const queue = viewOf === null ? 0 : viewOf.queue + viewOf.gate;
    const ready = viewOf === null ? 0 : viewOf.ready;
    for (const [count, x, hue, edge] of [[queue, cx - side / 2 + 4, hues.muted, false], [ready, cx + side / 2 - 4, hues.carDepot, true]]) {
      const h = Math.min(PLAN.bar.cap, count * PLAN.bar.perCar);
      out.bars.push({ depot: d.depot.id, count, height: h });
      if (count > 0) drawBox({ cx: x, cy: cy - side / 2 + 4, z: height, l: PLAN.bar.base, w: PLAN.bar.base, h, hx: 1, hy: 0, hue, edge });
    }
    // Bay cells in one row along the front of the top: free flat in panel, busy raised in the depot hue and filling.
    const bays = cells.length;
    const cell = Math.min(PLAN.cell.maxWidth, (side - 4) / Math.max(1, bays));
    cells.forEach((c, i) => {
      const x = cx - side / 2 + 3 + i * cell + cell / 2;
      const y = cy + side / 2 - PLAN.cell.depth;
      const shell = { cx: x, cy: y, z: height, l: cell - 1, w: PLAN.cell.depth, hx: 1, hy: 0, hue: hues.panel, edge: true, h: c.busy ? PLAN.cell.busy : PLAN.cell.free };
      drawBox(shell);
      if (c.busy && c.fraction > 0) {
        drawBox({ ...shell, h: PLAN.cell.busy * c.fraction, hue: hues.carDepot });
        out.raised += 1;
      } else if (c.busy) out.raised += 1;
      out.cells += 1;
    });
    out.blocks += 1;
  }

  function draw(input) {
    const { model, frame, log, scenario, pinned } = input;
    const k = backing.width / view.width;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineWidth = cssPx(1);
    const out = { bodies: 0, cubes: 0, blocks: 0, cells: 0, raised: 0, bars: [], lots: [], rings: 0, plates: 0 };
    ctx.fillStyle = hues.panel;
    ctx.fillRect(0, 0, view.width, view.height);
    for (const platform of Object.values(plan.platforms)) {
      ctx.fillStyle = hues.panelAlt;
      fillPoly(platform.corners.map(([x, y]) => [x, y, 0]));
      ctx.fill();
      ctx.strokeStyle = hues.ruleStrong;
      ctx.stroke();
    }
    // Ribbons: flat, first; a congested direction's half steps to the faint rule hue, as the flat picture's casing does.
    const routes = model.routes;
    for (const r of routes) {
      const entry = plan.routes[r.id];
      if (entry === undefined) continue;
      r.directions.forEach((direction, i) => {
        ctx.fillStyle = direction.level >= 2 ? hues.faint : r.cls === "HIGHWAY" ? hues.ruleStrong : hues.rule;
        fillPoly(halfQuad(entry, i));
        ctx.fill();
      });
    }
    ctx.strokeStyle = hues.ink;
    for (const r of routes) {
      const entry = plan.routes[r.id];
      if (entry === undefined) continue;
      r.directions.forEach((direction, i) => {
        if (direction.level === 0) return;
        ctx.beginPath();
        for (const [arm1, tip, arm2] of chevrons(entry, i, direction.level)) {
          ctx.moveTo(arm1.sx, arm1.sy);
          ctx.lineTo(tip.sx, tip.sy);
          ctx.lineTo(arm2.sx, arm2.sy);
        }
        ctx.stroke();
      });
    }
    if (banded.set.size > 0) {
      for (const r of routes) {
        const entry = plan.routes[r.id];
        if (entry === undefined) continue;
        r.directions.forEach((direction, i) => {
          if (banded.set.has(`${r.id}|${direction.dir}`)) drawBand(entry, i, direction);
        });
      }
    }
    // Everything that stands: cubes, bodies, blocks, sorted back to front by x + y + z / 2.
    const items = [];
    const size = bodySize(scale);
    const groups = model.hasLog ? bodyGroups(model, plan).filter((g) => !banded.set.has(`${g.route}|${g.dir}`)) : [];
    lastGroups = groups;
    for (const g of groups) {
      items.push({ key: g.x + g.y, draw: () => {
        for (const family of g.families) {
          drawBox({ cx: g.x, cy: g.y, z: 0.2, l: size.l, w: size.w, h: size.h, hx: g.hx, hy: g.hy, hue: family.family === "riderWork" ? hues.carRider : hues.carEmpty, edge: true, hollow: family.hollow });
          // Cabin and tires make moving vehicles legible without changing group counts or route positions.
          ctx.fillStyle = hues.muted;
          fillPoly([[-1,-1],[1,-1],[1,1],[-1,1]].map(([along,side]) => [g.x + g.hx * size.l * along * 0.24 - g.hy * size.w * side * 0.36, g.y + g.hy * size.l * along * 0.24 + g.hx * size.w * side * 0.36, size.h + 0.3]));
          ctx.fill();
          for (const along of [-0.28, 0.28]) for (const side of [-1, 1]) {
            const tire = project(g.x + g.hx * size.l * along - g.hy * size.w * side * 0.48, g.y + g.hy * size.l * along + g.hx * size.w * side * 0.48, 0.2);
            ctx.fillStyle = hues.ink;
            ctx.fillRect(tire.sx - cssPx(1), tire.sy - cssPx(1), cssPx(2), cssPx(2));
          }
          out.bodies += 1;
        }
      } });
    }
    const cubes = cubeRows(model, plan);
    for (const c of cubes) {
      const hue = c.family === "riderWork" ? hues.carRider : c.family === "emptyDrive" ? hues.carEmpty : hues.carAvailable;
      items.push({ key: c.cx + c.cy, draw: () => {
        drawBox({ cx: c.cx, cy: c.cy, z: 0, l: PLAN.cube, w: PLAN.cube, h: PLAN.cube, hx: 1, hy: 0, hue, edge: c.family === "available" });
        out.cubes += 1;
      } });
    }
    const views = new Map(model.hasLog ? frame.depots.map((d) => [d.id, d]) : []);
    for (const d of Object.values(plan.depots)) {
      const viewOf = views.get(d.depot.id) ?? null;
      // Before a run there are no cells: a free cell is this picture's way of saying a bay is free, and nothing has
      // computed that yet. The block stands as its own shell with `not available` under it, as the bars are omitted
      // at count 0 and the lot at fraction 0, and as the flat picture clears a depot tile it has no view for.
      const cells = model.hasLog ? bayCells({ frame, log, scenario, depot: d.depot }) : [];
      items.push({ key: d.cx + d.cy, draw: () => drawBlock(d, viewOf, cells, out) });
    }
    items.sort((a, b) => a.key - b.key);
    for (const item of items) item.draw();
    // Waiting riders ring the platform's front edge: a rule-strong ring, an ink arc of elapsed over patience.
    if (model.hasLog) {
      const rings = waitingByArea(log, scenario, model.at_s);
      ctx.lineWidth = cssPx(1.5);
      for (const [area, fractions] of Object.entries(rings)) {
        const c = plan.centres[area];
        if (c === undefined) continue;
        fractions.forEach((fraction, j) => {
          const t = (j + 1) / (PLAN.ring.max + 1);
          const p = project(c.x - plan.half + 2 * plan.half * t, c.y + plan.half - 5, 0);
          ctx.strokeStyle = hues.ruleStrong;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, PLAN.ring.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = hues.ink;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, PLAN.ring.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
          ctx.stroke();
          out.rings += 1;
        });
      }
      ctx.lineWidth = cssPx(1);
    }
    // The pinned car's ellipse at its base, wherever the log puts it.
    const spot = pinnedSpot(pinned, groups, cubes);
    if (spot !== null) {
      ctx.strokeStyle = hues.accent;
      ctx.lineWidth = cssPx(2);
      ctx.beginPath();
      ctx.ellipse(spot.sx, spot.sy, 8, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = cssPx(1);
    }
    report = out;
    return { groups, cubes };
  }

  /**
   * Where the pinned car's ellipse and plate go, as `{sx, sy, top, text, name}` or null: on its body along a route (with its
   * stack counted), on the first cube of its family when it stands in an area, on the block's front edge at a depot.
   * `pinned` is `{car, place, family}` from map.js placeCar. Never an invented place.
   */
  function pinnedSpot(pinned, groups, cubes) {
    if (pinned === null || pinned === undefined) return null;
    const { car, place } = pinned;
    if (place.kind === "route") {
      const group = groups.find((g) => g.route === place.route && g.dir === place.dir && g.fraction === place.fraction);
      if (group === undefined) return null;
      const others = group.families.reduce((n, f) => n + f.ids.length, 0) - 1;
      const top = project(group.x, group.y, bodySize(scale).h);
      const p = project(group.x, group.y, 0);
      // The words the plate shows and the name a reader hears say the same thing about the same car.
      const state = others > 0 ? withOthers(others) : carStateText(car);
      return { sx: p.sx, sy: p.sy, top, text: carHere({ car: car.id, state }), name: pinnedCarName({ car: car.id, state }) };
    }
    if (place.kind === "depot" && plan.depots[place.depot] !== undefined) {
      const d = plan.depots[place.depot];
      const p = project(d.cx, d.cy + d.side / 2, 0);
      const state = carStateText(car);
      return { sx: p.sx, sy: p.sy, top: project(d.cx, d.cy + d.side / 2, d.height), text: carHere({ car: car.id, state }), name: pinnedCarName({ car: car.id, state }) };
    }
    const c = plan.centres[place.area];
    if (c === undefined) return null;
    const cube = cubes.find((x) => x.area === place.area && x.family === pinned.family) ?? cubes.find((x) => x.area === place.area) ?? null;
    const x = cube === null ? c.x : cube.cx;
    const y = cube === null ? c.y : cube.cy;
    const p = project(x, y, 0);
    const state = carStateText(car);
    return { sx: p.sx, sy: p.sy, top: project(x, y, cube === null ? 0 : PLAN.cube), text: carHere({ car: car.id, state }), name: pinnedCarName({ car: car.id, state }) };
  }

  // ---- the overlay's per-frame writes ----------------------------------------------------------------------------

  const translate = (sx, sy) => `translate(${String(round(sx * scale))}px, ${String(round(sy * scale))}px) translate(-50%, -100%)`;

  function writeCounts(groups) {
    const plates = [];
    const size = bodySize(scale);
    for (const g of groups) {
      for (const f of g.families) {
        if (f.ids.length < 2) continue;
        const top = project(g.x, g.y, size.h);
        // Keyed on the stack's first car and family, which hold from frame to frame while the stack rides along its
        // ribbon, so a plate is moved by one transform and never rebuilt for a new fraction.
        plates.push({ key: `${f.family}|${f.ids[0]}`, count: f.ids.length, sx: top.sx, sy: top.sy - cssPx(8) });
      }
    }
    keyedList(nodes.counts, plates, {
      key: (p) => p.key,
      create: (p) => {
        const node = el("span", { class: "fl-iso__count", "data-role": "count", "data-key": p.key }, countPlate(p.count));
        node.style.transform = translate(p.sx, p.sy);
        return node;
      },
      update: (node, p) => {
        setText(node, countPlate(p.count));
        const t = translate(p.sx, p.sy);
        if (node.style.transform !== t) node.style.transform = t;
      },
    });
    return plates.length;
  }

  function writePinned(spot, pinned) {
    const pin = nodes.pin;
    if (spot === null) {
      if (!pin.hidden) pin.hidden = true;
      pin.removeAttribute("data-car");
      pin.removeAttribute("aria-label");
      return;
    }
    if (pin.hidden) pin.hidden = false;
    if (pin.getAttribute("data-car") !== pinned.car.id) pin.setAttribute("data-car", pinned.car.id);
    setText(pin, spot.text);
    if (pin.getAttribute("aria-label") !== spot.name) pin.setAttribute("aria-label", spot.name);
    const t = translate(spot.top.sx, spot.top.sy - cssPx(8));
    if (pin.style.transform !== t) pin.style.transform = t;
  }

  function writeAreas(model) {
    for (const [id, a] of Object.entries(model.areas)) {
      const n = nodes.areas[id];
      if (n === undefined) continue;
      if (n.waiting.hidden !== (a.waiting === null)) n.waiting.hidden = a.waiting === null;
      if (a.waiting !== null) setText(n.waiting, waitingRiders(a.waiting));
      const recent = a.unservedRecent ?? 0;
      if (n.unserved.hidden !== (recent === 0)) n.unserved.hidden = recent === 0;
      if (recent > 0) setText(n.unserved, unservedCount(recent));
    }
  }

  function writeNumbers(model, frame, still) {
    const views = new Map(model.hasLog ? frame.depots.map((d) => [d.id, d]) : []);
    for (const d of Object.values(plan.depots)) {
      const n = nodes.depots[d.depot.id];
      const v = views.get(d.depot.id);
      const bays = d.depot.cleaning_bays + d.depot.service_bays;
      const lines = v === undefined
        ? [absentValue(ABSENT_REASONS.notRunYet)]
        : numbersLines({ queue: v.queue + v.gate, inBays: v.clean_busy + v.service_busy, bays, ready: v.ready, held: v.stalls_held, stalls: d.depot.parking, blocked: v.blocked });
      // One span a line; a line appears (the blocked count) or goes with the state, never as an empty span.
      keyedList(n.numbers, lines.map((text, i) => ({ key: String(i), text })), { key: (l) => l.key, create: (l) => el("span", {}, l.text), update: (node, l) => setText(node, l.text) });
      if (!still) continue;
      const words = v === undefined ? lines[0] : numbersWords({ queue: v.queue + v.gate, inBays: v.clean_busy + v.service_busy, bays, ready: v.ready, held: v.stalls_held, stalls: d.depot.parking, blocked: v.blocked });
      if (n.numbers.getAttribute("aria-label") !== words) n.numbers.setAttribute("aria-label", words);
    }
  }

  // ---- picking ------------------------------------------------------------------------------------------------------

  function writePick(children) {
    output.replaceChildren(...children);
  }

  canvas.addEventListener("click", (event) => {
    if (plan === null) return;
    const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const x = (event.clientX - rect.left) / scale;
    const y = (event.clientY - rect.top) / scale;
    const radius = (plan.phone ? PLAN.pickPx.phone : PLAN.pickPx.wide) / scale;
    const h = bodySize(scale).h / 2;
    let best = null;
    let bestD = radius * radius;
    for (const g of lastGroups) {
      const p = project(g.x, g.y, h);
      const d = (p.sx - x) ** 2 + (p.sy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (best === null) {
      writePick([el("span", {}, MAP.pickNothing)]);
      return;
    }
    const family = best.families[0];
    const car = family.ids[0];
    const others = best.families.reduce((n, f) => n + f.ids.length, 0) - 1;
    const text = pickedCar({ car, state: MAP.carStates[family.state] }) + (others > 0 ? `, ${withOthers(others)}` : "");
    writePick([
      el("span", {}, text),
      el("button", { type: "button", class: "fl-button", "data-role": "inspect-car", on: { click: () => onInspect({ car }) } }, inspectCar(car)),
      el("button", { type: "button", class: "fl-button", "data-role": "pin-car", on: { click: () => onPin(car) } }, pinCarNamed(car)),
    ]);
  });

  // ---- following the page ---------------------------------------------------------------------------------------

  const media = typeof matchMedia === "function" ? matchMedia(DARK_QUERY) : null;
  const onTheme = () => {
    readHues();
    dirty = true;
    if (lastInput !== null && !hidden) update(lastInput);
  };
  media?.addEventListener?.("change", onTheme);
  let observer = null;
  if (typeof globalThis.ResizeObserver === "function") {
    observer = new globalThis.ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width ?? 0;
      if (width <= 0 || view === null) return;
      resize({ cssWidth: width });
      if (lastInput !== null && !hidden) update(lastInput);
    });
    observer.observe(stage);
  }

  /**
   * Draws `input`: `{model, frame, log, scenario, pinned, still, peaks, floorUnitsPerCar}`. One draw per frame, and only
   * when the model, the pinned car, the hues or the stage size has changed. `still` is whether the picture is at rest
   * (paused, or a step just landed): the canvas name and the numbers lines' names are written then, never per frame.
   */
  function update(input) {
    lastInput = input;
    if (plan === null) return;
    const { model, frame, log, pinned = null, still = true, peaks = null, floorUnitsPerCar = Infinity } = input;
    if (peaks !== banded.peaks) banded = { peaks, set: peaks === null ? new Set() : isoBandedDirections(peaks, plan, floorUnitsPerCar) };
    if (hidden) {
      dirty = true;
      return;
    }
    const key = `${String(pinned?.car?.id ?? "")}|${String(pinned?.place?.kind ?? "")}|${String(scale)}|${String(backing.width)}`;
    const changed = dirty || lastKey === null || lastKey.model !== model || lastKey.key !== key || lastKey.banded !== banded.set;
    if (changed) {
      const { groups, cubes } = draw(input);
      report.plates = writeCounts(groups);
      writePinned(pinnedSpot(pinned, groups, cubes), pinned);
      writeAreas(model);
      writeNumbers(model, frame, still);
      lastKey = { model, key, banded: banded.set };
      dirty = false;
    } else if (still) {
      writeNumbers(model, frame, true);
    }
    if (still) {
      const name = isoLabel({ clock: format.clock(model.clock_s) });
      if (canvas.getAttribute("aria-label") !== name) canvas.setAttribute("aria-label", name);
    }
  }

  return {
    element,
    stage,
    canvas,
    overlay,
    output,
    build,
    update,
    resize,
    /** Hides the picture and takes its stops out of the tab order; showing it again redraws on the next update. */
    setHidden(next) {
      hidden = next;
      element.hidden = next;
      element.toggleAttribute("inert", next);
      if (!next) dirty = true;
    },
    /** The route directions this picture bands, for the written reasons under the map. */
    banded: () => banded.set,
    plan: () => plan,
    scale: () => scale,
    /** Where a route's tooltip sits, as fractions of the stage. */
    routeMid(routeId) {
      const r = plan?.routes[routeId];
      return r === undefined ? null : { x: r.mid.sx / view.width, y: r.mid.sy / view.height };
    },
    /** What the last draw put on the canvas, for tests: counts of bodies, cubes, blocks, cells, raised cells, bars, lots, rings, plates. */
    lastDraw: () => report,
    destroy() {
      media?.removeEventListener?.("change", onTheme);
      observer?.disconnect?.();
    },
  };
}
