import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  SPEEDS,
  changeCount,
  createInitialState,
  createStore,
  isReducedMotion,
  largestDeltaSeed,
  lastChange,
  medianDeltaSeed,
  reduce,
  sandboxChangesSinceFreeze,
} from "../src/ui/store.js";

/** A small fake scenario in engine units; only the fields the store reads, plus knobs to change. */
function fakeScenario(name = "bay_teaching_map") {
  return {
    name,
    window: { start_s: 18000, end_s: 122400 }, // D1 05:00 to D2 10:00
    peaks: [
      { start_h: 7, end_h: 9 },
      { start_h: 16, end_h: 19 },
    ],
    areas: [
      { id: "SF", cars: 30 },
      { id: "PEN", cars: 18 },
      { id: "SJ", cars: 24 },
      { id: "EB", cars: 18 },
    ],
    depots: [{ id: "SJ-1", area: "SJ", cleaning_bays: 3 }],
    policies: { depot_assignment: "home_depot" },
    patience_s: 600,
  };
}

/** Freeze a value and everything inside it. */
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Apply one action to a deeply frozen state; the previous state must be byte-for-byte unchanged. */
function step(state, action) {
  deepFreeze(state);
  const before = JSON.stringify(state);
  const next = reduce(state, action);
  assert.equal(JSON.stringify(state), before, `${action.type} changed the previous state`);
  return deepFreeze(next);
}

/** Apply actions in order. */
function steps(state, actions) {
  return actions.reduce(step, state);
}

const initial = () => createInitialState({ presetId: "bay", scenario: fakeScenario() });

const SJ_CARS = { type: "knob/set", knob: "SUP-1.SJ", path: ["areas", 2, "cars"], value: 16 };
const SJ1_BAYS = { type: "knob/set", knob: "DEP-3.SJ-1", path: ["depots", 0, "cleaning_bays"], value: 1 };
const ASSIGN = { type: "knob/set", knob: "POL-2", axis: "policy:depot_assignment", path: ["policies", "depot_assignment"], value: "nearest_depot" };

/** A spec shaped like contract 6.6 with ten seeds of set 1. */
function fakeSpec(seedSet = 1) {
  const seeds = Array.from({ length: 10 }, (_, i) => 1000 * seedSet + 1 + i);
  return { format: "fleetlab-playground-spec", seed_set: seedSet, seeds, resamples: 2000 };
}

const DIGEST = "3f9a1c2e7b4d5a6c8e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f";

/** A valid verdict whose primary deltas are written here, one per seed 1001 to 1010. */
function validVerdict(deltas = [5, -40, 12, 3, 90, -7, 0, 8, -2, 15]) {
  return {
    validity: "VALID",
    outcome: "INCONCLUSIVE",
    recommendation: "RUN_MORE_EXPERIMENTS",
    primary: { metric: "wait.p90_s", paired_deltas: deltas },
  };
}

/** State frozen on the fake spec and waiting for its verdict. */
function frozenState(extra = []) {
  return steps(initial(), [
    { type: "engine/path", path: "worker" },
    ...extra,
    { type: "mode/set", mode: "experiment" },
    { type: "experiment/freeze", id: "x1", spec: fakeSpec(), digest: DIGEST, label: "playground-spec:3f9a1c2e", frozenAt: "14:02" },
  ]);
}

describe("createInitialState and createStore", () => {
  test("initial state holds every contract key", () => {
    const s = initial();
    for (const key of ["mode", "presetId", "scenario", "changes", "run", "clock_s", "playing", "speed", "selection", "inspector", "fork", "experiment", "reference", "learn", "reducedMotion", "engine"]) {
      assert.ok(key in s, key);
    }
    assert.equal(s.mode, "sandbox");
    assert.equal(s.clock_s, 18000);
    assert.equal(s.speed, 900);
    assert.equal(s.run.status, "idle");
    assert.deepEqual(s.experiment.sessionLog, []);
  });

  test("dispatch, subscribe, getState and unsubscribe", () => {
    const store = createStore(initial());
    const seen = [];
    const off = store.subscribe((state, action) => seen.push([state.speed, action.type]));
    store.dispatch({ type: "playback/speed", speed: 60 });
    store.dispatch({ type: "playback/speed", speed: 60 }); // same value still makes a new object
    store.dispatch({ type: "no/such-action" }); // unchanged state notifies nobody
    off();
    store.dispatch({ type: "playback/speed", speed: 300 });
    assert.equal(store.getState().speed, 300);
    assert.deepEqual(seen, [
      [60, "playback/speed"],
      [60, "playback/speed"],
    ]);
    assert.throws(() => store.dispatch({}), TypeError);
    assert.throws(() => createStore(null), TypeError);
  });

  test("an unknown action returns the same state object", () => {
    const s = deepFreeze(initial());
    assert.equal(reduce(s, { type: "nothing/here" }), s);
  });
});

