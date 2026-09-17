// The walkthrough (src/ui/present.js; demo plan sections 1.1, 4.4 and 4.7) on the fake DOM, over a real run of the
// casebook's OPS-01. What these tests hold: a beat is a silent seek and a projection, never a number this module typed;
// every figure equals what the frame model, the log or the depot view says at that second; the depot table equals the
// drawer's own reading; the ticker collapses the recall burst and is redrawn only when a new event joins it; beat clocks
// follow the scenario's declared knobs; nothing is shown before the runs land; and no string the walk renders states a
// direction the pins do not carry (H-9).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { experimentPayload, frozenExperiment, ops01Payload, presetScenario } from "./helpers/model-payloads.mjs";
import { CHECK_IDS } from "../src/model/invariants.js";
import { computeMetric } from "../src/model/metrics.js";
import { PRESETS, presetById } from "../src/model/presets.js";
import { REGISTRY_PREVIEW, registryRows } from "../src/ui/analytics.js";
import { specInWords, tradeOffSentence, valueWithMinutes } from "../src/ui/experiment.js";
import * as format from "../src/ui/format.js";
import { depotView } from "../src/ui/inspector.js";
import * as labels from "../src/ui/labels.js";
import { frameModel, mapModel } from "../src/ui/map.js";
import { createPlayback, frameAt } from "../src/ui/playback.js";
import {
  BEAT_ORDER,
  CHAPTERS,
  PRESENT_PRESET_ID,
  PRESENT_SPEED,
  beatAt,
  beatClock,
  beatPosition,
  beatTitle,
  eventsAt,
  eventsSoFar,
  focusArea,
  focusDepot,
  longestBayWait,
  mountPresent,
  nextCasebookPreset,
  nextCasebookQuestion,
  queueClearedAt,
  tickerLines,
} from "../src/ui/present.js";
import { createInitialState, createStore } from "../src/ui/store.js";

const { PRESENT } = labels;

const SOURCE = readFileSync(new URL("../src/ui/present.js", import.meta.url), "utf8");
const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** Words that state a direction, as test/captions.test.mjs scans for them. */
const DIRECTION = /\b(lower|higher|unchanged|more|fewer|less|rises?|rising|falls?|falling|longer|shorter|slower|faster|increases?|increased|decreases?|decreased|grows?|drops?|up|down|above|below|better|worse)\b/i;
const BANNED_WORDS = /\b(predict|forecast|live|real-time|realtime|real time|monitoring)\b|expected traffic/i;
const H6_WORDS = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const DASHES = /[–—]/;

/** Paired seeds the walkthrough's frozen spec runs, as the casebook record declares them. */
const VERDICT_SEEDS = 20;

let payload;
let scenario;

before(async () => {
  payload = await ops01Payload();
  scenario = presetScenario(PRESENT_PRESET_ID);
});

/**
 * The walkthrough mounted on its own, against a real store and the real playback controller with a scheduler that never
 * fires (so a test moves the clock itself). `prepare` stands in for the app's two runs: it puts the real OPS-01 window
 * payload in the store and freezes the casebook's own spec, which is what the page has when Prepare lands.
 */
function mount({ reduced = false } = {}) {
  const uninstall = installFakeDom(globalThis, { media: { "(min-width: 1280px)": true, "(min-width: 768px)": true } });
  const doc = uninstall.dom.document;
  const ledger = doc.createElement("section");
  const rail = doc.createElement("section");
  doc.body.appendChild(ledger);
  doc.body.appendChild(rail);
  const store = createStore(createInitialState({ presetId: PRESENT_PRESET_ID, scenario: presetScenario(PRESENT_PRESET_ID), reducedMotionSystem: reduced }));
  const playback = createPlayback({ store, scheduler: { request: () => 1, cancel: () => {} } });
  let frameMemo = { log: null, clock: null, frame: null };
  const scenarioOf = (state) => state.run.scenarioAtQueue ?? state.scenario;
  const frameOf = (state) => {
    if (state.run.log === null) return null;
    if (frameMemo.log !== state.run.log || frameMemo.clock !== state.clock_s) {
      frameMemo = { log: state.run.log, clock: state.clock_s, frame: playback.frame() };
    }
    return frameMemo.frame;
  };
  const modelOf = (state) => frameModel({ scenario: scenarioOf(state), log: state.run.log, frame: frameOf(state), clock_s: state.clock_s });
  let times = null;
  const watched = [];
  const present = mountPresent({
    store,
    playback,
    ledger,
    rail,
    modelOf,
    frameOf,
    scenarioOf,
    // What the page's own Prepare does: the casebook window at 5 seeds, then its frozen spec at its paired seeds.
    prepare: async () => {
      store.dispatch({ type: "run/queued", id: "w", total: 5 });
      store.dispatch({ type: "run/done", id: "w", payload });
      const frozen = frozenExperiment({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS });
      store.dispatch({ type: "experiment/freeze", spec: frozen.spec, digest: frozen.digest, label: frozen.label, frozenAt: "14:02", id: "x" });
      store.dispatch({ type: "experiment/verdict", id: "x", payload: await experimentPayload({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS }) });
      times = { windowMs: 1234, experimentMs: 4567 };
      store.dispatch({ type: "present/prepared" });
    },
    times: () => times,
    onWatchSeed: (seed) => watched.push(seed),
  });
  const find = (role, root = ledger) => root.querySelector(`[data-role="${role}"]`);
  const figure = (key) => ledger.querySelector(`[data-figure="${key}"] [data-role="figure-value"]`)?.textContent ?? null;
  const beatKey = () => beatAt(store.getState().present.chapter, store.getState().present.beat).key;
  const position = () => beatPosition(store.getState().present.chapter, store.getState().present.beat);
  return {
    store, playback, present, ledger, rail, doc, find, figure, beatKey, position, watched,
    next: () => find("present-next", rail),
    content: () => find("present-beat-content"),
    cleanup: () => {
      present.destroy();
      uninstall();
    },
  };
}

/** The walkthrough open and prepared, standing on its first beat. */
async function opened(options) {
  const ctx = mount(options);
  ctx.present.open();
  await ctx.present.prepare();
  return ctx;
}

/** The frame and the model of this replay at one second, computed here from the payload rather than from the page. */
function truth(clock_s, { interpolate = true } = {}) {
  const frame = frameAt(payload.log, clock_s, { interpolate });
  return { frame, model: mapModel({ scenario, log: payload.log, frame, clock_s }) };
}

const areaTotal = (model, field) => Object.values(model.areas).reduce((n, a) => n + a[field], 0);
const familyTotal = (model, family) =>
  Object.values(model.areas).reduce((n, a) => n + a.families[family], 0) + model.onRoutes.filter((c) => c.family === family).length;

const key = (node, k) => node.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

