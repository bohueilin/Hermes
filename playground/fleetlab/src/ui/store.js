// One immutable state object with pure reducer cases (contract section 8, design §7). No DOM, no clock, no model
// imports: the caller passes scenarios, run payloads and the session clock, so every case runs in Node.

/** Playback speeds in simulated seconds per real second (design §7.4). */
export const SPEEDS = Object.freeze([60, 300, 900, 3600]);

/** Step sizes in simulated seconds. */
export const STEP_S = Object.freeze({ "5min": 300, "1h": 3600 });

/** The three modes; Inspect is a drawer (`inspector`), not a mode. */
export const MODES = Object.freeze(["learn", "sandbox", "experiment"]);

/** Engine paths the runtime reports (contract section 7). */
export const ENGINE_PATHS = Object.freeze(["worker", "main thread"]);

const DAY_S = 86400;

// ---------------------------------------------------------------------------------------------------------------
// Helpers.

/** Structural equality over JSON-like values. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

/** Value at `path` (array of keys and indices) inside `object`. */
function getIn(object, path) {
  let node = object;
  for (const key of path) {
    if (node === null || typeof node !== "object" || !(key in node)) {
      throw new Error(`no value at path ${path.join(".")}`);
    }
    node = node[key];
  }
  return node;
}

/** Copy of `object` with `value` at `path`; only the objects along the path are copied. */
function setIn(object, path, value) {
  if (path.length === 0) return value;
  const [key, ...rest] = path;
  if (object === null || typeof object !== "object" || !(key in object)) {
    throw new Error(`no value at path ${String(key)}`);
  }
  const copy = Array.isArray(object) ? object.slice() : { ...object };
  copy[key] = setIn(object[key], rest, value);
  return copy;
}

/** Throw unless `path` is a non-empty array of strings and integers. */
function checkPath(path) {
  if (!Array.isArray(path) || path.length === 0 || !path.every((k) => typeof k === "string" || Number.isInteger(k))) {
    throw new TypeError("a knob path is a non-empty array of keys and indices");
  }
}

/** Clamp a second into the scenario's window. */
function clampToWindow(scenario, t_s) {
  const { start_s, end_s } = scenario.window;
  return Math.min(end_s, Math.max(start_s, t_s));
}

/** Throw unless `t_s` is a finite number of seconds. */
function checkSeconds(t_s, name) {
  if (typeof t_s !== "number" || !Number.isFinite(t_s)) throw new TypeError(`${name} must be a finite number of seconds`);
}

// ---------------------------------------------------------------------------------------------------------------
// Initial state.

/** A fresh experiment draft; `baselineScenario` is filled when Experiment opens. */
function emptyDraft() {
  return {
    question: "",
    baselineScenario: null,
    axis: null,
    axisSource: null,
    primary: null,
    guardrails: [],
    seedCount: 20,
    seedSet: 1,
    resamples: 2000,
  };
}

/**
 * A run slot with nothing computed. `scenarioAtQueue` is the scenario the run was queued on, so a result that arrives
 * after a knob or preset change is marked out of date.
 */
function emptyRun() {
  return { status: "idle", id: null, progress: null, summaries: [], selectedSeed: null, log: null, stale: false, violation: null, error: null, scenarioAtQueue: null };
}

/**
 * Initial state for a preset scenario (engine units, contract section 6.2). `reducedMotionSystem` is the operating
 * system setting read by the caller; `mode` defaults to sandbox.
 */
