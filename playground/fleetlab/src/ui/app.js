// Interface entry (contract section 8, design §7): builds the shell of design §7.2 and wires every region to one store
// and to the engine host. The region modules render the knobs, map, transport, inspector, Learn and Experiment; this
// file renders the top bar, the NOW panel, the panel across replications, the chart row, the fork section, the run
// states of design §7.7 and the footer, and it runs the engine for Run window, the fork and a verdict seed.
//
// Decisions this module makes where the design is silent (reported with the build):
// - Run window runs 5 replications of seed set 1 (the §7.2 wireframe reads "replay 1 of 5") and animates the first.
// - Learn and Experiment render inside the chart row, the only region wide enough, ahead of the charts. The root
//   carries `data-mode`, so the phone layout keeps that row on screen in those modes.
// - The fork (D-10) runs on the watched replay's seed. In a Learn case lane A is the preset's axis baseline and lane B
//   its candidate; in Sandbox lane A undoes the last knob change and lane B keeps it; from a verdict, lanes A and B are
//   the frozen spec's arms on the spec's shared envelope.
// - The demand and traffic strips sit under the scrubber for the selected area (San Francisco when nothing is
//   selected); the traffic strip reads the highway toward that area.
// - While the fork shows a verdict seed, the map, the NOW panel, the panel across replications and the strips (which
//   replay the Sandbox world) are hidden and the top bar names the verdict seed, so only one THIS REPLAY seed is on
//   screen (design §7.4, H-10). Closing the fork shows them again.
// - The wait p90 values of the panel across replications and of the wait chart summary carry their completed rides.

import { percentileFleetLab } from "../core/stats.js";
import { armScenarios, experimentEnvelope } from "../model/experiment.js";
import { violationId } from "../model/invariants.js";
import { metricKey } from "../model/metrics.js";
import { DEFAULT_PRESET_ID, PRESET_SEED_SET, presetById, seedSet } from "../model/presets.js";
import { AREA_IDS, applyAxis, cloneScenario } from "../model/schema.js";
import { sharedLambdaMaxPermille } from "../model/world.js";
import { createEngineHost } from "../runtime/host.js";
import { createAnnouncer, createLiveRegion, createShortcutHelp, watchReducedMotion } from "./a11y.js";
import { armComparisonCharts, carForkCharts, demandStrip, fleetStateChart, metricByHourChart, setCursorAll, trafficStrip } from "./charts.js";
import { mountControls } from "./controls.js";
import { el, keyedList, setText } from "./dom.js";
import { mountExperiment } from "./experiment.js";
import * as format from "./format.js";
import { mountInspector } from "./inspector.js";
import * as labels from "./labels.js";
import { LEARN_FORK_DEPOTS, learnCase, mountLearn } from "./learn.js";
import { mapModel, mountMap } from "./map.js";
import { createPlayback, renderTransport } from "./playback.js";
import { createInitialState, createStore, ENGINE_PATHS, lastChange, MODES } from "./store.js";

/** Shell regions in document order, which is the design section 7.7 tab order; `now` and `across` sit in `side`. */
export const REGION_IDS = Object.freeze([
  "topbar",
  "knobs",
  "map",
  "transport",
  "segmented",
  "now",
  "across",
  "charts",
  "inspector",
  "footer",
]);

/** Phone groups of the segmented control (design section 7.2), as `data-phone-group` values on `.fl-app`. */
export const PHONE_GROUPS = Object.freeze(["now", "charts", "across"]);

/** Replications Run window computes (design §7.2 wireframe: replay 1 of 5). */
export const SANDBOX_REPLICATIONS = 5;

/** Charts of the Sandbox chart row after Fleet state (design §7.2 wireframe), by computeSeries id. */
export const ROW_CHARTS = Object.freeze(["wait_p90_by_hour", "bay_wait_by_depot", "available_by_area"]);

const PHONE_GROUP_LABEL_PATHS = { now: "CHARTS.phoneSegments.now", charts: "CHARTS.phoneSegments.charts", across: "CHARTS.phoneSegments.all" };

/** Reads a required string from labels.js by dotted path, with a clear error when it is missing. */
function label(path) {
  let value = labels;
  for (const key of path.split(".")) value = value == null ? undefined : value[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`src/ui/labels.js must provide a non-empty string at ${path}`);
  }
  return value;
}

/** Fills the strip: the full sentence, and a phone button that opens the popover. It has no dismiss control. */
function buildTeachingStrip(strip) {
  strip.setAttribute("role", "note");
  strip.setAttribute("aria-label", label("HONESTY.stripPhone"));
  const full = el("p", { class: "fl-strip__full" }, label("HONESTY.strip"));
  const popover = el("p", { id: "fleetlab-teaching-popover", class: "fl-popover", "data-open": "false" }, label("HONESTY.popover"));
  popover.hidden = true;
  const toggle = el(
    "button",
    {
      type: "button",
      class: "fl-strip__short",
      "aria-expanded": "false",
      "aria-controls": "fleetlab-teaching-popover",
      "aria-label": label("HONESTY.stripPhoneHint"),
      on: {
        click: () => {
          const open = popover.hidden;
          popover.hidden = !open;
          popover.setAttribute("data-open", open ? "true" : "false");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
        },
      },
    },
    label("HONESTY.stripPhone"),
  );
  strip.replaceChildren(full, toggle, popover);
}

