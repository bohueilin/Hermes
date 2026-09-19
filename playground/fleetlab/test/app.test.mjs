// The integrated interface (src/ui/app.js, contract section 8, design §7): start() on the fake DOM mounts every region
// against one store, Run window runs through the engine host, the fork and a verdict seed run both arms on one world,
// and the design §7.7 states render with their labels. A fake host decides when each run settles; the payloads it
// returns are real, from test/helpers/model-payloads.mjs.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { percentileFleetLab } from "../src/core/stats.js";
import { armScenarios, experimentEnvelope } from "../src/model/experiment.js";
import { seedSet } from "../src/model/presets.js";
import { sharedLambdaMaxPermille } from "../src/model/world.js";
import { tabbables } from "../src/ui/a11y.js";
import { REGION_IDS, ROW_CHARTS, SANDBOX_REPLICATIONS, start } from "../src/ui/app.js";
import { depotView } from "../src/ui/inspector.js";
import { frameAt } from "../src/ui/playback.js";
import { beatAt } from "../src/ui/present.js";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import { experimentPayload, frozenExperiment, ops01Payload, pairPayload, windowPayload } from "./helpers/model-payloads.mjs";

const BANNED_WORDS = /\b(predict|forecast|live|real-time|realtime|real time|monitoring)\b|expected traffic/i;
const H6_WORDS = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const DASHES = /[\u2013\u2014]/; // en dash, em dash

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** An engine host whose runs settle only when the test resolves or rejects them; it records every call and cancel. */
function createFakeHost(path = "worker") {
  const calls = [];
  const cancelled = [];
  const submit = (type) => (args, options = {}) => {
    let settle;
    const promise = new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
    promise.id = `run-${String(calls.length + 1)}`;
    calls.push({ type, args, options, id: promise.id, ...settle });
    return promise;
  };
  return {
    path,
    ready: Promise.resolve(path),
    calls,
    cancelled,
    runWindow: submit("run_window"),
    runPair: submit("run_pair"),
    runExperiment: submit("run_experiment"),
    cancel(id) {
      for (const call of id === undefined ? calls : calls.filter((c) => c.id === id)) {
        cancelled.push(call.id);
        const error = new Error("cancelled");
        error.name = "AbortError";
        call.reject(error);
      }
    },
    last(type) {
      return calls.filter((c) => c.type === type).at(-1);
    },
  };
}

/** The development shell's body on the full fake DOM at desktop width, with start() run against it. */
function mount({ host = createFakeHost(), copyText = null, studio = false, media = { "(min-width: 1280px)": true, "(min-width: 768px)": true } } = {}) {
  const uninstall = installFakeDom(globalThis, { media });
  const { document: doc } = uninstall.dom;
  const root = doc.createElement("div");
  root.setAttribute("id", "fleetlab-root");
  const strip = doc.createElement("div");
  strip.setAttribute("id", "fleetlab-teaching-strip");
  root.appendChild(strip);
  doc.body.appendChild(root);
  const app = start({ createWorker: () => null, engineHost: host, copyText, studio });
  const find = (selector) => root.querySelector(selector);
  const buttonNamed = (text, within = root) => within.querySelectorAll("button").find((b) => b.textContent === text);
  const cleanup = () => {
    app.destroy();
    uninstall();
  };
  return { doc, root, app, host, store: app.store, find, buttonNamed, cleanup };
}

/** Runs `fn(ctx)` on a fresh mount and always cleans up. */
async function withApp(options, fn) {
  const ctx = mount(options);
  try {
    return await fn(ctx);
  } finally {
    ctx.cleanup();
  }
}

/** Starts Run window and settles it with the real run_window payload for the seeds the app asked for. */
async function finishWindow(ctx, transform = (payload) => payload) {
  const settled = ctx.app.runWindow();
  const call = ctx.host.last("run_window");
  call.resolve(transform(await windowPayload({ seeds: call.args.seeds, logSeed: call.args.logSeed })));
  await settled;
  return call;
}

const rowValues = (container) => container.querySelectorAll("[data-row]").map((row) => [row.getAttribute("data-row"), row.querySelector('[data-role="value"]').textContent]);
const chartIds = (container) => container.querySelectorAll("figure[data-chart]").map((f) => f.getAttribute("data-chart"));