export function createInitialState({ presetId, scenario, mode = "sandbox", reducedMotionSystem = false }) {
  if (!MODES.includes(mode)) throw new TypeError(`unknown mode ${String(mode)}`);
  if (scenario === null || typeof scenario !== "object" || typeof scenario.window?.start_s !== "number") {
    throw new TypeError("createInitialState needs a scenario with a window");
  }
  return {
    mode,
    presetId,
    scenario,
    changes: [],
    run: emptyRun(),
    clock_s: scenario.window.start_s,
    playing: false,
    speed: 900,
    selection: null,
    inspector: null,
    fork: { pinnedCar: null, status: "closed", id: null, pair: null, stale: false, error: null, scenarioAtOpen: null },
    experiment: {
      draft: emptyDraft(),
      frozen: null,
      status: "idle",
      id: null,
      progress: null,
      error: null,
      verdict: null,
      perSeed: [],
      verdictStale: false,
      selectedSeed: null,
      largestWarning: false,
      sinceFreeze: {},
      sessionLog: [],
    },
    reference: null,
    learn: { case: null, moment: 0 },
    reducedMotion: { system: Boolean(reducedMotionSystem), override: null },
    engine: { path: null },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Selectors.

/** Whether playback should use reduced motion: the in-app override wins over the system setting. */
export function isReducedMotion(state) {
  return state.reducedMotion.override ?? state.reducedMotion.system;
}

/** Number of knobs that differ from the preset. */
export function changeCount(state) {
  return state.changes.length;
}

/** The most recent change still in effect, or null. */
export function lastChange(state) {
  return state.changes.length === 0 ? null : state.changes[state.changes.length - 1];
}

/** Knobs whose value differs from the value they had when the current spec was frozen (design §7.1 freeze rule). */
export function sandboxChangesSinceFreeze(state) {
  return Object.keys(state.experiment.sinceFreeze).length;
}

/** `{seed, delta}` pairs of a valid verdict's primary, in spec seed order; empty for void evidence. */
export function primaryDeltasBySeed(verdict, seeds) {
  if (verdict === null || verdict.validity !== "VALID" || verdict.primary === null || verdict.primary === undefined) return [];
  const deltas = verdict.primary.paired_deltas;
  if (!Array.isArray(deltas) || deltas.length !== seeds.length) {
    throw new Error("the primary's paired deltas must align with the frozen seeds");
  }
  return seeds.map((seed, i) => ({ seed, delta: deltas[i] }));
}

/** Seed with the median primary delta (the lower middle for an even count; ties by seed), or null. */
export function medianDeltaSeed(verdict, seeds) {
  const pairs = primaryDeltasBySeed(verdict, seeds);
  if (pairs.length === 0) return null;
  const sorted = pairs.slice().sort((a, b) => a.delta - b.delta || a.seed - b.seed);
  return sorted[Math.floor((sorted.length - 1) / 2)].seed;
}

/** Seed with the largest absolute primary delta (ties by the lower seed), or null. */
export function largestDeltaSeed(verdict, seeds) {
  const pairs = primaryDeltasBySeed(verdict, seeds);
  if (pairs.length === 0) return null;
  let best = pairs[0];
  for (const pair of pairs.slice(1)) {
    const size = Math.abs(pair.delta);
    const bestSize = Math.abs(best.delta);
    if (size > bestSize || (size === bestSize && pair.seed < best.seed)) best = pair;
  }
  return best.seed;
}

// ---------------------------------------------------------------------------------------------------------------
// Reducer cases.

/** Results computed for an earlier scenario stay visible but are marked out of date. */
function markResultsStale(state) {
  const hasRun = state.run.summaries.length > 0 || state.run.log !== null;
  const hasFork = state.fork.pair !== null;
  if ((!hasRun || state.run.stale) && (!hasFork || state.fork.stale)) return state;
  return {
    ...state,
    run: hasRun ? { ...state.run, stale: true } : state.run,
    fork: hasFork ? { ...state.fork, stale: true } : state.fork,
  };
}

/** Track a knob's value at freeze time so the freeze notice counts knobs changed since (design §7.1). */
function trackSinceFreeze(experiment, key, valueBefore, valueAfter) {
  if (experiment.frozen === null) return experiment;
  const since = { ...experiment.sinceFreeze };
  if (!Object.prototype.hasOwnProperty.call(since, key)) since[key] = valueBefore;
  if (deepEqual(since[key], valueAfter)) delete since[key];
  return { ...experiment, sinceFreeze: since };
}

/** Apply one knob value, update the changes list and the since-freeze record. */
function applyKnob(state, { knob, path, value, axis }) {
  const before = getIn(state.scenario, path);
  const existing = state.changes.find((c) => c.knob === knob);
  const from = existing ? existing.from : before;
  const others = state.changes.filter((c) => c.knob !== knob);
  const changes = deepEqual(value, from)
    ? others
    : [...others, { knob, axis: axis ?? `parameter:${knob}`, path: path.slice(), from, to: value }];
  return {
    ...state,
    scenario: setIn(state.scenario, path, value),
    changes,
    experiment: trackSinceFreeze(state.experiment, knob, before, value),
  };
}

/** Mode switch with carried state (design §7.1): nothing is recomputed or cleared. */
function switchMode(state, mode) {
  if (!MODES.includes(mode)) throw new TypeError(`unknown mode ${String(mode)}`);
  if (mode === state.mode) return state;
  let experiment = state.experiment;
  if (mode === "experiment") {
    // The scenario becomes the baseline; the last knob changed pre-fills the axis unless the user wrote one.
    const change = lastChange(state);
    const draft = { ...experiment.draft, baselineScenario: state.scenario };
    if (change !== null && draft.axisSource !== "user") {
      draft.axis = { id: change.axis, baseline: change.from, candidate: change.to };
      draft.axisSource = "sandbox";
    }
    experiment = { ...experiment, draft };
  }
  return { ...state, mode, experiment };
}

/** Speed one step faster or slower, stopping at the ends. */
function shiftSpeed(state, by) {
  const index = SPEEDS.indexOf(state.speed);
  const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, index + by))];
  return next === state.speed ? state : { ...state, speed: next };
}

