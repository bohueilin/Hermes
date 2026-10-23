// Inspect drawer (design §7.1, §7.2): the day of one depot or one car in the replay being watched, stamped THIS REPLAY
// with its seed and clock. The depot ledger adds a column across replications; a value that cannot be shown reads
// "not available: <reason>". Escape closes the drawer and focus returns to where it was.
//
// Decision where the design is silent: the depot drawer lists the cars at the depot at the snapshot, each with Inspect
// and Pin buttons, so a pointer or touch can open a car and pin it on the map (the keyboard keeps I on the map).

import { computeMetric, metricKey, metricRow } from "../model/metrics.js";
import { rememberFocus } from "./a11y.js";
import { carTimelineChart, depotBoardCharts } from "./charts.js";
import { el, withArrows } from "./dom.js";
import { acrossText as spreadText, clock, minutes, number, percent, valueText } from "./format.js";
import * as labels from "./labels.js";

const { INSPECTOR } = labels;

const LEDGER_ROWS = [
  ["bayWait", "depot.bay_wait_p90_s"],
  ["timeToReady", "depot.turnaround_p90_s"],
  ["timeToReadyCompleted", "depot.turnaround_completed_p90_s"],
  ["diversions", "depot.diversions"],
  ["lotPeak", "depot.parking_peak_fraction"],
];
const DECISIONS = new Set(["DEPOT_ASSIGNED", "DEPOT_DIVERTED"]);

/** Formatter for a registered metric's values: seconds as minutes, fractions as percentages, counts as numbers. */
function formatterOf(metric) {
  const unit = metricRow(metric).unit;
  if (unit === "s") return minutes;
  return unit === "fraction" ? (v) => percent(v, 1) : (v) => number(v);
}

/** A metric result `{value}` or `{absent}` as text. */
const metricText = (result, format) => valueText("absent" in result ? result : result.value, format);

/** A table inside its own scroller; every cell is text, and absent cells take the absent style. */
function table(head, rows) {
  return el("div", { class: "fl-scroll" }, el("table", { class: "fl-table" }, [
    el("thead", {}, el("tr", {}, head.map((text) => el("th", { scope: "col" }, text)))),
    el("tbody", {}, rows.map((cells) => el("tr", {}, cells.map((text) => el("td", { class: text.startsWith(labels.ABSENT_PREFIX) ? "fl-absent" : null }, text))))),
  ]));
}

const heading = (text) => el("h3", { class: "fl-title" }, text);
const absentLine = (reason) => el("p", { class: "fl-absent" }, labels.absentValue(reason));

/** The last snapshot at or before `t_s` (snapshots are every 300 simulated seconds). */
function snapshotAt(log, t_s) {
  let found = log.snapshots[0];
  for (const snapshot of log.snapshots) {
    if (snapshot.t > t_s) break;
    found = snapshot;
  }
  return found;
}

/** Across-replications text for a metric key: the 10th to 90th percentile, or why it is not available. */
function acrossText(summaries, key, format) {
  const values = summaries.map((s) => s.metrics[key]);
  if (values.some((v) => v === undefined)) return labels.absentValue(labels.ABSENT_REASONS.onlyThisReplay);
  if (values.some((v) => "absent" in v)) return labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication);
  return spreadText(values.map((v) => v.value), format);
}

/**
 * One depot at second `t_s` in this replay, read from the snapshot at or before it and from the visits still open
 * there: `{id, at_s, held, stalls, queued, oldestWait_s, inBays, bays, cleanBays, serviceBays, ready}`. `queued` counts
 * the cars that finished intake and have not started a task, which is the queue the drawer's NOW flow writes. The
 * walkthrough's four-depot table reads this same function, so the table and the drawer cannot disagree about one depot
 * at one second.
 */