describe("start mounts the interface", () => {
  test("studio navigation preserves an edited experiment and follows the presenter exit", () =>
    withApp({ studio: true }, ({ app, root, store, host }) => {
      assert.equal(root.hidden, true);
      app.studio.navigate("depots");
      assert.ok(root.children.indexOf(app.regions.charts) < root.children.indexOf(app.regions.map));
      store.dispatch({ type: "experiment/draft", patch: { question: "Does this capacity change affect the rider?" } });
      const experiment = store.getState().experiment;
      const scenario = store.getState().scenario;
      app.studio.navigate("approach");
      app.studio.navigate("depots");
      assert.equal(store.getState().experiment, experiment);
      assert.equal(store.getState().scenario, scenario);
      assert.equal(host.calls.length, 0, "navigation never runs the simulation");
      app.studio.navigate("tour");
      assert.equal(store.getState().present.on, true);
      assert.ok(root.children.indexOf(app.regions.rail) < root.children.indexOf(app.regions.map));
      app.present.close();
      assert.equal(app.studio.element.getAttribute("data-page"), "operations");
      assert.equal(store.getState().mode, "sandbox");
      assert.equal(root.hidden, false);
      assert.ok(root.children.indexOf(app.regions.map) < root.children.indexOf(app.regions.charts));
    }));

  test("every region is filled in design 7.7 order before anything runs", () =>
    withApp({}, ({ root, app, find, buttonNamed, store }) => {
      assert.deepEqual(root.children.map((n) => n.getAttribute("class").split(" ")[0]), ["fl-strip", "fl-topbar", "fl-knobs", "fl-map", "fl-ledger", "fl-rail", "fl-transport", "fl-segmented", "fl-side", "fl-charts", "fl-drawer", "fl-footer"]);
      for (const id of REGION_IDS) assert.ok(app.regions[id].children.length > 0, `${id} holds content`);
      assert.equal(root.getAttribute("data-mode"), "sandbox");
      const modes = find(".fl-modes").querySelectorAll("button");
      assert.deepEqual(modes.map((b) => b.textContent), ["Learn", "Sandbox", "Experiment"].map((_, i) => labels.MODES[["learn", "sandbox", "experiment"][i]].name));
      assert.deepEqual(modes.map((b) => b.getAttribute("aria-pressed")), ["false", "true", "false"]);
      assert.equal(find('[data-role="top-status"]').textContent, "D1 05:00");
      assert.ok(buttonNamed(labels.KNOB_PANEL.runWindow, app.regions.knobs));
      assert.ok(app.regions.map.querySelector("svg"), "the static map is drawn");
      assert.ok(buttonNamed(labels.PLAYBACK.play, app.regions.transport));
      const notRun = labels.absentValue(labels.ABSENT_REASONS.notRunYet);
      // Changed with G4: before any run each panel shows one state line and no rows, where it repeated notRun on every row.
      assert.deepEqual([...rowValues(app.regions.now), ...rowValues(app.regions.across)], []);
      for (const role of ["now-state", "across-state"]) {
        assert.equal(find(`[data-role="${role}"]`).hidden, false);
        assert.equal(find(`[data-role="${role}"]`).textContent, notRun);
      }
      assert.equal(find('[data-role="across-chip"]').hidden, true, "no replication count before a run");
      assert.equal(find('[data-role="charts-absent"]').textContent, notRun);
      assert.equal(find('[data-role="engine-path"]').textContent, labels.enginePath("worker"));
      assert.equal(store.getState().engine.path, "worker", "the host's path reaches the store at once");
      assert.equal(find('[data-role="run-status"]').children.length, 0);
    }));

  test("the map region mounts the isometric picture, and on a document without a 2D canvas keeps the flat one and says why", () =>
    withApp({}, ({ app, find, store }) => {
      // The fake DOM's canvas has no getContext, which is the browser-without-canvas case the page must survive.
      assert.equal(find('[data-role="view-status"]').hidden, false);
      assert.equal(find('[data-role="view-status"]').textContent, labels.MAP.isoFallback);
      assert.equal(find('[data-role="view-group"]'), null);
      assert.ok(app.regions.map.querySelector("svg"), "the flat picture is drawn");
      assert.equal(find('[data-role="world-line"]').textContent, labels.worldLine({ name: "Bay teaching map", changes: 0 }));
      store.dispatch({ type: "knob/set", knob: "SUP-1.SJ", path: ["areas", 2, "cars"], value: 16 });
      assert.equal(find('[data-role="world-line"]').textContent, labels.worldLine({ name: "Bay teaching map", changes: 1 }));
    }));

  test("the knob sheet handle sits in the top bar, outside the knobs sheet", () =>
    withApp({}, ({ app }) => {
      const toggle = app.regions.topbar.querySelector(".fl-knobs-toggle");
      assert.ok(toggle);
      assert.equal(toggle.getAttribute("aria-controls"), app.regions.knobs.getAttribute("id"));
    }));

  test("with no engine host given, start builds one from the worker factory and records its path", () => {
    const uninstall = installFakeDom();
    try {
      const root = document.createElement("div");
      root.setAttribute("id", "fleetlab-root");
      const strip = root.appendChild(document.createElement("div"));
      strip.setAttribute("id", "fleetlab-teaching-strip");
      document.body.appendChild(root);
      let made = 0;
      const app = start({ createWorker: () => { made += 1; throw new Error("workers are blocked here"); } });
      assert.equal(made, 1);
      assert.equal(app.host.path, "main thread");
      assert.equal(app.store.getState().engine.path, "main thread");
      assert.equal(root.querySelector('[data-role="engine-path"]').textContent, labels.enginePath("main thread"));
      app.destroy();
    } finally {
      uninstall();
    }
  });
});