describe("modes and carried state (design §7.1)", () => {
  test("Learn to Sandbox keeps the preset, the clock and the selected entity", () => {
    let s = steps(initial(), [
      { type: "learn/case", caseId: "L3", clock_s: 66600 },
      { type: "selection/set", selection: { car: "SF-017" } },
    ]);
    assert.equal(s.mode, "learn");
    const run = s.run;
    s = step(s, { type: "mode/set", mode: "sandbox" });
    assert.equal(s.mode, "sandbox");
    assert.equal(s.presetId, "bay");
    assert.equal(s.clock_s, 66600);
    assert.deepEqual(s.selection, { car: "SF-017" });
    assert.equal(s.run, run, "no recomputation on a mode switch");
  });

  test("Sandbox to Experiment makes the scenario the baseline and pre-fills the axis from the last change", () => {
    const s = steps(initial(), [SJ_CARS, ASSIGN, { type: "mode/set", mode: "experiment" }]);
    assert.equal(s.experiment.draft.baselineScenario, s.scenario);
    assert.deepEqual(s.experiment.draft.axis, { id: "policy:depot_assignment", baseline: "home_depot", candidate: "nearest_depot" });
    assert.equal(s.experiment.draft.axisSource, "sandbox");
  });

  test("a parameter knob pre-fills a parameter axis with its old and new values", () => {
    const s = steps(initial(), [SJ1_BAYS, { type: "mode/set", mode: "experiment" }]);
    assert.deepEqual(s.experiment.draft.axis, { id: "parameter:DEP-3.SJ-1", baseline: 3, candidate: 1 });
  });

  test("an axis the user wrote is not overwritten by a later mode switch", () => {
    const userAxis = { id: "parameter:DEP-4", baseline: 1200, candidate: 900 };
    const s = steps(initial(), [
      SJ_CARS,
      { type: "mode/set", mode: "experiment" },
      { type: "experiment/draft", patch: { axis: userAxis } },
      { type: "mode/set", mode: "sandbox" },
      SJ1_BAYS,
      { type: "mode/set", mode: "experiment" },
    ]);
    assert.deepEqual(s.experiment.draft.axis, userAxis);
    assert.equal(s.experiment.draft.baselineScenario, s.scenario);
  });

  test("switching to the current mode returns the same state; an unknown mode throws", () => {
    const s = deepFreeze(initial());
    assert.equal(reduce(s, { type: "mode/set", mode: "sandbox" }), s);
    assert.throws(() => reduce(s, { type: "mode/set", mode: "inspect" }), TypeError);
  });

  test("Test it properly opens Experiment on the Learn preset with the axis filled in", () => {
    const axis = { id: "policy:depot_assignment", baseline: "home_depot", candidate: "nearest_depot" };
    const s = steps(initial(), [
      { type: "learn/case", caseId: "L3" },
      { type: "learn/testItProperly", draft: { axis, question: "Home depot or nearest depot?" } },
    ]);
    assert.equal(s.mode, "experiment");
    assert.deepEqual(s.experiment.draft.axis, axis);
    assert.equal(s.experiment.draft.question, "Home depot or nearest depot?");
    assert.equal(s.experiment.draft.baselineScenario, s.scenario);
    assert.equal(s.experiment.draft.axisSource, "learn");
  });
});

describe("presets and knobs", () => {
  test("a knob change applies the value and lists the change", () => {
    const s0 = initial();
    const s = step(s0, SJ_CARS);
    assert.equal(s.scenario.areas[2].cars, 16);
    assert.equal(s0.scenario.areas[2].cars, 24);
    assert.equal(s.scenario.areas[0], s0.scenario.areas[0], "untouched branches are shared");
    assert.deepEqual(s.changes, [{ knob: "SUP-1.SJ", axis: "parameter:SUP-1.SJ", path: ["areas", 2, "cars"], from: 24, to: 16 }]);
    assert.equal(changeCount(s), 1);
  });

  test("changing a knob twice keeps its preset value as from and moves it to the end", () => {
    const s = steps(initial(), [SJ_CARS, SJ1_BAYS, { ...SJ_CARS, value: 20 }]);
    assert.deepEqual(s.changes.map((c) => [c.knob, c.from, c.to]), [
      ["DEP-3.SJ-1", 3, 1],
      ["SUP-1.SJ", 24, 20],
    ]);
    assert.equal(lastChange(s).knob, "SUP-1.SJ");
  });

  test("setting a knob back to its preset value removes the change", () => {
    const s = steps(initial(), [SJ_CARS, { ...SJ_CARS, value: 24 }]);
    assert.deepEqual(s.changes, []);
    assert.equal(lastChange(s), null);
  });

  test("per-change reset restores one knob and keeps the others", () => {
    const s = steps(initial(), [SJ_CARS, SJ1_BAYS, { type: "knob/reset", knob: "SUP-1.SJ" }]);
    assert.equal(s.scenario.areas[2].cars, 24);
    assert.equal(s.scenario.depots[0].cleaning_bays, 1);
    assert.deepEqual(s.changes.map((c) => c.knob), ["DEP-3.SJ-1"]);
  });

  test("reset all restores every knob; resetting an unchanged knob returns the same state", () => {
    const s = steps(initial(), [SJ_CARS, SJ1_BAYS, ASSIGN, { type: "knob/resetAll" }]);
    assert.deepEqual(s.scenario, fakeScenario());
    assert.deepEqual(s.changes, []);
    assert.equal(reduce(s, { type: "knob/reset", knob: "SUP-1.SJ" }), s);
    assert.equal(reduce(s, { type: "knob/resetAll" }), s);
  });

  test("a bad path or knob id throws", () => {
    const s = deepFreeze(initial());
    assert.throws(() => reduce(s, { ...SJ_CARS, path: [] }), TypeError);
    assert.throws(() => reduce(s, { ...SJ_CARS, path: ["areas", 9, "cars"] }), Error);
    assert.throws(() => reduce(s, { ...SJ_CARS, knob: undefined }), TypeError);
  });

  test("preset selection replaces the scenario, clears changes and clamps the clock", () => {
    const other = fakeScenario("evening_depot_visit");
    other.window = { start_s: 18000, end_s: 50000 };
    const s = steps(initial(), [SJ_CARS, { type: "clock/set", clock_s: 90000 }, { type: "preset/select", presetId: "uc07", scenario: other }]);
    assert.equal(s.presetId, "uc07");
    assert.equal(s.scenario.name, "evening_depot_visit");
    assert.deepEqual(s.changes, []);
    assert.equal(s.clock_s, 50000);
  });
});