describe("chapters and beats are data", () => {
  test("four chapters walk eleven beats in order, each with a title, a rule and a caveat that names a model limit", () => {
    assert.deepEqual(CHAPTERS.map((c) => c.key), ["operations", "analytics", "simulation", "product"]);
    assert.deepEqual(CHAPTERS.map((c) => c.title), [PRESENT.chapters.operations, PRESENT.chapters.analytics, PRESENT.chapters.simulation, PRESENT.chapters.product]);
    assert.equal(BEAT_ORDER.length, 11);
    for (const chapter of CHAPTERS) {
      for (const beat of chapter.beats) {
        assert.equal(beat.title, PRESENT.beats[beat.key], beat.key);
        assert.equal(beat.rule, PRESENT.rules[beat.key], beat.key);
        assert.ok(beat.limits.length > 0, `${beat.key} owes a caveat`);
        for (const limit of beat.limits) assert.equal(typeof labels.MODEL_LIMITS[limit], "string", `${beat.key}: ${limit}`);
      }
    }
    // The walk is one chapter after another, never a jump back into an earlier one.
    assert.deepEqual(BEAT_ORDER.map((p) => p.chapter), [...BEAT_ORDER.map((p) => p.chapter)].sort((a, b) => a - b));
  });

  test("beat clocks are derived from the declared knobs, so moving a knob moves the beat with it", () => {
    const beats = Object.fromEntries(CHAPTERS.flatMap((c) => c.beats).map((b) => [b.key, b]));
    const evening = scenario.peaks[scenario.peaks.length - 1];
    assert.equal(beatClock(beats.peak, scenario), evening.start_h * 3600 + 5400);
    assert.equal(beatClock(beats.unservedHour, scenario), evening.end_h * 3600);
    assert.equal(beatClock(beats.recall, scenario), scenario.policies.recall_s);
    assert.equal(beatClock(beats.depotNight, scenario), scenario.policies.recall_s + 5400);
    assert.equal(beatClock(beats.morning, scenario), scenario.policies.release_s);
    assert.equal(beatClock(beats.frame, scenario), scenario.policies.recall_s + 900);
    assert.equal(beatClock(beats.arms, scenario), scenario.policies.recall_s + 5400);
    // A moved recall moves every beat that was derived from it, and none that was not.
    const moved = { ...scenario, policies: { ...scenario.policies, recall_s: scenario.policies.recall_s + 3600 } };
    assert.equal(beatClock(beats.recall, moved), scenario.policies.recall_s + 3600);
    assert.equal(beatClock(beats.depotNight, moved), scenario.policies.recall_s + 3600 + 5400);
    assert.equal(beatClock(beats.peak, moved), beatClock(beats.peak, scenario));
    // The analytics and product chapters keep the clock where the last beat left it.
    for (const beatKey of ["registers", "verdict", "standsFor", "refusals"]) assert.equal(beatClock(beats[beatKey], scenario), null);
  });

  test("the morning beat says so when the scenario turns the release off, and stands at the recall plus its own span", () => {
    const morning = CHAPTERS[0].beats.find((b) => b.key === "morning");
    assert.equal(beatTitle(morning, scenario), PRESENT.beats.morning);
    const off = { ...scenario, policies: { ...scenario.policies, release_s: null } };
    assert.equal(beatTitle(morning, off), PRESENT.beats.morningNoRelease);
    assert.equal(beatClock(morning, off), scenario.policies.recall_s + 18900);
  });

  test("a played beat runs 15 or 30 simulated minutes at 300x, never an hour", () => {
    assert.equal(PRESENT_SPEED, 300);
    for (const beat of CHAPTERS.flatMap((c) => c.beats)) {
      if (beat.play === null) continue;
      const span = beat.play(scenario) - beatClock(beat, scenario);
      assert.ok(span === 900 || span === 1800, `${beat.key} plays ${String(span)} s`);
    }
  });
});

describe("reading the run", () => {
  test("the recall burst is one second's worth of depot assignments, and the ticker carries it as one line", () => {
    const recall = scenario.policies.recall_s;
    const sent = eventsAt(payload.log, "DEPOT_ASSIGNED", recall);
    assert.ok(sent > 1, `the recall sent ${String(sent)} cars at one second`);
    const lines = tickerLines(payload.log, scenario, recall);
    assert.equal(lines[0].text, labels.tickerRecall(sent));
    assert.equal(lines.filter((l) => l.text === labels.tickerRecall(sent)).length, 1, "the burst collapses into the event that caused it");
    assert.ok(lines.length <= 4);
  });

  test("a depot's queue clears where a queue that held cars falls to empty, never at a second before the backlog", () => {
    const depot = focusDepot({ scenario, experiment: { frozen: null, draft: { guardrails: [] } } });
    const recall = scenario.policies.recall_s;
    const cleared = queueClearedAt(payload.log, depot, recall);
    assert.ok(cleared !== null && cleared >= recall);
    // The seconds just after the recall read zero because the first recalled car walks into a free bay; the backlog
    // builds after them. A cleared second must have cars queued somewhere between the recall and itself.
    const step = payload.log.snapshots[1].t - payload.log.snapshots[0].t;
    const queuedBefore = payload.log.snapshots
      .filter((snapshot) => snapshot.t > recall && snapshot.t < cleared)
      .map((snapshot) => depotView(payload.log, depot, snapshot.t).queued);
    assert.ok(Math.max(...queuedBefore) > 0, `${depot} held a queue between the recall and ${format.clock(cleared)}`);
    // The queue is empty at the next snapshot after it cleared; the drawer reads snapshots, and the clearing second
    // itself falls between two of them.
    assert.equal(depotView(payload.log, depot, cleared + step).queued, 0, "the depot view past that second agrees");
  });

  test("the queue this replay clears is SF-2's, at the second its backlog ran out (OPS-01, seed 1001)", () => {
    const recall = scenario.policies.recall_s;
    const cleared = queueClearedAt(payload.log, "SF-2", recall);
    // D2 05:34, the second the last car of the overnight backlog took a bay: 25 cars were queued at D2 01:24.
    assert.equal(format.clock(cleared), format.clock(86400 + 5 * 3600 + 34 * 60));
    assert.ok(cleared < scenario.policies.release_s, "which is before the release, and the narration says so");
    assert.equal(depotView(payload.log, "SF-2", 86400 + 3600 + 30 * 60).queued > 0, true, "the backlog stands at D2 01:30");
  });

  test("the car the morning beat pins is the one this replay made wait longest for a bay", () => {
    const depot = "SF-2";
    const waited = longestBayWait(payload.log, depot, scenario.policies.release_s);
    assert.ok(waited !== null);
    const visits = payload.log.visits.filter((v) => v.depot === depot && v.intake_end_s !== null && v.first_task_s !== null && v.first_task_s <= scenario.policies.release_s);
    assert.equal(waited.waited_s, Math.max(...visits.map((v) => v.first_task_s - v.intake_end_s)));
  });

  test("the walkthrough watches the depot its own guardrail names", () => {
    const frozen = frozenExperiment({ presetId: PRESENT_PRESET_ID, replications: 20 });
    assert.equal(focusDepot({ scenario, experiment: { frozen, draft: { guardrails: [] } } }), frozen.spec.guardrails[0].scope.depot);
  });

  test("the next casebook question is the record after this one, by its id and title", () => {
    const next = nextCasebookQuestion();
    assert.ok(typeof next === "string" && next.startsWith("OPS-02 "));
  });
});

