// The isometric world (src/ui/iso.js; design 7.3 as amended by the demo plan) on the fake DOM with a fake 2D context
// that records every call, drawn from real run_window payloads. Position is held to the model: a body's fill sits
// where the projection of placeCar's fraction puts it, coincidence is grouped in model space, a depot block's cells
// equal the frame's bays, and every word is DOM (never fillText).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

import { callText, createFakeContext, fillsOf, strokesOf } from "./helpers/fake-canvas.mjs";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, referencePayload, referenceScenario, windowPayload } from "./helpers/model-payloads.mjs";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import {
  PLAN,
  SHADES,
  bayCells,
  bodyGroups,
  bodySize,
  createIsoView,
  cubeRows,
  faceHue,
  isoBandedDirections,
  overlayPlacements,
  planGeometry,
  project,
  ribbonLengths,
  shadeHex,
  unproject,
  waitingByArea,
} from "../src/ui/iso.js";
import { AREA_NEIGHBOURS, AREA_ORDER, FLOOR_UNITS_PER_CAR, GEOMETRIES, createMap, frameModel, mapModel, peakConcurrency } from "../src/ui/map.js";
import { frameAt } from "../src/ui/playback.js";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** The colour tokens of one theme, read from styles.css: the bare :root block, then the dark block over it. */
function tokens(theme) {
  const block = (text) => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const light = block(CSS.slice(CSS.indexOf(":root {"), CSS.indexOf("@media (prefers-color-scheme: dark)")));
  if (theme === "light") return light;
  const dark = CSS.slice(CSS.indexOf("@media (prefers-color-scheme: dark)"));
  return { ...light, ...block(dark.slice(0, dark.indexOf("}", dark.indexOf("--car-depot")))) };
}

const LIGHT = tokens("light");
const DARK = tokens("dark");

let payload;
let scenario;
let uninstall;

before(async () => {
  payload = await windowPayload();
  scenario = presetScenario();
  uninstall = installFakeDom();
});

after(() => uninstall());

const RECALL_S = 88200; // D2 00:30, the recall second of the default preset
/** One line of the numbers tag: .fl-iso__numbers is 12 px at line-height 1.2, so a line is 14.4 view units. */
const LINE_PX = 14.4;
/** The overlay's target, from --target: every label is at least this many CSS px in both directions. */
const TARGET_PX = 44;

/** A map with the isometric picture on, on a fake context, updated at `clock_s` with the real log (or none). */
function drawn({ clock_s = 66600, withLog = true, pinnedCar = null, interpolate = true, handlers = {}, theme = LIGHT, phone = false, still = true, log: givenLog = null, scenario: givenScenario = null } = {}) {
  const ctx = createFakeContext();
  const map = createMap({
    view: "iso",
    isoView: createIsoView,
    context2d: () => ctx,
    theme: () => theme,
    matchMedia: (query) => ({ matches: phone && query === "(max-width: 767.98px)", addEventListener() {}, removeEventListener() {} }),
    ...handlers,
  });
  document.body.appendChild(map.element);
  const log = givenLog ?? (withLog ? payload.log : null);
  const sc = givenScenario ?? scenario;
  const input = { scenario: sc, log, frame: log === null ? null : frameAt(log, clock_s, { interpolate }), clock_s, pinnedCar, seed: log === null ? null : log.seed, world: { name: "Bay teaching map", changes: 0 }, still };
  const model = map.update(input);
  const iso = map.iso();
  return { map, iso, ctx, model, input, redraw: (changes) => map.update({ ...input, ...changes }) };
}

const overlayOf = (map) => map.element.querySelector(".fl-iso__overlay");
const textOf = (node) => node.textContent;
const overlaps = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;
const centroid = (path) => [path.reduce((s, p) => s + p[0], 0) / path.length, path.reduce((s, p) => s + p[1], 0) / path.length];

describe("the plan geometry is the schematic stood up", () => {
  test("the projection inverts at the ground, and the platform centres are the SVG's own centres", () => {
    for (const geometry of [GEOMETRIES.wide, GEOMETRIES.phone]) {
      const plan = planGeometry(scenario, geometry, scenario.depots);
      for (const [id, p] of Object.entries(geometry.positions)) {
        const c = plan.centres[id];
        const back = project(c.x, c.y, 0);
        assert.ok(Math.abs(back.sx - p.x) < 1e-9 && Math.abs(back.sy - p.y) < 1e-9, `${geometry.name} ${id} centre`);
        assert.deepEqual(unproject(p.x, p.y), { x: c.x, y: c.y });
      }
      assert.equal(plan.half, geometry.name === "phone" ? 31 : 49);
      assert.equal(plan.view, geometry.view);
    }
    assert.deepEqual(project(10, 4, 3), { sx: 6, sy: 4 });
  });

  test("ribbon visible lengths are the spike's, wide and phone, and every route keeps its class width and offset", () => {
    const wide = ribbonLengths(planGeometry(scenario, GEOMETRIES.wide, scenario.depots));
    const rounded = Object.fromEntries(Object.entries(wide).map(([id, n]) => [id, Math.round(n)]));
    // The spike's table rounds H2 to 400; the exact figure is 399.45, so 399 is what a reader can measure.
    assert.deepEqual(rounded, { H1: 152, L1: 152, H2: 399, L2: 399, H3: 166, L3: 166, H4: 183, L4: 183, H5: 300, L5: 300, H6: 340, L6: 340 });
    const phone = ribbonLengths(planGeometry(scenario, GEOMETRIES.phone, scenario.depots));
    assert.deepEqual(Object.fromEntries(Object.entries(phone).map(([id, n]) => [id, Math.round(n)])), { H1: 279, L1: 279, H2: 314, L2: 314, H3: 77, L3: 77, H4: 77, L4: 77, H5: 314, L5: 314, H6: 279, L6: 279 });
    const plan = planGeometry(scenario, GEOMETRIES.wide, scenario.depots);
    for (const route of scenario.routes) {
      const entry = plan.routes[route.id];
      assert.equal(entry.width, PLAN.road[route.cls].width, route.id);
      // The ribbon is the centre line moved along its normal by the class offset: highways one side, locals the other.
      const ca = plan.centres[route.a];
      const beside = (entry.pA.x - ca.x) * entry.nx + (entry.pA.y - ca.y) * entry.ny;
      assert.ok(Math.abs(beside - PLAN.road[route.cls].offset) < 1e-9, `${route.id} offset ${beside.toFixed(2)}`);
    }
  });

  test("depot blocks stand at their platform's +x corner, the second depot of an area below the first", () => {
    const plan = planGeometry(scenario, GEOMETRIES.wide, scenario.depots);
    const sf1 = plan.depots["SF-1"];
    const sf2 = plan.depots["SF-2"];
    const c = plan.centres.SF;
    assert.equal(sf1.side, PLAN.block.wide.side);
    assert.equal(sf1.height, PLAN.block.wide.height);
    assert.equal(sf1.cx, c.x + plan.half - sf1.side / 2 - PLAN.blockInset);
    assert.equal(sf2.cx, sf1.cx);
    assert.equal(sf2.cy - sf1.cy, sf1.side + PLAN.blockGap);
    assert.equal(planGeometry(scenario, GEOMETRIES.phone, scenario.depots).depots["SJ-1"].side, PLAN.block.phone.side);
  });
});