describe("Run window", () => {
  for (const interruption of ["pause", "navigate back", "switch modes", "edit", "seek", "step", "jump"]) {
    test(`a pending studio Run window respects ${interruption}`, () =>
      withApp({studio:true},async ctx=>{
        ctx.app.studio.navigate("operations");
        const pending=ctx.app.runWindow();const call=ctx.host.last("run_window");
        if(interruption==="pause")ctx.app.playback.pause();
        if(interruption==="seek")ctx.app.playback.seek(ctx.store.getState().scenario.window.start_s+60);
        if(interruption==="step")ctx.app.playback.step("5min",1);
        if(interruption==="jump")ctx.app.playback.jump("am_peak");
        if(interruption==="navigate back"){ctx.app.studio.navigate("overview");ctx.app.studio.navigate("operations");}
        if(interruption==="switch modes")ctx.app.studio.navigate("depots");
        if(interruption==="edit")ctx.store.dispatch({type:"knob/set",knob:"SUP-1.SJ",path:["areas",2,"cars"],value:16});
        call.resolve(await windowPayload({seeds:call.args.seeds,logSeed:call.args.logSeed}));await pending;
        assert.equal(ctx.store.getState().playing,false);
      }));
  }
  test("studio Run window starts the replay and navigation cancels pending autoplay", () =>
    withApp({ studio: true }, async (ctx) => {
      ctx.app.studio.navigate("operations");
      await finishWindow(ctx);
      assert.equal(ctx.store.getState().playing, true);
      ctx.app.playback.pause();
      const pending=ctx.app.runWindow();
      const call=ctx.host.last("run_window");
      ctx.app.studio.navigate("overview");
      call.resolve(await windowPayload({seeds:call.args.seeds,logSeed:call.args.logSeed}));
      await pending;
      assert.equal(ctx.store.getState().playing,false);
    }));

  test(`runs ${String(SANDBOX_REPLICATIONS)} replications of seed set 1 through the host, with progress, then fills every region`, () =>
    withApp({}, async (ctx) => {
      const { app, host, find, buttonNamed, store } = ctx;
      buttonNamed(labels.KNOB_PANEL.runWindow, app.regions.knobs).click();
      const call = host.last("run_window");
      assert.deepEqual(call.args.seeds, seedSet(1, SANDBOX_REPLICATIONS));
      assert.equal(call.args.logSeed, 1001);
      assert.deepEqual(call.args.scenario, store.getState().scenario);
      assert.equal(find('[data-role="progress"]').textContent, labels.STATES.queued);
      call.options.onProgress({ done: 2, total: 5, label: "ignored" });
      assert.equal(find('[data-role="progress"]').textContent, labels.replicationProgress(3, 5));
      assert.ok(buttonNamed(labels.STATES.cancel, app.regions.map));

      call.resolve(await windowPayload({ seeds: call.args.seeds, logSeed: 1001 }));
      await tick();
      assert.equal(store.getState().run.status, "done");
      assert.equal(find('[data-role="run-status"]').children.length, 0);
      assert.equal(find('[data-role="top-status"]').textContent, labels.topBarStatus({ clock: "D1 05:00", replay: 1, replays: 5, seed: 1001 }));
      assert.equal(find('[data-role="now-chip"]').textContent, labels.thisReplayChip(1001));
      assert.equal(find('[data-role="now-state"]').hidden, true, "the state line gives way to the rows");
      assert.equal(find('[data-role="across-state"]').hidden, true);
      const now = rowValues(app.regions.now);
      assert.deepEqual(now.map(([key]) => key), ["waiting", "unserved", "lot:SF-1", "lot:SF-2", "lot:SJ-1", "lot:EB-1", "highways"]);
      for (const [key, value] of now) assert.ok(!value.startsWith(labels.ABSENT_PREFIX), `${key} has a value from this replay`);
      assert.match(now.find(([key]) => key === "lot:SJ-1")[1], /^\d+\/30$/);
      assert.equal(find('[data-role="across-chip"]').hidden, false);
      assert.equal(find('[data-role="across-chip"]').textContent, labels.acrossReplicationsChip(5));
      // Changed with G7: the default preset runs at sigma 0, so every seed builds the same world and the 5 replications
      // give identical metrics (wait p90 1968 s, 1968 / 60 = 32.8, shown 33 min; unserved 0.0050139, shown 0.5%). A range
      // whose ends match now reads as one value in every replication instead of "33 min to 33 min".
      const summaries = store.getState().run.summaries;
      for (const key of ["wait.p90_s", "unserved.fraction"]) assert.ok(summaries.every((s) => s.metrics[key].value === summaries[0].metrics[key].value), `${key} is identical across replications at sigma 0`);
      for (const [key, value] of rowValues(app.regions.across)) assert.match(value, / in every replication/, `${key} reads one value across identical replications`);
      assert.equal(find('[data-role="across-table"]').querySelectorAll("tbody tr").length, 5);
      // The Table toggle shows and hides the numeric twin of the across-replications values.
      const acrossTable = find('[data-role="across-table"]');
      const acrossToggle = find('[data-role="across-table-toggle"]');
      assert.equal(acrossTable.hidden, true, "the table starts hidden");
      assert.equal(acrossToggle.getAttribute("aria-pressed"), "false");
      acrossToggle.click();
      assert.equal(acrossTable.hidden, false);
      assert.equal(acrossToggle.getAttribute("aria-pressed"), "true");
      acrossToggle.click();
      assert.equal(acrossTable.hidden, true);
      assert.equal(acrossToggle.getAttribute("aria-pressed"), "false");
      assert.deepEqual(chartIds(find('[data-role="sandbox-charts"]')), ["fleet_state", ...ROW_CHARTS]);
      assert.deepEqual(chartIds(find('[data-role="strips"]')), ["demand_by_hour", "traffic_by_hour"]);
    }));

  test("the chart cursors follow the clock", () =>
    withApp({}, async (ctx) => {
      await finishWindow(ctx);
      const cursors = () => ctx.find('[data-role="sandbox-charts"]').querySelectorAll('[data-role="cursor"]');
      ctx.store.dispatch({ type: "clock/set", clock_s: 40000 });
      const first = cursors().map((c) => c.getAttribute("transform"));
      assert.ok(cursors().some((c) => c.getAttribute("visibility") === "visible"));
      ctx.store.dispatch({ type: "clock/set", clock_s: 60000 });
      assert.notDeepEqual(cursors().map((c) => c.getAttribute("transform")), first);
    }));

  test("a new run while one computes cancels it and keeps the previous result, desaturated; Cancel keeps it too", () =>
    withApp({}, async (ctx) => {
      const { app, host, find, buttonNamed, store } = ctx;
      await finishWindow(ctx);
      app.runWindow();
      const second = host.last("run_window");
      assert.ok(app.regions.now.classList.contains("fl-stale"), "the previous result is desaturated while computing");
      assert.equal(chartIds(find('[data-role="sandbox-charts"]')).length, 4, "the previous charts stay");
      app.runWindow();
      const third = host.last("run_window");
      assert.deepEqual(host.cancelled, [second.id]);
      buttonNamed(labels.STATES.cancel, app.regions.map).click();
      assert.deepEqual(host.cancelled, [second.id, third.id]);
      await tick();
      assert.equal(store.getState().run.status, "cancelled");
      assert.equal(find('[data-role="cancelled"]').textContent, labels.STATES.cancelled);
      assert.equal(app.regions.now.classList.contains("fl-stale"), false);
      assert.equal(chartIds(find('[data-role="sandbox-charts"]')).length, 4);
    }));

  test("an engine failure shows the stopped state, and Retry runs the window again", () =>
    withApp({}, async (ctx) => {
      const { app, host, find, buttonNamed } = ctx;
      app.runWindow();
      host.last("run_window").reject(new Error("the engine worker stopped"));
      await tick();
      assert.equal(find('[data-role="engine-stopped"] p').textContent, labels.STATES.engineStopped);
      buttonNamed(labels.STATES.retry, app.regions.map).click();
      assert.equal(host.calls.filter((c) => c.type === "run_window").length, 2);
      assert.equal(find('[data-role="progress"]').textContent, labels.STATES.queued);
    }));

  test("a run that breaks an invariant is void: the rule is named, nothing is shown, Copy details copies the violation", () => {
    const copied = [];
    return withApp({ copyText: async (text) => copied.push(text) }, async (ctx) => {
      const { app, find, buttonNamed } = ctx;
      const violation = "2: SF-001 was assigned r-SF-4 while serving r-SF-3";
      await finishWindow(ctx, (payload) => ({ ...payload, runs: payload.runs.map((r, i) => (i === 1 ? { ...r, invariant_violations: [violation] } : r)) }));
      assert.equal(find('[data-role="invariant-failure"] p').textContent, labels.invariantFailure({ rule: labels.INVARIANT_RULES[2], id: 2 }));
      assert.deepEqual(chartIds(app.regions.charts), [], "no chart of a void run");
      assert.equal(find('[data-role="charts-absent"]'), null);
      const voidText = labels.absentValue(labels.ABSENT_REASONS.voidRun);
      // Review: since G4 a panel can hold no rows, and the loop below then checks nothing. A void run shows every row
      // (waiting, unserved, one lot per depot, highways; wait and unserved across replications) and no before-run line.
      const depots = ctx.store.getState().scenario.depots.length;
      assert.equal(rowValues(app.regions.now).length, 3 + depots, "every NOW row is shown for a void run");
      assert.equal(rowValues(app.regions.across).length, 2, "both rows across replications are shown for a void run");
      assert.equal(find('[data-role="now-state"]').hidden, true, "a void run is not the before-run state");
      assert.equal(find('[data-role="across-state"]').hidden, true, "a void run did run");
      for (const [, value] of [...rowValues(app.regions.now), ...rowValues(app.regions.across)]) assert.equal(value, voidText);
      buttonNamed(labels.STATES.copyDetails, app.regions.map).click();
      await tick();
      assert.deepEqual(copied, [violation]);
      assert.equal(find('[data-role="copy-status"]').textContent, labels.VERDICT.copied);
    });
  });

  test("an unknown invariant id still reads as a model rule failure", () =>
    withApp({}, async (ctx) => {
      await finishWindow(ctx, (payload) => ({ ...payload, runs: payload.runs.map((r, i) => (i === 0 ? { ...r, invariant_violations: ["Q9: new check"] } : r)) }));
      assert.equal(ctx.find('[data-role="invariant-failure"] p').textContent, labels.invariantFailure({ rule: labels.STATES.unknownRule, id: "Q9" }));
      assert.ok(ctx.buttonNamed(labels.STATES.copyDetails, ctx.app.regions.map).disabled, "no clipboard, no copy");
    }));
});