describe("before the runs land", () => {
  test("every figure reads not available, Next is off, and no depot table or ticker is drawn", () => {
    const ctx = mount();
    try {
      ctx.present.open();
      const missing = labels.absentValue(labels.ABSENT_REASONS.notRunYet);
      const values = ctx.ledger.querySelectorAll('[data-role="figure-value"]').map((n) => n.textContent);
      assert.ok(values.length >= 2, "the beat names what it will show");
      for (const value of values) assert.equal(value, missing);
      const names = ctx.ledger.querySelectorAll('[data-role="figure-label"]').map((n) => n.textContent);
      assert.deepEqual(names, [PRESENT.figures.ridersWaiting, PRESENT.figures.carsWithRiders]);
      assert.equal(ctx.next().disabled, true, "Next waits for Prepare");
      assert.equal(ctx.find("present-depot-table").hidden, true);
      assert.equal(ctx.find("present-ticker").children.length, 0);
      assert.equal(ctx.find("present-prepare-status").textContent, PRESENT.prepareWait);
    } finally {
      ctx.cleanup();
    }
  });

  test("the reading card stands before any run and steps aside once one has landed", async () => {
    const ctx = mount();
    try {
      assert.equal(ctx.present.card.hidden, false);
      assert.ok(ctx.present.card.textContent.includes(PRESENT.card.lead));
      await ctx.present.prepare();
      assert.equal(ctx.present.card.hidden, true, "a page with a run behind it no longer needs the card");
    } finally {
      ctx.cleanup();
    }
  });

  test("Prepare hands the walk's own control the hands the button it hid was holding", async () => {
    const ctx = mount();
    try {
      ctx.present.open();
      const button = ctx.find("present-prepare");
      button.focus();
      assert.equal(ctx.doc.activeElement, button);
      await ctx.present.prepare();
      assert.equal(button.hidden, true, "the button that was pressed is gone");
      assert.equal(ctx.doc.activeElement, ctx.next(), "so the walk begins with Next under the hands");
    } finally {
      ctx.cleanup();
    }
  });

  test("Prepare shows what it ran on this visitor's own clock, and runs once", async () => {
    const ctx = await opened();
    try {
      assert.equal(ctx.find("present-prepare").hidden, true);
      assert.equal(
        ctx.find("present-prepare-status").textContent,
        labels.yourClock(labels.prepareTimes({ window: format.seconds(1.234, 1), experiment: format.seconds(4.567, 1) })),
      );
      const before = ctx.store.getState().run.log;
      await ctx.present.prepare();
      assert.equal(ctx.store.getState().run.log, before, "a prepared walkthrough does not run again");
    } finally {
      ctx.cleanup();
    }
  });
});