describe("bodies: one per car on a route, at placeCar's fraction, heading along the ribbon", () => {
  test("a body per car in model.onRoutes and none for a car standing in an area or at a depot", () => {
    const { iso, model } = drawn({ clock_s: 66600 });
    const plan = iso.plan();
    const groups = bodyGroups(model, plan);
    const drawnIds = groups.flatMap((g) => g.families.flatMap((f) => f.ids)).sort();
    assert.deepEqual(drawnIds, model.onRoutes.map((c) => c.id).sort());
    assert.ok(drawnIds.length > 50, `${String(drawnIds.length)} cars on routes at D1 18:30`);
    const bodies = groups.reduce((n, g) => n + g.families.length, 0);
    assert.equal(iso.lastDraw().bodies, bodies, "one body per family per group");
    const standing = Object.values(model.areas).reduce((n, a) => n + a.families.riderWork + a.families.emptyDrive + a.families.available, 0);
    assert.ok(standing > 0, "some cars stand in an area");
    assert.equal(iso.lastDraw().cubes, cubeRows(model, plan).length, "standing cars are cubes, never bodies");
  });

  test("one cube is five cars standing, counted per area and family from the model, not from the drawing", () => {
    // D2 04:00, where cars stand in all four areas: the legend promises one cube per five, so the tally is held to
    // the model's own family counts. Measured on this payload: 34 cars standing are 12 cubes, never 34.
    const { iso, model } = drawn({ clock_s: 100800 });
    const cubes = cubeRows(model, iso.plan());
    let standing = 0;
    for (const [area, a] of Object.entries(model.areas)) {
      const here = a.families.riderWork + a.families.emptyDrive + a.families.available;
      assert.ok(here > 0, `${area} has cars standing at D2 04:00`);
      standing += here;
      for (const family of ["riderWork", "emptyDrive", "available"]) {
        const drawnCubes = cubes.filter((c) => c.area === area && c.family === family).length;
        assert.equal(drawnCubes, Math.ceil(a.families[family] / 5), `${area} ${family}: ${String(a.families[family])} cars standing`);
      }
    }
    assert.equal(standing, 34, "measured at D2 04:00");
    assert.equal(cubes.length, 12, "34 cars standing are 12 cubes: one cube is five cars, as the legend says");
    assert.equal(iso.lastDraw().cubes, cubes.length, "and the report matches what was drawn");
  });

  test("a body's fill sits where the projection of its fraction along the ribbon puts it, pointing the ribbon's way", () => {
    const { iso, ctx, model } = drawn({ clock_s: 66600 });
    const plan = iso.plan();
    const size = bodySize(iso.scale());
    const fills = fillsOf(ctx).filter((c) => c.path.length === 4);
    let checked = 0;
    for (const group of bodyGroups(model, plan)) {
      const entry = plan.routes[group.route];
      const forward = group.dir === `${entry.route.a}>${entry.route.b}`;
      const f = forward ? group.fraction : 1 - group.fraction;
      assert.ok(Math.abs(group.x - (entry.pA.x + (entry.pB.x - entry.pA.x) * f)) < 1e-9 && Math.abs(group.y - (entry.pA.y + (entry.pB.y - entry.pA.y) * f)) < 1e-9, group.key);
      assert.ok(Math.abs(group.hx - (forward ? entry.ux : -entry.ux)) < 1e-9 && Math.abs(group.hy - (forward ? entry.uy : -entry.uy)) < 1e-9, `${group.key} heading`);
      // The top face is a quad whose centroid projects at the body's centre raised by its height.
      const top = project(group.x, group.y, size.h);
      const found = fills.some((c) => {
        const [x, y] = centroid(c.path);
        return Math.abs(x - top.sx) < 0.5 && Math.abs(y - top.sy) < 0.5;
      });
      assert.ok(found, `a top face fill at ${top.sx.toFixed(1)},${top.sy.toFixed(1)} for ${group.key}`);
      checked += 1;
    }
    assert.ok(checked > 50, `${String(checked)} bodies checked`);
  });

  test("the body is 10 x 7 x 4 units with pixel floors that bind below scale 1.2", () => {
    assert.deepEqual(bodySize(1.4), { l: 10, w: 7, h: 4 });
    assert.deepEqual(bodySize(1.2), { l: 10, w: 7, h: 4 });
    const small = bodySize(1.0);
    assert.equal(small.l, 12);
    assert.equal(small.w, 8);
    assert.ok(small.h > 4 && small.h < 5, "the height keeps the body's proportion");
    const phone = bodySize(344 / 340);
    assert.ok(phone.l * (344 / 340) >= 12 - 1e-9 && phone.w * (344 / 340) >= 8 - 1e-9, "the floors hold on the phone stage");
  });

  test("the same clock drawn by two maps is call-for-call identical; interpolation off draws the snapshot positions", () => {
    const snap = payload.log.snapshots[162];
    const first = drawn({ clock_s: snap.t + 150 });
    const second = drawn({ clock_s: snap.t + 150 });
    assert.equal(callText(first.ctx), callText(second.ctx));
    assert.ok(first.ctx.calls.length > 500, `${String(first.ctx.calls.length)} calls`);
    const stepped = drawn({ clock_s: snap.t + 150, interpolate: false });
    const atSnapshot = drawn({ clock_s: snap.t, interpolate: false });
    const places = (m) => bodyGroups(m.model, m.iso.plan()).map((g) => [g.key, g.x, g.y]);
    assert.deepEqual(places(stepped), places(atSnapshot), "reduced motion lands on the 5-minute grid, no second code path");
    assert.notDeepEqual(places(first), places(atSnapshot), "full motion interpolates between snapshots");
  });

  test("only the four driving states draw bodies, hollow for ENROUTE_PICKUP and REPOSITIONING", () => {
    const states = new Set();
    // D2 05:55 is the first snapshot that puts a REPOSITIONING car on a route: the release is the only thing that
    // repositions one, and measured on this payload the other four clocks never draw that state, so without it half
    // of the hollow rule would be claimed and never tested.
    for (const clock_s of [25200, 43200, 66600, 68400, 107700, 111600]) {
      const { iso, model } = drawn({ clock_s });
      for (const group of bodyGroups(model, iso.plan())) {
        for (const family of group.families) {
          states.add(family.state);
          assert.equal(family.hollow, family.state === "ENROUTE_PICKUP" || family.state === "REPOSITIONING", family.state);
        }
      }
    }
    for (const state of states) assert.ok(["ENROUTE_PICKUP", "ON_TRIP", "TO_DEPOT", "REPOSITIONING"].includes(state), state);
    // All four, so a clock list that stopped covering a state would fail here instead of quietly narrowing.
    assert.deepEqual([...states].sort(), ["ENROUTE_PICKUP", "ON_TRIP", "REPOSITIONING", "TO_DEPOT"], "every driving state is drawn at one of the sampled clocks");
  });
});