describe("stale results", () => {
  const done = () =>
    steps(initial(), [
      { type: "run/queued", id: "r1", total: 5 },
      { type: "run/done", id: "r1", payload: { runs: [{ seed: 1001, world_digest: "w", metrics: { "wait.p90_s": 600 }, series: {}, invariant_violations: [] }], log: { seed: 1001, events: [] } } },
    ]);

  test("a knob change marks a finished run out of date and keeps its results", () => {
    const s0 = done();
    assert.equal(s0.run.stale, false);
    const s = step(s0, SJ_CARS);
    assert.equal(s.run.stale, true);
    assert.equal(s.run.status, "done");
    assert.deepEqual(s.run.summaries, s0.run.summaries);
  });

  test("reset, reset all, preset selection and run/stale also mark results out of date", () => {
    for (const action of [{ type: "knob/reset", knob: "SUP-1.SJ" }, { type: "knob/resetAll" }]) {
      const s = steps(done(), [SJ_CARS, { type: "run/queued", id: "r2" }]);
      // A fresh result, then the reset.
      const fresh = steps(s, [{ type: "run/done", id: "r2", payload: { runs: [{ seed: 1001, invariant_violations: [] }], log: null } }]);
      assert.equal(fresh.run.stale, false);
      assert.equal(step(fresh, action).run.stale, true, action.type);
    }
    assert.equal(step(done(), { type: "preset/select", presetId: "b", scenario: fakeScenario("b") }).run.stale, true);
    assert.equal(step(done(), { type: "run/stale" }).run.stale, true);
  });

  test("nothing to mark returns the same state", () => {
    const s = deepFreeze(initial());
    assert.equal(reduce(s, { type: "run/stale" }), s);
  });

  test("a knob or preset change while a run or fork is in flight marks its result out of date when it arrives", () => {
    const result = (id) => ({ type: "run/done", id, payload: { runs: [{ seed: 1001, world_digest: "w", metrics: {}, series: {}, invariant_violations: [] }], log: null } });
    // The first run of the session: nothing was on screen to mark when the knob moved.
    let s = steps(initial(), [{ type: "run/queued", id: "r1" }, SJ_CARS, result("r1")]);
    assert.equal(s.run.status, "done");
    assert.equal(s.run.stale, true, "computed on 24 SJ cars, shown with 16");
    assert.equal(s.run.summaries.length, 1, "the result stays visible");
    // A later run with earlier results on screen.
    s = steps(done(), [{ type: "run/queued", id: "r2" }, SJ_CARS]);
    assert.equal(s.run.stale, true);
    assert.equal(step(s, result("r2")).run.stale, true);
    // A preset change counts too; a run queued after the change is current.
    s = steps(initial(), [{ type: "run/queued", id: "r3" }, { type: "preset/select", presetId: "b", scenario: fakeScenario("b") }, result("r3")]);
    assert.equal(s.run.stale, true);
    assert.equal(steps(s, [{ type: "run/queued", id: "r4" }, result("r4")]).run.stale, false);

    let f = steps(initial(), [{ type: "fork/open", id: "f1", car: "SF-017" }, SJ_CARS, { type: "fork/result", id: "f1", pair: { world_digest: "w" } }]);
    assert.equal(f.fork.status, "open");
    assert.equal(f.fork.stale, true);
    f = steps(f, [{ type: "fork/open", id: "f2" }, { type: "fork/result", id: "f2", pair: { world_digest: "v" } }]);
    assert.equal(f.fork.stale, false, "a fork opened after the change is current");
  });

  test("a scenario change marks an open fork out of date", () => {
    const s = steps(initial(), [
      { type: "fork/open", id: "f1", car: "SF-017" },
      { type: "fork/result", id: "f1", pair: { world_digest: "w" } },
      SJ_CARS,
    ]);
    assert.equal(s.fork.stale, true);
    assert.deepEqual(s.fork.pair, { world_digest: "w" });
  });
});