describe("walking the beats", () => {
  test("opening seeks the first beat silently: an untagged clock set, never a step or a jump", async () => {
    const ctx = mount();
    try {
      ctx.present.open();
      const actions = [];
      const stop = ctx.store.subscribe((_, action) => actions.push(action));
      await ctx.present.prepare();
      stop();
      const clocks = actions.filter((a) => a.type.startsWith("clock/"));
      assert.ok(clocks.some((a) => a.type === "clock/set"), "the beat seeks");
      for (const action of clocks) {
        assert.equal(action.type, "clock/set", `${action.type} would speak`);
        assert.equal(action.reason, undefined, "an untagged clock set is a scrub, which the announcer stays silent for");
      }
      assert.equal(ctx.store.getState().clock_s, scenario.peaks[scenario.peaks.length - 1].start_h * 3600 + 5400);
    } finally {
      ctx.cleanup();
    }
  });

  test("Next walks every beat of every chapter in order and keeps its own focus", async () => {
    const ctx = await opened();
    try {
      const next = ctx.next();
      next.focus();
      const seen = [ctx.beatKey()];
      assert.equal(ctx.find("present-speed", ctx.rail).textContent, labels.speedText(PRESENT_SPEED));
      for (let i = 1; i < BEAT_ORDER.length; i += 1) {
        next.click();
        seen.push(ctx.beatKey());
        // Focus stays on Next for as long as there is a next beat; the last one hands it to Leave rather than
        // letting a disabled button drop it out of the rail, where Escape would no longer leave.
        const holder = next.disabled ? ctx.find("present-leave", ctx.rail) : next;
        assert.equal(ctx.doc.activeElement, holder, `focus stays in the rail at ${ctx.beatKey()}`);
        // The rail says where the walk stands, and marks the chapter it stands in.
        const state = ctx.store.getState();
        const chapter = CHAPTERS[state.present.chapter];
        assert.equal(ctx.find("present-step", ctx.rail).textContent, labels.stepOf(state.present.beat + 1, chapter.beats.length));
        const marked = ctx.rail.querySelectorAll('[data-role="present-chapter-button"]').filter((b) => b.getAttribute("aria-current") === "step");
        assert.deepEqual(marked.map((b) => b.getAttribute("data-chapter")), [chapter.key], `one chapter is current at ${ctx.beatKey()}`);
      }
      assert.deepEqual(seen, BEAT_ORDER.map((p) => p.key));
      assert.equal(next.disabled, true, "the last beat has nothing after it");
      assert.equal(ctx.find("present-back", ctx.rail).disabled, false);
    } finally {
      ctx.cleanup();
    }
  });

  test("the rail's keys act inside the rail and nowhere else", async () => {
    const ctx = await opened();
    try {
      const start = ctx.position();
      key(ctx.ledger, "ArrowRight");
      assert.equal(ctx.position(), start, "the ledger is not the rail");
      key(ctx.rail, "ArrowRight");
      assert.equal(ctx.position(), start + 1);
      key(ctx.rail, "ArrowLeft");
      assert.equal(ctx.position(), start);
      key(ctx.rail, "End");
      assert.equal(ctx.position(), BEAT_ORDER.length - 1);
      key(ctx.rail, "Home");
      assert.equal(ctx.position(), 0);
      key(ctx.rail, "3");
      assert.equal(ctx.store.getState().present.chapter, 2);
      key(ctx.rail, "Escape");
      assert.equal(ctx.store.getState().present.on, false, "Escape leaves the walkthrough");
    } finally {
      ctx.cleanup();
    }
  });

  test("a beat lands on its declared second and stays there until the presenter presses Play", async () => {
    const ctx = await opened();
    try {
      const beat = CHAPTERS[0].beats[0];
      const stopAt = beat.play(scenario);
      assert.equal(ctx.store.getState().present.stop_s, stopAt);
      // The script reads this frame before anything moves: at D1 17:30 it carries the two numbers the beat was
      // written around, and nothing starts the clock on the walkthrough's own initiative.
      assert.equal(ctx.store.getState().playing, false, "the beat arrives still");
      assert.equal(ctx.store.getState().clock_s, beat.clock(scenario));
      assert.equal(ctx.find("present-play-hint").hidden, false, "the ledger says whose hand the clock is in");
      assert.equal(ctx.find("present-play-hint").textContent, labels.playToWatch(format.clock(stopAt)));
      ctx.find("present-play", ctx.rail).click();
      assert.equal(ctx.store.getState().playing, true, "Play runs the beat to its stop clock");
      assert.equal(ctx.find("present-play-hint").hidden, true);
      ctx.store.dispatch({ type: "clock/advance", seconds: stopAt - ctx.store.getState().clock_s - 300 });
      assert.equal(ctx.store.getState().playing, true, "it is still running before its second");
      ctx.store.dispatch({ type: "clock/advance", seconds: 300 });
      assert.equal(ctx.store.getState().clock_s, stopAt);
      assert.equal(ctx.store.getState().playing, false, "the stop clock pauses it");
      assert.equal(ctx.store.getState().present.stop_s, null);
      ctx.next().click();
      assert.equal(ctx.store.getState().playing, false, "a still beat is still");
      assert.equal(ctx.store.getState().present.stop_s, null);
    } finally {
      ctx.cleanup();
    }
  });

  test("no beat starts the clock on its own, and every beat teaches from its still frame", async () => {
    const ctx = await opened({ reduced: true });
    try {
      assert.equal(ctx.store.getState().playing, false, "the walk arrives still");
      const next = ctx.next();
      for (let i = 0; i < BEAT_ORDER.length; i += 1) {
        assert.equal(ctx.store.getState().playing, false, `${ctx.beatKey()} never starts playing`);
        const lines = ctx.find("present-narration").children;
        assert.ok(lines.length >= 1 && lines.length <= 3, `${ctx.beatKey()} has one to three still lines`);
        assert.ok(ctx.find("present-rule").textContent.length > 0);
        assert.ok(ctx.find("present-caveat").textContent.length > 0);
        if (i + 1 < BEAT_ORDER.length) next.click();
      }
    } finally {
      ctx.cleanup();
    }
  });

  test("the beat that opens a depot opens the drawer on it, and the beat after it closes the drawer again", async () => {
    const ctx = await opened();
    try {
      const next = ctx.next();
      while (ctx.beatKey() !== "depotNight") next.click();
      assert.deepEqual(ctx.store.getState().inspector, { depot: focusDepot(ctx.store.getState()) });
      next.click();
      assert.equal(ctx.store.getState().inspector, null);
    } finally {
      ctx.cleanup();
    }
  });

  test("a beat that opens the drawer leaves the presenter's hands on Next, and the last beat hands them Leave", async () => {
    const ctx = await opened();
    try {
      // The real drawer moves focus to its Close button when it opens (inspector.js); this stands in for it. The
      // walkthrough's keys are bound to the rail alone, so a Next that lost focus is a walk that stops responding.
      const elsewhere = ctx.doc.createElement("button");
      ctx.doc.body.appendChild(elsewhere);
      const stop = ctx.store.subscribe((state) => {
        if (state.inspector !== null) elsewhere.focus();
      });
      const next = ctx.next();
      next.focus();
      while (ctx.beatKey() !== "depotNight") next.click();
      assert.notEqual(ctx.store.getState().inspector, null, "the beat opened the drawer");
      assert.equal(ctx.doc.activeElement, next, "and Next kept the hands");
      stop();
      while (!next.disabled) next.click();
      assert.equal(ctx.doc.activeElement, ctx.find("present-leave", ctx.rail), "a disabled Next hands them Leave, so Escape still leaves");
    } finally {
      ctx.cleanup();
    }
  });

  test("Space plays or pauses once: the keydown is the shortcut and the keyup a browser would click with is swallowed", async () => {
    const ctx = await opened();
    try {
      const play = ctx.find("present-play", ctx.rail);
      play.focus();
      assert.equal(ctx.store.getState().playing, false);
      assert.equal(key(play, " "), false, "the keydown is taken by the rail's shortcut");
      assert.equal(ctx.store.getState().playing, true, "which played it once");
      const up = new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true });
      assert.equal(play.dispatchEvent(up), false, "the keyup is swallowed, so the focused button does not activate too");
      assert.equal(ctx.store.getState().playing, true, "and nothing toggled it back");
    } finally {
      ctx.cleanup();
    }
  });

  test("the morning beat pins the car it narrates, and the beats around it pin nothing", async () => {
    const ctx = await opened();
    try {
      const next = ctx.next();
      while (ctx.beatKey() !== "morning") next.click();
      const state = ctx.store.getState();
      const waited = longestBayWait(payload.log, focusDepot(state), state.clock_s);
      assert.equal(state.fork.pinnedCar, waited.car);
      next.click();
      assert.equal(ctx.store.getState().fork.pinnedCar, null);
    } finally {
      ctx.cleanup();
    }
  });
});