describe("coincidence is grouped in model space, one body and one count per family", () => {
  test("at the recall second the stacks are the log's own, and the plates read ×N with N the family's count", () => {
    const { map, iso, model } = drawn({ clock_s: RECALL_S });
    const groups = bodyGroups(model, iso.plan());
    const expected = new Map();
    for (const car of model.onRoutes) {
      const key = `${car.route}|${car.dir}|${String(car.fraction)}|${car.family}`;
      expected.set(key, (expected.get(key) ?? 0) + 1);
    }
    const stacks = [...expected.values()].filter((n) => n > 1).sort((a, b) => b - a);
    // The counts pinned to the log, not to the drawing: measured on this payload at D2 00:30, the recall puts whole
    // convoys on one leg at one instant, so five stacks carry 67 of the 85 cars on routes. Pinned because a key
    // coarser than the leg's own fraction invents coincidence the log does not hold: rounded to a twentieth of a leg
    // it makes these five stacks six and claims 69 cars coincident.
    assert.deepEqual(stacks, [22, 18, 9, 9, 9], "the log's own exact (route, dir, fraction, family) stacks");
    const plates = overlayOf(map).querySelectorAll('[data-role="count"]');
    for (const plate of plates) assert.match(plate.textContent, /^×\d+$/);
    assert.deepEqual(
      plates.map((p) => Number(p.textContent.slice(1))).sort((a, b) => b - a),
      stacks,
      "one plate per stack, each counting the cars the model put on that leg",
    );
    // And what was drawn matches the report: one plate per family group, keyed on the stack's first car.
    assert.deepEqual(
      plates.map((p) => [p.getAttribute("data-key"), p.textContent]).sort(),
      groups.flatMap((g) => g.families.filter((f) => f.ids.length > 1).map((f) => [`${f.family}|${f.ids[0]}`, labels.countPlate(f.ids.length)])).sort(),
    );
    // A plate rides 8 px above the shared body and moves by transform, never by left or top.
    for (const plate of plates) {
      assert.match(plate.style.transform, /^translate\(-?[\d.]+px, -?[\d.]+px\) translate\(-50%, -100%\)$/);
      assert.equal(plate.style.left, "");
      assert.equal(plate.style.top, "");
    }
  });

  test("the counts at one clock are equal at two canvas sizes, and a mixed-family stack draws two bodies", () => {
    const { map, iso, redraw } = drawn({ clock_s: RECALL_S });
    const read = () => overlayOf(map).querySelectorAll('[data-role="count"]').map((p) => [p.getAttribute("data-key"), p.textContent]).sort();
    const small = read();
    iso.resize({ cssWidth: 1280 });
    redraw({});
    assert.equal(iso.scale(), 2);
    assert.deepEqual(read(), small);
    // Two families at one point are two bodies in two hues, never one body in one hue.
    const groups = bodyGroups({ onRoutes: [
      { id: "a", state: "ON_TRIP", family: "riderWork", route: "H2", dir: "SF>SJ", fraction: 0.25 },
      { id: "b", state: "TO_DEPOT", family: "emptyDrive", route: "H2", dir: "SF>SJ", fraction: 0.25 },
      { id: "c", state: "ON_TRIP", family: "riderWork", route: "H2", dir: "SF>SJ", fraction: 0.25 },
    ] }, iso.plan());
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].families.map((f) => [f.family, f.ids.length]), [["riderWork", 2], ["emptyDrive", 1]]);
  });
});

describe("the depot block: cells, bars, lot fill and the numbers line", () => {
  test("cells equal the bays, raised cells equal the busy bays, and the numbers line carries the frame's view", () => {
    const snap = payload.log.snapshots[162];
    const { map, iso, input } = drawn({ clock_s: snap.t, interpolate: false });
    for (const view of snap.depots) {
      const depot = payload.log.depots.find((d) => d.id === view.id);
      const cells = bayCells({ frame: input.frame, log: payload.log, scenario, depot });
      assert.equal(cells.length, depot.cleaning_bays + depot.service_bays, view.id);
      assert.equal(cells.filter((c) => c.busy).length, view.clean_busy + view.service_busy, `${view.id} raised cells`);
      assert.deepEqual(cells.map((c) => c.task), [...Array(depot.cleaning_bays).fill("CLEAN"), ...Array(depot.service_bays).fill("SERVICE")]);
      for (const c of cells) assert.ok(c.fraction >= 0 && c.fraction <= 1 && (c.busy || c.fraction === 0), `${view.id} fill ${String(c.fraction)}`);
      const line = overlayOf(map).querySelector(`[data-role="numbers"][data-depot="${view.id}"]`);
      const facts = { queue: view.queue + view.gate, inBays: view.clean_busy + view.service_busy, bays: depot.cleaning_bays + depot.service_bays, ready: view.ready, held: view.stalls_held, stalls: depot.parking, blocked: view.blocked };
      assert.deepEqual(line.children.map(textOf), labels.numbersLines(facts));
      assert.equal(line.children.length, 4, "one fact a line, no blocked line while nothing is blocked");
      assert.equal(line.getAttribute("role"), "img", "a naming role, so the full words are the name a reader hears");
      assert.equal(line.getAttribute("aria-label"), labels.numbersWords({ queue: view.queue + view.gate, inBays: view.clean_busy + view.service_busy, bays: depot.cleaning_bays + depot.service_bays, ready: view.ready, held: view.stalls_held, stalls: depot.parking, blocked: view.blocked }));
    }
    const report = iso.lastDraw();
    assert.equal(report.blocks, snap.depots.length);
    assert.equal(report.cells, snap.depots.reduce((n, v) => n + payload.log.depots.find((d) => d.id === v.id).cleaning_bays + payload.log.depots.find((d) => d.id === v.id).service_bays, 0));
    assert.equal(report.raised, snap.depots.reduce((n, v) => n + v.clean_busy + v.service_busy, 0));
  });

  test("the identity intake + queue + ready = stalls held holds at every sampled snapshot (the motion plan's Phase 3)", () => {
    const log = payload.log;
    let checked = 0;
    for (let i = 0; i < log.snapshots.length; i += 12) {
      const snap = log.snapshots[i];
      for (const view of snap.depots) {
        const intake = snap.cars.filter((c) => c.state === "INTAKE" && c.location?.depot === view.id).length;
        assert.equal(intake + view.queue + view.ready, view.stalls_held, `${view.id} at ${format.clock(snap.t)}`);
        checked += 1;
      }
    }
    assert.ok(checked > 100);
  });

  test("a busy cell fills by elapsed over total, clamped to 1; a blocked car's cell is full and its line says so", () => {
    const depot = { id: "SF-2", area: "SF", parking: 30, cleaning_bays: 2, service_bays: 1 };
    const t0 = 90000;
    // The two orders disagree on purpose: SF-026 started its clean first but sorts last by id, so a cell row filled
    // in id order would put SF-024 first and fail here. Bays are not numbered in this model and the caption says
    // cars fill them in the order their task started, which is the only thing this row's order may mean.
    const visits = [
      { car: "SF-026", depot: "SF-2", arrival_s: t0 - 3000, intake_end_s: t0 - 2700, first_task_s: t0 - 1500, clean_start_s: t0 - 1500, clean_end_s: t0 - 300, service_start_s: null, service_end_s: null, ready_s: null, censored: false },
      { car: "SF-024", depot: "SF-2", arrival_s: t0 - 900, intake_end_s: t0 - 600, first_task_s: t0, clean_start_s: t0, clean_end_s: null, service_start_s: null, service_end_s: null, ready_s: null, censored: false },
    ];
    const cars = [
      { id: "SF-026", state: "IN_SERVICE", task: "CLEAN", blocked: true, location: { depot: "SF-2" } },
      { id: "SF-024", state: "IN_SERVICE", task: "CLEAN", location: { depot: "SF-2" } },
      { id: "SF-001", state: "QUEUED_SERVICE", location: { depot: "SF-2" } },
    ];
    const view = { id: "SF-2", stalls_held: 1, queue: 1, gate: 0, clean_busy: 2, service_busy: 0, blocked: 1, ready: 0 };
    const frame = { clock_s: t0 + 300, snapshot_t: t0, at_s: t0 + 300, interpolated: true, cars, depots: [view] };
    const log = { seed: 1001, events: [], intervals: {}, visits, requests: [], cars: cars.map((c) => ({ id: c.id })), depots: [depot], snapshots: [{ t: t0, cars, depots: [view] }], drain_end_s: t0 + 7200 };
    const cells = bayCells({ frame, log, scenario, depot });
    assert.deepEqual(cells.map((c) => [c.task, c.busy, c.blocked, c.car]), [["CLEAN", true, true, "SF-026"], ["CLEAN", true, false, "SF-024"], ["SERVICE", false, false, null]]);
    assert.equal(cells[0].fraction, 1, "finished with no stall free: the cell stays full");
    assert.equal(cells[1].fraction, 300 / scenario.clean_s, "elapsed over the clean time you set");
    // Later in the same task the fill grows; past the task it is clamped.
    assert.equal(bayCells({ frame: { ...frame, at_s: t0 + 600 }, log, scenario, depot })[1].fraction, 600 / scenario.clean_s);
    assert.equal(bayCells({ frame: { ...frame, at_s: t0 + 99999 }, log, scenario, depot })[1].fraction, 1);
    // Through the map: the numbers line carries the blocked count and its full words.
    const { map, iso } = drawn({ clock_s: t0 + 300, log, scenario: { ...scenario, depots: [depot] } });
    const line = overlayOf(map).querySelector('[data-role="numbers"][data-depot="SF-2"]');
    assert.deepEqual(line.children.map(textOf), ["queue 1", "bays 2/3", "ready 0", "stalls 1/30", "1 blocked"]);
    // A paragraph cannot carry an author name (role=paragraph is name-prohibited), so the words the reader hears
    // would be the abbreviated lines and the blocked reason would be said nowhere. The tag is named as the flat
    // picture names its pinned glyph: role="img" with the full words.
    assert.equal(line.getAttribute("role"), "img");
    assert.match(line.getAttribute("aria-label"), new RegExp(`1 blocked, ${labels.MAP.blocked}$`));
    // The tag hangs from its bottom edge, so this fifth line grew up into the gap under its own block.
    const numbersRule = CSS.slice(CSS.indexOf(".fl-iso__numbers {"), CSS.indexOf("}", CSS.indexOf(".fl-iso__numbers {")));
    assert.match(numbersRule, /transform:\s*translate\(-50%,\s*-100%\)/);
    assert.equal(iso.lastDraw().raised, 2);
  });

  test("the queue and ready bars are capped at 12 units and the lot fill climbs the side faces only", () => {
    const { iso } = drawn({ clock_s: RECALL_S + 3600 });
    const report = iso.lastDraw();
    assert.ok(report.bars.every((b) => b.height <= PLAN.bar.cap && b.height >= 0), JSON.stringify(report.bars));
    assert.ok(report.bars.some((b) => b.count * PLAN.bar.perCar > PLAN.bar.cap && b.height === PLAN.bar.cap), "a queue past the cap is capped; the numbers line carries the count");
    for (const lot of report.lots) {
      assert.ok(lot.fraction >= 0 && lot.fraction <= 1);
      assert.equal(lot.faces, 2, "side faces only: the painter's sort cannot interpenetrate a top");
    }
  });
});