describe("the fork (design D-10)", () => {
  test("without a knob change it asks for one; after a change lanes A and B run on one world for the pinned car", () =>
    withApp({}, async (ctx) => {
      const { app, host, find, buttonNamed, store, root } = ctx;
      await finishWindow(ctx);
      assert.equal(app.openFork("SJ-001"), null);
      const fork = find('[data-role="fork"]');
      assert.equal(fork.hidden, false);
      assert.equal(find('[data-role="fork-needs-change"]').textContent, labels.FORK.needsChange);
      assert.equal(host.calls.filter((c) => c.type === "run_pair").length, 0);
      buttonNamed(labels.FORK.close, fork).click();
      assert.equal(fork.hidden, true);

      store.dispatch({ type: "knob/set", knob: "SUP-1.SJ", path: ["areas", 2, "cars"], value: 16 });
      const settled = app.openFork("SJ-001");
      const call = host.last("run_pair");
      // SJ default 32 since the SUP-1 recalibration (120 cars at 5:3:4:3); it was 24.
      assert.equal(call.args.baseline.areas[2].cars, 32, "lane A undoes the last change");
      assert.equal(call.args.candidate.areas[2].cars, 16, "lane B keeps it");
      assert.equal(call.args.seed, 1001, "the fork runs on the watched replay's seed");
      assert.deepEqual(call.args.lambdaMaxPermille, sharedLambdaMaxPermille([call.args.baseline, call.args.candidate]));
      assert.equal(find('[data-role="fork-running"]').textContent, labels.FORK.running);
      assert.equal(fork.querySelectorAll('[data-role="fork-caption"]').length, 0, "the caption waits for the two runs it describes");
      assert.equal(store.getState().fork.pinnedCar, "SJ-001");

      call.resolve(await pairPayload({ baselineScenario: call.args.baseline, candidateScenario: call.args.candidate, seed: 1001 }));
      await settled;
      assert.equal(store.getState().fork.status, "open");
      assert.equal(find('[data-role="fork-caption"]').textContent, labels.HONESTY.forkCaption);
      assert.equal(root.querySelectorAll('[data-role="fork-caption"]').length, 1, "the §1.3 caption is rendered once");
      const timeline = fork.querySelector('figure[data-chart="car_timeline"]');
      assert.ok(timeline, "the two-lane timeline is drawn");
      assert.ok(timeline.textContent.includes("SJ-001"));
      assert.ok(timeline.textContent.includes(labels.INSPECTOR.forkArms.A) && timeline.textContent.includes(labels.INSPECTOR.forkArms.B));
      buttonNamed(labels.FORK.close, fork).click();
      assert.equal(store.getState().fork.status, "closed");
      assert.equal(fork.hidden, true);
    }));

  test("the inspector's Open the fork runs it, and a failed fork offers Retry with the same arms", () =>
    withApp({}, async (ctx) => {
      const { app, host, find, buttonNamed, store } = ctx;
      await finishWindow(ctx);
      store.dispatch({ type: "knob/set", knob: "SUP-1.SJ", path: ["areas", 2, "cars"], value: 16 });
      store.dispatch({ type: "inspector/open", target: { car: "SF-017" } });
      buttonNamed(labels.INSPECTOR.openFork, app.regions.inspector).click();
      const first = host.last("run_pair");
      first.reject(new Error("the engine worker stopped"));
      await tick();
      assert.equal(find('[data-role="fork-error"] p').textContent, labels.STATES.engineStopped);
      buttonNamed(labels.STATES.retry, find('[data-role="fork"]')).click();
      const again = host.last("run_pair");
      assert.notEqual(again.id, first.id);
      assert.deepEqual(again.args, first.args);
    }));
});

describe("Open the fork moves the reader to the fork (G2)", () => {
  test("the drawer closes, the fork scrolls into view, its heading takes focus and the live region says what opened", () =>
    withApp({}, async (ctx) => {
      const { app, host, find, buttonNamed, store, doc } = ctx;
      await finishWindow(ctx);
      const fork = find('[data-role="fork"]');
      const heading = find('[data-role="fork-heading"]');
      const live = app.regions.footer.querySelector('[aria-live="polite"]');
      const scrolls = [];
      fork.scrollIntoView = (options) => scrolls.push(options);

      // Without a knob change the fork explains itself, and the reader is moved there all the same.
      store.dispatch({ type: "inspector/open", target: { car: "SF-017" } });
      buttonNamed(labels.INSPECTOR.openFork, app.regions.inspector).click();
      assert.equal(store.getState().inspector, null);
      assert.equal(find('[data-role="fork-needs-change"]').textContent, labels.FORK.needsChange);
      assert.equal(doc.activeElement, heading);
      assert.equal(live.textContent, labels.FORK.needsChange);
      buttonNamed(labels.FORK.close, fork).click();

      store.dispatch({ type: "knob/set", knob: "SUP-1.SJ", path: ["areas", 2, "cars"], value: 16 });
      store.dispatch({ type: "inspector/open", target: { car: "SF-017" } });
      assert.equal(app.regions.inspector.hidden, false);
      buttonNamed(labels.INSPECTOR.openFork, app.regions.inspector).click();
      assert.equal(store.getState().inspector, null, "the drawer closes");
      assert.equal(app.regions.inspector.hidden, true);
      assert.equal(fork.hidden, false);
      assert.equal(heading.textContent, labels.FORK.heading);
      assert.equal(doc.activeElement, heading, "focus moves to the fork heading");
      assert.deepEqual(scrolls, [{ block: "start" }, { block: "start" }]);
      // On a phone the fork lives in the Charts group, so that group is shown before focus moves.
      assert.equal(ctx.root.getAttribute("data-phone-group"), "charts");
      assert.equal(app.regions.segmented.querySelector('button[data-group="charts"]').getAttribute("aria-pressed"), "true");
      assert.equal(live.textContent, labels.forkOpened("SF-017"));

      // Rendering the result keeps the heading node, so focus is not dropped when the pair settles.
      const call = host.last("run_pair");
      call.resolve(await pairPayload({ baselineScenario: call.args.baseline, candidateScenario: call.args.candidate, seed: 1001 }));
      await tick();
      assert.equal(store.getState().fork.status, "open");
      assert.equal(find('[data-role="fork-heading"]'), heading);
      assert.equal(doc.activeElement, heading);
    }));
});