describe("run lifecycle", () => {
  test("queued, progress and done", () => {
    let s = step(initial(), { type: "run/queued", id: "r1", total: 5, label: "Replication 0 of 5" });
    assert.equal(s.run.status, "queued");
    assert.deepEqual(s.run.progress, { done: 0, total: 5, label: "Replication 0 of 5" });
    s = step(s, { type: "run/progress", id: "r1", done: 3, total: 5, label: "Replication 3 of 5" });
    assert.equal(s.run.status, "running");
    assert.equal(s.run.progress.done, 3);
    s = step(s, {
      type: "run/done",
      id: "r1",
      payload: {
        runs: [
          { seed: 1001, world_digest: "a", metrics: { m: 1 }, series: { s: [] }, invariant_violations: [] },
          { seed: 1002, world_digest: "b", metrics: { m: 2 }, series: { s: [] }, invariant_violations: [] },
        ],
        log: { seed: 1001, events: [] },
      },
    });
    assert.equal(s.run.status, "done");
    assert.equal(s.run.progress, null);
    assert.equal(s.run.summaries.length, 2);
    assert.equal(s.run.selectedSeed, 1001);
    assert.deepEqual(s.run.log, { seed: 1001, events: [] });
  });

  test("a message for another run id is ignored", () => {
    const s = step(initial(), { type: "run/queued", id: "r2" });
    for (const action of [
      { type: "run/progress", id: "r1", done: 1, total: 5, label: "" },
      { type: "run/done", id: "r1", payload: { runs: [] } },
      { type: "run/error", id: "r1", message: "x" },
      { type: "run/cancelled", id: "r1" },
    ]) {
      assert.equal(reduce(s, action), s, action.type);
    }
  });

  test("an invariant violation voids the run and shows nothing", () => {
    const s = steps(initial(), [
      { type: "run/queued", id: "r1" },
      { type: "run/done", id: "r1", payload: { runs: [{ seed: 1001, metrics: { m: 1 }, invariant_violations: ["2: SF-003 holds r-SF-4 and r-SF-9"] }], log: { seed: 1001 } } },
    ]);
    assert.equal(s.run.status, "void");
    assert.equal(s.run.violation, "2: SF-003 holds r-SF-4 and r-SF-9");
    assert.deepEqual(s.run.summaries, []);
    assert.equal(s.run.log, null);
  });

  test("error stops playback and keeps the knobs and previous results", () => {
    const s = steps(initial(), [
      SJ_CARS,
      { type: "run/queued", id: "r1" },
      { type: "run/done", id: "r1", payload: { runs: [{ seed: 1001, invariant_violations: [] }], log: null } },
      { type: "playback/play" },
      { type: "run/queued", id: "r2" },
      { type: "run/error", id: "r2", message: "worker stopped" },
    ]);
    assert.equal(s.run.status, "error");
    assert.equal(s.run.error, "worker stopped");
    assert.equal(s.playing, false);
    assert.equal(s.run.summaries.length, 1);
    assert.equal(s.scenario.areas[2].cars, 16);
  });

  test("cancel keeps the previous result", () => {
    const s = steps(initial(), [
      { type: "run/queued", id: "r1" },
      { type: "run/done", id: "r1", payload: { runs: [{ seed: 1001, invariant_violations: [] }], log: null } },
      { type: "run/queued", id: "r2" },
      { type: "run/cancelled", id: "r2" },
    ]);
    assert.equal(s.run.status, "cancelled");
    assert.equal(s.run.progress, null);
    assert.equal(s.run.summaries.length, 1);
  });
});

describe("clock and playback (design §7.4)", () => {
  test("play, pause and toggle", () => {
    let s = step(initial(), { type: "playback/play" });
    assert.equal(s.playing, true);
    assert.equal(reduce(s, { type: "playback/play" }), s);
    s = step(s, { type: "playback/pause" });
    assert.equal(s.playing, false);
    assert.equal(reduce(s, { type: "playback/pause" }), s);
    s = step(s, { type: "playback/toggle" });
    assert.equal(s.playing, true);
    s = step(s, { type: "playback/toggle" });
    assert.equal(s.playing, false);
  });

  test("speeds 60, 300, 900 and 3600, faster and slower stop at the ends", () => {
    assert.deepEqual(SPEEDS, [60, 300, 900, 3600]);
    let s = initial();
    for (const speed of SPEEDS) {
      s = step(s, { type: "playback/speed", speed });
      assert.equal(s.speed, speed);
    }
    assert.throws(() => reduce(s, { type: "playback/speed", speed: 120 }), TypeError);
    assert.equal(reduce(s, { type: "playback/faster" }), s);
    s = steps(s, [{ type: "playback/slower" }, { type: "playback/slower" }, { type: "playback/slower" }]);
    assert.equal(s.speed, 60);
    assert.equal(reduce(s, { type: "playback/slower" }), s);
    assert.equal(step(s, { type: "playback/faster" }).speed, 300);
  });

  test("step 5 minutes or 1 hour, clamped to the window", () => {
    let s = step(initial(), { type: "clock/step", unit: "5min", direction: 1 });
    assert.equal(s.clock_s, 18300); // 18000 + 300
    s = step(s, { type: "clock/step", unit: "1h", direction: 1 });
    assert.equal(s.clock_s, 21900); // 18300 + 3600
    s = step(s, { type: "clock/step", unit: "1h", direction: -1 });
    s = step(s, { type: "clock/step", unit: "1h", direction: -1 });
    assert.equal(s.clock_s, 18000, "clamped at the window start");
    assert.throws(() => reduce(s, { type: "clock/step", unit: "10min", direction: 1 }), TypeError);
    assert.throws(() => reduce(s, { type: "clock/step", unit: "5min", direction: 2 }), TypeError);
  });

  test("set and advance clamp; reaching the window end stops playback", () => {
    let s = step(initial(), { type: "clock/set", clock_s: 999999 });
    assert.equal(s.clock_s, 122400);
    s = steps(initial(), [{ type: "clock/set", clock_s: 122000 }, { type: "playback/play" }, { type: "clock/advance", seconds: 300 }]);
    assert.equal(s.clock_s, 122300);
    assert.equal(s.playing, true);
    s = step(s, { type: "clock/advance", seconds: 900 });
    assert.equal(s.clock_s, 122400);
    assert.equal(s.playing, false);
    assert.equal(reduce(s, { type: "playback/play" }), s, "no play at the window end");
    assert.throws(() => reduce(s, { type: "clock/set", clock_s: "18:30" }), TypeError);
  });

  test("jumps to AM peak, PM peak and D2 first wave follow the peak windows", () => {
    const s = initial();
    assert.equal(step(s, { type: "clock/jump", target: "am_peak" }).clock_s, 25200); // 7 × 3600
    assert.equal(step(s, { type: "clock/jump", target: "pm_peak" }).clock_s, 57600); // 16 × 3600
    assert.equal(step(s, { type: "clock/jump", target: "d2_first_wave" }).clock_s, 111600); // 86400 + 7 × 3600
    assert.throws(() => reduce(s, { type: "clock/jump", target: "noon" }), TypeError);
  });
});