describe("the ledger", () => {
  test("the ledger is a tab stop, because its own box is what scrolls", async () => {
    const ctx = await opened();
    try {
      // Eight of the eleven beats hold no control inside the ledger once Prepare has hidden its button, and the beat
      // bodies are taller than the box at both presenting sizes, so without a tab stop on the scroll container the
      // overflow is out of every keyboard's reach (WCAG 2.1.1).
      assert.equal(ctx.ledger.getAttribute("tabindex"), "0");
      assert.equal(ctx.find("present-ticker-foot").hidden, false, "and the ticker stands at its foot");
      const children = ctx.ledger.children.map((n) => n.getAttribute("data-role"));
      assert.equal(children.at(-1), "present-ticker-foot", "the ticker is the last thing in the ledger");
    } finally {
      ctx.cleanup();
    }
  });

  test("a figure with no value still names the register it will be read in, never the word its absence produced", () => {
    const ctx = mount();
    try {
      ctx.present.open();
      const chips = ctx.ledger.querySelectorAll('[data-role="figure-chip"]');
      assert.ok(chips.length >= 2);
      for (const chip of chips) assert.equal(chip.textContent, labels.REGISTERS.thisReplay);
      // This is the first screen Present shows, and the screen it holds for the whole of Prepare.
      const words = ctx.ledger.querySelectorAll("*").map((n) => n.textContent).filter((t) => t === "undefined");
      assert.deepEqual(words, [], "no node on the page renders the word an absent field produced");
    } finally {
      ctx.cleanup();
    }
  });

  test("the hour beat counts the riders its own frozen spec measures, and its label says which area", async () => {
    const ctx = await opened();
    try {
      ctx.next().click();
      assert.equal(ctx.beatKey(), "unservedHour");
      const state = ctx.store.getState();
      const area = focusArea(state);
      const hourStart = Math.floor(state.clock_s / 3600) * 3600 - 3600;
      const scoped = computeMetric(
        { ...payload.log, scenario, window: scenario.window },
        { metric: "wait.p90_s", scope: { area, window: { start_s: hourStart, end_s: hourStart + 3600 } } },
      );
      const fleetWide = computeMetric(
        { ...payload.log, scenario, window: scenario.window },
        { metric: "wait.p90_s", scope: { window: { start_s: hourStart, end_s: hourStart + 3600 } } },
      );
      assert.notEqual(scoped.value, fleetWide.value, "the two scopes are two numbers, which is why the label has to say");
      assert.equal(ctx.figure("waitHour"), format.minutes(scoped.value));
      const label = ctx.ledger.querySelector('[data-figure="waitHour"] [data-role="figure-label"]').textContent;
      assert.equal(label, labels.areaHourFigure({ label: PRESENT.figures.waitP90, area: labels.MAP.areas[area], clock: format.clock(hourStart) }));
    } finally {
      ctx.cleanup();
    }
  });

  test("a played beat leaves no two seconds standing in one panel: at its stop clock the narration equals its figures", async () => {
    const ctx = await opened();
    try {
      const beat = CHAPTERS[0].beats[0];
      const stopAt = beat.play(scenario);
      const entry = ctx.find("present-narration").textContent;
      ctx.find("present-play", ctx.rail).click();
      ctx.store.dispatch({ type: "clock/advance", seconds: stopAt - ctx.store.getState().clock_s });
      assert.equal(ctx.store.getState().playing, false, "the stop clock pauses it");
      const now = truth(stopAt);
      const fleet = payload.log.cars.length;
      const waiting = areaTotal(now.model, "waiting");
      const riders = familyTotal(now.model, "riderWork");
      assert.notEqual(ctx.find("present-narration").textContent, entry, "the sentence moved with the clock");
      assert.equal(
        ctx.find("present-narration").textContent,
        labels.narrationPeak({ clock: format.clock(stopAt), waiting, riders, fleet }),
      );
      // The figures beside it are the same second's.
      assert.equal(ctx.figure("waiting"), format.count(waiting));
      assert.equal(ctx.figure("riders"), labels.outOf({ count: riders, total: fleet }));
    } finally {
      ctx.cleanup();
    }
  });

  test("the depot table is built once and then written cell by cell, so a played beat allocates none of it", async () => {
    const ctx = await opened();
    try {
      const cells = () => ctx.find("present-depot-table").querySelectorAll("tbody td");
      const before = cells();
      assert.equal(before.length, scenario.depots.length * 5);
      const made = [];
      const doc = ctx.doc;
      const create = doc.createElement.bind(doc);
      doc.createElement = (tag) => {
        made.push(tag);
        return create(tag);
      };
      try {
        // A played beat renders on every animation frame; the table's twenty cells are compared in place.
        for (let i = 0; i < 6; i += 1) ctx.store.dispatch({ type: "clock/advance", seconds: 300 });
      } finally {
        doc.createElement = create;
      }
      assert.deepEqual(made.filter((tag) => ["table", "thead", "tbody", "tr", "td", "th"].includes(tag)), []);
      const after = cells();
      assert.deepEqual(after.map((n) => n === before[after.indexOf(n)]), after.map(() => true), "the same twenty cells");
      const at_s = truth(ctx.store.getState().clock_s).frame.at_s;
      const views = scenario.depots.map((d) => depotView(payload.log, d.id, at_s));
      assert.deepEqual(
        ctx.find("present-depot-table").querySelectorAll("tbody tr").map((tr) => tr.children[2].textContent),
        views.map((v) => format.count(v.queued)),
        "and they carry the second the clock reached",
      );
    } finally {
      ctx.cleanup();
    }
  });

  test("every operations figure equals what the frame model, the log or the depot view says at that second", async () => {
    const ctx = await opened();
    try {
      const fleet = payload.log.cars.length;
      // 1.1 the evening peak.
      let now = truth(ctx.store.getState().clock_s);
      assert.equal(ctx.figure("waiting"), format.count(areaTotal(now.model, "waiting")));
      assert.equal(ctx.figure("riders"), labels.outOf({ count: familyTotal(now.model, "riderWork"), total: fleet }));

      const next = ctx.next();
      next.click(); // 1.2 the hour of the patience cliff.
      assert.equal(ctx.beatKey(), "unservedHour");
      now = truth(ctx.store.getState().clock_s);
      assert.equal(ctx.figure("unserved"), format.count(areaTotal(now.model, "unservedLastHour")));

      next.click(); // 1.3 the recall.
      now = truth(ctx.store.getState().clock_s);
      assert.equal(ctx.figure("sent"), format.count(eventsAt(payload.log, "DEPOT_ASSIGNED", scenario.policies.recall_s)));
      assert.equal(ctx.figure("toDepot"), format.count(now.frame.cars.filter((c) => c.state === "TO_DEPOT").length));

      next.click(); // 1.4 the depot overnight.
      now = truth(ctx.store.getState().clock_s);
      const views = scenario.depots.map((d) => depotView(payload.log, d.id, now.frame.at_s));
      const depot = focusDepot(ctx.store.getState());
      const here = views.find((v) => v.id === depot);
      assert.equal(ctx.figure("queued"), format.count(views.reduce((n, v) => n + v.queued, 0)));
      assert.equal(ctx.figure("held"), labels.lotFill(here.held, here.stalls));

      next.click(); // 1.5 the morning after.
      now = truth(ctx.store.getState().clock_s);
      const morning = scenario.depots.map((d) => depotView(payload.log, d.id, now.frame.at_s));
      assert.equal(ctx.figure("ready"), format.count(morning.reduce((n, v) => n + v.ready, 0)));
      assert.equal(ctx.figure("home"), format.count(now.frame.cars.filter((c) => c.state === "REPOSITIONING").length));
      assert.equal(ctx.figure("cleared"), format.clock(queueClearedAt(payload.log, depot, scenario.policies.recall_s)));
    } finally {
      ctx.cleanup();
    }
  });

  test("no beat shows more than three figures, and each one carries exactly one register chip", async () => {
    const ctx = await opened();
    try {
      const next = ctx.next();
      // The two registers a figure may carry: the replications the window ran, and a verdict's own paired seeds.
      const across = [labels.acrossReplicationsChip(payload.runs.length), labels.acrossReplicationsChip(VERDICT_SEEDS)];
      for (let i = 0; i < BEAT_ORDER.length; i += 1) {
        const figures = ctx.ledger.querySelectorAll('[data-figure]');
        assert.ok(figures.length <= 3, `${ctx.beatKey()} shows ${String(figures.length)} figures`);
        for (const node of figures) {
          const chip = node.querySelector('[data-role="figure-chip"]');
          const register = chip.getAttribute("class");
          assert.ok(["fl-chip-replay", "fl-chip-across"].includes(register), `${ctx.beatKey()} names the register of every figure`);
          if (register === "fl-chip-replay") assert.equal(chip.textContent, labels.thisReplayChip(payload.log.seed));
          else assert.ok(across.includes(chip.textContent), `${ctx.beatKey()}: ${chip.textContent}`);
        }
        if (i + 1 < BEAT_ORDER.length) next.click();
      }
    } finally {
      ctx.cleanup();
    }
  });

  test("the four-depot table is the drawer's own reading of each depot, on every operations beat", async () => {
    const ctx = await opened();
    try {
      const next = ctx.next();
      for (const beat of CHAPTERS[0].beats) {
        assert.equal(ctx.beatKey(), beat.key);
        const table = ctx.find("present-depot-table");
        assert.equal(table.hidden, false, `${beat.key} shows the depots`);
        const at_s = truth(ctx.store.getState().clock_s).frame.at_s;
        const rows = table.querySelectorAll("tbody tr");
        assert.equal(rows.length, scenario.depots.length);
        rows.forEach((tr, i) => {
          const view = depotView(payload.log, scenario.depots[i].id, at_s);
          assert.deepEqual(
            tr.children.map((td) => td.textContent),
            [view.id, labels.lotFill(view.held, view.stalls), format.count(view.queued), labels.lotFill(view.inBays, view.bays), format.count(view.ready)],
            `${beat.key} ${view.id}`,
          );
        });
        next.click();
      }
      assert.equal(ctx.beatKey(), "registers");
      assert.equal(ctx.find("present-depot-table").hidden, true, "the analytics chapter is not about depots");
    } finally {
      ctx.cleanup();
    }
  });

  test("every beat's mount point is named for it, and every beat of chapters 2 to 4 fills it", async () => {
    const ctx = await opened();
    try {
      const next = ctx.next();
      const filled = [];
      for (let i = 0; i < BEAT_ORDER.length; i += 1) {
        const mountPoint = ctx.content();
        assert.equal(mountPoint.getAttribute("data-beat"), ctx.beatKey());
        if (CHAPTERS[ctx.store.getState().present.chapter].key !== "operations") {
          filled.push(ctx.beatKey());
          assert.ok(mountPoint.children.length > 0, `${ctx.beatKey()} shows its own content`);
        } else {
          assert.equal(mountPoint.children.length, 0, `${ctx.beatKey()} shows the world and the depots, not a panel`);
        }
        if (i + 1 < BEAT_ORDER.length) next.click();
      }
      assert.deepEqual(filled, ["registers", "verdict", "frame", "arms", "standsFor", "refusals"]);
    } finally {
      ctx.cleanup();
    }
  });

  test("the narration is generated from the run, speaks once a beat, and never more than three lines", async () => {
    const ctx = await opened();
    try {
      const narration = ctx.find("present-narration");
      assert.equal(narration.getAttribute("aria-live"), "polite");
      const now = truth(ctx.store.getState().clock_s);
      assert.deepEqual(
        narration.children.map((p) => p.textContent),
        [labels.narrationPeak({
          clock: format.clock(ctx.store.getState().clock_s),
          waiting: areaTotal(now.model, "waiting"),
          riders: familyTotal(now.model, "riderWork"),
          fleet: payload.log.cars.length,
        })],
      );
      const spoken = narration.textContent;
      ctx.store.dispatch({ type: "clock/advance", seconds: 300 });
      assert.equal(narration.textContent, spoken, "a beat speaks once, not once a frame");
      ctx.next().click();
      assert.notEqual(narration.textContent, spoken);
    } finally {
      ctx.cleanup();
    }
  });

  test("the ticker carries what just happened and is redrawn only when a new event joins it", async () => {
    const ctx = await opened();
    try {
      const next = ctx.next();
      while (ctx.beatKey() !== "recall") next.click();
      const ticker = ctx.find("present-ticker");
      const lines = tickerLines(payload.log, scenario, truth(ctx.store.getState().clock_s).frame.at_s);
      assert.deepEqual(ticker.children.map((p) => p.children[1].textContent), lines.map((l) => l.text));
      assert.equal(ticker.children[0].children[0].textContent, lines[0].clock);
      assert.equal(ctx.find("present-ticker-heading").textContent, PRESENT.ticker);
      const first = ticker.children[0];
      ctx.store.dispatch({ type: "selection/set", selection: null });
      assert.equal(ctx.find("present-ticker").children[0], first, "no new event, no redraw");
    } finally {
      ctx.cleanup();
    }
  });

  test("leaving the walkthrough stops its voice", async () => {
    const ctx = await opened();
    try {
      assert.ok(ctx.find("present-narration").children.length > 0);
      ctx.present.close();
      assert.equal(ctx.store.getState().present.on, false);
      assert.equal(ctx.find("present-narration").children.length, 0);
      assert.equal(ctx.store.getState().playing, false);
    } finally {
      ctx.cleanup();
    }
  });
});