describe("hues and words", () => {
  const luminance = (hex) => {
    const c = (i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
  };

  test("every fill and stroke is a token or a shaded face of one, never a status colour, and no text is ever drawn", () => {
    for (const [theme, dark] of [[LIGHT, false], [DARK, true]]) {
      const allowed = new Set(["--ground", "--panel", "--panel-alt", "--ink", "--muted", "--faint", "--rule", "--rule-strong", "--accent"].map((k) => theme[k].toLowerCase()));
      // Every box is shaded by one rule: the four car hues, the panel of a block and its cells, the muted queue bar.
      for (const hue of ["--car-rider", "--car-empty", "--car-available", "--car-depot", "--panel", "--muted"]) {
        for (const face of ["top", "sideY", "sideX"]) allowed.add(faceHue(theme[hue], face, dark).toLowerCase());
      }
      // The status hues, less any that shares its value with a token the canvas may use: light and dark `--invalid`
      // are `--muted`'s value, so that word cannot be told from the queue bar by its hex.
      const status = new Set(["--hold", "--pass", "--cond", "--invalid"].map((k) => theme[k].toLowerCase()).filter((hex) => !allowed.has(hex)));
      assert.ok(status.size >= 3);
      for (const clock_s of [25200, 66600, RECALL_S, RECALL_S + 5400]) {
        const { ctx } = drawn({ clock_s, pinnedCar: "SF-017", theme });
        for (const call of ctx.calls) {
          // The style in force when paint happens; a path call carries whatever the context started with.
          if (call.name === "fill" || call.name === "fillRect") assert.ok(allowed.has(call.fillStyle.toLowerCase()) && !status.has(call.fillStyle.toLowerCase()), `${call.name} in ${call.fillStyle} at ${String(clock_s)}`);
          if (call.name === "stroke") assert.ok(allowed.has(call.strokeStyle.toLowerCase()) && !status.has(call.strokeStyle.toLowerCase()), `stroke in ${call.strokeStyle} at ${String(clock_s)}`);
          assert.ok(call.name !== "fillText" && call.name !== "strokeText", "every word is DOM");
        }
        assert.ok(fillsOf(ctx).length > 100 && strokesOf(ctx).length > 50);
      }
    }
  });

  test("faces darken on the light theme and lighten on the dark one, by the design's factors, and the ribbons keep the rule hues", () => {
    assert.deepEqual(SHADES, { light: { top: 1, sideY: 0.84, sideX: 0.68 }, dark: { top: 1, sideY: 1.14, sideX: 1.28 } });
    assert.equal(shadeHex("#2a78d6", 1), "#2a78d6");
    assert.equal(shadeHex("#2a78d6", 0.5), "#153c6b");
    assert.equal(shadeHex("#e0e0e0", 1.28), "#ffffff", "lightening clamps at white");
    for (const [hue, dark] of [[LIGHT["--car-rider"], false], [DARK["--car-rider"], true]]) {
      const top = luminance(faceHue(hue, "top", dark));
      const side = luminance(faceHue(hue, "sideX", dark));
      assert.ok(dark ? side > top : side < top, `the side face ${dark ? "lightens" : "darkens"}`);
    }
    const { ctx } = drawn({ clock_s: 66600 });
    // The ground, then four platforms, then two halves of each of the twelve ribbons, before anything stands.
    const ribbonFills = fillsOf(ctx).slice(0, 4 + 2 * scenario.routes.length).map((c) => c.fillStyle.toLowerCase());
    const ribbonHues = new Set([LIGHT["--rule-strong"], LIGHT["--rule"], LIGHT["--faint"], LIGHT["--panel"], LIGHT["--panel-alt"]].map((h) => h.toLowerCase()));
    for (const hue of ribbonFills) assert.ok(ribbonHues.has(hue), `an early fill in ${hue} is not ground, platform or ribbon`);
  });

  test("a theme change re-reads the hues and redraws", () => {
    let theme = LIGHT;
    const listeners = [];
    const ctx = createFakeContext();
    const map = createMap({
      view: "iso",
      isoView: createIsoView,
      context2d: () => ctx,
      theme: () => theme,
      matchMedia: (query) => ({ matches: false, addEventListener: (type, fn) => { if (query.includes("dark")) listeners.push(fn); }, removeEventListener() {} }),
    });
    document.body.appendChild(map.element);
    map.update({ scenario, log: payload.log, frame: frameAt(payload.log, 66600), clock_s: 66600, pinnedCar: null, seed: payload.log.seed });
    const before = ctx.calls.filter((c) => c.name === "fillRect")[0].fillStyle;
    assert.equal(before.toLowerCase(), LIGHT["--panel"].toLowerCase());
    theme = DARK;
    ctx.reset();
    for (const fn of listeners) fn({ matches: true });
    assert.equal(ctx.calls.filter((c) => c.name === "fillRect")[0].fillStyle.toLowerCase(), DARK["--panel"].toLowerCase());
    map.destroy();
  });

  test("the captions the world owes stand before a run, with the legend line, the world line and the stamp", () => {
    const { map } = drawn({ withLog: false, clock_s: 18000 });
    const limits = map.element.querySelectorAll('[data-role="model-limits"] [data-limit]').filter((n) => !n.inHiddenOrInert());
    assert.deepEqual(limits.map((n) => n.getAttribute("data-limit")), ["hourlyTraffic", "areasArePoints", "isoSketch", "bodyIsConvention", "fixedTaskTimes", "noStaff", "baysNotNumbered"]);
    for (const node of limits) assert.equal(node.textContent, labels.MODEL_LIMITS[node.getAttribute("data-limit")]);
    assert.equal(map.element.querySelector('[data-role="mark-legend"]').textContent, labels.MAP.oneBodyOneCar);
    assert.equal(map.element.querySelector('[data-role="unit-legend"]').hidden, true, "the block legend belongs to the flat picture");
    assert.equal(map.element.querySelector('[data-role="world-line"]').textContent, labels.worldLine({ name: "Bay teaching map", changes: 0 }));
    assert.equal(map.element.querySelector(".fl-map__stamp").textContent, labels.MAP.cornerStamp);
    assert.equal(map.element.querySelector(".fl-chip-replay").hidden, true);
    const absent = labels.absentValue(labels.ABSENT_REASONS.notRunYet);
    for (const line of overlayOf(map).querySelectorAll('[data-role="numbers"]')) assert.equal(line.textContent, absent, "never queue 0 before a run");
    for (const node of overlayOf(map).querySelectorAll('[data-role="waiting"]')) assert.equal(node.hidden, true);
    const report = map.iso().lastDraw();
    assert.equal(report.bodies, 0);
    // A free cell is the picture's way of saying "this bay is free", which is a state nothing has computed yet. The
    // blocks stand as empty shells with their `not available` tags, as the flat picture clears its micro and lot.
    assert.equal(report.cells, 0, "no bay cells before a run: a row of free cells would be absence drawn as zero");
    assert.equal(report.raised, 0);
    assert.deepEqual(report.lots, []);
    assert.equal(report.blocks, scenario.depots.length, "the shells still stand");
  });

  test("a stale replay greys the picture through the class, and the canvas is an image with one name", () => {
    const { map, redraw } = drawn({ clock_s: 66600 });
    const stage = map.element.querySelector(".fl-iso");
    assert.equal(stage.classList.contains("fl-stale"), false);
    redraw({ stale: true });
    assert.equal(stage.classList.contains("fl-stale"), true);
    const canvas = map.element.querySelector("canvas");
    assert.equal(canvas.getAttribute("role"), "img");
    assert.equal(canvas.getAttribute("tabindex"), "-1");
    assert.equal(canvas.getAttribute("class"), "fl-iso__canvas");
    assert.equal(canvas.getAttribute("aria-label"), labels.isoLabel({ clock: format.clock(66600) }));
  });
});

describe("the overlay is the keyboard layer: 20 roving stops, one tab stop, names from the allowlist", () => {
  const press = (key, extra = {}) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra });
    document.activeElement.dispatchEvent(event);
    return event;
  };
  const active = () => document.activeElement;

  test("the flat picture is hidden and inert, the canvas takes no stop, and the overlay holds the map's 20 stops", () => {
    const { map } = drawn();
    const svgStage = map.element.querySelector('[data-role="stage"]');
    assert.equal(svgStage.hidden, true);
    assert.ok(svgStage.hasAttribute("inert"));
    const overlay = overlayOf(map);
    const keys = overlay.querySelectorAll("[data-focus-key]").map((n) => n.getAttribute("data-focus-key"));
    assert.equal(keys.length, 20);
    assert.deepEqual(keys.filter((k) => k.startsWith("area:")), AREA_ORDER.map((a) => `area:${a}`));
    assert.deepEqual(keys.filter((k) => k.startsWith("depot:")).sort(), ["depot:EB-1", "depot:SF-1", "depot:SF-2", "depot:SJ-1"]);
    assert.equal(keys.filter((k) => k.startsWith("route:")).length, 12, "highways and locals both keep their stop");
    const stops = map.element.querySelectorAll("[tabindex]").filter((n) => n.tabIndex >= 0 && !n.inHiddenOrInert());
    assert.equal(stops.length, 1, stops.map((n) => n.getAttribute("data-focus-key") ?? n.localName).join(","));
    assert.equal(stops[0].getAttribute("data-focus-key"), "area:SF");
    for (const node of overlay.querySelectorAll("[data-focus-key]")) assert.equal(node.localName, "button");
    assert.equal(overlay.querySelectorAll("button").length, 20, "no other button rides the overlay");
  });

  test("every overlay name comes from the allowlist: area names, depot ids and route shields", () => {
    const { map } = drawn({ clock_s: 66600 });
    const allowed = new Set([
      ...Object.values(labels.MAP.areas),
      ...scenario.depots.map((d) => d.id),
      ...scenario.routes.map((r) => labels.routeShield({ routeId: r.id, freeFlow: format.minutes(r.free_flow_s) })),
    ]);
    for (const button of overlayOf(map).querySelectorAll("button")) {
      const name = button.getAttribute("aria-label") ?? button.textContent;
      assert.ok(allowed.has(name) || scenario.depots.some((d) => name === labels.depotName({ depotId: d.id, areaName: labels.MAP.areas[d.area] })), name);
    }
    const text = [overlayOf(map), ...overlayOf(map).querySelectorAll("*")].flatMap((n) => [n.textContent, n.getAttribute("aria-label") ?? ""]).join(" ");
    assert.doesNotMatch(text, /[–—]/);
    assert.doesNotMatch(text, /\b(predict|forecast|live|real-time|monitoring|wins?|winner|beats|score|gauge|grade|leaderboard|revenue|cost)\b|expected traffic|better option|best configuration/i);
  });

  test("arrows follow AREA_NEIGHBOURS, Enter goes into an area's depots and routes, Escape comes out, I opens Inspect", () => {
    const calls = [];
    const { map } = drawn({ pinnedCar: "SF-017", handlers: { onInspect: (t) => calls.push(["inspect", t]), onSelect: (s) => calls.push(["select", s]) } });
    const overlay = overlayOf(map);
    overlay.querySelector('[data-focus-key="area:SF"]').focus();
    for (const [key, area] of [["ArrowRight", "EB"], ["ArrowDown", "SJ"], ["ArrowLeft", "PEN"], ["ArrowLeft", "PEN"], ["ArrowUp", "SF"]]) {
      press(key);
      assert.equal(active().getAttribute("data-area"), area, key);
    }
    assert.deepEqual(AREA_NEIGHBOURS.SF, { ArrowRight: "EB", ArrowDown: "PEN" });
    press("Enter");
    assert.equal(active().getAttribute("data-depot"), "SF-1");
    press("ArrowRight");
    assert.equal(active().getAttribute("data-depot"), "SF-2");
    press("ArrowRight");
    assert.equal(active().getAttribute("data-route"), "H1");
    const tooltip = map.element.querySelector(".fl-tooltip");
    assert.equal(tooltip.getAttribute("data-open"), "true", "focus on a route shows its tooltip");
    assert.match(tooltip.textContent, /Leaving now, D1 18:30: /);
    press("ArrowLeft");
    press("ArrowLeft");
    press("i");
    press("Enter");
    press("Escape");
    assert.equal(active().getAttribute("data-area"), "SF");
    assert.deepEqual(calls, [["inspect", { depot: "SF-1" }], ["select", { depot: "SF-1" }]]);
    press("I");
    assert.deepEqual(calls.at(-1), ["inspect", { car: "SF-017" }]);
    assert.equal(overlay.querySelectorAll('[tabindex="0"]').length, 1);
    // A pointer on a depot plate opens its inspector, as the tile does today.
    overlay.querySelector('[data-focus-key="depot:SJ-1"]').click();
    assert.deepEqual(calls.at(-1), ["inspect", { depot: "SJ-1" }]);
  });

  for (const name of ["wide", "phone"]) {
    test(`${name}: no two of the 20 targets overlap, every numbers line lies inside the stage, and shields stand off their road`, () => {
      const geometry = GEOMETRIES[name];
      const plan = planGeometry(scenario, geometry, scenario.depots);
      const placed = overlayPlacements(plan, scenario);
      const targets = [
        ...AREA_ORDER.map((id) => ({ id: `area:${id}`, ...placed.areas[id].box })),
        ...scenario.depots.map((d) => ({ id: `depot:${d.id}`, ...placed.depots[d.id].plate })),
        ...scenario.routes.map((r) => ({ id: `route:${r.id}`, ...(placed.routes[r.id].box) })),
      ];
      assert.equal(targets.length, 20);
      for (const a of targets) {
        assert.ok(a.x1 - a.x0 >= 44 - 1e-9 && a.y1 - a.y0 >= 44 - 1e-9, `${a.id} is a 44 px target`);
        for (const b of targets) if (a !== b) assert.ok(!overlaps(a, b), `${a.id} overlaps ${b.id} at ${name}`);
      }
      // The numbers under a block are words on an opaque tag: inside the stage, never over another label's words (an
      // id plate, a shield's visible plate, an area name); a transparent local target under a tag keeps its clicks.
      const words = [
        ...AREA_ORDER.map((id) => ({ id: `area:${id}`, ...placed.areas[id].text })),
        ...scenario.depots.map((d) => ({ id: `depot:${d.id}`, ...placed.depots[d.id].plateWords })),
        ...scenario.routes.filter((r) => r.cls === "HIGHWAY").map((r) => ({ id: `route:${r.id}`, ...placed.routes[r.id].plate })),
      ];
      for (const d of scenario.depots) {
        const box = placed.depots[d.id].numbers;
        assert.ok(box.x0 >= 0 && box.y0 >= 0 && box.x1 <= geometry.view.width && box.y1 <= geometry.view.height, `${d.id} numbers inside the ${name} stage: ${JSON.stringify(box)}`);
        for (const w of words) assert.ok(!overlaps(box, w), `${d.id} numbers over ${w.id} at ${name}`);
        for (const e of scenario.depots) if (e !== d) assert.ok(!overlaps(box, placed.depots[e.id].numbers), `${d.id} numbers over ${e.id} numbers at ${name}`);
        // The box the scorer clears is the box the tag draws: four lines of 12 px mono at line-height 1.2, 2 px of
        // padding above and below. A tag that rendered a line the scorer never measured would stand outside it.
        assert.ok(Math.abs(box.y1 - box.y0 - (4 * LINE_PX + 4)) < 1e-9, `${d.id} reserves exactly its four lines at ${name}`);
        // A blocked car adds a fifth line (MAP.blocked's count). The tag hangs from its bottom edge, so that line
        // grows up into the gap under its own block instead of down off the stage: measured with a top anchor,
        // SJ-1's fifth line ends at 502 of the 500-unit wide stage and at 413 of the 400-unit phone stage, where
        // `contain: layout paint` clips it and the blocked count can be neither seen nor, on a phone, nearly seen.
        assert.equal(placed.depots[d.id].numbersAnchor.y, box.y1, `${d.id} tag hangs from its bottom edge at ${name}`);
        const blocked = { ...box, y0: box.y0 - LINE_PX };
        assert.ok(blocked.y0 >= 0 && blocked.y1 <= geometry.view.height, `${d.id} blocked line inside the ${name} stage: ${JSON.stringify(blocked)}`);
        // Wide is the geometry the page presents from (768 px and up), and there the fifth line clears every other
        // label's words too. The 340-unit phone stage has no such room for any five-line tag: reserving five lines
        // there costs four overlapping targets and stands SJ-1's tag on H6's shield (measured), so the phone keeps
        // the placement and takes the fifth line over a neighbouring plate rather than off the stage.
        if (name === "wide") for (const w of words) assert.ok(!overlaps(blocked, w), `${d.id} blocked line over ${w.id} at ${name}`);
      }
      for (const r of scenario.routes.filter((x) => x.cls === "HIGHWAY")) {
        const s = placed.routes[r.id];
        assert.ok(s.plate.x0 >= 0 && s.plate.y0 >= 0 && s.plate.x1 <= geometry.view.width && s.plate.y1 <= geometry.view.height, `${r.id} shield inside the view`);
        assert.ok(Number.isFinite(s.off), `${r.id} carries its offset`);
      }
    });
  }

  test("the non-overlap proof holds wherever the stage is at least as wide as its view", () => {
    // Every target is placed in view units but sized in CSS px (.fl-iso__label takes min-width and min-height from
    // --target), so a DOM target covers TARGET / scale view units. At scale 1 and above it is no larger than the box
    // the scorer cleared, which is what makes the proof above a proof about the rendered page and not only about the
    // arithmetic. The stage never scales below 1 at a width the design supports: the phone floor of 400 px leaves
    // about 342 px of stage for a 340-unit view (scale 1.01) and the wide geometry is at 1.03 by 1280 px.
    const plan = planGeometry(scenario, GEOMETRIES.phone, scenario.depots);
    const placed = overlayPlacements(plan, scenario);
    const targets = [
      ...AREA_ORDER.map((id) => ({ id: `area:${id}`, ...placed.areas[id].box })),
      ...scenario.depots.map((d) => ({ id: `depot:${d.id}`, ...placed.depots[d.id].plate })),
      ...scenario.routes.map((r) => ({ id: `route:${r.id}`, ...placed.routes[r.id].box })),
    ];
    // What the DOM actually covers at `scale`: the placed box grown about its centre to the 44 px target's size.
    const rendered = (b, scale) => {
      const grow = Math.max(0, TARGET_PX / scale - (b.x1 - b.x0)) / 2;
      const rise = Math.max(0, TARGET_PX / scale - (b.y1 - b.y0)) / 2;
      return { x0: b.x0 - grow, y0: b.y0 - rise, x1: b.x1 + grow, y1: b.y1 + rise };
    };
    for (const scale of [1, 1.01, 1.4, 2]) {
      for (const a of targets) {
        for (const b of targets) {
          if (a !== b) assert.ok(!overlaps(rendered(a, scale), rendered(b, scale)), `${a.id} overlaps ${b.id} at scale ${String(scale)}`);
        }
      }
    }
  });

  test("phone shields: the corridors' crossing is resolved by the scorer, measured and pinned", () => {
    const plan = planGeometry(scenario, GEOMETRIES.phone, scenario.depots);
    const placed = overlayPlacements(plan, scenario);
    const shields = scenario.routes.filter((r) => r.cls === "HIGHWAY").map((r) => ({ id: r.id, ...placed.routes[r.id].plate }));
    for (const a of shields) for (const b of shields) if (a !== b) assert.ok(!overlaps(a, b), `${a.id} and ${b.id} plates collide on the phone`);
    // Measured: H3, H4 and H6 stand beside their road; H1, H2 and H5 keep their line, where the corridors' crossing
    // and the tags leave nowhere beside it that clears every other target.
    const offLine = shields.filter((s) => placed.routes[s.id].off !== 0).map((s) => s.id).sort();
    assert.deepEqual(offLine, ["H3", "H4", "H6"]);
  });

  test("a local route's label shows its shield words on focus, and every route names its tooltip", () => {
    const { map } = drawn({ clock_s: 66600 });
    const local = overlayOf(map).querySelector('[data-focus-key="route:L2"]');
    assert.equal(local.getAttribute("aria-label"), "L2 · 110 min");
    assert.equal(local.getAttribute("aria-roledescription"), labels.MAP.localRoute);
    assert.equal(local.getAttribute("aria-describedby"), "fleetlab-map-tooltip");
    assert.ok(local.classList.contains("fl-iso__label--local"));
    const highway = overlayOf(map).querySelector('[data-focus-key="route:H2"]');
    assert.equal(highway.querySelector(".fl-iso__plate").textContent, "H2 · 55 min");
    assert.equal(highway.getAttribute("aria-roledescription"), labels.MAP.highwayRoute);
    highway.dispatchEvent(new PointerEvent("pointerenter"));
    const tooltip = map.element.querySelector(".fl-tooltip");
    assert.equal(tooltip.getAttribute("data-route"), "H2");
    assert.equal(tooltip.querySelector('[data-dir="SF>SJ"]').children[1].textContent, "Leaving now, D1 18:30: 77 min (55 min free-flow, slowed by your traffic profile)");
    highway.dispatchEvent(new PointerEvent("pointerleave"));
    assert.equal(tooltip.getAttribute("data-open"), "false");
  });
});