/** Second a named jump lands on, from the scenario's peak windows (design §7.4). */
function jumpTarget(scenario, target) {
  const [morning, evening] = scenario.peaks;
  if (target === "am_peak") return morning.start_h * 3600;
  if (target === "pm_peak") return evening.start_h * 3600;
  if (target === "d2_first_wave") return DAY_S + morning.start_h * 3600;
  throw new TypeError(`unknown jump ${String(target)}`);
}

/** Reducer cases for the Sandbox run lifecycle. */
function runCase(state, action) {
  const run = state.run;
  switch (action.type) {
    case "run/queued":
      return {
        ...state,
        run: { ...run, status: "queued", id: action.id, progress: { done: 0, total: action.total ?? 0, label: action.label ?? "" }, error: null, scenarioAtQueue: state.scenario },
      };
    case "run/progress":
      if (action.id !== run.id) return state;
      return { ...state, run: { ...run, status: "running", progress: { done: action.done, total: action.total, label: action.label } } };
    case "run/done": {
      if (action.id !== run.id) return state;
      const runs = action.payload.runs;
      const violations = runs.flatMap((r) => r.invariant_violations ?? []);
      if (violations.length > 0) {
        return { ...state, run: { ...emptyRun(), status: "void", id: run.id, violation: violations[0], scenarioAtQueue: run.scenarioAtQueue } };
      }
      const log = action.payload.log ?? null;
      return {
        ...state,
        run: {
          status: "done",
          id: run.id,
          progress: null,
          summaries: runs.map((r) => ({ seed: r.seed, world_digest: r.world_digest, metrics: r.metrics, series: r.series })),
          selectedSeed: log !== null ? log.seed : (runs[0]?.seed ?? null),
          log,
          // Every scenario change makes a new object, so identity tells whether the scenario moved while it ran.
          stale: state.scenario !== run.scenarioAtQueue,
          violation: null,
          error: null,
          scenarioAtQueue: run.scenarioAtQueue,
        },
      };
    }
    case "run/error":
      if (action.id !== run.id) return state;
      return { ...state, playing: false, run: { ...run, status: "error", progress: null, error: action.message } };
    case "run/cancelled":
      if (action.id !== run.id) return state;
      return { ...state, run: { ...run, status: "cancelled", progress: null } };
    case "run/stale":
      return markResultsStale(state);
    default:
      return state;
  }
}