export function depotView(log, depotId, t_s) {
  const depot = log.depots.find((d) => d.id === depotId);
  if (depot === undefined) return null;
  const snapshot = snapshotAt(log, t_s);
  const t = snapshot.t;
  const view = snapshot.depots.find((d) => d.id === depotId);
  const open = log.visits.filter((v) => v.depot === depotId && v.arrival_s <= t && (v.ready_s === null || v.ready_s > t));
  const waiting = open.filter((v) => v.intake_end_s !== null && v.intake_end_s <= t && (v.first_task_s === null || v.first_task_s > t));
  return {
    id: depotId,
    at_s: t,
    held: view.stalls_held,
    stalls: depot.parking,
    queued: waiting.length,
    oldestWait_s: waiting.length === 0 ? null : t - Math.min(...waiting.map((v) => v.intake_end_s)),
    inBays: snapshot.cars.filter((c) => c.state === "IN_SERVICE" && c.location?.depot === depotId).length,
    bays: depot.cleaning_bays + depot.service_bays,
    cleanBays: depot.cleaning_bays,
    serviceBays: depot.service_bays,
    ready: view.ready,
  };
}

/** The NOW flow of a depot at the snapshot's second: arriving, intake, queue with its oldest wait, each bay, ready. */
function flowStages(log, snapshot, depot, scenario, depotNow) {
  const t = snapshot.t;
  const { stages } = INSPECTOR;
  const here = snapshot.cars.filter((c) => c.location?.depot === depot.id);
  const openVisits = log.visits.filter((v) => v.depot === depot.id && v.arrival_s <= t && (v.ready_s === null || v.ready_s > t));
  const lines = [
    labels.flowStage({ stage: stages.arriving, count: snapshot.cars.filter((c) => c.state === "TO_DEPOT" && c.leg.to.depot === depot.id).length }),
    labels.flowStage({ stage: stages.intake, count: here.filter((c) => c.state === "INTAKE").length }),
    labels.queueStage({ count: depotNow.queued, oldest: depotNow.oldestWait_s === null ? null : minutes(depotNow.oldestWait_s) }),
  ];
  const tasks = [["CLEAN", depot.cleaning_bays, "clean_start_s", scenario.clean_s], ["SERVICE", depot.service_bays, "service_start_s", scenario.service_s]];
  for (const [task, bays, startKey, seconds] of tasks) {
    // The engine does not number bays, so cars fill bays in the order their task started.
    const busy = here
      .filter((c) => c.state === "IN_SERVICE" && c.task === task)
      .map((car) => ({ car, start: openVisits.find((v) => v.car === car.id)?.[startKey] ?? t }))
      .sort((a, b) => a.start - b.start || (a.car.id < b.car.id ? -1 : 1));
    for (let i = 0; i < bays; i += 1) {
      const bay = labels.bayId({ task, index: i + 1 });
      const entry = busy[i];
      lines.push(entry === undefined ? labels.bayFree(bay) : labels.bayBusy({
        bay, car: entry.car.id, task, done: Math.floor(Math.min(seconds, t - entry.start) / 60), total: Math.round(seconds / 60), blocked: entry.car.blocked === true,
      }));
    }
  }
  lines.push(labels.flowStage({ stage: stages.ready, count: depotNow.ready }));
  return lines;
}

/**
 * Renders the Inspect drawer into `region` (the shell's inspector aside) from `store`: `state.inspector` opens a
 * `{depot}` or `{car}` of the run log. `onOpenFork(carId)` starts the fork, which the caller runs.
 */