describe("picking, the pinned car and what is written when", () => {
  test("a click near a body names the car in the output with Inspect and Pin; far from one it says so; on a label it says so", () => {
    const calls = [];
    const { map, iso, model } = drawn({ clock_s: 66600, handlers: { onInspect: (t) => calls.push(["inspect", t]), onPin: (car) => calls.push(["pin", car]) } });
    const output = map.element.querySelector('output[data-role="pick"]');
    assert.equal(output.textContent, "");
    // A body with no other within twelve units, so the nearest body to the click is not a matter of convoy order.
    const groups = bodyGroups(model, iso.plan());
    const group = groups.find((g) => groups.every((o) => o === g || Math.hypot(o.x - g.x, o.y - g.y) > 12));
    assert.ok(group, "an isolated body at D1 18:30");
    const p = project(group.x, group.y, bodySize(iso.scale()).h / 2);
    const canvas = map.element.querySelector("canvas");
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.sx + 3, clientY: p.sy - 2 }));
    const car = model.onRoutes.find((c) => c.id === group.families[0].ids[0]);
    assert.ok(output.textContent.startsWith(labels.pickedCar({ car: car.id, state: labels.MAP.carStates[car.state] })), output.textContent);
    output.querySelector('[data-role="inspect-car"]').click();
    output.querySelector('[data-role="pin-car"]').click();
    assert.deepEqual(calls, [["inspect", { car: car.id }], ["pin", car.id]]);
    canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 2, clientY: 2 }));
    assert.equal(output.textContent, labels.MAP.pickNothing);
    assert.equal(output.querySelector("button"), null);
    overlayOf(map).querySelector('[data-focus-key="depot:SF-2"]').click();
    assert.equal(output.textContent, labels.pickedLabel("SF-2"));
  });

  test("the pinned plate follows its body on a route, sits on the block at a depot, and counts its stack", () => {
    const log = payload.log;
    const snap = log.snapshots[162];
    const onRoute = snap.cars.find((c) => c.leg !== undefined && frameModel({ scenario, log, frame: frameAt(log, snap.t), clock_s: snap.t }).onRoutes.some((r) => r.id === c.id));
    const { map, redraw } = drawn({ clock_s: snap.t, pinnedCar: onRoute.id });
    const plate = overlayOf(map).querySelector('[data-role="pinned"]');
    assert.equal(plate.hidden, false);
    assert.equal(plate.textContent, labels.carHere({ car: onRoute.id, state: labels.MAP.carStates[onRoute.state] }));
    // The plate is named as the flat picture names its pinned glyph (map.js drawPinned), so a reader who switches
    // pictures loses nothing: the isometric one is the only surface that reports the pinned car's stack.
    assert.equal(plate.getAttribute("role"), "img");
    assert.equal(plate.getAttribute("aria-hidden"), null, "an aria-hidden plate gives the pinned car no name at all");
    assert.equal(plate.getAttribute("aria-label"), labels.pinnedCarName({ car: onRoute.id, state: labels.MAP.carStates[onRoute.state] }));
    const first = plate.style.transform;
    assert.match(first, /^translate\(-?[\d.]+px, -?[\d.]+px\) translate\(-50%, -100%\)$/);
    redraw({ clock_s: snap.t + 120, frame: frameAt(log, snap.t + 120) });
    assert.notEqual(plate.style.transform, first, "the plate rides the body");
    const atDepot = snap.cars.find((c) => c.state === "IN_SERVICE");
    redraw({ pinnedCar: atDepot.id });
    assert.equal(plate.textContent, labels.carHere({ car: atDepot.id, state: labels.carStateText(atDepot) }));
    assert.equal(plate.getAttribute("aria-label"), labels.pinnedCarName({ car: atDepot.id, state: labels.carStateText(atDepot) }));
    const stacked = frameModel({ scenario, log, frame: frameAt(log, RECALL_S), clock_s: RECALL_S }).onRoutes;
    const counts = new Map();
    for (const c of stacked) counts.set(`${c.route}|${c.dir}|${String(c.fraction)}`, (counts.get(`${c.route}|${c.dir}|${String(c.fraction)}`) ?? 0) + 1);
    const inStack = stacked.find((c) => counts.get(`${c.route}|${c.dir}|${String(c.fraction)}`) > 1);
    redraw({ clock_s: RECALL_S, frame: frameAt(log, RECALL_S), pinnedCar: inStack.id });
    assert.equal(plate.textContent, labels.carHere({ car: inStack.id, state: labels.withOthers(counts.get(`${inStack.route}|${inStack.dir}|${String(inStack.fraction)}`) - 1) }));
    // In a stack the name carries the count too: the plate is the only surface that reports it.
    assert.equal(plate.getAttribute("aria-label"), labels.pinnedCarName({ car: inStack.id, state: labels.withOthers(counts.get(`${inStack.route}|${inStack.dir}|${String(inStack.fraction)}`) - 1) }));
    redraw({ pinnedCar: null });
    assert.equal(plate.hidden, true);
  });

  test("the canvas name and the numbers lines are written on a still frame only: 60 frames of play write nothing", () => {
    const log = payload.log;
    const start = log.snapshots[150].t;
    const { map, redraw } = drawn({ clock_s: start, still: true });
    const canvas = map.element.querySelector("canvas");
    const label = canvas.getAttribute("aria-label");
    const writes = [];
    const original = canvas.setAttribute.bind(canvas);
    canvas.setAttribute = (name, value) => {
      writes.push(name);
      original(name, value);
    };
    for (let i = 1; i <= 60; i += 1) redraw({ clock_s: start + i, frame: frameAt(log, start + i), still: false });
    assert.deepEqual(writes, []);
    assert.equal(canvas.getAttribute("aria-label"), label);
    redraw({ clock_s: start + 60, frame: frameAt(log, start + 60), still: true });
    assert.deepEqual(writes, ["aria-label"]);
    assert.equal(canvas.getAttribute("aria-label"), labels.isoLabel({ clock: format.clock(start + 60) }));
  });

  test("waiting riders ring the platform's front edge, at most eight, with the count written; unserved folds after ten minutes", () => {
    const log = payload.log;
    const at = log.requests.filter((r) => r.state === "UNSERVED").sort((a, b) => a.unserved_s - b.unserved_s)[0];
    const t = Math.ceil(at.unserved_s / 300) * 300;
    const { map, iso, model } = drawn({ clock_s: t, interpolate: false });
    const byArea = waitingByArea(log, scenario, model.at_s);
    for (const area of AREA_ORDER) {
      const node = overlayOf(map).querySelector(`[data-role="waiting"][data-area="${area}"]`);
      assert.equal(node.hidden, false);
      assert.equal(node.textContent, labels.waitingRiders(model.areas[area].waiting));
      assert.equal(byArea[area].length, Math.min(PLAN.ring.max, model.areas[area].waiting), `${area} rings`);
      for (const f of byArea[area]) assert.ok(f >= 0 && f <= 1);
    }
    assert.equal(iso.lastDraw().rings, AREA_ORDER.reduce((n, a) => n + byArea[a].length, 0));
    const unserved = overlayOf(map).querySelector(`[data-role="unserved"][data-area="${at.origin}"]`);
    assert.equal(unserved.hidden, false);
    assert.equal(unserved.textContent, labels.unservedCount(model.areas[at.origin].unservedRecent));
    assert.ok(unserved.classList.contains("fl-unserved"));
  });

  test("the rings stop at eight while the written count stays the true number of riders waiting", () => {
    // Measured across this replay, the most riders waiting in any one area at any snapshot is eight, exactly the cap,
    // so the demo world never exercises it. A log built for it does: twelve riders waiting in San Francisco at one
    // second. The drawing caps the rings it can place along a platform edge; the number beside them does not.
    const t0 = 66600;
    const depot = { id: "SF-2", area: "SF", parking: 30, cleaning_bays: 2, service_bays: 1 };
    const view = { id: "SF-2", stalls_held: 0, queue: 0, gate: 0, clean_busy: 0, service_busy: 0, blocked: 0, ready: 0 };
    const requests = Array.from({ length: 12 }, (_, i) => ({ id: `R-${String(i)}`, origin: "SF", dest: "PEN", time_s: t0 - 60 * (i + 1), assigned_s: null, unserved_s: null, state: "WAITING" }));
    const log = { seed: 1001, events: [], intervals: {}, visits: [], requests, cars: [], depots: [depot], snapshots: [{ t: t0, cars: [], depots: [view] }], drain_end_s: t0 + 7200 };
    const rings = waitingByArea(log, scenario, t0);
    assert.equal(rings.SF.length, PLAN.ring.max, "the drawing rings at most eight riders");
    // The eight ringed are the eight who have waited longest, each arc its own elapsed over the patience you set.
    assert.deepEqual(rings.SF, Array.from({ length: PLAN.ring.max }, (_, i) => Math.min(1, (60 * (12 - i)) / scenario.patience_s)));
    const { map, iso, model } = drawn({ clock_s: t0, log, scenario: { ...scenario, depots: [depot] }, interpolate: false });
    assert.equal(model.areas.SF.waiting, 12, "the model holds all twelve");
    assert.equal(overlayOf(map).querySelector('[data-role="waiting"][data-area="SF"]').textContent, labels.waitingRiders(12), "the written number is the true count, never the capped one");
    assert.equal(iso.lastDraw().rings, PLAN.ring.max, "and eight rings were drawn");
  });
});