describe("lookup tables before the first run (G8)", () => {
  const later = () => new Promise((resolve) => setTimeout(resolve, 5));

  test("an idle step builds the tables for the scenario's sigma with a preparing line, once per sigma", async () => {
    const host = createFakeHost();
    const calls = [];
    const pending = [];
    host.warmTables = (args) => {
      calls.push(args);
      return new Promise((resolve) => pending.push(resolve));
    };
    await withApp({ host }, async ({ find, store }) => {
      assert.deepEqual(calls, [], "start itself builds nothing");
      await later();
      const sigma = store.getState().scenario.sigma_permille;
      assert.deepEqual(calls, [{ sigmaPermille: sigma }]);
      assert.equal(find('[data-role="preparing"]').textContent, labels.STATES.preparing);
      assert.equal(find('[data-role="preparing"]').getAttribute("role"), "status");
      pending.shift()({ sigma_permille: sigma });
      await tick();
      assert.equal(find('[data-role="preparing"]'), null);
      assert.equal(find('[data-role="run-status"]').children.length, 0);
      await later();
      assert.equal(calls.length, 1, "a sigma is built once");
      store.dispatch({ type: "knob/set", knob: "RD-5", path: ["sigma_permille"], value: sigma === 200 ? 250 : 200 });
      await later();
      assert.deepEqual(calls.at(-1), { sigmaPermille: sigma === 200 ? 250 : 200 }, "a new traffic spread is built in its own idle step");
      pending.shift()({});
      await tick();
    });
  });

  test("a host without warmTables is left alone, and destroy cancels a scheduled build", async () => {
    const host = createFakeHost();
    let called = 0;
    await withApp({}, async ({ find }) => {
      await later();
      assert.equal(find('[data-role="preparing"]'), null);
    });
    host.warmTables = () => {
      called += 1;
      return new Promise(() => {});
    };
    const ctx = mount({ host });
    ctx.cleanup();
    await later();
    assert.equal(called, 0);
  });

  test("a rejected build is not retried and clears the preparing line", async () => {
    // Review: only a build that resolves was tested. A failed sigma counts as done, so it is not built again after
    // every idle step (the engine rejects an off-grid sigma, a worker error or a cancel).
    const host = createFakeHost();
    let calls = 0;
    host.warmTables = () => {
      calls += 1;
      return Promise.reject(new Error("the table build failed"));
    };
    await withApp({ host }, async ({ find }) => {
      await later();
      assert.equal(calls, 1, "the first idle step builds once");
      for (let i = 0; i < 5; i += 1) await later();
      assert.equal(calls, 1, "a failed sigma is not built again");
      assert.equal(find('[data-role="preparing"]'), null);
    });
  });
});

describe("modes", () => {
  test("Learn and Experiment render in the chart row by mode, and the root carries data-mode", () =>
    withApp({}, ({ root, find, buttonNamed, app }) => {
      const learn = find('[data-role="learn"]');
      const experiment = find('[data-role="experiment"]');
      const charts = find('[data-role="sandbox-charts"]');
      assert.deepEqual([learn.hidden, experiment.hidden, charts.hidden], [true, true, false]);
      buttonNamed(labels.MODES.learn.name, app.regions.topbar).click();
      assert.equal(root.getAttribute("data-mode"), "learn");
      assert.deepEqual([learn.hidden, experiment.hidden, charts.hidden], [false, true, false]);
      assert.ok(learn.textContent.includes(labels.LEARN.chooseCase));
      buttonNamed(labels.MODES.experiment.name, app.regions.topbar).click();
      assert.equal(root.getAttribute("data-mode"), "experiment");
      assert.deepEqual([learn.hidden, experiment.hidden, charts.hidden], [true, false, true]);
      assert.ok(experiment.querySelector('[data-role="references"]'));
      buttonNamed(labels.MODES.sandbox.name, app.regions.topbar).click();
      assert.deepEqual([learn.hidden, experiment.hidden, charts.hidden], [true, true, false]);
    }));

  test("in a Learn case the fork runs the preset's axis baseline as lane A and its candidate as lane B", () =>
    withApp({}, async ({ app, host, buttonNamed, store }) => {
      buttonNamed(labels.MODES.learn.name, app.regions.topbar).click();
      app.regions.charts.querySelector('[data-case="L3"]').click();
      assert.equal(store.getState().learn.case, "L3");
      app.openFork("SF-017");
      const call = host.last("run_pair");
      assert.equal(call.args.baseline.policies.depot_assignment, "home_depot");
      assert.equal(call.args.candidate.policies.depot_assignment, "nearest_depot");
    }));

  test("a verdict seed opens both frozen arms on the spec's shared envelope; the session log records the engine path", () =>
    withApp({}, async ({ app, host, find, store }) => {
      const frozen = frozenExperiment();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      store.dispatch({ type: "experiment/freeze", spec: frozen.spec, digest: frozen.digest, label: frozen.label, frozenAt: "14:02", id: "x" });
      store.dispatch({ type: "experiment/verdict", id: "x", payload: await experimentPayload() });
      const experiment = find('[data-role="experiment"]');
      assert.equal(store.getState().experiment.sessionLog[0].engine, "worker");
      assert.ok(experiment.textContent.includes(labels.enginePath("worker")), "the session log shows engine: worker");
      const arms = find('[data-role="arm-comparison"]');
      assert.equal(arms.hidden, false);
      assert.ok(chartIds(arms).length >= 1 && chartIds(arms).every((id) => id === "arm_comparison"));

      app.watchVerdictSeed(frozen.spec.seeds[2]);
      const call = host.last("run_pair");
      const expected = armScenarios(frozen.spec);
      assert.deepEqual(call.args.baseline, expected.baseline);
      assert.deepEqual(call.args.candidate, expected.candidate);
      assert.deepEqual(call.args.lambdaMaxPermille, experimentEnvelope(frozen.spec));
      assert.equal(call.args.seed, frozen.spec.seeds[2]);
    }));
});