/** Reducer cases for the clock and playback. */
function playbackCase(state, action) {
  switch (action.type) {
    case "clock/set":
      checkSeconds(action.clock_s, "clock_s");
      return { ...state, clock_s: clampToWindow(state.scenario, action.clock_s) };
    case "clock/advance": {
      checkSeconds(action.seconds, "seconds");
      const clock_s = clampToWindow(state.scenario, state.clock_s + action.seconds);
      const atEnd = clock_s >= state.scenario.window.end_s;
      return { ...state, clock_s, playing: atEnd ? false : state.playing };
    }
    case "clock/step": {
      const size = STEP_S[action.unit];
      if (size === undefined) throw new TypeError(`unknown step ${String(action.unit)}`);
      if (action.direction !== 1 && action.direction !== -1) throw new TypeError("step direction is 1 or -1");
      return { ...state, clock_s: clampToWindow(state.scenario, state.clock_s + action.direction * size) };
    }
    case "clock/jump":
      return { ...state, clock_s: clampToWindow(state.scenario, jumpTarget(state.scenario, action.target)) };
    case "playback/play":
      if (state.playing || state.clock_s >= state.scenario.window.end_s) return state;
      return { ...state, playing: true };
    case "playback/pause":
      return state.playing ? { ...state, playing: false } : state;
    case "playback/toggle":
      return playbackCase(state, { type: state.playing ? "playback/pause" : "playback/play" });
    case "playback/speed":
      if (!SPEEDS.includes(action.speed)) throw new TypeError(`speed must be one of ${SPEEDS.join(", ")}`);
      return { ...state, speed: action.speed };
    case "playback/faster":
      return shiftSpeed(state, 1);
    case "playback/slower":
      return shiftSpeed(state, -1);
    default:
      return state;
  }
}

/** Reducer cases for Experiment: draft, freeze, run lifecycle, verdict and seed choice. */
function experimentCase(state, action) {
  const ex = state.experiment;
  const withDraft = (draft) => ({ ...state, experiment: { ...ex, draft, verdictStale: ex.verdict !== null } });
  switch (action.type) {
    case "experiment/draft": {
      const patch = { ...action.patch };
      if ("axis" in patch) patch.axisSource = "user";
      return withDraft({ ...ex.draft, ...patch });
    }
    case "experiment/guardrailAdd":
      return withDraft({ ...ex.draft, guardrails: [...ex.draft.guardrails, action.guardrail] });
    case "experiment/guardrailUpdate": {
      if (!Number.isInteger(action.index) || ex.draft.guardrails[action.index] === undefined) throw new RangeError("no guardrail at that index");
      const guardrails = ex.draft.guardrails.map((g, i) => (i === action.index ? { ...g, ...action.patch } : g));
      return withDraft({ ...ex.draft, guardrails });
    }
    case "experiment/guardrailRemove": {
      if (!Number.isInteger(action.index) || ex.draft.guardrails[action.index] === undefined) throw new RangeError("no guardrail at that index");
      return withDraft({ ...ex.draft, guardrails: ex.draft.guardrails.filter((_, i) => i !== action.index) });
    }
    case "experiment/nextSeedSet": {
      const current = ex.frozen !== null ? ex.frozen.spec.seed_set : ex.draft.seedSet;
      return withDraft({ ...ex.draft, seedSet: current + 1 });
    }
    case "experiment/freeze": {
      const { spec, digest, label, frozenAt, id } = action;
      if (spec === null || typeof spec !== "object" || !Array.isArray(spec.seeds)) throw new TypeError("freeze needs a frozen spec");
      if (typeof digest !== "string" || typeof label !== "string") throw new TypeError("freeze needs a digest and its label");
      if (typeof frozenAt !== "string") throw new TypeError("freeze needs the session clock from the caller");
      return {
        ...state,
        experiment: {
          ...ex,
          frozen: { spec, digest, label, frozenAt },
          status: "running",
          id: id ?? null,
          progress: { done: 0, total: spec.seeds.length, label: "" },
          error: null,
          verdict: null,
          perSeed: [],
          verdictStale: false,
          selectedSeed: null,
          largestWarning: false,
          sinceFreeze: {},
        },
      };
    }
    case "experiment/progress":
      if (action.id !== ex.id) return state;
      return { ...state, experiment: { ...ex, progress: { done: action.done, total: action.total, label: action.label } } };
    case "experiment/verdict": {
      const { payload } = action;
      if (action.id !== ex.id || ex.frozen === null || payload.digest !== ex.frozen.digest) return state;
      const { verdict } = payload;
      const { spec, label } = ex.frozen;
      const selectedSeed = medianDeltaSeed(verdict, spec.seeds);
      const entry = {
        seedSet: spec.seed_set,
        seeds: spec.seeds.slice(),
        label,
        validity: verdict.validity,
        outcome: verdict.validity === "VALID" ? verdict.outcome : null,
        recommendation: verdict.recommendation,
        engine: state.engine.path,
      };
      return {
        ...state,
        experiment: {
          ...ex,
          status: "done",
          progress: null,
          verdict,
          perSeed: payload.per_seed ?? [],
          verdictStale: false,
          selectedSeed,
          largestWarning: false,
          sessionLog: [...ex.sessionLog, entry],
        },
      };
    }
    case "experiment/error":
      if (action.id !== ex.id) return state;
      return { ...state, experiment: { ...ex, status: "error", progress: null, error: action.message } };
    case "experiment/cancelled":
      if (action.id !== ex.id) return state;
      return { ...state, experiment: { ...ex, status: "cancelled", progress: null } };
    case "experiment/watchMedian":
      return chooseSeed(state, ex.verdict === null ? null : medianDeltaSeed(ex.verdict, ex.frozen.spec.seeds));
    case "experiment/watchLargest":
      return chooseSeed(state, ex.verdict === null ? null : largestDeltaSeed(ex.verdict, ex.frozen.spec.seeds));
    case "experiment/selectSeed":
      if (ex.frozen === null || !ex.frozen.spec.seeds.includes(action.seed)) throw new RangeError("that seed is not in the frozen spec");
      return chooseSeed(state, action.seed);
    default:
      return state;
  }
}