/** Builds the phone segmented control; each button shows one group by setting `data-phone-group` on the root. */
function buildSegmented(root) {
  const buttons = PHONE_GROUPS.map((group) =>
    el(
      "button",
      {
        type: "button",
        "data-group": group,
        "aria-pressed": group === root.getAttribute("data-phone-group") ? "true" : "false",
        on: { click: () => showPhoneGroup(root, buttons, group) },
      },
      label(PHONE_GROUP_LABEL_PATHS[group]),
    ),
  );
  return el("div", { id: "fleetlab-region-segmented", class: "fl-segmented", role: "group" }, buttons);
}

function showPhoneGroup(root, buttons, group) {
  root.setAttribute("data-phone-group", group);
  for (const button of buttons) {
    button.setAttribute("aria-pressed", button.getAttribute("data-group") === group ? "true" : "false");
  }
}

function region(tag, id, className, labelPath) {
  return el(tag, { id: `fleetlab-region-${id}`, class: className, "aria-label": labelPath ? label(labelPath) : null });
}

/**
 * Builds the empty shell of design §7.2 in the page document, which must hold `#fleetlab-root` with
 * `#fleetlab-teaching-strip` inside it: the strip, then one container per region with the classes styles.css defines.
 * Returns `{root, strip, regions}`; `start` mounts the interface into it.
 */
export function buildShell() {
  const doc = globalThis.document;
  const root = doc.getElementById("fleetlab-root");
  const strip = doc.getElementById("fleetlab-teaching-strip");
  if (!root || !strip || strip.parentNode !== root) {
    throw new Error('start needs an element with id "fleetlab-teaching-strip" inside one with id "fleetlab-root"');
  }
  root.setAttribute("class", "fl-app");
  strip.setAttribute("class", "fl-strip");
  if (!PHONE_GROUPS.includes(root.getAttribute("data-phone-group"))) root.setAttribute("data-phone-group", "now");
  buildTeachingStrip(strip);

  const regions = {
    topbar: region("header", "topbar", "fl-topbar", "TOP_BAR.product"),
    knobs: region("aside", "knobs", "fl-knobs", "KNOB_PANEL.heading"),
    map: region("section", "map", "fl-map", "MAP.name"),
    transport: region("section", "transport", "fl-transport", "PLAYBACK.transportName"),
    segmented: buildSegmented(root),
    now: region("section", "now", "fl-now", "REGISTERS.nowThisReplay"),
    across: region("section", "across", "fl-across", "CHARTS.phoneSegments.all"),
    charts: region("section", "charts", "fl-charts", "CHARTS.phoneSegments.charts"),
    inspector: region("aside", "inspector", "fl-drawer fl-inspector", "MODES.inspect.name"),
    footer: region("footer", "footer", "fl-footer"),
  };
  regions.inspector.hidden = true;
  regions.inspector.setAttribute("inert", "");
  regions.inspector.setAttribute("data-open", "false");
  const side = el("div", { class: "fl-side" }, [regions.now, regions.across]);

  root.replaceChildren(
    strip,
    regions.topbar,
    regions.knobs,
    regions.map,
    regions.transport,
    regions.segmented,
    side,
    regions.charts,
    regions.inspector,
    regions.footer,
  );
  return { root, strip, regions };
}

/**
 * Starts the interface. `createWorker` is the engine worker factory (contract section 9). Options for tests and
 * embedding: `engineHost` replaces the host built from `createWorker` (an object with `path`, `ready`, `runWindow`,
 * `runPair`, `runExperiment` and `cancel`), and `copyText(text)` replaces the clipboard (null disables copying).
 * Returns `{root, strip, regions, createWorker, store, host, playback, runWindow, openFork, watchVerdictSeed, destroy}`.
 */
export function start({ createWorker, engineHost = null, copyText = clipboardWriter() } = {}) {
  if (typeof createWorker !== "function") throw new TypeError("start needs a createWorker factory");
  const shell = buildShell();
  const app = mountInterface(shell, { createWorker, engineHost, copyText });
  return { ...shell, createWorker, ...app };
}

/** The page clipboard's writeText, or null where the page has none. */
function clipboardWriter() {
  const clipboard = globalThis.navigator?.clipboard;
  return clipboard && typeof clipboard.writeText === "function" ? (text) => clipboard.writeText(text) : null;
}

/** The message text of a rejected run. */
function messageOf(error) {
  return error && typeof error.message === "string" ? error.message : String(error);
}