describe("accessibility and copy", () => {
  test("the polite live region speaks this replay's riders on a step", () =>
    withApp({}, async (ctx) => {
      await finishWindow(ctx);
      const live = ctx.app.regions.footer.querySelector('[aria-live="polite"]');
      ctx.store.dispatch({ type: "clock/step", unit: "5min", direction: 1 });
      assert.match(live.textContent, /^D1 05:05, this replay: \d+ riders? waiting, \d+ unserved in the last hour\.$/);
    }));

  test("the reduced motion buttons set the in-app override on the root element", () =>
    withApp({}, ({ doc, app, buttonNamed }) => {
      const html = doc.documentElement;
      buttonNamed(labels.STATES.reducedMotionOn, app.regions.footer).click();
      assert.equal(html.getAttribute("data-motion"), "reduce");
      assert.equal(buttonNamed(labels.STATES.reducedMotionOn, app.regions.footer).getAttribute("aria-pressed"), "true");
      buttonNamed(labels.STATES.reducedMotionOff, app.regions.footer).click();
      assert.equal(html.getAttribute("data-motion"), "full");
      buttonNamed(labels.STATES.reducedMotionSystem, app.regions.footer).click();
      assert.equal(html.hasAttribute("data-motion"), false);
    }));

  test("rendered copy after a run and a fork has no banned word, winner word or dash", () =>
    withApp({}, async (ctx) => {
      await finishWindow(ctx);
      ctx.store.dispatch({ type: "knob/set", knob: "SUP-1.SJ", path: ["areas", 2, "cars"], value: 16 });
      const settled = ctx.app.openFork("SJ-001");
      const call = ctx.host.last("run_pair");
      call.resolve(await pairPayload({ baselineScenario: call.args.baseline, candidateScenario: call.args.candidate, seed: 1001 }));
      await settled;
      const texts = [ctx.root.textContent, ...ctx.root.querySelectorAll("[aria-label], [title]").flatMap((n) => [n.getAttribute("aria-label"), n.getAttribute("title")]).filter(Boolean)];
      for (const text of texts) {
        assert.doesNotMatch(text, BANNED_WORDS);
        assert.doesNotMatch(text, H6_WORDS);
        assert.doesNotMatch(text, DASHES);
      }
    }));

  test("destroy stops the interface: store changes no longer render", () => {
    const ctx = mount();
    const status = ctx.find('[data-role="top-status"]');
    ctx.app.destroy();
    ctx.store.dispatch({ type: "clock/set", clock_s: 40000 });
    assert.equal(status.textContent, "D1 05:00");
    ctx.cleanup();
  });
});

describe("the walkthrough layer (demo plan section 4.1)", () => {
  test("Present is a layer, not a fourth mode: the mode underneath carries and the modes stay as they were", () =>
    withApp({}, ({ root, find, store }) => {
      const present = find('[data-role="present-toggle"]');
      assert.equal(present.textContent, labels.PRESENT.open);
      assert.equal(present.getAttribute("aria-pressed"), "false");
      assert.equal(root.getAttribute("data-present"), "false");
      present.click();
      assert.equal(store.getState().present.on, true);
      assert.equal(store.getState().mode, "sandbox", "the mode underneath carries");
      assert.equal(root.getAttribute("data-mode"), "sandbox");
      assert.equal(present.getAttribute("aria-pressed"), "true");
      assert.equal(root.getAttribute("data-present"), "true");
    }));

  test("presenting hides the knobs, the side column, the chart row and the transport's controls, and keeps the strips container", () =>
    withApp({}, ({ root, app, find }) => {
      const strips = find('[data-role="strips"]');
      find('[data-role="present-toggle"]').click();
      assert.equal(app.regions.ledger.hidden, false);
      assert.equal(app.regions.rail.hidden, false);
      assert.equal(app.regions.map.hidden, false, "the map region is the stage");
      assert.equal(strips.hidden, false, "the strips container stays, with its strips hidden");
      for (const node of [app.regions.knobs, app.regions.charts, app.regions.segmented]) assert.equal(node.hidden, true);
      assert.equal(root.querySelector(".fl-side").hidden, true);
      for (const id of ["ledger", "rail"]) assert.equal(app.regions[id].hasAttribute("inert"), false);
      // Leaving restores the page it was, and puts the reader back on the control that opened it.
      find('[data-role="present-toggle"]').click();
      for (const node of [app.regions.knobs, app.regions.charts]) assert.equal(node.hidden, false);
      assert.equal(app.regions.ledger.hidden, true);
      assert.equal(app.regions.ledger.hasAttribute("inert"), true);
      assert.equal(root.ownerDocument.activeElement, find('[data-role="present-toggle"]'));
    }));

  test("while presenting, the ledger and the rail hold the only tab stops of the regions they replace", () =>
    withApp({}, ({ root, app }) => {
      const stops = () => tabbables(root);
      assert.equal(stops().some((node) => app.regions.rail.contains(node)), false, "a closed walkthrough holds no tab stop");
      root.querySelector('[data-role="present-toggle"]').click();
      const open = stops();
      assert.ok(open.some((node) => app.regions.rail.contains(node)), "the rail is reachable");
      for (const id of ["knobs", "charts"]) {
        assert.equal(open.some((node) => app.regions[id].contains(node)), false, `${id} is out of the tab order while presenting`);
      }
      // DOM order is visual order: the stage, then the ledger, then the rail.
      const order = root.children.map((n) => n.getAttribute("class").split(" ")[0]);
      assert.ok(order.indexOf("fl-map") < order.indexOf("fl-ledger"));
      assert.ok(order.indexOf("fl-ledger") < order.indexOf("fl-rail"));
    }));

  test("while presenting, Next is reachable from the top bar in at most six tabs", () =>
    withApp({}, ({ root, find, store }) => {
      find('[data-role="present-toggle"]').click();
      // The rail's controls are off until Prepare lands, and an off control is not a tab stop; this measures the
      // distance a reader tabs once the walkthrough is ready, which is what the reachability gate is about.
      store.dispatch({ type: "present/prepared" });
      const order = tabbables(root);
      const from = order.indexOf(find('[data-role="present-toggle"]'));
      const to = order.indexOf(find('[data-role="present-next"]'));
      assert.ok(from >= 0, "Present is a tab stop");
      assert.ok(to > from, "Next follows Present in the tab order");
      assert.ok(to - from <= 6, `Next is ${String(to - from)} tabs after Present`);
    }));

  test("the walk keeps the presenter's hands in the rail, and the arms beat carries both arms in words", () =>
    withApp({}, async (ctx) => {
      const { app, host, store, find, root } = ctx;
      find('[data-role="present-toggle"]').click();
      const prepared = app.present.prepare();
      const windowCall = host.last("run_window");
      windowCall.resolve(await ops01Payload({ seeds: windowCall.args.seeds, logSeed: windowCall.args.logSeed }));
      await tick();
      const experimentCall = host.last("run_experiment");
      experimentCall.resolve(await experimentPayload({ presetId: "OPS-01", replications: experimentCall.args.spec.seeds.length }));
      await prepared;
      assert.equal(store.getState().present.prepared, true);
      // The ledger is the scroll container while presenting, so it is one of the tab stops a reader can reach.
      assert.ok(tabbables(root).includes(app.regions.ledger), "the ledger is a tab stop while presenting");

      const next = find('[data-role="present-next"]');
      next.focus();
      while (beatAt(store.getState().present.chapter, store.getState().present.beat).key !== "depotNight") next.click();
      // The real drawer is mounted here and moves focus to its Close button when it opens; the walkthrough's keys are
      // bound to the rail, so a Next that lost focus would stop the walk at step 4 of 5.
      assert.deepEqual(store.getState().inspector, { depot: "SF-2" });
      assert.equal(app.regions.inspector.getAttribute("data-open"), "true");
      assert.equal(root.ownerDocument.activeElement, next, "Next kept the hands");

      while (beatAt(store.getState().present.chapter, store.getState().present.beat).key !== "arms") next.click();
      const pair = host.last("run_pair");
      assert.ok(pair, "the arms beat opens the page's own fork on the watched seed");
      pair.resolve(await pairPayload({ baselineScenario: pair.args.baseline, candidateScenario: pair.args.candidate, seed: pair.args.seed, lambdaMaxPermille: pair.args.lambdaMaxPermille }));
      await tick();
      // The picture steps aside for this beat, so the ledger has to carry the evidence in words and numbers.
      const arms = app.regions.ledger.querySelectorAll('[data-role="present-arm"]');
      assert.deepEqual(arms.map((n) => n.getAttribute("data-arm")), ["A", "B"]);
      const at_s = frameAt(store.getState().fork.pair.baseline.log, store.getState().clock_s).at_s;
      for (const [lane, node] of [["A", arms[0]], ["B", arms[1]]]) {
        const log = lane === "A" ? store.getState().fork.pair.baseline.log : store.getState().fork.pair.candidate.log;
        const view = depotView(log, "SF-2", at_s);
        assert.equal(node.textContent, labels.armDepotLine({
          arm: labels.INSPECTOR.forkArms[lane],
          depot: "SF-2",
          held: labels.lotFill(view.held, view.stalls),
          queued: view.queued,
        }), lane);
      }
    }));

  test("Prepare starts the casebook situation, runs the window at 5 seeds with the log of seed 1001, then freezes and runs the experiment", () =>
    withApp({}, async (ctx) => {
      const { app, host, store, find } = ctx;
      find('[data-role="present-toggle"]').click();
      const prepared = app.present.prepare();
      const windowCall = host.last("run_window");
      assert.equal(store.getState().presetId, "OPS-01");
      assert.equal(store.getState().mode, "sandbox", "the situation is set up in Sandbox, where the walk watches it");
      assert.deepEqual(windowCall.args.seeds, seedSet(1, SANDBOX_REPLICATIONS));
      assert.equal(windowCall.args.logSeed, 1001);
      assert.deepEqual(windowCall.args.scenario, store.getState().scenario);
      assert.equal(find('[data-role="present-next"]').disabled, true, "Next waits for both runs");

      windowCall.resolve(await ops01Payload({ seeds: windowCall.args.seeds, logSeed: windowCall.args.logSeed }));
      await tick();
      const experimentCall = host.last("run_experiment");
      assert.ok(experimentCall, "the frozen spec runs after the window");
      assert.equal(experimentCall.args.spec.seeds.length, 20);
      assert.equal(experimentCall.args.spec.resamples, 2000);
      assert.equal(store.getState().present.prepared, false, "one run of the two is not a prepared walkthrough");
      assert.equal(find('[data-role="present-next"]').disabled, true);

      const abort = new Error("cancelled");
      abort.name = "AbortError";
      experimentCall.reject(abort);
      await prepared;
      assert.equal(store.getState().present.prepared, false, "a run that never landed never marks the walkthrough ready");
      assert.equal(find('[data-role="present-next"]').disabled, true);
    }));
});

