// Performance (contract 10, design 5.9 and 9.5). Deterministic proxies on the reference preset always run: work
// counters within bounds declared here with their arithmetic. Wall-clock budgets run only with FLEET_PLAYGROUND_PERF=1.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, runThroughWorkerHandler } from "./helpers/model-payloads.mjs";
import { bootstrapCi } from "../src/instrument/bootstrap.js";
import { start } from "../src/ui/app.js";
import { AREA_ORDER, CARS_PER_BLOCK, FAMILY_ORDER, frameModelCounts } from "../src/ui/map.js";
import { runToEnd } from "../src/model/engine.js";
import { experimentSteps, freezeSpec, runExperimentSpec } from "../src/model/experiment.js";
import { computeAll, computeSeries } from "../src/model/metrics.js";
import { seedSet } from "../src/model/presets.js";
import { applyAxis, defaultScenario } from "../src/model/schema.js";
import { buildWorld } from "../src/model/world.js";

const PERF = process.env.FLEET_PLAYGROUND_PERF === "1";

/** The design 5.9 reference preset: the Bay teaching map with 150 cars (SF 50, PEN 30, SJ 40, EB 30). */
function reference(sigma) {
  let s = defaultScenario();
  for (const [area, n] of [["SF", 50], ["PEN", 30], ["SJ", 40], ["EB", 30]]) s = applyAxis(s, `parameter:SUP-1.${area}`, n);
  s.sigma_permille = sigma;
  return s;
}

/** The frozen experiment of the design 5.9 budget: reference preset at σ 0.15, DEP-4 20 min to 15 min, 20 seeds, 2,000 resamples. */
function referenceSpec() {
  const base = reference(150);
  base.name = "reference_150";
  return freezeSpec({
    question: "Does a 15 minute clean instead of a 20 minute clean change rider wait p90?",
    scenario: base,
    axis: { id: "parameter:DEP-4", baseline: 1200, candidate: 900 },
    primary: { metric: "wait.p90_s", scope: {}, direction: "lower_is_better", margin_units: 30 },
    guardrails: [{ metric: "unserved.fraction", scope: {}, direction: "lower_is_better", max_harm_units: 20000 }],
    seed_set: 1,
    seeds: seedSet(1, 20),
    resamples: 2000,
  }).spec;
}

describe("deterministic work proxies on the reference preset (design 5.9)", () => {
  for (const sigma of [0, 150]) {
    test(`σ ${sigma / 1000}, seed 1001`, () => {
      const scenario = reference(sigma);
      const r = runToEnd(scenario, buildWorld(scenario, { seed: 1001 }), { seed: 1001, keepLogs: false });
      const c = r.counters;
      const R = r.requests.length;
      const V = r.visits.length;
      const C = r.cars.length;
      const D = r.depots.reduce((n, d) => n + d.diversions_s.length, 0);
      const assigned = r.requests.filter((q) => q.assigned_s !== null).length;

      // Requests: the window runs D1 05:00 to D2 10:00, 29 hours, of which 7 are peak (D1 7, 8, 16, 17, 18 and D2 7, 8).
      // Mean count: SF 7×60 + 22×15 = 750; PEN 7×20 + 22×8 = 316; SJ 7×35 + 22×10 = 465; EB 7×30 + 22×8 = 386; total 1,917.
      // A Poisson count this large has a standard deviation near sqrt(1917) ≈ 44; the bound allows about ±5 of them.
      assert.ok(R >= 1700 && R <= 2150, `requests ${R}`);

      // Heap pushes, by push site: each request pushes REQUEST_CREATED and WAIT_DEADLINE (2R), at most one
      // PICKUP_COMPLETED and one TRIP_COMPLETED (2R); each visit at most one INTAKE_COMPLETED and two SERVICE_COMPLETED
      // (3V); each depot leg one DEPOT_ARRIVED, at most V + C legs (a leg without a visit record is censored, one per
      // car at most), plus one per diversion (D); each car at most one REPOSITION_COMPLETED (C); and the recall, the
      // release and WINDOW_END (3). So pushes ≤ 4R + 4V + D + 2C + 3.
      assert.ok(c.heap_pushes <= 4 * R + 4 * V + D + 2 * C + 3, `pushes ${c.heap_pushes}, bound ${4 * R + 4 * V + D + 2 * C + 3}`);
      assert.ok(c.heap_pops <= c.heap_pushes, `pops ${c.heap_pops}`);
      // Every request pushes at least its creation and its deadline, and the three clock events exist.
      assert.ok(c.heap_pushes >= 2 * R + 3);

      // Dispatch scans only locations holding a dispatchable car: 4 area centres plus 4 depots, so at most 8 per
      // assignment (design 5.9), never one per car.
      assert.ok(c.dispatch_location_scans <= 8 * assigned, `scans ${c.dispatch_location_scans} for ${assigned} assignments`);
      assert.ok(c.dispatch_location_scans < C * assigned / 10, "far fewer than scanning every car");

      // A leg holds at most 4 segments (pull-out, access out, route or in-area, access in).
      assert.ok(c.segments <= 4 * c.legs, `segments ${c.segments} on ${c.legs} legs`);
      // Log entries: every pop logs at most one entry, and decisions add at most one assignment per request, one
      // diversion each, and per visit a stall claim and two task starts, plus the censoring entries (at most 2 per car).
      assert.ok(c.log_entries <= c.heap_pops + R + D + 3 * V + 2 * C, `log entries ${c.log_entries}`);
    });
  }
});

