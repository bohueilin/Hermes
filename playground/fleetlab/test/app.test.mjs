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
import { REGION_IDS, ROW_CHARTS, SANDBOX_REPLICATIONS, start } from "../src/ui/app.js";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import { experimentPayload, frozenExperiment, pairPayload, windowPayload } from "./helpers/model-payloads.mjs";

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
function mount({ host = createFakeHost(), copyText = null, media = { "(min-width: 1280px)": true, "(min-width: 768px)": true } } = {}) {
  const uninstall = installFakeDom(globalThis, { media });
  const { document: doc } = uninstall.dom;
  const root = doc.createElement("div");
  root.setAttribute("id", "fleetlab-root");
  const strip = doc.createElement("div");
  strip.setAttribute("id", "fleetlab-teaching-strip");
  root.appendChild(strip);
  doc.body.appendChild(root);
  const app = start({ createWorker: () => null, engineHost: host, copyText });
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
  test("every region is filled in design 7.7 order before anything runs", () =>
    withApp({}, ({ root, app, find, buttonNamed, store }) => {
      assert.deepEqual(root.children.map((n) => n.getAttribute("class").split(" ")[0]), ["fl-strip", "fl-topbar", "fl-knobs", "fl-map", "fl-transport", "fl-segmented", "fl-side", "fl-charts", "fl-drawer", "fl-footer"]);
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
      for (const [, value] of [...rowValues(app.regions.now), ...rowValues(app.regions.across)]) assert.equal(value, notRun);
      assert.equal(find('[data-role="across-chip"]').hidden, true, "no replication count before a run");
      assert.equal(find('[data-role="charts-absent"]').textContent, notRun);
      assert.equal(find('[data-role="engine-path"]').textContent, labels.enginePath("worker"));
      assert.equal(store.getState().engine.path, "worker", "the host's path reaches the store at once");
      assert.equal(find('[data-role="run-status"]').children.length, 0);
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
      const now = rowValues(app.regions.now);
      assert.deepEqual(now.map(([key]) => key), ["waiting", "unserved", "lot:SF-1", "lot:SF-2", "lot:SJ-1", "lot:EB-1", "highways"]);
      for (const [key, value] of now) assert.ok(!value.startsWith(labels.ABSENT_PREFIX), `${key} has a value from this replay`);
      assert.match(now.find(([key]) => key === "lot:SJ-1")[1], /^\d+\/30$/);
      assert.equal(find('[data-role="across-chip"]').hidden, false);
      assert.equal(find('[data-role="across-chip"]').textContent, labels.acrossReplicationsChip(5));
      for (const [key, value] of rowValues(app.regions.across)) assert.match(value, / to /, `${key} reads a range across replications`);
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
      assert.equal(call.args.baseline.areas[2].cars, 24, "lane A undoes the last change");
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
      const settled = app.openFork("SF-017");
      const call = host.last("run_pair");
      call.resolve(await pairPayload({ baselineScenario: call.args.baseline, candidateScenario: call.args.candidate, seed: call.args.seed, lambdaMaxPermille: call.args.lambdaMaxPermille }));
      await settled;
      const lots = find('[data-role="fork"]').querySelectorAll('figure[data-chart="lot_and_queue"]').filter((f) => f.getAttribute("data-depot") === "SJ-1");
      assert.deepEqual(lots.map((f) => f.getAttribute("data-lane")), ["A", "B"]);
      assert.ok(lots[1].querySelector("h3").textContent.endsWith(labels.INSPECTOR.forkArms.B), "lane B is named on its chart");
      assert.equal(store.getState().clock_s, 70200, "the moment's clock is D1 19:30");
      for (const lot of lots) assert.equal(lot.querySelector('[data-role="cursor"]').getAttribute("visibility"), "visible", "the lot chart shows the 19:30 cursor");
    }));

  test("wait p90 across replications carries the completed rides it counts, and so does each replay's table cell", () =>
    withApp({}, async (ctx) => {
      await finishWindow(ctx);
      const summaries = ctx.store.getState().run.summaries;
      const values = (key) => summaries.map((s) => s.metrics[key].value);
      const count = (v) => format.number(v, Number.isInteger(v) ? 0 : 1);
      const range = (key, fmt) => labels.acrossRange({ low: fmt(percentileFleetLab(values(key), 0.1)), high: fmt(percentileFleetLab(values(key), 0.9)) });
      const expected = labels.withWaitPopulation({ value: range("wait.p90_s", format.minutes), population: labels.waitPopulation(range("wait.population_n", count)) });
      assert.equal(ctx.app.regions.across.querySelector('[data-row="wait"] [data-role="value"]').textContent, expected);
      const cells = ctx.find('[data-role="across-table"]').querySelectorAll("tbody tr").map((tr) => tr.children[1].textContent);
      assert.deepEqual(cells, summaries.map((s) => labels.withWaitPopulation({ value: format.minutes(s.metrics["wait.p90_s"].value), population: labels.waitPopulation(format.count(s.metrics["wait.population_n"].value)) })));
      const waitChart = ctx.app.regions.charts.querySelector('figure[data-chart="wait_p90_by_hour"] [data-role="summary"]');
      assert.match(waitChart.textContent, /, from [0-9,]+ completed rides(; [^.]+)?\.$/);
    }));
});