describe("what chapters 2 to 4 show", () => {
  /** Walks Next from where the walk stands to the beat named `key`. */
  function walkTo(ctx, key) {
    const next = ctx.next();
    while (ctx.beatKey() !== key) next.click();
  }

  test("the registers beat mounts the registry in two registers, the two charts by hour, and one row as its figures", async () => {
    const ctx = await opened();
    try {
      walkTo(ctx, "registers");
      const registry = ctx.content().querySelector('[data-role="registry"]');
      assert.ok(registry, "the registry is mounted");
      assert.equal(registry.querySelector('[data-role="registry-replay-chip"]').textContent, labels.thisReplayChip(payload.log.seed));
      assert.equal(registry.querySelector('[data-role="registry-across-chip"]').textContent, labels.acrossReplicationsChip(payload.runs.length));
      assert.equal(registry.querySelectorAll("tbody tr").length, REGISTRY_PREVIEW.length);
      const hourly = ctx.content().querySelector('[data-role="hourly-pair"]');
      assert.deepEqual(hourly.querySelectorAll("figure.fl-chart").map((f) => f.getAttribute("data-chart")), ["wait_p90_by_hour", "bay_wait_by_depot"]);
      // The beat's two figures are the registry's own wait row, one register each, so they cannot disagree with it.
      const wait = registryRows({ summaries: ctx.store.getState().run.summaries, seed: payload.log.seed }).find((row) => row.metric === "wait.p90_s");
      assert.equal(ctx.figure("waitReplay"), wait.replay);
      assert.equal(ctx.figure("waitAcross"), wait.across);
      assert.notEqual(wait.replay, wait.across, "the two registers are two values");
    } finally {
      ctx.cleanup();
    }
  });

  test("all rows opens every metric the replications carry, and the walk keeps its place", async () => {
    const ctx = await opened();
    try {
      walkTo(ctx, "registers");
      const registry = () => ctx.content().querySelector('[data-role="registry"]');
      const toggle = () => ctx.content().querySelector('[data-role="registry-all"]');
      assert.equal(toggle().textContent, labels.VERDICT.allRows);
      assert.equal(registry().querySelectorAll("tbody tr").length, REGISTRY_PREVIEW.length);
      toggle().click();
      // The registry's own rows, not the tables the two charts beside it carry.
      assert.equal(registry().querySelectorAll("tbody tr").length, Object.keys(ctx.store.getState().run.summaries[0].metrics).length);
      assert.equal(toggle().textContent, labels.VERDICT.fewerRows);
      assert.equal(ctx.beatKey(), "registers", "opening the rest of the registry is not a step of the walk");
    } finally {
      ctx.cleanup();
    }
  });

  test("the verdict beat mounts the readout and the frozen spec in words, and its figure carries the paired seeds", async () => {
    const ctx = await opened();
    try {
      walkTo(ctx, "verdict");
      const state = ctx.store.getState();
      const spec = state.experiment.frozen.spec;
      assert.equal(ctx.content().querySelector('[data-role="present-spec"]').textContent, specInWords(spec));
      const readout = ctx.content().querySelector("article.fl-readout");
      assert.ok(readout, "the readout is the verdict card's own article");
      assert.equal(readout.querySelector('[data-role="teaching-chip"]').textContent, labels.verdictHeader(spec.seeds.length));
      assert.equal(readout.lastChild.textContent, labels.HONESTY.verdictFooter);
      const p = state.experiment.verdict.primary;
      assert.equal(ctx.figure("meanDelta"), valueWithMinutes(p.metric, p.mean_delta, { withSign: true }));
      assert.equal(ctx.ledger.querySelector('[data-figure="meanDelta"] [data-role="figure-chip"]').textContent, labels.acrossReplicationsChip(spec.seeds.length));
    } finally {
      ctx.cleanup();
    }
  });

  test("the frame beat says where the frame came from, counts this replay's own events, and writes its line in place", async () => {
    const ctx = await opened();
    try {
      walkTo(ctx, "frame");
      const now = () => truth(ctx.store.getState().clock_s);
      const expected = (frame) => labels.frameLine({ snapshot: format.clockSeconds(frame.snapshot_t), drawn: format.clockSeconds(frame.at_s), interpolated: frame.at_s !== frame.snapshot_t });
      const line = ctx.content().querySelector('[data-role="present-frame-line"]');
      assert.equal(line.textContent, expected(now().frame));
      assert.equal(ctx.figure("onLeg"), labels.outOf({ count: now().model.onRoutes.length, total: payload.log.cars.length }));
      assert.equal(ctx.figure("events"), labels.outOf({ count: format.count(eventsSoFar(payload.log, now().frame.at_s)), total: format.count(payload.log.events.length) }));
      ctx.store.dispatch({ type: "clock/advance", seconds: 600 });
      assert.equal(ctx.content().querySelector('[data-role="present-frame-line"]'), line, "the line is written in place, never rebuilt");
      assert.equal(line.textContent, expected(now().frame));
      assert.equal(ctx.content().querySelector('[data-role="present-snapshots"]').textContent, labels.snapshotsLine({
        snapshots: payload.log.snapshots.length,
        every: format.minutes(payload.log.snapshots[1].t - payload.log.snapshots[0].t),
        engine: labels.absentValue(labels.ABSENT_REASONS.enginePathNotReported),
        replications: payload.runs.length,
        took: format.seconds(1.234, 1),
      }));
      assert.equal(ctx.content().querySelector('[data-role="present-validation"]').textContent, labels.validationLine({
        invariants: CHECK_IDS.length,
        cases: PRESETS.filter((preset) => preset.kind === "ops").length,
      }));
    } finally {
      ctx.cleanup();
    }
  });

  test("the arms beat watches the verdict's own seed and says why the picture steps aside", async () => {
    const ctx = await opened();
    try {
      walkTo(ctx, "arms");
      const state = ctx.store.getState();
      const seed = state.experiment.selectedSeed;
      const seeds = state.experiment.frozen.spec.seeds;
      assert.ok(seed !== null, "the verdict chose the seed to watch");
      assert.deepEqual(ctx.watched, [seed], "the walk asked the page to open that seed's fork, once");
      assert.equal(ctx.content().querySelector('[data-role="present-now-watching"]').textContent, labels.nowWatching({ seed, index: seeds.indexOf(seed) + 1, total: seeds.length }));
      assert.equal(ctx.content().querySelector('[data-role="present-fork-note"]').textContent, labels.FORK.verdictSeedNote);
      assert.equal(ctx.content().querySelector('[data-role="present-fork-caption"]').textContent, labels.HONESTY.forkCaption);
    } finally {
      ctx.cleanup();
    }
  });

  test("the product beat carries the casebook record's own copy and what this run trades", async () => {
    const ctx = await opened();
    try {
      walkTo(ctx, "standsFor");
      const preset = presetById(PRESENT_PRESET_ID);
      const content = ctx.content();
      assert.equal(content.querySelector('[data-role="situation"]').textContent, preset.situation);
      assert.deepEqual(content.querySelectorAll('[data-role="outside-model"] li').map((li) => li.textContent), [...preset.outsideModel]);
      assert.equal(content.querySelector('[data-role="watch"]').textContent, preset.watch);
      const state = ctx.store.getState();
      const sentence = tradeOffSentence({ verdict: state.experiment.verdict, frozen: state.experiment.frozen });
      assert.equal(content.querySelector('[data-role="present-trade-off"]')?.textContent ?? null, sentence);
    } finally {
      ctx.cleanup();
    }
  });

  test("the last beat lists the refusals and the next question by title and situation, never a verdict (H-9)", async () => {
    const ctx = await opened();
    try {
      walkTo(ctx, "refusals");
      const content = ctx.content();
      assert.deepEqual(content.querySelectorAll('[data-role="present-refusals"] li').map((li) => li.textContent), [...PRESENT.refusals]);
      const next = nextCasebookPreset();
      assert.equal(content.querySelector('[data-role="present-next-title"]').textContent, labels.presetOption({ id: next.id, title: next.title }));
      assert.equal(content.querySelector('[data-role="present-next-situation"]').textContent, next.situation);
      const words = [...Object.values(labels.STATUS_WORDS.outcome), ...Object.values(labels.STATUS_WORDS.recommendation)].map((w) => w.word);
      for (const word of words) assert.ok(!content.textContent.includes(word), `${word} is not said about a case this page has not run`);
      content.querySelector('[data-role="present-open-next"]').click();
      const state = ctx.store.getState();
      assert.equal(state.present.on, false, "the handoff leaves the walkthrough");
      assert.equal(state.mode, "experiment");
      assert.equal(state.experiment.draft.axis.id, presetById(next.id).experiment.axis.id, "the next question's own setup is loaded");
    } finally {
      ctx.cleanup();
    }
  });
});