describe("wall-clock budgets of design 5.9 (FLEET_PLAYGROUND_PERF=1)", { skip: PERF ? false : "set FLEET_PLAYGROUND_PERF=1" }, () => {
  test("one Sandbox run of the reference preset, world to charts, at most 500 ms", () => {
    const scenario = reference(150);
    const t0 = performance.now();
    const r = runToEnd(scenario, buildWorld(scenario, { seed: 1002 }), { seed: 1002, keepLogs: true });
    computeAll(r);
    computeSeries(r, scenario);
    const ms = performance.now() - t0;
    assert.ok(ms <= 500, `${ms.toFixed(1)} ms`);
  });

  test("an experiment of 20 seeds × 2 arms on the reference preset, at most 10 s", () => {
    const spec = referenceSpec();
    const t0 = performance.now();
    const out = runExperimentSpec(spec);
    const ms = performance.now() - t0;
    assert.equal(out.per_seed.length, 20);
    assert.ok(ms <= 10000, `${ms.toFixed(0)} ms`);
  });

  test("experimentSteps on the reference preset: every gap between next() calls at most 8 ms after one warm-up (design 5.9, contract 7)", (t) => {
    const spec = referenceSpec();
    // Warm-up: builds the sigma 150 tables (memoized) and compiles the hot paths. A cold first experiment still pays
    // for the table build in one step of its own.
    const warm = runExperimentSpec(spec);
    const steps = experimentSteps(spec);
    // Each gap also records this process's CPU time (all threads, so garbage collector and compiler helper threads can
    // push it above the wall time): a gap far above its CPU time means the machine preempted the process under another
    // load, not that one step did too much work. The budget is on wall time all the same.
    let largest = { ms: 0, cpuMs: 0, label: "" };
    let yields = 0;
    let out;
    let before = performance.now();
    let cpuBefore = process.cpuUsage();
    for (;;) {
      const next = steps.next();
      const after = performance.now();
      const cpuAfter = process.cpuUsage(cpuBefore);
      if (after - before > largest.ms) {
        largest = { ms: after - before, cpuMs: (cpuAfter.user + cpuAfter.system) / 1000, label: next.done ? "the return" : next.value.label };
      }
      before = performance.now();
      cpuBefore = process.cpuUsage();
      if (next.done) {
        out = next.value;
        break;
      }
      yields += 1;
    }
    const text = `largest gap ${largest.ms.toFixed(2)} ms (process CPU ${largest.cpuMs.toFixed(2)} ms), ending at ${largest.label}, over ${yields} yields`;
    t.diagnostic(text);
    assert.deepEqual(out, warm, "slicing never changes the payload");
    assert.ok(largest.ms <= 8, text);
  });

  test("a bootstrap of 2,000 resamples over 20 deltas, at most 100 ms", () => {
    const deltas = Array.from({ length: 20 }, (_, i) => (i * 37) % 11 - 5 + i / 8);
    const t0 = performance.now();
    bootstrapCi(deltas, 2000, "ab".repeat(32));
    const ms = performance.now() - t0;
    assert.ok(ms <= 100, `${ms.toFixed(1)} ms`);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// What one drawn frame costs (design 5.9). The budget is "a frame <= 8 ms with 150 cars drawn", and a frame is style,
// layout, paint and composite. None of those exist under node --test, so nothing below is called a frame cost: these
// are deterministic work proxies, what one frame asks of the model and of the DOM before a pixel is touched, each
// bound with its arithmetic. The whole-frame measurement is a browser gate, run in a window that reports
// document.hidden === false; a number measured here, or on any fake DOM, is JavaScript and layout, never a frame.

/** Fleet sizes drawn: the default preset, the design 5.9 reference, and the largest SUP-1 allows (5.9 records it). */
const FLEETS = Object.freeze([120, 150, 500]);

/** The scenario of a fleet size; 120 is the preset's own. */
function fleetScenario(cars) {
  const sizes = { 150: { SF: 50, PEN: 30, SJ: 40, EB: 30 }, 500: { SF: 200, PEN: 100, SJ: 120, EB: 80 } };
  let scenario = presetScenario();
  for (const [area, n] of Object.entries(sizes[cars] ?? {})) scenario = applyAxis(scenario, `parameter:SUP-1.${area}`, n);
  return scenario;
}

/**
 * The whole page on a fake DOM at desktop width, showing one replication of `cars` cars at D1 18:15, the busiest hour
 * of the run. The log is wrapped so reads of `log.snapshots` can be counted: `frameAt` makes exactly two per frame it
 * builds (one in `snapshotIndex`, one for the snapshot itself), so those reads stand for frames taken from the log.
 */
async function drawnPage(cars) {
  const { payload } = await runThroughWorkerHandler({ type: "run_window", scenario: fleetScenario(cars), seeds: [1001], logSeed: 1001 });
  const reads = { snapshots: 0 };
  const log = new Proxy(payload.log, {
    get(target, key, receiver) {
      if (key === "snapshots") reads.snapshots += 1;
      return Reflect.get(target, key, receiver);
    },
  });
  const uninstall = installFakeDom(globalThis, { media: { "(min-width: 1280px)": true, "(min-width: 768px)": true } });
  const doc = uninstall.dom.document;
  const root = doc.createElement("div");
  root.setAttribute("id", "fleetlab-root");
  const strip = doc.createElement("div");
  strip.setAttribute("id", "fleetlab-teaching-strip");
  root.appendChild(strip);
  doc.body.appendChild(root);
  const app = start({ createWorker: () => null });
  app.store.dispatch({ type: "run/queued", id: "w", total: 1 });
  app.store.dispatch({ type: "run/done", id: "w", payload: { ...payload, log } });
  const busy = payload.log.snapshots[0].t + 47700;
  app.store.dispatch({ type: "clock/set", clock_s: busy });
  return { app, fleet: payload.log.cars.length, busy, reads, map: app.regions.map, close: () => { app.destroy(); uninstall(); } };
}

/** One frame in ten of a measured window announces, so the announcer, the third reader of the model, is measured too. */
const ANNOUNCE_EVERY = 10;

/**
 * Advances the clock one second at a time for `frames` frames and counts what each frame cost: models computed and
 * handed on, attribute writes, child replacements, and reads of the log. The window is synchronous, so no idle work
 * the page schedules for itself can land inside it. It holds both kinds of frame the page draws, ordinary and
 * announcing, because the announcer asks for the frame's model on its own and only an announcing frame runs it.
 */
function costOfFrames(page, frames) {
  const element = globalThis.Element.prototype;
  const node = globalThis.Node.prototype;
  const original = { setAttribute: element.setAttribute, replaceChildren: node.replaceChildren };
  const writes = { attributes: 0, replacements: 0 };
  element.setAttribute = function setAttribute(...args) {
    writes.attributes += 1;
    return original.setAttribute.apply(this, args);
  };
  node.replaceChildren = function replaceChildren(...args) {
    writes.replacements += 1;
    return original.replaceChildren.apply(this, args);
  };
  const before = { computed: frameModelCounts.computed, reused: frameModelCounts.reused, snapshots: page.reads.snapshots };
  const t0 = performance.now();
  try {
    // A reduced-motion step is a clock/set tagged "step", and it is the one action here that also announces. Plain
    // clock/set frames alone would leave the announcer's call site unmeasured, free to take a frame of its own.
    for (let i = 1; i <= frames; i += 1) {
      page.app.store.dispatch({ type: "clock/set", clock_s: page.busy + i, reason: i % ANNOUNCE_EVERY === 0 ? "step" : undefined });
    }
  } finally {
    element.setAttribute = original.setAttribute;
    node.replaceChildren = original.replaceChildren;
  }
  const ms = performance.now() - t0;
  const per = (n) => n / frames;
  return {
    models: per(frameModelCounts.computed - before.computed),
    reused: per(frameModelCounts.reused - before.reused),
    snapshotReads: per(page.reads.snapshots - before.snapshots),
    attributes: per(writes.attributes),
    replacements: per(writes.replacements),
    ms: per(ms),
  };
}

/**
 * Attribute writes one frame may make. A frame writes only where a number moved, and one of those numbers is now the
 * place of every car driving a route: the map draws one mark per driving car and moves each with one composed
 * transform, written only when its rounded place has changed. Measured over the 60 frames from D1 18:15: 255.9 a
 * frame at 120 cars, where about 102 marks are moving, then 198.4 at 150 and 188.4 at 500, where more of the fleet is
 * standing in an area or parked. The bound keeps its teeth at that shape: two writes a mark would land near 360.
 */
const ATTRIBUTE_WRITES_PER_FRAME = 320;

/** Child replacements one frame may make: a guard that missed and rebuilt a bar row, a band or the table twin. */
const REPLACEMENTS_PER_FRAME = 12;

describe("what one drawn frame costs (design 5.9)", () => {
  test("one model and one frame per page frame, and a drawing that does not grow with the fleet", async (t) => {
    const rows = [];
    for (const cars of FLEETS) {
      const page = await drawnPage(cars);
      try {
        const cost = costOfFrames(page, 60);
        const where = `${cars} cars`;

        // The map, the NOW panel and the announcer draw one second between them, so one frame computes one model.
        // The announcing frames of the window have that third reader, so the mean handed on stands above one.
        assert.equal(cost.models, 1, `${where}: models computed per frame`);
        assert.ok(cost.reused > 1, `${where}: ${cost.reused} regions were handed the model instead of computing it`);

        // Two readers touch the log on a frame: the one frameAt (twice, snapshotIndex and the snapshot) and the
        // closed inspector's own snapshotAt (twice). Two frames taken would be six reads, and three would be eight.
        // An announcer taking a frame of its own would add two reads on every tenth frame, landing the mean at 4.2.
        assert.ok(cost.snapshotReads <= 4, `${where}: ${cost.snapshotReads} reads of log.snapshots per frame`);

        // A frame writes attributes only where a number moved: nothing is rebuilt while the guards hold.
        assert.ok(cost.attributes <= ATTRIBUTE_WRITES_PER_FRAME, `${where}: ${cost.attributes} attribute writes per frame`);
        assert.ok(cost.replacements <= REPLACEMENTS_PER_FRAME, `${where}: ${cost.replacements} child replacements per frame`);

        // The drawing itself: the schematic and its tooltip, without the legend and the table twin beside them.
        const nodes = page.map.querySelectorAll('[data-role="stage"] *').length;
        rows.push({ cars, fleet: page.fleet, nodes, ...cost });
      } finally {
        page.close();
      }
    }
    for (const r of rows) {
      t.diagnostic(
        `${String(r.cars).padStart(3)} cars (fleet ${String(r.fleet).padStart(3)}): model ${r.models}, handed on ${r.reused}, ` +
        `log.snapshots reads ${r.snapshotReads}, ${r.attributes.toFixed(1)} attribute writes, ${r.replacements.toFixed(2)} replacements, ` +
        `${r.nodes} nodes, ${r.ms.toFixed(3)} ms of JavaScript (not a frame cost)`,
      );
    }
    // The drawing grows with the fleet, because a unit bar draws one block per five cars; it grows far below one node
    // per car. A block is at most two rects (the under-3:1 families carry an ink edge), so five more cars add at most
    // two more nodes, and each of the four rows in each of the four yards may hold one partial block of its own.
    const first = rows[0];
    const last = rows[rows.length - 1];
    const added = last.fleet - first.fleet;
    const ceiling = (2 * added) / CARS_PER_BLOCK + 2 * AREA_ORDER.length * FAMILY_ORDER.length;
    assert.ok(
      last.nodes - first.nodes <= ceiling,
      `${String(added)} more cars added ${String(last.nodes - first.nodes)} nodes, against a ceiling of ${String(ceiling)}`,
    );
    assert.ok(last.nodes - first.nodes < added, "the map never draws one node per car");
  });
});

describe("wall clock of the drawn page, JavaScript only (FLEET_PLAYGROUND_PERF=1)", { skip: PERF ? false : "set FLEET_PLAYGROUND_PERF=1" }, () => {
  test("one page frame at the reference preset, model and DOM writes only, at most 2 ms", async (t) => {
    const page = await drawnPage(150);
    try {
      const cost = costOfFrames(page, 120);
      t.diagnostic(`${cost.ms.toFixed(3)} ms per frame of JavaScript and fake-DOM writes; this is not a frame cost`);
      // Not the design 5.9 budget: no style, layout, paint or composite happens here. The 8 ms budget is settled in a
      // browser, on a window that paints. This bound only catches the drawing growing by an order of magnitude.
      assert.ok(cost.ms <= 2, `${cost.ms.toFixed(3)} ms per frame`);
    } finally {
      page.close();
    }
  });
});