describe("selection, inspector, fork and reference", () => {
  test("selection accepts a car, a depot or null", () => {
    let s = step(initial(), { type: "selection/set", selection: { depot: "SJ-1" } });
    assert.deepEqual(s.selection, { depot: "SJ-1" });
    s = step(s, { type: "selection/set", selection: null });
    assert.equal(s.selection, null);
    assert.throws(() => reduce(s, { type: "selection/set", selection: { area: "SJ" } }), TypeError);
  });

  test("the inspector opens a car or depot, selects it, and closes", () => {
    let s = step(initial(), { type: "inspector/open", target: { car: "SF-017" } });
    assert.deepEqual(s.inspector, { car: "SF-017" });
    assert.deepEqual(s.selection, { car: "SF-017" });
    s = step(s, { type: "inspector/close" });
    assert.equal(s.inspector, null);
    assert.deepEqual(s.selection, { car: "SF-017" });
    assert.equal(reduce(s, { type: "inspector/close" }), s);
    assert.throws(() => reduce(s, { type: "inspector/open", target: null }), TypeError);
  });

  test("fork: pin, open, result for its own id only, error and close", () => {
    let s = step(initial(), { type: "fork/pin", car: "SF-017" });
    assert.equal(s.fork.pinnedCar, "SF-017");
    s = step(s, { type: "fork/open", id: "f1" });
    assert.equal(s.fork.status, "running");
    assert.equal(s.fork.pinnedCar, "SF-017");
    assert.equal(reduce(s, { type: "fork/result", id: "f0", pair: {} }), s);
    s = step(s, { type: "fork/result", id: "f1", pair: { world_digest: "w" } });
    assert.equal(s.fork.status, "open");
    s = step(s, { type: "fork/close" });
    assert.equal(s.fork.status, "closed");
    assert.equal(s.fork.pair, null);
    assert.equal(s.fork.pinnedCar, "SF-017", "the pin survives closing the fork");
    s = steps(s, [{ type: "fork/open", id: "f2" }, { type: "fork/error", id: "f2", message: "stopped" }]);
    assert.equal(s.fork.status, "error");
  });

  test("reference panel open and close", () => {
    let s = step(initial(), { type: "reference/open", id: "FLEET-005" });
    assert.equal(s.reference, "FLEET-005");
    s = step(s, { type: "reference/close" });
    assert.equal(s.reference, null);
    assert.equal(reduce(s, { type: "reference/close" }), s);
  });
});

describe("Learn, reduced motion and engine path", () => {
  test("a Learn case starts at moment 0; a moment moves the clock and pauses", () => {
    let s = steps(initial(), [{ type: "playback/play" }, { type: "learn/case", caseId: "L1" }]);
    assert.deepEqual(s.learn, { case: "L1", moment: 0 });
    assert.equal(s.mode, "learn");
    s = step(s, { type: "learn/moment", index: 2, clock_s: 63000 });
    assert.deepEqual(s.learn, { case: "L1", moment: 2 });
    assert.equal(s.clock_s, 63000);
    assert.equal(s.playing, false);
    assert.throws(() => reduce(s, { type: "learn/moment", index: -1 }), RangeError);
  });

  test("reduced motion follows the system until an override, which wins", () => {
    let s = createInitialState({ presetId: "bay", scenario: fakeScenario(), reducedMotionSystem: true });
    assert.equal(isReducedMotion(s), true);
    s = step(s, { type: "motion/override", value: false });
    assert.equal(isReducedMotion(s), false);
    s = step(s, { type: "motion/system", reduced: false });
    s = step(s, { type: "motion/override", value: true });
    assert.equal(isReducedMotion(s), true);
    s = step(s, { type: "motion/override", value: null });
    assert.equal(isReducedMotion(s), false);
    assert.throws(() => reduce(s, { type: "motion/override", value: "on" }), TypeError);
  });

  test("engine path is worker or main thread", () => {
    assert.equal(step(initial(), { type: "engine/path", path: "main thread" }).engine.path, "main thread");
    assert.throws(() => reduce(initial(), { type: "engine/path", path: "gpu" }), TypeError);
  });
});