/** True when two key arrays hold the same values by identity. */
function sameKey(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * A store view whose listeners run only when `select(state)` changes (compared by identity, item by item), so a module
 * that rebuilds its whole view is not rebuilt on every playback frame.
 */
function gatedStore(store, select) {
  return {
    getState: store.getState,
    dispatch: store.dispatch,
    subscribe(listener) {
      let last = select(store.getState());
      return store.subscribe((state, action) => {
        const next = select(state);
        if (sameKey(next, last)) return;
        last = next;
        listener(state, action);
      });
    },
  };
}

/** A copy of `scenario` with `value` at `path` (keys and indices). */
function withValueAt(scenario, path, value) {
  const copy = cloneScenario(scenario);
  let node = copy;
  for (const key of path.slice(0, -1)) node = node[key];
  node[path[path.length - 1]] = value !== null && typeof value === "object" ? structuredClone(value) : value;
  return copy;
}

/** The scenario the shown run was computed on (the store keeps it, so a later knob change cannot relabel a replay). */
function scenarioOfRun(state) {
  return state.run.scenarioAtQueue ?? state.scenario;
}

/** The area the strips describe: the selected depot's or car's area, else San Francisco. */
function focusArea(state) {
  const id = state.selection?.depot ?? state.selection?.car ?? null;
  const area = id === null ? null : id.split("-")[0];
  return AREA_IDS.includes(area) ? area : "SF";
}

/** Across-replications text for a metric key: the 10th to 90th percentile, or why it is not available. */
function acrossText(summaries, key, formatter) {
  if (summaries.length === 0) return labels.absentValue(labels.ABSENT_REASONS.notRunYet);
  const values = summaries.map((s) => s.metrics[key]);
  if (values.some((v) => v === undefined || "absent" in v)) return labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication);
  const numbers = values.map((v) => v.value);
  return labels.acrossRange({ low: formatter(percentileFleetLab(numbers, 0.1)), high: formatter(percentileFleetLab(numbers, 0.9)) });
}

/** A count across replications as text: whole numbers plain, a percentile between two counts to one decimal. */
function countText(v) {
  return format.number(v, Number.isInteger(v) ? 0 : 1);
}

/** The wait p90 range across replications with the completed rides it counts beside it (design §5.8). */
function acrossWaitText(summaries, formatter) {
  const wait = acrossText(summaries, "wait.p90_s", formatter);
  if (wait.startsWith(labels.ABSENT_PREFIX)) return wait;
  const population = acrossText(summaries, "wait.population_n", countText);
  return labels.withWaitPopulation({ value: wait, population: population.startsWith(labels.ABSENT_PREFIX) ? population : labels.waitPopulation(population) });
}

/** One replay's wait p90 with its completed rides, for the table across replications. */
function seedWaitText(summary, formatter) {
  const m = summary.metrics["wait.p90_s"];
  if (m === undefined) return labels.absentValue(labels.ABSENT_REASONS.notComputed);
  if ("absent" in m) return format.valueText(m, formatter);
  const n = summary.metrics["wait.population_n"];
  const population = n === undefined ? labels.absentValue(labels.ABSENT_REASONS.notComputed) : "absent" in n ? format.valueText(n, format.count) : labels.waitPopulation(format.count(n.value));
  return labels.withWaitPopulation({ value: formatter(m.value), population });
}

const ACROSS_ROWS = Object.freeze([
  ["wait", "wait.p90_s", format.minutes],
  ["unserved", "unserved.fraction", (v) => format.percent(v, 1)],
]);

const button = (text, onClick, role, attrs = {}) => el("button", { type: "button", class: "fl-button", "data-role": role, ...attrs, on: { click: onClick } }, text);

/** A text row of the NOW panel or the panel across replications. */
function textRow([key, name, value]) {
  const node = el("p", { class: "fl-now__row", "data-row": key }, [el("span", {}, name), el("span", { "data-role": "value" }, value)]);
  updateTextRow(node, [key, name, value]);
  return node;
}

function updateTextRow(node, [, name, value]) {
  const [nameNode, valueNode] = node.children;
  setText(nameNode, name);
  setText(valueNode, value);
  valueNode.classList.toggle("fl-absent", value.startsWith(labels.ABSENT_PREFIX));
}