describe("honesty copy on the page (review: honesty-copy lens)", () => {
  /** The seed each visible THIS REPLAY chip names (null for a chip with no seed yet). */
  const visibleReplaySeeds = (root) => root.querySelectorAll(".fl-chip-replay").filter((n) => !n.inHiddenOrInert()).map((n) => n.textContent.match(/seed ([0-9]+)/)?.[1] ?? null);

  test("watching a verdict seed leaves one THIS REPLAY seed on screen; closing the fork brings the Sandbox replay back", () =>
    withApp({}, async (ctx) => {
      const { app, host, find, root, store, buttonNamed } = ctx;
      await finishWindow(ctx);
      const frozen = frozenExperiment();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      store.dispatch({ type: "experiment/freeze", spec: frozen.spec, digest: frozen.digest, label: frozen.label, frozenAt: "14:02", id: "x" });
      store.dispatch({ type: "experiment/verdict", id: "x", payload: await experimentPayload() });
      const seeds = frozen.spec.seeds;
      const seed = seeds[4];
      assert.notEqual(seed, store.getState().run.selectedSeed, "the verdict seed is not the Sandbox replay's seed");
      assert.deepEqual([...new Set(visibleReplaySeeds(root))], [String(store.getState().run.selectedSeed)], "before: the Sandbox replay only");

      store.dispatch({ type: "inspector/open", target: { depot: "SJ-1" } });
      const settled = app.watchVerdictSeed(seed);
      assert.equal(store.getState().inspector, null, "the inspector of the Sandbox replay closes");
      const call = host.last("run_pair");
      call.resolve(await pairPayload({ baselineScenario: call.args.baseline, candidateScenario: call.args.candidate, seed, lambdaMaxPermille: call.args.lambdaMaxPermille }));
      await settled;

      const shown = visibleReplaySeeds(root);
      assert.ok(shown.length >= 2, "the fork's charts carry THIS REPLAY");
      assert.deepEqual([...new Set(shown)], [String(seed)], "every visible THIS REPLAY chip names the watched verdict seed");
      for (const id of ["map", "now", "across"]) assert.equal(app.regions[id].hidden, true, `${id} replays the Sandbox world and steps aside`);
      assert.equal(find('[data-role="strips"]').hidden, true);
      const top = find('[data-role="top-status"]').textContent;
      assert.equal(top, labels.verdictSeedStatus({ clock: format.clock(store.getState().clock_s), seed, index: 5, total: seeds.length }));
      assert.equal(find('[data-role="now-watching"]').textContent, labels.nowWatching({ seed: store.getState().experiment.selectedSeed, index: seeds.indexOf(store.getState().experiment.selectedSeed) + 1, total: seeds.length }));
      assert.equal(find('[data-role="verdict-seed-note"]').textContent, labels.FORK.verdictSeedNote);

      buttonNamed(labels.FORK.close, find('[data-role="fork"]')).click();
      assert.equal(app.regions.map.hidden, false);
      assert.equal(app.regions.now.hidden, false);
      assert.deepEqual([...new Set(visibleReplaySeeds(root))], [String(store.getState().run.selectedSeed)]);
      assert.equal(find('[data-role="top-status"]').textContent, labels.topBarStatus({ clock: format.clock(store.getState().clock_s), replay: 1, replays: SANDBOX_REPLICATIONS, seed: store.getState().run.selectedSeed }));
    }));

  test("L3's second moment reads SJ-1's lot in lane B, and the L3 fork draws that lot in both lanes on the moment's clock", () =>
    withApp({}, async ({ app, host, find, buttonNamed, store }) => {
      buttonNamed(labels.MODES.learn.name, app.regions.topbar).click();
      app.regions.charts.querySelector('[data-case="L3"]').click();
      app.regions.charts.querySelector('[data-moment="1"]').click();
      assert.equal(app.regions.charts.querySelector('[data-role="caption"] [data-key]').getAttribute("data-key"), "learn.L3.m2");
      // L3 pins SF-005 and its second moment is D1 21:00 = 75600 (was SF-017 at 19:30 = 70200): in the fork's replay SJ-1's
      // lot in lane B holds 3 stalls at 21:00 and 1 at 19:30 (test/learn.test.mjs asserts the lot on this clock).
      const settled = app.openFork("SF-005");
      const call = host.last("run_pair");
      call.resolve(await pairPayload({ baselineScenario: call.args.baseline, candidateScenario: call.args.candidate, seed: call.args.seed, lambdaMaxPermille: call.args.lambdaMaxPermille }));
      await settled;
      const lots = find('[data-role="fork"]').querySelectorAll('figure[data-chart="lot_and_queue"]').filter((f) => f.getAttribute("data-depot") === "SJ-1");
      assert.deepEqual(lots.map((f) => f.getAttribute("data-lane")), ["A", "B"]);
      assert.ok(lots[1].querySelector("h3").textContent.endsWith(labels.INSPECTOR.forkArms.B), "lane B is named on its chart");
      assert.equal(store.getState().clock_s, 75600, "the moment's clock is D1 21:00");
      for (const lot of lots) assert.equal(lot.querySelector('[data-role="cursor"]').getAttribute("visibility"), "visible", "the lot chart shows the 21:00 cursor");
    }));

  test("wait p90 across replications carries the completed rides it counts, and so does each replay's table cell", () =>
    withApp({}, async (ctx) => {
      await finishWindow(ctx);
      const summaries = ctx.store.getState().run.summaries;
      const values = (key) => summaries.map((s) => s.metrics[key].value);
      const count = (v) => format.number(v, Number.isInteger(v) ? 0 : 1);
      // Changed with G7: a range whose ends format alike reads as one value. The default preset runs at sigma 0, so all
      // replications share wait p90 (1968 s, shown 33 min) and completed rides (1,786); the line reads
      // "33 min in every replication, from 1,786 completed rides" where it read "33 min to 33 min, from 1,786 to 1,786 ...".
      const alike = (key, fmt) => values(key).every((v) => fmt(v) === fmt(values(key)[0]));
      const range = (key, fmt) => labels.acrossRange({ low: fmt(percentileFleetLab(values(key), 0.1)), high: fmt(percentileFleetLab(values(key), 0.9)) });
      const waitText = alike("wait.p90_s", format.minutes) ? labels.acrossSame(format.minutes(values("wait.p90_s")[0])) : range("wait.p90_s", format.minutes);
      const rides = alike("wait.population_n", count) ? count(values("wait.population_n")[0]) : range("wait.population_n", count);
      assert.ok(alike("wait.p90_s", format.minutes) && alike("wait.population_n", count), "sigma 0: identical replications");
      const expected = labels.withWaitPopulation({ value: waitText, population: labels.waitPopulation(rides) });
      assert.equal(ctx.app.regions.across.querySelector('[data-row="wait"] [data-role="value"]').textContent, expected);
      const cells = ctx.find('[data-role="across-table"]').querySelectorAll("tbody tr").map((tr) => tr.children[1].textContent);
      assert.deepEqual(cells, summaries.map((s) => labels.withWaitPopulation({ value: format.minutes(s.metrics["wait.p90_s"].value), population: labels.waitPopulation(format.count(s.metrics["wait.population_n"].value)) })));
      const waitChart = ctx.app.regions.charts.querySelector('figure[data-chart="wait_p90_by_hour"] [data-role="summary"]');
      assert.match(waitChart.textContent, /, from [0-9,]+ completed rides(; [^.]+)?\.$/);
    }));

  test("replications that differ read as ranges across replications, the completed rides too", () =>
    withApp({}, async (ctx) => {
      // Review: at sigma 0 every replication of the default preset is identical, so no test fed the panel differing
      // replications. Replication 0 is set to wait p90 2400 s, 1,700 completed rides and 0.03 unserved; the other four
      // stay as run. Linear percentiles over five values: p10 at index 0.4, p90 at index 3.6. With four equal values
      // `b` above (or below) the changed one, p10 and p90 follow by hand below.
      const changed = { "wait.p90_s": 2400, "wait.population_n": 1700, "unserved.fraction": 0.03 };
      await finishWindow(ctx, (payload) => ({
        ...payload,
        runs: payload.runs.map((r, i) => (i === 0 ? { ...r, metrics: { ...r.metrics, ...Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, { value: v }])) } } : r)),
      }));
      const summaries = ctx.store.getState().run.summaries;
      assert.equal(summaries.length, 5);
      const b = (key) => summaries[1].metrics[key].value;
      for (const key of Object.keys(changed)) assert.ok(summaries.slice(1).every((s) => s.metrics[key].value === b(key)), `${key} alike in replications 2 to 5`);
      const count = (v) => format.number(v, Number.isInteger(v) ? 0 : 1);
      const pct = (v) => format.percent(v, 1);
      assert.ok(b("wait.p90_s") < 2400 && b("unserved.fraction") < 0.03 && b("wait.population_n") > 1700, "the changed replication is the highest wait and unserved, the fewest rides");
      // Sorted [b, b, b, b, x] (x above): p10 = b, p90 = b + 0.6 (x - b). Sorted [x, b, b, b, b] (x below): p10 = x + 0.4 (b - x), p90 = b.
      const wait = labels.acrossRange({ low: format.minutes(b("wait.p90_s")), high: format.minutes(b("wait.p90_s") + 0.6 * (2400 - b("wait.p90_s"))) });
      const rides = labels.acrossRange({ low: count(1700 + 0.4 * (b("wait.population_n") - 1700)), high: count(b("wait.population_n")) });
      const unserved = labels.acrossRange({ low: pct(b("unserved.fraction")), high: pct(b("unserved.fraction") + 0.6 * (0.03 - b("unserved.fraction"))) });
      const rows = Object.fromEntries(rowValues(ctx.app.regions.across));
      assert.equal(rows.wait, labels.withWaitPopulation({ value: wait, population: labels.waitPopulation(rides) }));
      assert.equal(rows.unserved, unserved);
      for (const value of Object.values(rows)) assert.ok(!value.includes(labels.acrossSame("").trim()), value);
      assert.match(rows.wait, /^\d+ min to \d+ min, from [0-9,.]+ to [0-9,.]+ completed rides$/);
    }));
});