describe("Experiment: draft, freeze, verdict and session log", () => {
  test("draft edits and guardrail edits", () => {
    const rail = { metric: "unserved.fraction", scope: {}, max_harm: "0.02" };
    let s = steps(initial(), [
      { type: "mode/set", mode: "experiment" },
      { type: "experiment/draft", patch: { question: "Does a fourth bay lower the wait?", seedCount: 30 } },
      { type: "experiment/guardrailAdd", guardrail: rail },
      { type: "experiment/guardrailAdd", guardrail: { metric: "depot.bay_wait_p90_s", scope: { depot: "SJ-1" }, max_harm: "600" } },
      { type: "experiment/guardrailUpdate", index: 0, patch: { max_harm: "0.01" } },
    ]);
    assert.equal(s.experiment.draft.question, "Does a fourth bay lower the wait?");
    assert.equal(s.experiment.draft.seedCount, 30);
    assert.deepEqual(s.experiment.draft.guardrails.map((g) => g.max_harm), ["0.01", "600"]);
    s = step(s, { type: "experiment/guardrailRemove", index: 0 });
    assert.deepEqual(s.experiment.draft.guardrails.map((g) => g.metric), ["depot.bay_wait_p90_s"]);
    assert.throws(() => reduce(s, { type: "experiment/guardrailRemove", index: 4 }), RangeError);
    assert.throws(() => reduce(s, { type: "experiment/guardrailUpdate", index: 4, patch: {} }), RangeError);
  });

  test("freeze stores the spec, digest, label and the caller's session clock", () => {
    const s = frozenState();
    assert.deepEqual(s.experiment.frozen, { spec: fakeSpec(), digest: DIGEST, label: "playground-spec:3f9a1c2e", frozenAt: "14:02" });
    assert.equal(s.experiment.status, "running");
    assert.deepEqual(s.experiment.progress, { done: 0, total: 10, label: "" });
    assert.throws(() => reduce(s, { type: "experiment/freeze", id: "x2", spec: fakeSpec(), digest: DIGEST, label: "l" }), TypeError);
  });

  test("progress, error and cancel apply only to the running experiment", () => {
    const s = frozenState();
    assert.equal(step(s, { type: "experiment/progress", id: "x1", done: 7, total: 10, label: "Seed 7 of 10, both arms" }).experiment.progress.done, 7);
    assert.equal(reduce(s, { type: "experiment/progress", id: "old", done: 7, total: 10, label: "" }), s);
    const failed = step(s, { type: "experiment/error", id: "x1", message: "stopped" });
    assert.equal(failed.experiment.status, "error");
    assert.equal(failed.experiment.error, "stopped");
    assert.deepEqual(failed.experiment.sessionLog, []);
    const cancelled = step(s, { type: "experiment/cancelled", id: "x1" });
    assert.equal(cancelled.experiment.status, "cancelled");
    assert.equal(cancelled.experiment.frozen.digest, DIGEST);
  });

  test("a verdict selects the median seed by default and appends a session log entry", () => {
    // Deltas by seed: 1001:5 1002:-40 1003:12 1004:3 1005:90 1006:-7 1007:0 1008:8 1009:-2 1010:15.
    // Sorted: -40 -7 -2 0 3 5 8 12 15 90; lower middle of ten is index 4, delta 3, seed 1004.
    const s = step(frozenState(), { type: "experiment/verdict", id: "x1", payload: { verdict: validVerdict(), digest: DIGEST, per_seed: [] } });
    assert.equal(s.experiment.status, "done");
    assert.equal(s.experiment.selectedSeed, 1004);
    assert.equal(s.experiment.largestWarning, false);
    assert.deepEqual(s.experiment.sessionLog, [
      {
        seedSet: 1,
        seeds: fakeSpec().seeds,
        label: "playground-spec:3f9a1c2e",
        validity: "VALID",
        outcome: "INCONCLUSIVE",
        recommendation: "RUN_MORE_EXPERIMENTS",
        engine: "worker",
      },
    ]);
  });

  test("a verdict for another digest or run id is ignored", () => {
    const s = frozenState();
    const other = "0".repeat(64);
    assert.equal(reduce(s, { type: "experiment/verdict", id: "x1", payload: { verdict: validVerdict(), digest: other } }), s);
    assert.equal(reduce(s, { type: "experiment/verdict", id: "x0", payload: { verdict: validVerdict(), digest: DIGEST } }), s);
  });

  test("watching the largest delta sets the warning; the median clears it", () => {
    let s = step(frozenState(), { type: "experiment/verdict", id: "x1", payload: { verdict: validVerdict(), digest: DIGEST } });
    // Largest absolute delta is 90 at seed 1005.
    s = step(s, { type: "experiment/watchLargest" });
    assert.equal(s.experiment.selectedSeed, 1005);
    assert.equal(s.experiment.largestWarning, true);
    s = step(s, { type: "experiment/watchMedian" });
    assert.equal(s.experiment.selectedSeed, 1004);
    assert.equal(s.experiment.largestWarning, false);
    s = step(s, { type: "experiment/selectSeed", seed: 1007 });
    assert.equal(s.experiment.selectedSeed, 1007);
    assert.equal(s.experiment.largestWarning, false);
    s = step(s, { type: "experiment/selectSeed", seed: 1005 });
    assert.equal(s.experiment.largestWarning, true, "picking the largest seed by hand also warns");
    assert.throws(() => reduce(s, { type: "experiment/selectSeed", seed: 2001 }), RangeError);
  });

  test("median and largest selectors: ties, a negative largest and void evidence", () => {
    const seeds = [1001, 1002, 1003, 1004];
    // Sorted deltas -50 (1003), 10 (1001), 10 (1004), 40 (1002): lower middle index 1 is seed 1001.
    const v = validVerdict([10, 40, -50, 10]);
    assert.equal(medianDeltaSeed(v, seeds), 1001);
    assert.equal(largestDeltaSeed(v, seeds), 1003);
    // Equal absolute deltas: the lower seed.
    assert.equal(largestDeltaSeed(validVerdict([-30, 30, 0, 1]), seeds), 1001);
    const invalid = { validity: "INVALID_EXPERIMENT", outcome: null, recommendation: "NO_RECOMMENDATION", primary: null };
    assert.equal(medianDeltaSeed(invalid, seeds), null);
    assert.equal(largestDeltaSeed(invalid, seeds), null);
    assert.throws(() => medianDeltaSeed(validVerdict([1, 2]), seeds), Error);
  });

  test("void evidence logs no outcome and selects no seed", () => {
    const invalid = { validity: "INVALID_EXPERIMENT", invalidity_reason: "NOT_COMPARABLE", outcome: null, recommendation: "NO_RECOMMENDATION", primary: null };
    const s = step(frozenState([{ type: "engine/path", path: "main thread" }]), { type: "experiment/verdict", id: "x1", payload: { verdict: invalid, digest: DIGEST } });
    assert.equal(s.experiment.selectedSeed, null);
    assert.equal(s.experiment.sessionLog[0].outcome, null);
    assert.equal(s.experiment.sessionLog[0].recommendation, "NO_RECOMMENDATION");
    assert.equal(s.experiment.sessionLog[0].engine, "main thread");
    assert.equal(reduce(s, { type: "experiment/watchLargest" }), s);
  });

  test("editing the setup after a verdict marks it out of date and never clears it", () => {
    const s0 = step(frozenState(), { type: "experiment/verdict", id: "x1", payload: { verdict: validVerdict(), digest: DIGEST } });
    const s = step(s0, { type: "experiment/draft", patch: { resamples: 5000 } });
    assert.equal(s.experiment.verdictStale, true);
    assert.equal(s.experiment.verdict, s0.experiment.verdict);
    assert.equal(s.experiment.status, "done");
  });

  test("the freeze notice counts knobs changed in Sandbox since the freeze", () => {
    let s = step(frozenState(), { type: "experiment/verdict", id: "x1", payload: { verdict: validVerdict(), digest: DIGEST } });
    assert.equal(sandboxChangesSinceFreeze(s), 0);
    s = steps(s, [{ type: "mode/set", mode: "sandbox" }, SJ_CARS, SJ1_BAYS, { ...SJ_CARS, value: 12 }]);
    assert.equal(sandboxChangesSinceFreeze(s), 2);
    s = step(s, ASSIGN);
    assert.equal(sandboxChangesSinceFreeze(s), 3);
    s = step(s, { type: "knob/reset", knob: "DEP-3.SJ-1" });
    assert.equal(sandboxChangesSinceFreeze(s), 2, "a knob back at its frozen value no longer counts");
    assert.equal(s.experiment.verdictStale, false, "Sandbox changes do not touch the frozen verdict");
    s = step(s, { type: "preset/select", presetId: "uc07", scenario: fakeScenario("uc07") });
    assert.equal(sandboxChangesSinceFreeze(s), 3);
  });

  test("changes made before the freeze do not count; a new freeze resets the count", () => {
    let s = frozenState([SJ_CARS]);
    assert.equal(sandboxChangesSinceFreeze(s), 0);
    s = steps(s, [SJ1_BAYS, { type: "experiment/freeze", id: "x2", spec: fakeSpec(2), digest: "1".repeat(64), label: "playground-spec:11111111", frozenAt: "14:30" }]);
    assert.equal(sandboxChangesSinceFreeze(s), 0);
    assert.equal(s.experiment.frozen.frozenAt, "14:30");
  });

  test("another seed set moves the draft to set k + 1 and both runs stay in the session log", () => {
    let s = step(frozenState(), { type: "experiment/verdict", id: "x1", payload: { verdict: validVerdict(), digest: DIGEST } });
    s = step(s, { type: "experiment/nextSeedSet" });
    assert.equal(s.experiment.draft.seedSet, 2);
    const digest2 = "2".repeat(64);
    s = steps(s, [
      { type: "experiment/freeze", id: "x2", spec: fakeSpec(2), digest: digest2, label: "playground-spec:22222222", frozenAt: "14:10" },
      { type: "experiment/verdict", id: "x2", payload: { verdict: { ...validVerdict(), outcome: "UNCHANGED", recommendation: "NO_RECOMMENDATION" }, digest: digest2 } },
    ]);
    assert.deepEqual(
      s.experiment.sessionLog.map((e) => [e.seedSet, e.seeds[0], e.label, e.outcome, e.recommendation, e.engine]),
      [
        [1, 1001, "playground-spec:3f9a1c2e", "INCONCLUSIVE", "RUN_MORE_EXPERIMENTS", "worker"],
        [2, 2001, "playground-spec:22222222", "UNCHANGED", "NO_RECOMMENDATION", "worker"],
      ],
    );
  });
});