export function mountInspector({ store, region, onOpenFork = () => {} }) {
  const title = el("h2", { class: "fl-title" });
  const stamp = el("p", { class: "fl-chip-replay" });
  const close = el("button", { type: "button", class: "fl-button", on: { click: () => store.dispatch({ type: "inspector/close" }) } }, INSPECTOR.close);
  const body = el("div", {});
  region.replaceChildren(el("div", {}, [title, stamp, close]), body);
  region.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    store.dispatch({ type: "inspector/close" });
  });

  let restoreFocus = null;
  let rendered = null;
  let carsOpen = false;

  const setOpen = (open) => {
    region.hidden = !open;
    region.toggleAttribute("inert", !open);
    region.setAttribute("data-open", String(open));
  };

  function depotSections(state, log, scenario, depotId, t) {
    const depot = log.depots.find((d) => d.id === depotId);
    if (depot === undefined) return [absentLine(labels.ABSENT_REASONS.notComputed)];
    const snapshot = snapshotAt(log, t);
    const now = depotView(log, depotId, t);
    const board = depotBoardCharts({ log, scenario, depots: [depotId], seed: log.seed });
    board.setCursor(t);
    const result = { ...log, scenario, window: scenario.window };
    const ledgerRows = LEDGER_ROWS.map(([row, metric]) => {
      const ref = { metric, scope: { depot: depotId } };
      const format = formatterOf(metric);
      return [INSPECTOR.ledgerRows[row], metricText(computeMetric(result, ref), format), acrossText(state.run.summaries, metricKey(ref), format)];
    });
    return [
      el("p", { class: "fl-mono" }, labels.depotStatus({ held: now.held, stalls: now.stalls, inBays: now.inBays, cleanBays: now.cleanBays, serviceBays: now.serviceBays })),
      el("p", { class: "fl-limits-chip" }, labels.MODEL_LIMITS.noStaff),
      heading(INSPECTOR.now),
      el("ol", { class: "fl-flow" }, withArrows(flowStages(log, snapshot, depot, scenario, now).map((text) => el("li", { class: "fl-mono" }, text)), labels.FLOW_ARROW)),
      carsHere(state, snapshot, depotId),
      heading(INSPECTOR.board),
      board.node,
      table([INSPECTOR.ledger, INSPECTOR.value, labels.ledgerAcross(state.run.summaries.length)], ledgerRows),
    ];
  }

  /** The cars at the depot at the snapshot, each with Inspect and Pin (the pointer path to a car's drawer and the map). */
  function carsHere(state, snapshot, depotId) {
    const cars = snapshot.cars.filter((c) => c.location?.depot === depotId).sort((a, b) => (a.id < b.id ? -1 : 1));
    const pinned = state.fork.pinnedCar;
    const items = cars.map((car) => el("li", { class: "fl-group", "data-car": car.id }, [
      el("span", { class: "fl-mono" }, labels.carHere({ car: car.id, state: labels.carStateText(car) })),
      el("button", {
        type: "button", class: "fl-button", "data-role": "inspect-car", "data-focus-key": `inspect:${car.id}`,
        on: { click: () => store.dispatch({ type: "inspector/open", target: { car: car.id } }) },
      }, labels.inspectCar(car.id)),
      el("button", {
        type: "button", class: "fl-button", "data-role": "pin-car", "data-focus-key": `pin:${car.id}`, "aria-pressed": pinned === car.id ? "true" : "false",
        on: { click: () => store.dispatch({ type: "fork/pin", car: car.id }) },
      }, labels.pinCarNamed(car.id)),
    ]));
    return el("details", {
      "data-role": "cars-here",
      open: carsOpen,
      on: { toggle: (event) => { carsOpen = event.target.hasAttribute("open"); } },
    }, [
      el("summary", { class: "fl-title" }, labels.carsHereHeading(cars.length)),
      cars.length === 0 ? el("p", { class: "fl-muted" }, INSPECTOR.carsHereNone) : el("ul", { class: "fl-list-plain" }, items),
    ]);
  }

  function carSections(log, scenario, carId, t) {
    const car = log.cars.find((c) => c.id === carId);
    if (car === undefined) return [absentLine(labels.ABSENT_REASONS.notComputed)];
    const intervals = log.intervals[carId];
    const now = intervals.find((iv) => iv.t0 <= t && t < iv.t1) ?? intervals[intervals.length - 1];
    const visits = log.visits.filter((v) => v.car === carId);
    const decisions = log.events.filter((e) => e.car === carId && DECISIONS.has(e.kind));
    const timeline = carTimelineChart({ log, scenario, car: carId, seed: log.seed });
    timeline.setCursor(t);
    const cols = INSPECTOR.columns;
    return [
      el("p", { class: "fl-mono" }, labels.carHome({ area: car.home_area, depot: car.home_depot })),
      heading(INSPECTOR.now),
      el("p", {}, labels.carStateText(now)),
      heading(INSPECTOR.timelineHeading),
      timeline.node,
      heading(INSPECTOR.visitsHeading),
      visits.length === 0
        ? el("p", { class: "fl-muted" }, INSPECTOR.noVisit)
        : table([cols.depot, cols.arrival, cols.ready], visits.map((v) => [v.depot, clock(v.arrival_s), v.ready_s === null ? labels.absentValue(labels.visitsUnfinished(1)) : clock(v.ready_s)])),
      heading(INSPECTOR.whyHeading),
      decisions.length === 0
        ? el("p", { class: "fl-muted" }, INSPECTOR.noDecision)
        : el("ul", {}, decisions.map((e) => el("li", { class: "fl-mono" }, labels.decisionLine({ clock: clock(e.t), kind: e.kind, depot: e.depot, target: e.detail.purpose ?? e.detail.to, cause: e.detail.cause })))),
      el("button", { type: "button", class: "fl-button", "data-focus-key": "pin-this-car", on: { click: () => store.dispatch({ type: "fork/pin", car: carId }) } }, INSPECTOR.pinCar),
      el("button", { type: "button", class: "fl-button fl-button--primary", on: { click: () => onOpenFork(carId) } }, INSPECTOR.openFork),
      el("p", { class: "fl-muted" }, labels.HONESTY.forkCaption),
    ];
  }

  function fill(state, target, log, t) {
    // Metrics read the scenario the run was queued on, so a later knob change cannot relabel this replay's numbers.
    const scenario = state.run.scenarioAtQueue ?? state.scenario;
    const name = target.depot === undefined ? target.car : labels.depotName({ depotId: target.depot, areaName: labels.MAP.areas[target.depot.split("-")[0]] });
    title.textContent = labels.inspectorTitle({ heading: target.depot === undefined ? INSPECTOR.carHeading : INSPECTOR.depotHeading, name });
    stamp.hidden = log === null;
    if (state.run.stale) body.setAttribute("class", "fl-stale");
    else body.removeAttribute("class");
    if (log === null) {
      body.replaceChildren(el("p", { class: "fl-muted" }, labels.STATES.nothingRun));
      return;
    }
    stamp.textContent = labels.inspectorStamp({ seed: log.seed, clock: clock(t) });
    body.replaceChildren(...(target.depot === undefined ? carSections(log, scenario, target.car, t) : depotSections(state, log, scenario, target.depot, t)));
  }

  /**
   * Rebuilds when the target, the run or the pinned car changes, or the clock crosses into another snapshot. Focus stays
   * on the control it was on (by `data-focus-key`); when that control is gone with a new target, it moves to Close.
   */
  function render(state) {
    const target = state.inspector;
    const log = state.run.log;
    const pinned = state.fork.pinnedCar;
    const t = log === null ? state.clock_s : snapshotAt(log, state.clock_s).t;
    if (rendered !== null && rendered.target === target && rendered.run === state.run && rendered.t === t && rendered.pinned === pinned) return;
    const opening = target !== null && (rendered === null || rendered.target === null);
    const retargeted = !opening && target !== null && rendered.target !== target;
    rendered = { target, run: state.run, t, pinned };
    if (target === null) {
      if (region.hidden) return;
      setOpen(false);
      restoreFocus?.();
      restoreFocus = null;
      return;
    }
    if (opening) restoreFocus = rememberFocus();
    const doc = region.ownerDocument;
    const active = doc.activeElement;
    const focusKey = active && region.contains(active) ? active.getAttribute("data-focus-key") : null;
    fill(state, target, log, t);
    setOpen(true);
    const again = focusKey === null ? null : region.querySelector(`[data-focus-key="${focusKey}"]`);
    if (again !== null) again.focus();
    else if (opening || retargeted || (focusKey !== null && !region.contains(doc.activeElement))) close.focus();
  }

  const unsubscribe = store.subscribe(render);
  render(store.getState());
  return { destroy: unsubscribe };
}