/** Select a verdict seed; the warning shows whenever it is the largest delta and not also the median. */
function chooseSeed(state, seed) {
  const ex = state.experiment;
  if (seed === null) return state;
  const seeds = ex.frozen.spec.seeds;
  const largest = largestDeltaSeed(ex.verdict, seeds);
  const median = medianDeltaSeed(ex.verdict, seeds);
  return { ...state, experiment: { ...ex, selectedSeed: seed, largestWarning: seed === largest && largest !== median } };
}

/** The pure reducer: every action is one case; an unknown type returns the same state. */
export function reduce(state, action) {
  const type = action.type;
  if (type.startsWith("run/")) return runCase(state, action);
  if (type.startsWith("clock/") || type.startsWith("playback/")) return playbackCase(state, action);
  if (type.startsWith("experiment/")) return experimentCase(state, action);
  switch (type) {
    case "mode/set":
      return switchMode(state, action.mode);
    case "preset/select": {
      if (action.scenario === null || typeof action.scenario !== "object") throw new TypeError("preset/select needs a scenario");
      const experiment = trackSinceFreeze(state.experiment, "preset", state.presetId, action.presetId);
      const next = {
        ...state,
        presetId: action.presetId,
        scenario: action.scenario,
        changes: [],
        clock_s: clampToWindow(action.scenario, state.clock_s),
        experiment,
      };
      return markResultsStale(next);
    }
    case "knob/set":
      checkPath(action.path);
      if (typeof action.knob !== "string") throw new TypeError("knob/set needs a knob id");
      return markResultsStale(applyKnob(state, action));
    case "knob/reset": {
      const change = state.changes.find((c) => c.knob === action.knob);
      if (change === undefined) return state;
      return markResultsStale(applyKnob(state, { knob: change.knob, path: change.path, value: change.from, axis: change.axis }));
    }
    case "knob/resetAll": {
      if (state.changes.length === 0) return state;
      let next = state;
      for (const change of state.changes) {
        next = applyKnob(next, { knob: change.knob, path: change.path, value: change.from, axis: change.axis });
      }
      return markResultsStale(next);
    }
    case "selection/set": {
      const s = action.selection;
      const ok = s === null || (typeof s === "object" && (typeof s.car === "string" || typeof s.depot === "string"));
      if (!ok) throw new TypeError("a selection is {car}, {depot} or null");
      return { ...state, selection: s };
    }
    case "inspector/open": {
      const t = action.target;
      if (t === null || typeof t !== "object" || (typeof t.car !== "string" && typeof t.depot !== "string")) {
        throw new TypeError("the inspector opens a {car} or a {depot}");
      }
      return { ...state, inspector: t, selection: t };
    }
    case "inspector/close":
      return state.inspector === null ? state : { ...state, inspector: null };
    case "fork/pin":
      return { ...state, fork: { ...state.fork, pinnedCar: action.car ?? null } };
    case "fork/open":
      return {
        ...state,
        fork: { ...state.fork, pinnedCar: action.car ?? state.fork.pinnedCar, status: "running", id: action.id, pair: null, stale: false, error: null, scenarioAtOpen: state.scenario },
      };
    case "fork/result":
      if (action.id !== state.fork.id) return state;
      return { ...state, fork: { ...state.fork, status: "open", pair: action.pair, stale: state.scenario !== state.fork.scenarioAtOpen } };
    case "fork/error":
      if (action.id !== state.fork.id) return state;
      return { ...state, fork: { ...state.fork, status: "error", error: action.message } };
    case "fork/close":
      return { ...state, fork: { ...state.fork, status: "closed", id: null, pair: null, stale: false, error: null, scenarioAtOpen: null } };
    case "reference/open":
      if (typeof action.id !== "string") throw new TypeError("reference/open needs a panel id");
      return { ...state, reference: action.id };
    case "reference/close":
      return state.reference === null ? state : { ...state, reference: null };
    case "learn/case": {
      const next = { ...state, mode: "learn", learn: { case: action.caseId, moment: 0 } };
      return action.clock_s === undefined ? next : { ...next, clock_s: clampToWindow(state.scenario, action.clock_s) };
    }
    case "learn/moment": {
      if (!Number.isInteger(action.index) || action.index < 0) throw new RangeError("a moment index is a non-negative integer");
      const next = { ...state, learn: { ...state.learn, moment: action.index } };
      return action.clock_s === undefined ? next : { ...next, clock_s: clampToWindow(state.scenario, action.clock_s), playing: false };
    }
    case "learn/testItProperly": {
      // "Test it properly": open Experiment on the Learn preset with the case's axis filled in (design §4.1).
      const draft = { ...state.experiment.draft, ...action.draft, baselineScenario: state.scenario, axisSource: "learn" };
      return {
        ...state,
        mode: "experiment",
        experiment: { ...state.experiment, draft, verdictStale: state.experiment.verdict !== null },
      };
    }
    case "motion/system":
      return { ...state, reducedMotion: { ...state.reducedMotion, system: Boolean(action.reduced) } };
    case "motion/override":
      if (action.value !== null && typeof action.value !== "boolean") throw new TypeError("the override is true, false or null");
      return { ...state, reducedMotion: { ...state.reducedMotion, override: action.value } };
    case "engine/path":
      if (!ENGINE_PATHS.includes(action.path)) throw new TypeError(`unknown engine path ${String(action.path)}`);
      return { ...state, engine: { path: action.path } };
    default:
      return state;
  }
}

/** A store over `initialState`: `getState()`, `dispatch(action)` and `subscribe(fn)` returning an unsubscribe. */
export function createStore(initialState, reducer = reduce) {
  if (initialState === null || typeof initialState !== "object") throw new TypeError("createStore needs an initial state");
  let state = initialState;
  const listeners = new Set();
  return {
    getState: () => state,
    dispatch(action) {
      if (action === null || typeof action !== "object" || typeof action.type !== "string") {
        throw new TypeError("an action is an object with a string type");
      }
      const next = reducer(state, action);
      if (next !== state) {
        state = next;
        for (const listener of [...listeners]) listener(state, action);
      }
      return action;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