/** Mounts every region into the shell and wires the store to the engine host. */
function mountInterface({ root, regions }, { createWorker, engineHost, copyText }) {
  const doc = globalThis.document;
  const preset = presetById(DEFAULT_PRESET_ID);
  const store = createStore(createInitialState({ presetId: preset.id, scenario: cloneScenario(preset.scenario) }));
  const host = engineHost ?? createEngineHost({ createWorker });
  const cleanups = [];
  let destroyed = false;
  const runs = { window: null, fork: null, forkArgs: null, forkMeta: null, forkNotice: false, copyStatus: null };
  const memo = { chartHandles: [], stripHandles: [], forkHandles: [], cursor: null };

  // ---- engine ------------------------------------------------------------------------------------------------------

  /** Records the engine path in the store, which copies it into every session log entry (design §9.4). */
  function reportPath() {
    if (destroyed) return;
    const path = host.path;
    if (ENGINE_PATHS.includes(path) && store.getState().engine.path !== path) store.dispatch({ type: "engine/path", path });
  }

  /** Run window (design §7.4): computes the whole log of the first replication and the metrics of every one. */
  function runWindow() {
    const scenario = store.getState().scenario;
    if (runs.window !== null) host.cancel(runs.window.id);
    const seeds = seedSet(PRESET_SEED_SET, SANDBOX_REPLICATIONS);
    let id = null;
    const promise = host.runWindow({ scenario, seeds, logSeed: seeds[0] }, {
      onProgress: (p) => {
        if (!destroyed) store.dispatch({ type: "run/progress", id, done: p.done, total: p.total, label: p.label });
      },
    });
    id = promise.id;
    runs.window = promise;
    runs.copyStatus = null;
    store.dispatch({ type: "run/queued", id, total: seeds.length });
    return promise
      .then(
        (payload) => {
          if (destroyed) return;
          reportPath();
          store.dispatch({ type: "run/done", id, payload });
        },
        (error) => {
          if (destroyed) return;
          store.dispatch(error && error.name === "AbortError" ? { type: "run/cancelled", id } : { type: "run/error", id, message: messageOf(error) });
        },
      )
      .finally(() => {
        if (runs.window === promise) runs.window = null;
      });
  }

  /** Runs both arms of a fork on one world (contract section 7 run_pair) and shows them in the fork section. */
  function startPair(args) {
    if (runs.fork !== null) host.cancel(runs.fork.id);
    const { baseline, candidate, seed, lambdaMaxPermille, car, source = "sandbox", depots = [], verdictSeed = null } = args;
    runs.forkNotice = false;
    runs.forkArgs = args;
    const promise = host.runPair({ baseline, candidate, seed, lambdaMaxPermille });
    const id = promise.id;
    runs.fork = promise;
    runs.forkMeta = { id, baselineScenario: baseline, candidateScenario: candidate, seed, car, source, depots, verdictSeed };
    store.dispatch({ type: "fork/open", id, car });
    return promise
      .then(
        (pair) => {
          if (destroyed) return;
          reportPath();
          store.dispatch({ type: "fork/result", id, pair });
        },
        (error) => {
          if (destroyed) return;
          if (error && error.name === "AbortError") {
            if (store.getState().fork.id === id) store.dispatch({ type: "fork/close" });
          } else {
            store.dispatch({ type: "fork/error", id, message: messageOf(error) });
          }
        },
      )
      .finally(() => {
        if (runs.fork === promise) runs.fork = null;
      });
  }

  /** The two arms of a fork opened from Learn or Sandbox, or null when Sandbox has no change to fork on. */
  function forkArms(state) {
    if (state.mode === "learn" && state.learn.case !== null) {
      const axis = presetById(learnCase(state.learn.case).presetId).experiment.axis;
      return { baseline: applyAxis(state.scenario, axis.id, axis.baseline), candidate: applyAxis(state.scenario, axis.id, axis.candidate) };
    }
    const change = lastChange(state);
    if (change === null) return null;
    return { baseline: withValueAt(state.scenario, change.path, change.from), candidate: state.scenario };
  }

  /** Opens the fork for `car` (the inspector's Open the fork). Returns the run's promise, or null with a notice. */
  function openFork(car) {
    const state = store.getState();
    const arms = forkArms(state);
    if (arms === null) {
      runs.forkNotice = true;
      render(store.getState());
      return null;
    }
    const seed = state.run.selectedSeed ?? seedSet(PRESET_SEED_SET, 1)[0];
    const learning = state.mode === "learn" && state.learn.case !== null;
    const depots = learning ? [...(LEARN_FORK_DEPOTS[state.learn.case] ?? [])] : [];
    return startPair({ ...arms, seed, lambdaMaxPermille: sharedLambdaMaxPermille([arms.baseline, arms.candidate]), car, source: learning ? "learn" : "sandbox", depots });
  }

  /** From a verdict: opens `seed`'s world in both arms of the frozen spec (design §7.1). */
  function watchVerdictSeed(seed) {
    const state = store.getState();
    const frozen = state.experiment.frozen;
    if (frozen === null) return null;
    const { baseline, candidate } = armScenarios(frozen.spec);
    const car = state.fork.pinnedCar ?? state.selection?.car ?? null;
    const seeds = frozen.spec.seeds;
    // The inspector reads the Sandbox replay, which is hidden while a verdict seed is shown.
    if (state.inspector !== null) store.dispatch({ type: "inspector/close" });
    const verdictSeed = { seed, index: seeds.indexOf(seed) + 1, total: seeds.length };
    return startPair({ baseline, candidate, seed, lambdaMaxPermille: experimentEnvelope(frozen.spec), car, source: "verdict", verdictSeed });
  }

  /** The verdict seed the fork shows (`{seed, index, total}`), or null when the fork is closed or came from elsewhere. */
  function shownVerdictSeed(state) {
    const meta = runs.forkMeta;
    if (state.fork.status === "closed" || meta === null || meta.id !== state.fork.id || meta.source !== "verdict") return null;
    return meta.verdictSeed;
  }

  function closeFork() {
    if (runs.fork !== null) host.cancel(runs.fork.id);
    runs.forkNotice = false;
    store.dispatch({ type: "fork/close" });
    render(store.getState());
  }

  async function copyDetails(text) {
    try {
      await copyText(text);
      runs.copyStatus = "copied";
    } catch {
      runs.copyStatus = "failed";
    }
    if (!destroyed) render(store.getState());
  }

  // ---- regions -----------------------------------------------------------------------------------------------------

  const controls = mountControls({ store, region: regions.knobs, onRunWindow: () => runWindow() });

  const modeButtons = MODES.map((mode) =>
    el("button", { type: "button", class: "fl-button", "data-mode": mode, "aria-pressed": "false", on: { click: () => store.dispatch({ type: "mode/set", mode }) } }, labels.MODES[mode].name),
  );
  const topStatus = el("p", { class: "fl-clock", "data-role": "top-status" });
  regions.topbar.replaceChildren(
    el("h1", { class: "fl-title" }, labels.TOP_BAR.product),
    el("div", { class: "fl-modes", role: "group", "aria-label": labels.TOP_BAR.modesName }, modeButtons),
    controls.toggle,
    topStatus,
  );

  const runStatus = el("div", { "data-role": "run-status" });
  const mapHost = el("div", {});
  regions.map.replaceChildren(runStatus, mapHost);
  const help = createShortcutHelp(regions.map);
  const playback = createPlayback({ store });
  const map = mountMap(mapHost, { store, playback, onShortcuts: () => help.toggle() });

  const transportHost = el("div", { class: "fl-contents" });
  const strips = el("div", { class: "fl-transport__strips", "data-role": "strips" });
  regions.transport.replaceChildren(transportHost, strips);
  const transport = renderTransport(transportHost, { store, playback });

  const nowChip = el("span", { class: "fl-chip-replay", "data-role": "now-chip" });
  const nowRows = el("div", { "data-role": "now-rows" });
  regions.now.replaceChildren(el("div", { class: "fl-now__row" }, [el("h2", { class: "fl-small-label" }, labels.REGISTERS.nowThisReplay), nowChip]), nowRows);

  const acrossChip = el("h2", { class: "fl-chip-across", "data-role": "across-chip" });
  const acrossRows = el("div", { "data-role": "across-rows" });
  const acrossTable = el("div", { class: "fl-scroll", "data-role": "across-table" });
  acrossTable.hidden = true;
  const acrossToggle = button(labels.CHARTS.table, () => {
    acrossTable.hidden = !acrossTable.hidden;
    acrossToggle.setAttribute("aria-pressed", acrossTable.hidden ? "false" : "true");
  }, "across-table-toggle", { "aria-pressed": "false" });
  regions.across.replaceChildren(acrossChip, acrossRows, acrossToggle, acrossTable);

  const learnHost = el("div", { class: "fl-charts__wide", "data-role": "learn" });
  const experimentHost = el("div", { class: "fl-charts__wide", "data-role": "experiment" });
  const forkHost = el("section", { class: "fl-charts__wide fl-panel", "data-role": "fork", "aria-label": labels.FORK.heading });
  forkHost.hidden = true;
  const armHost = el("div", { class: "fl-charts__wide", "data-role": "arm-comparison" });
  const chartSet = el("div", { class: "fl-charts__set", "data-role": "sandbox-charts" });
  regions.charts.replaceChildren(learnHost, experimentHost, forkHost, armHost, chartSet);

  const learn = mountLearn(learnHost, { store: gatedStore(store, (s) => [s.mode === "learn", s.learn, s.reference, s.presetId, s.scenario]) });
  const experiment = mountExperiment(experimentHost, {
    store: gatedStore(store, (s) => [s.mode === "experiment", s.experiment, s.reference, s.scenario, s.changes, s.presetId, s.engine]),
    host,
    copy: copyText,
    onWatchSeed: (seed) => watchVerdictSeed(seed),
  });
  const inspector = mountInspector({ store, region: regions.inspector, onOpenFork: (car) => openFork(car) });

  const engineText = el("p", { "data-role": "engine-path" });
  const motionChoices = [[null, labels.STATES.reducedMotionSystem], [true, labels.STATES.reducedMotionOn], [false, labels.STATES.reducedMotionOff]];
  const motionButtons = motionChoices.map(([value, text]) =>
    button(text, () => store.dispatch({ type: "motion/override", value }), "motion", { "aria-pressed": "false" }),
  );
  regions.footer.replaceChildren(
    el("p", {}, labels.HONESTY.illustrative),
    engineText,
    el("div", { class: "fl-group", role: "group", "aria-label": labels.STATES.reducedMotion }, [el("span", {}, labels.STATES.reducedMotion), ...motionButtons]),
  );
  const live = createLiveRegion(regions.footer);

  // ---- rendering ---------------------------------------------------------------------------------------------------

  function renderTopBar(state) {
    root.setAttribute("data-mode", state.mode);
    for (const b of modeButtons) b.setAttribute("aria-pressed", b.getAttribute("data-mode") === state.mode ? "true" : "false");
    const run = state.run;
    const seed = run.log !== null ? run.selectedSeed : null;
    const clock = format.clock(state.clock_s);
    const verdictSeed = shownVerdictSeed(state);
    if (verdictSeed !== null) setText(topStatus, labels.verdictSeedStatus({ clock, ...verdictSeed }));
    else setText(topStatus, seed === null ? clock : labels.topBarStatus({ clock, replay: run.summaries.findIndex((s) => s.seed === seed) + 1, replays: run.summaries.length, seed }));
  }

  function runStatusNodes(state) {
    const run = state.run;
    if (run.status === "queued" || run.status === "running") {
      const p = run.progress;
      const text = run.status === "queued" || p === null || p.total === 0 ? labels.STATES.queued : labels.replicationProgress(Math.min(p.done + 1, p.total), p.total);
      return [el("div", { class: "fl-group" }, [el("p", { role: "status", "data-role": "progress" }, text), button(labels.STATES.cancel, () => host.cancel(run.id), "cancel")])];
    }
    if (run.status === "cancelled") return [el("p", { class: "fl-muted", role: "status", "data-role": "cancelled" }, labels.STATES.cancelled)];
    if (run.status === "error") {
      return [el("div", { class: "fl-error", "data-role": "engine-stopped" }, [el("p", {}, labels.STATES.engineStopped), button(labels.STATES.retry, () => runWindow(), "retry")])];
    }
    if (run.status === "void") {
      const id = violationId(run.violation);
      const rule = labels.INVARIANT_RULES[id] ?? labels.STATES.unknownRule;
      const children = [
        el("p", {}, labels.invariantFailure({ rule, id })),
        button(labels.STATES.copyDetails, () => copyDetails(run.violation), "copy-details", { disabled: typeof copyText !== "function" }),
      ];
      if (runs.copyStatus !== null) children.push(el("p", { role: "status", "data-role": "copy-status" }, runs.copyStatus === "copied" ? labels.VERDICT.copied : labels.VERDICT.copyFailed));
      return [el("div", { class: "fl-error", "data-role": "invariant-failure" }, children)];
    }
    return [];
  }

  function renderRunStatus(state) {
    const run = state.run;
    const key = [run.status, run.id, run.progress?.done, run.progress?.total, run.violation, runs.copyStatus];
    if (sameKey(key, memo.status)) return;
    memo.status = key;
    runStatus.replaceChildren(...runStatusNodes(state));
  }

  function renderNow(state) {
    const run = state.run;
    const key = [run.log, run.status, state.clock_s, state.reducedMotion, playback.simplified, run.selectedSeed, scenarioOfRun(state)];
    if (sameKey(key, memo.now)) return;
    memo.now = key;
    const scenario = scenarioOfRun(state);
    const model = mapModel({ scenario, log: run.log, frame: run.log === null ? null : playback.frame(), clock_s: state.clock_s });
    const missing = labels.absentValue(run.status === "void" ? labels.ABSENT_REASONS.voidRun : labels.ABSENT_REASONS.notRunYet);
    const total = (values) => (values.includes(null) ? null : values.reduce((a, b) => a + b, 0));
    const text = (value) => (value === null ? missing : format.count(value));
    const areas = Object.values(model.areas);
    const highway = model.routes.filter((r) => r.cls === "HIGHWAY").flatMap((r) => r.directions.flatMap((d) => [d.riderWork, d.emptyDrive]));
    // Depot rows follow the scenario's depot list (area order), whatever order the run log keeps.
    const place = new Map(scenario.depots.map((d, i) => [d.id, i]));
    const depots = model.depots.slice().sort((a, b) => (place.get(a.id) ?? place.size) - (place.get(b.id) ?? place.size));
    const rows = [
      ["waiting", labels.MAP.tableHeads.waitingRiders, text(total(areas.map((a) => a.waiting)))],
      ["unserved", labels.MAP.tableHeads.unservedLastHour, text(total(areas.map((a) => a.unservedLastHour)))],
      ...depots.map((d) => [`lot:${d.id}`, labels.nowLot(d.id), d.held === null ? missing : labels.lotFill(d.held, d.parking)]),
      ["highways", labels.NOW_PANEL.carsOnHighways, text(total(highway))],
    ];
    setText(nowChip, run.log !== null && run.selectedSeed !== null ? labels.thisReplayChip(run.selectedSeed) : labels.REGISTERS.thisReplay);
    keyedList(nowRows, rows, { key: (row) => row[0], create: textRow, update: updateTextRow });
  }

  function renderAcross(state) {
    const summaries = state.run.summaries;
    if (memo.across === summaries && memo.acrossStatus === state.run.status) return;
    memo.across = summaries;
    memo.acrossStatus = state.run.status;
    // The register chip names a count, so it waits for replications that exist.
    acrossChip.hidden = summaries.length === 0;
    setText(acrossChip, labels.acrossReplicationsChip(summaries.length));
    const rows = ACROSS_ROWS.map(([key, metric, formatter]) => [
      key,
      key === "wait" ? labels.NOW_PANEL.waitP90 : labels.NOW_PANEL.unservedShare,
      key === "wait" ? acrossWaitText(summaries, formatter) : acrossText(summaries, metric, formatter),
    ]);
    if (summaries.length === 0 && state.run.status === "void") {
      for (const row of rows) row[2] = labels.absentValue(labels.ABSENT_REASONS.voidRun);
    }
    keyedList(acrossRows, rows, { key: (row) => row[0], create: textRow, update: updateTextRow });
    const heads = [labels.CHART_TEXT.heads.seed, labels.NOW_PANEL.waitP90, labels.NOW_PANEL.unservedShare];
    const cells = summaries.map((s) => [
      String(s.seed),
      ...ACROSS_ROWS.map(([key, metric, formatter]) => {
        if (key === "wait") return seedWaitText(s, formatter);
        const m = s.metrics[metric];
        return m === undefined ? labels.absentValue(labels.ABSENT_REASONS.notComputed) : format.valueText("absent" in m ? m : m.value, formatter);
      }),
    ]);
    acrossToggle.disabled = summaries.length === 0;
    acrossTable.replaceChildren(
      el("table", { class: "fl-table" }, [
        el("thead", {}, el("tr", {}, heads.map((h) => el("th", { scope: "col" }, h)))),
        el("tbody", {}, cells.map((row) => el("tr", {}, row.map((cell) => el("td", { class: cell.startsWith(labels.ABSENT_PREFIX) ? "fl-absent" : null }, cell))))),
      ]),
    );
  }

  function renderCharts(state) {
    const run = state.run;
    const key = [run.summaries, run.selectedSeed, run.status === "void"];
    if (sameKey(key, memo.charts)) return;
    memo.charts = key;
    memo.cursor = null;
    const replay = run.summaries.find((s) => s.seed === run.selectedSeed);
    if (replay === undefined) {
      memo.chartHandles = [];
      if (run.status === "void") chartSet.replaceChildren();
      else chartSet.replaceChildren(el("p", { class: "fl-absent fl-charts__wide", "data-role": "charts-absent" }, labels.absentValue(labels.ABSENT_REASONS.notRunYet)));
      return;
    }
    const window = scenarioOfRun(state).window;
    const seed = replay.seed;
    memo.chartHandles = [
      fleetStateChart({ series: replay.series, window, seed }),
      ...ROW_CHARTS.map((chart) => metricByHourChart({ chart, runs: run.summaries, seed, window, population: run.log !== null && run.log.seed === seed ? { log: run.log, scenario: scenarioOfRun(state) } : null })),
    ];
    chartSet.replaceChildren(...memo.chartHandles.map((handle) => handle.node));
  }

  function renderStrips(state) {
    const run = state.run;
    const area = focusArea(state);
    const key = [run.summaries, run.selectedSeed, area];
    if (sameKey(key, memo.strips)) return;
    memo.strips = key;
    memo.cursor = null;
    const replay = run.summaries.find((s) => s.seed === run.selectedSeed);
    if (replay === undefined) {
      memo.stripHandles = [];
      strips.replaceChildren();
      return;
    }
    const scenario = scenarioOfRun(state);
    const route = scenario.routes.find((r) => r.cls === "HIGHWAY" && (r.a === area || r.b === area));
    const traffic = route === undefined
      ? { roadClass: "IN_AREA" }
      : { roadClass: "HIGHWAY", direction: `${route.a === area ? route.b : route.a}>${area}` };
    memo.stripHandles = [
      demandStrip({ series: replay.series, area, seed: replay.seed, window: scenario.window }),
      trafficStrip({ series: replay.series, ...traffic, seed: replay.seed, window: scenario.window }),
    ];
    strips.replaceChildren(...memo.stripHandles.map((handle) => handle.node));
  }

  function renderFork(state) {
    const fork = state.fork;
    const key = [fork.status, fork.id, fork.pair, fork.stale, fork.error, fork.pinnedCar, runs.forkNotice, runs.forkMeta];
    if (sameKey(key, memo.fork)) return;
    memo.fork = key;
    memo.cursor = null;
    memo.forkHandles = [];
    if (fork.status === "closed" && !runs.forkNotice) {
      forkHost.hidden = true;
      forkHost.replaceChildren();
      return;
    }
    forkHost.hidden = false;
    forkHost.classList.toggle("fl-stale", fork.stale === true);
    // The §1.3 caption belongs to the two drawn runs, so carForkCharts places it once, above them.
    const children = [el("h2", { class: "fl-title" }, labels.FORK.heading)];
    if (shownVerdictSeed(state) !== null) children.push(el("p", { class: "fl-muted", "data-role": "verdict-seed-note" }, labels.FORK.verdictSeedNote));
    if (fork.status === "closed") {
      children.push(el("p", { "data-role": "fork-needs-change" }, labels.FORK.needsChange));
    } else if (fork.status === "running") {
      children.push(el("div", { class: "fl-group" }, [el("p", { role: "status", "data-role": "fork-running" }, labels.FORK.running), button(labels.STATES.cancel, () => closeFork(), "fork-cancel")]));
    } else if (fork.status === "error") {
      children.push(el("div", { class: "fl-error", "data-role": "fork-error" }, [el("p", {}, labels.STATES.engineStopped), button(labels.STATES.retry, () => startPair(runs.forkArgs), "fork-retry")]));
    } else if (fork.pair !== null && runs.forkMeta !== null && runs.forkMeta.id === fork.id) {
      const meta = runs.forkMeta;
      const inBoth = (car) => typeof car === "string" && fork.pair.baseline.log.intervals[car] !== undefined && fork.pair.candidate.log.intervals[car] !== undefined;
      const car = [fork.pinnedCar, meta.car].find(inBoth) ?? fork.pair.baseline.log.cars[0].id;
      const group = carForkCharts({ pair: fork.pair, baselineScenario: meta.baselineScenario, candidateScenario: meta.candidateScenario, car, seed: meta.seed, depots: meta.depots });
      memo.forkHandles = [group];
      children.push(group.node);
    }
    children.push(button(labels.FORK.close, () => closeFork(), "fork-close"));
    forkHost.replaceChildren(...children);
  }

  function renderArms(state) {
    const ex = state.experiment;
    const key = [ex.verdict, ex.perSeed, ex.frozen];
    if (sameKey(key, memo.arms)) return;
    memo.arms = key;
    if (ex.verdict === null || ex.frozen === null || ex.verdict.validity !== "VALID" || ex.perSeed.length === 0) {
      armHost.replaceChildren();
      return;
    }
    const spec = ex.frozen.spec;
    const measured = new Set(Object.keys(ex.perSeed[0].baseline_metrics));
    const metrics = [spec.primary, ...spec.guardrails]
      .map((ref) => metricKey({ metric: ref.metric, scope: ref.scope }))
      .filter((k, i, all) => measured.has(k) && all.indexOf(k) === i);
    if (metrics.length === 0) {
      armHost.replaceChildren();
      return;
    }
    armHost.replaceChildren(el("h2", { class: "fl-title" }, labels.CHARTS.titles.arm_comparison), armComparisonCharts({ perSeed: ex.perSeed, metrics }).node);
  }

  function renderFooter(state) {
    const path = state.engine.path;
    setText(engineText, path === null ? `engine: ${labels.absentValue(labels.ABSENT_REASONS.enginePathNotReported)}` : labels.enginePath(path));
    motionButtons.forEach((b, i) => b.setAttribute("aria-pressed", motionChoices[i][0] === state.reducedMotion.override ? "true" : "false"));
  }

  function render(state) {
    if (destroyed) return;
    const computing = state.run.status === "queued" || state.run.status === "running";
    const stale = state.run.stale || (computing && state.run.summaries.length > 0);
    learnHost.hidden = state.mode !== "learn";
    experimentHost.hidden = state.mode !== "experiment";
    armHost.hidden = state.mode !== "experiment";
    chartSet.hidden = state.mode === "experiment";
    // One THIS REPLAY seed on screen (design §7.4, H-10): the Sandbox replay's regions step aside for a verdict seed.
    const sandboxAside = shownVerdictSeed(state) !== null;
    for (const node of [regions.map, regions.now, regions.across, strips]) node.hidden = sandboxAside;
    root.setAttribute("data-verdict-seed", sandboxAside ? "true" : "false");
    for (const node of [regions.now, regions.across, chartSet, strips]) node.classList.toggle("fl-stale", stale);
    renderTopBar(state);
    renderRunStatus(state);
    renderNow(state);
    renderAcross(state);
    renderCharts(state);
    renderStrips(state);
    renderFork(state);
    renderArms(state);
    renderFooter(state);
    if (memo.cursor !== state.clock_s) {
      memo.cursor = state.clock_s;
      setCursorAll([...memo.chartHandles, ...memo.stripHandles, ...memo.forkHandles], state.clock_s);
    }
  }

  /** The polite announcement (design §7.7): the clock, and this replay's waiting and unserved riders once a run exists. */
  function announcement(state) {
    const clock = format.clock(state.clock_s);
    if (state.run.log === null) return clock;
    const model = mapModel({ scenario: scenarioOfRun(state), log: state.run.log, frame: playback.frame(), clock_s: state.clock_s });
    const areas = Object.values(model.areas);
    return labels.mapAnnouncement({
      clock,
      waiting: areas.reduce((n, a) => n + a.waiting, 0),
      unservedLastHour: areas.reduce((n, a) => n + a.unservedLastHour, 0),
    });
  }

  cleanups.push(store.subscribe((state) => render(state)));
  cleanups.push(playback.onChange(() => render(store.getState())));
  cleanups.push(store.subscribe(createAnnouncer(live, announcement)));
  cleanups.push(watchReducedMotion(store, doc.documentElement));
  if (ENGINE_PATHS.includes(host.path)) reportPath();
  else Promise.resolve(host.ready).then(reportPath, () => {});
  render(store.getState());

  function destroy() {
    if (destroyed) return;
    host.cancel();
    destroyed = true;
    for (const stop of cleanups.splice(0)) stop();
    for (const part of [controls, inspector, map, transport, playback, learn, experiment]) part.destroy();
  }

  return { store, host, playback, runWindow, openFork, watchVerdictSeed, destroy };
}