describe("copy and classes", () => {
  /** Every string the walk renders: the PRESENT tables, and each template with the arguments the walk gives it. */
  function everyWalkString() {
    const out = [];
    const walk = (value, path) => {
      if (typeof value === "string") out.push({ path, text: value });
      else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${String(i)}]`));
      else if (value !== null && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    };
    walk(PRESENT, "PRESENT");
    const samples = [
      ["stepOf", [4, 5]],
      ["outOf", [{ count: 113, total: 120 }]],
      ["depotFigure", [{ depot: "SF-2", label: PRESENT.figures.stallsHeld }]],
      ["hourFigure", [{ label: PRESENT.figures.waitP90, clock: "D1 18:00" }]],
      ["yourClock", ["4.8 s"]],
      ["prepareTimes", [{ window: "1.2 s", experiment: "4.8 s" }]],
      ["tickerUnserved", [{ area: "San Francisco", after: "10 min" }]],
      ["tickerRecall", [77]],
      ["tickerBay", [{ car: "SF-040", after: "250 min" }]],
      ["tickerQueued", [{ car: "SF-040", depot: "SF-2" }]],
      ["narrationPeak", [{ clock: "D1 17:30", waiting: 15, riders: 113, fleet: 120 }]],
      ["narrationUnservedHour", [{ clock: "D1 18:00", unserved: 63, wait: "68 min" }]],
      ["narrationRecall", [{ clock: "D2 00:30", sent: 77, driving: 82 }]],
      ["narrationDepots", [{ clock: "D2 02:00", queued: 56, depot: "SF-2", held: 25, stalls: 30 }]],
      ["narrationRelease", [{ clock: "D2 05:45", home: 12, ready: 64 }]],
      ["narrationPinnedBay", [{ car: "SF-040", took: "D2 05:34", ready: "D2 05:54", release: "D2 05:45", before: false }]],
      ["narrationQueueCleared", [{ depot: "SF-2", cleared: "D2 05:34", release: "D2 05:45", before: true }]],
      ["frameLine", [{ snapshot: "D2 00:45", drawn: "D2 00:46", interpolated: true }]],
      ["snapshotsLine", [{ snapshots: 369, every: "5 min", engine: "engine: worker", replications: 5, took: "1.2 s" }]],
      ["validationLine", [{ invariants: 19, cases: 20 }]],
      ["specSentence", [{ axis: "parameter:SUP-1.SF", margin: "60 s", guardrails: 2, seeds: 20, resamples: "2,000" }]],
      ["narrationRegisters", [5]],
      ["narrationVerdict", [{ seeds: 20, resamples: 2000 }]],
      ["narrationFrame", [{ snapshot: "D2 00:45", drawn: "D2 00:46" }]],
      ["narrationArms", [{ seed: 1006, index: 6, total: 20 }]],
      ["narrationSituation", ["OPS-01"]],
      ["narrationNext", ["OPS-02 Late night recall: 00:30 or 02:00"]],
    ];
    for (const [name, args] of samples) out.push({ path: name, text: labels[name](...args) });
    return out;
  }

  test("no string the walk renders states a direction the pins do not carry (H-9)", () => {
    const strings = everyWalkString();
    assert.ok(strings.length > 60, `only ${String(strings.length)} strings reached`);
    const directional = strings.filter((s) => DIRECTION.test(s.text)).map((s) => `${s.path}: ${s.text}`);
    assert.deepEqual(directional, []);
  });

  test("no string the walk renders carries a banned word, a winner word or a dash", () => {
    for (const { path, text } of everyWalkString()) {
      assert.doesNotMatch(text, BANNED_WORDS, path);
      assert.doesNotMatch(text, H6_WORDS, path);
      assert.doesNotMatch(text, DASHES, path);
    }
  });

  test("the refusals say what this page is not, each with its reason, in the second person", () => {
    assert.equal(PRESENT.refusals.length, 5);
    for (const row of PRESENT.refusals) {
      assert.ok(row.includes(":"), row);
      assert.doesNotMatch(row, /\bI\b|\bwe\b|\bour\b/i, row);
    }
  });

  test("every class the walkthrough sets is defined in styles.css, listed in its header inventory, and carries no motion", () => {
    const classes = new Set([...SOURCE.matchAll(/fl-(?:ledger|ticker|rail|reading-card)[\w-]*/g)].map((m) => m[0]));
    assert.ok(classes.size >= 8, [...classes].join(","));
    const header = CSS.slice(0, CSS.indexOf("*/"));
    for (const name of classes) {
      assert.match(CSS, new RegExp(`\\.${name}(?![\\w-])`), `styles.css defines .${name}`);
      assert.match(header, new RegExp(`\\.${name}(?![\\w-])`), `the header inventory lists .${name}`);
    }
    assert.ok(CSS.includes("/* The walkthrough"), "the walkthrough's rules say what they are for");
    // A beat change is instant, so no rule of the walkthrough or of the presenting grid may animate. Comments are
    // dropped first: the block's own comment says the word "transition" to explain why there is none.
    const declarations = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const walkRules = declarations.split("}").filter((rule) => /\.fl-(?:ledger|ticker|rail|reading-card)|data-present/.test(rule));
    assert.ok(walkRules.length >= 10, `only ${String(walkRules.length)} walkthrough rules`);
    for (const rule of walkRules) assert.doesNotMatch(rule, /transition|animation|will-change/, rule.trim().slice(0, 80));
  });

  test("the walkthrough drives no frame of its own and writes no text outside labels.js", () => {
    assert.doesNotMatch(SOURCE, /requestAnimationFrame|setInterval|setTimeout/);
    assert.doesNotMatch(SOURCE, /innerHTML|document\.write/);
    // Every string the module renders comes from labels.js: no bare quoted sentence reaches a node.
    assert.doesNotMatch(SOURCE, /textContent\s*=\s*"/);
  });
});