describe("Experiment flow across modes and presets (review: experiment-flow lens)", () => {
  const AXIS = { id: "policy:depot_assignment", baseline: "home_depot", candidate: "nearest_depot" };
  const VERDICT_X1 = { type: "experiment/verdict", id: "x1", payload: { verdict: validVerdict(), digest: DIGEST } };
  const toSandbox = { type: "mode/set", mode: "sandbox" };
  const toExperiment = { type: "mode/set", mode: "experiment" };

  test("a draft Test it properly declared keeps its scenario across a Sandbox round trip with no knob changed", () => {
    const declared = { ...fakeScenario(), sigma_permille: 150 };
    const s0 = steps(initial(), [
      { type: "engine/path", path: "worker" },
      { type: "learn/case", caseId: "L3" },
      { type: "learn/testItProperly", draft: { axis: AXIS, question: "Home depot or nearest depot?", baselineScenario: declared } },
      { type: "experiment/freeze", id: "x1", spec: fakeSpec(), digest: DIGEST, label: "playground-spec:3f9a1c2e", frozenAt: "14:02" },
      VERDICT_X1,
    ]);
    assert.deepEqual(s0.experiment.draft.baselineScenario, declared);
    assert.deepEqual(s0.experiment.draft.baselineSource, { presetId: "bay" });
    const s = steps(s0, [toSandbox, toExperiment]);
    assert.deepEqual(s.experiment.draft, s0.experiment.draft, "nothing in the setup moved");
    assert.equal(s.experiment.verdictStale, false);

    const moved = steps(s, [toSandbox, SJ1_BAYS, toExperiment]);
    assert.equal(moved.experiment.draft.baselineScenario, moved.scenario, "a Sandbox change makes the scenario the baseline");
    assert.deepEqual(moved.experiment.draft.axis, { id: "parameter:DEP-3.SJ-1", baseline: 3, candidate: 1 });
    assert.equal(moved.experiment.draft.axisSource, "sandbox");
    assert.equal(moved.experiment.verdictStale, true, "the setup changed, so the verdict is out of date");

    const other = steps(s, [toSandbox, { type: "preset/select", presetId: "uc07", scenario: fakeScenario("uc07") }, toExperiment]);
    assert.equal(other.experiment.draft.baselineScenario, other.scenario, "another preset is not the declared one");
    assert.deepEqual(other.experiment.draft.baselineSource, { presetId: "uc07" });
    assert.equal(other.experiment.verdictStale, true);
  });

  test("a Sandbox round trip that changes nothing leaves the verdict current; one that moves the baseline marks it", () => {
    let s = step(frozenState([SJ_CARS]), VERDICT_X1);
    s = steps(s, [toSandbox, toExperiment]);
    assert.equal(s.experiment.verdictStale, false);
    s = steps(s, [toSandbox, SJ1_BAYS, toExperiment]);
    assert.equal(s.experiment.verdictStale, true);
    assert.equal(s.experiment.draft.baselineScenario, s.scenario);
  });

  test("an edit made while the experiment runs marks the verdict out of date when it arrives", () => {
    const edits = [
      [{ type: "experiment/draft", patch: { question: "edited during the run" } }],
      [{ type: "experiment/guardrailAdd", guardrail: { metric: "unserved.fraction", scope: {}, max_harm_text: "0.02" } }],
      [{ type: "experiment/nextSeedSet" }],
      [toSandbox, SJ1_BAYS, toExperiment],
    ];
    for (const edit of edits) {
      const s = steps(frozenState(), [...edit, VERDICT_X1]);
      assert.equal(s.experiment.status, "done");
      assert.equal(s.experiment.verdictStale, true, edit.map((a) => a.type).join(", "));
    }
    const untouched = step(frozenState(), VERDICT_X1);
    assert.equal(untouched.experiment.verdictStale, false);
    const edited = steps(frozenState(), [{ type: "experiment/draft", patch: { resamples: 5000 } }, VERDICT_X1]);
    const refrozen = step(edited, { type: "experiment/freeze", id: "x2", spec: fakeSpec(), digest: DIGEST, label: "playground-spec:3f9a1c2e", frozenAt: "14:05" });
    assert.equal(refrozen.experiment.verdictStale, false, "a new freeze is about the current setup");
  });

  test("a chosen preset loads its scenario and declared draft, survives a round trip, and marks a shown verdict out of date", () => {
    const declared = { ...fakeScenario("uc01"), sigma_permille: 150 };
    const draft = {
      question: "Null check?",
      baselineScenario: declared,
      axis: { id: "parameter:DEP-7", baseline: 10, candidate: 10 },
      primary: { metric: "wait.p90_s", scope: {}, direction: "lower_is_better", margin_units: 60 },
      guardrails: [],
      seedSet: 1,
      seedCount: 20,
      resamples: 2000,
    };
    let s = step(frozenState([SJ_CARS]), VERDICT_X1);
    s = steps(s, [toSandbox, { type: "experiment/fromPreset", presetId: "UC-01", scenario: fakeScenario("uc01"), draft }]);
    assert.equal(s.mode, "experiment");
    assert.equal(s.presetId, "UC-01");
    assert.equal(s.scenario.name, "uc01");
    assert.deepEqual(s.changes, []);
    assert.deepEqual(s.experiment.draft, { ...draft, axisSource: "preset", baselineSource: { presetId: "UC-01" } });
    assert.equal(s.experiment.verdictStale, true);
    assert.equal(sandboxChangesSinceFreeze(s), 1, "the preset change counts in the freeze notice");
    const back = steps(s, [toSandbox, toExperiment]);
    assert.deepEqual(back.experiment.draft, s.experiment.draft);
    assert.throws(() => reduce(s, { type: "experiment/fromPreset", presetId: "UC-01", scenario: fakeScenario(), draft: { question: "" } }), TypeError);
  });
});