describe("the banded rule against ribbon lengths, and the flat fallback", () => {
  test("nothing bands wide at the default fleet or the design 5.9 reference; the phone's short corridors are measured", async () => {
    const wide = planGeometry(scenario, GEOMETRIES.wide, scenario.depots);
    assert.equal(isoBandedDirections(peakConcurrency(payload.log), wide, FLOOR_UNITS_PER_CAR).size, 0);
    const reference = await referencePayload();
    const referenced = referenceScenario();
    assert.equal(isoBandedDirections(peakConcurrency(reference.log), planGeometry(referenced, GEOMETRIES.wide, referenced.depots), FLOOR_UNITS_PER_CAR).size, 0);
    const phone = planGeometry(scenario, GEOMETRIES.phone, scenario.depots);
    const peaks = peakConcurrency(payload.log);
    const banded = isoBandedDirections(peaks, phone, FLOOR_UNITS_PER_CAR);
    // The rule, direction by direction: a corridor shorter than three units a car at its busiest snapshot bands.
    for (const [key, cars] of peaks) {
      const length = ribbonLengths(phone)[key.slice(0, key.indexOf("|"))];
      assert.equal(banded.has(key), length < FLOOR_UNITS_PER_CAR * cars, `${key}: ${length.toFixed(0)} units for ${String(cars)} cars`);
    }
    // Measured on this payload: the 77-unit phone corridors H3 and H4 hold at most 20 cars a direction, so nothing bands.
    assert.deepEqual([...banded], []);
    const { map } = drawn({ clock_s: 66600, phone: true });
    assert.equal(map.element.querySelectorAll('[data-role="crowded-route"]').length, 0);
  });

  test("a canvas without a 2D context falls back to the flat picture and writes its reason", () => {
    const map = createMap({ view: "iso", isoView: createIsoView, context2d: () => null });
    document.body.appendChild(map.element);
    map.update({ scenario, log: payload.log, frame: frameAt(payload.log, 66600), clock_s: 66600, pinnedCar: null, seed: payload.log.seed });
    assert.equal(map.iso(), null);
    assert.equal(map.element.querySelector(".fl-iso"), null);
    assert.equal(map.element.querySelector('[data-role="view-status"]').textContent, labels.MAP.isoFallback);
    assert.equal(map.element.querySelector('[data-role="stage"]').hidden, false);
    assert.ok(map.svg.querySelectorAll('[data-layer="cars"] g[data-car]').length > 0, "the flat picture draws");
    assert.equal(map.element.querySelector('[data-role="view-group"]'), null, "no picture to switch to");
    map.destroy();
  });

  test("the backing store follows the CSS width, capped at 1,600 px wide, and the transform draws in view units", () => {
    const { map, iso, ctx, redraw } = drawn({ clock_s: 66600 });
    const canvas = map.element.querySelector("canvas");
    assert.equal(Number(canvas.getAttribute("width")), 640);
    assert.equal(Number(canvas.getAttribute("height")), 500);
    iso.resize({ cssWidth: 893, devicePixelRatio: 2 });
    assert.equal(Number(canvas.getAttribute("width")), 1600);
    assert.equal(Number(canvas.getAttribute("height")), 1250);
    ctx.reset();
    redraw({});
    const transform = ctx.calls.find((c) => c.name === "setTransform");
    assert.deepEqual(transform.args, [2.5, 0, 0, 2.5, 0, 0]);
    assert.ok(Math.abs(iso.scale() - 893 / 640) < 1e-9);
    const ground = ctx.calls.find((c) => c.name === "fillRect");
    assert.deepEqual(ground.args, [0, 0, 640, 500]);
    assert.ok(ground.fillStyle.toLowerCase() === LIGHT["--panel"].toLowerCase());
  });
});
