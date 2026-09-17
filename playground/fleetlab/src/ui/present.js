// The walkthrough (demo plan sections 1.1, 4.1, 4.4 and 4.7; ARCHITECTURE decision 44). A layer over the three modes,
// never a fourth one: `Present` turns the page into a stage, a ledger and a rail, and one `Next` button walks four
// chapters of scripted beats over a single replay of the operations casebook's OPS-01.
//
// What a beat is allowed to do. `Prepare` runs the window once and the experiment once; after that every beat is a
// seek, a pin and a projection. A beat never runs the model, never stores a number and never carries a number this
// file typed: every figure, every table cell and every narration line is read from the frame model (map.js), the
// interval log, the summaries or the verdict through the same formatters the rest of the page uses. Before those runs
// land, every figure reads `not available: nothing has run yet` and `Next` is off (H-5, H-6: never a zero for an
// absence, never a score).
//
// Beat clocks are derived from the scenario's own declared knobs (`peaks`, `recall_s`, `release_s`), never searched and
// never typed, so moving a knob moves the beat with it. Narration is generated from the run in the second person and
// states no direction the pins do not carry (H-9); test/present.test.mjs scans every string in PRESENT for a direction
// word and holds each narration line to the run it was generated from.
//
// Motion: a beat change is instant, and a beat lands on its own second and stays there. Nothing here tweens, counts up,
// transitions or starts the clock: the presenter (or a reader) presses Play, the beat runs the ordinary playback clock
// at 300x, and a store subscriber pauses it at the second the beat declared. Every beat teaches from its still frame,
// which is the frame the script was written around.

import { CHECK_IDS } from "../model/invariants.js";
import { computeMetric } from "../model/metrics.js";
import { PRESETS, presetById } from "../model/presets.js";
import { bindShortcuts } from "./a11y.js";
import { registryRows, renderHourly, renderReadout, renderRegistry } from "./analytics.js";
import { el, keyedList, setText } from "./dom.js";
import { situationBlock, specInWords, startFromPreset, tradeOffSentence, valueWithMinutes } from "./experiment.js";
import * as format from "./format.js";
import { depotView } from "./inspector.js";
import * as labels from "./labels.js";
import { frameModel } from "./map.js";

const { MAP, MODEL_LIMITS, PRESENT } = labels;

/** Simulated seconds per real second while presenting (demo plan 4.4: 15 simulated minutes in 3 s). */
export const PRESENT_SPEED = 300;

/** The casebook situation the walkthrough plays (demo plan section 1.1). */
export const PRESENT_PRESET_ID = "OPS-01";

/** Lines the ticker keeps, and how far back through the log it will look for them. */
const TICKER_LINES = 4;
const TICKER_SCAN = 600;

/** Second of hour `h` on `day` (day 1 is the first simulated day), in the clock the engine and the store share. */
const at = (day, h, m = 0) => (day - 1) * 86400 + h * 3600 + m * 60;

/**
 * The casebook question after the one this walkthrough played, by its id and title alone: a title is a question, and
 * naming a verdict for a case this page never ran would be a direction the pins do not carry (H-9).
 */
export function nextCasebookPreset(afterId = PRESENT_PRESET_ID) {
  const casebook = PRESETS.filter((preset) => preset.kind === "ops");
  const after = casebook.findIndex((preset) => preset.id === afterId);
  return after === -1 ? null : casebook[after + 1] ?? null;
}

/** That record by id and title alone, which is the form the walkthrough says it in. */
export function nextCasebookQuestion(afterId = PRESENT_PRESET_ID) {
  const next = nextCasebookPreset(afterId);
  return next === null ? null : labels.presetOption({ id: next.id, title: next.title });
}

/** How many situations the casebook holds; counted from the records, never typed. */
const CASEBOOK_COUNT = PRESETS.filter((preset) => preset.kind === "ops").length;

/** The evening peak's own start, from the scenario's declared peak windows. */
const eveningPeak = (scenario) => scenario.peaks[scenario.peaks.length - 1];

// ---------------------------------------------------------------------------------------------------------------
// Reading the run. Every function here is a projection: it takes what the engine already computed and returns a
// number, a clock or null. None of them runs the model and none of them rounds before a formatter does.

/** Cars of one state family, wherever they stand: the areas' tallies plus the cars drawn on a route. */
function familyTotal(model, family) {
  const standing = Object.values(model.areas).reduce((n, area) => n + (area.families === null ? 0 : area.families[family]), 0);
  return standing + model.onRoutes.filter((car) => car.family === family).length;
}

/** Cars in one engine state at the frame's second, counted over the whole fleet. */
const carsInState = (frame, state) => frame.cars.filter((car) => car.state === state).length;

/** Every area's waiting riders, or its riders who gave up inside the last simulated hour. */
const areaTotal = (model, field) => Object.values(model.areas).reduce((n, area) => n + (area[field] ?? 0), 0);

/** The depot view of every depot the scenario declares, in the scenario's own order (the drawer's own reading). */
function depotViews(log, scenario, t_s) {
  return scenario.depots.map((d) => depotView(log, d.id, t_s)).filter((view) => view !== null);
}

/**
 * The depot the walkthrough watches: the depot its own guardrail names, so the beat that shows a queue is showing the
 * resource the frozen spec said it would watch. Falls back to the scenario's smallest lot when no guardrail names one.
 */
export function focusDepot(state) {
  const spec = state.experiment.frozen?.spec ?? state.experiment.draft;
  const named = (spec?.guardrails ?? []).map((g) => g.scope?.depot).find((id) => typeof id === "string");
  if (named !== undefined) return named;
  const depots = state.scenario.depots;
  return depots.reduce((smallest, d) => (d.parking < smallest.parking ? d : smallest), depots[0]).id;
}

/**
 * The area the walkthrough reads by hour: the area its own primary is scoped to, so the chart shows the riders the
 * frozen spec measured. Falls back to the scenario's first area when the primary is not scoped to one.
 */
export function focusArea(state) {
  const spec = state.experiment.frozen?.spec ?? state.experiment.draft;
  const named = spec?.primary?.scope?.area;
  return typeof named === "string" ? named : state.scenario.areas[0].id;
}

/** Index of the last event at or before `t_s` (-1 when none); events are written in clock order. */
function eventIndexAt(events, t_s) {
  let lo = 0;
  let hi = events.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t <= t_s) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Events of one kind at exactly second `t_s`, counted (the recall's burst is one second's worth of them). */
export function eventsAt(log, kind, t_s) {
  let n = 0;
  for (let i = eventIndexAt(log.events, t_s); i >= 0 && log.events[i].t === t_s; i -= 1) {
    if (log.events[i].kind === kind) n += 1;
  }
  return n;
}

/** Events of this replay written at or before `t_s`: the log is in clock order, so it is the index plus one. */
export function eventsSoFar(log, t_s) {
  return eventIndexAt(log.events, t_s) + 1;
}

/**
 * The second a depot's bay queue cleared at or after `after_s`, or null while it never clears inside the run.
 * A visit joins the queue when its intake ends and leaves it when its first task starts, so sweeping those two seconds
 * gives the queue length at every second the log can change it, without inventing a second between snapshots.
 *
 * Cleared means a queue that held a car falling to empty, never any second whose count happens to read zero. The
 * seconds just after a recall read zero because the backlog has not built yet: the first recalled car walks into a free
 * bay, and a figure labelled `queue cleared` pointing at that second would assert an event this replay never had.
 */
export function queueClearedAt(log, depotId, after_s) {
  const marks = [];
  for (const visit of log.visits) {
    if (visit.depot !== depotId || visit.intake_end_s === null) continue;
    marks.push([visit.intake_end_s, 1]);
    if (visit.first_task_s !== null) marks.push([visit.first_task_s, -1]);
  }
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let held = 0;
  let queued = false;
  let i = 0;
  while (i < marks.length) {
    const t = marks[i][0];
    const before = held;
    // Every mark at this second is applied before the queue is read, so a car leaving and another joining at the same
    // second never reads as an empty queue.
    while (i < marks.length && marks[i][0] === t) {
      held += marks[i][1];
      i += 1;
    }
    if (t < after_s) continue;
    if (held > 0 || before > 0) queued = true;
    if (held === 0 && queued) return t;
  }
  return null;
}

/**
 * The car that waited longest for a bay at `depotId` among the visits whose task had started by `t_s`:
 * `{car, took_s, ready_s, waited_s}`, or null. The walkthrough pins it rather than naming a car, so the car it follows
 * is one this replay produced.
 */
export function longestBayWait(log, depotId, t_s) {
  let best = null;
  for (const visit of log.visits) {
    if (visit.depot !== depotId || visit.intake_end_s === null || visit.first_task_s === null) continue;
    if (visit.first_task_s > t_s) continue;
    const waited = visit.first_task_s - visit.intake_end_s;
    if (best === null || waited > best.waited_s || (waited === best.waited_s && visit.car < best.car)) {
      best = { car: visit.car, took_s: visit.first_task_s, ready_s: visit.ready_s, waited_s: waited };
    }
  }
  return best;
}

/** A metric of this replay, scoped as the model scopes it, as text through `formatter` (absence keeps its reason). */
function metricText(log, scenario, ref, formatter) {
  const result = computeMetric({ ...log, scenario, window: scenario.window }, ref);
  return format.valueText("absent" in result ? result : result.value, formatter);
}

/**
 * Wait p90 over the rides completed inside one hour of this replay in one area, as text. The area is the one the
 * frozen spec's primary is scoped to, so this figure and the hourly chart two beats later count the same riders; a
 * wait label that named an hour but no population would be the one wait on the page that does not say what it counts.
 */
function waitP90InHour(log, scenario, start_s, area) {
  return metricText(log, scenario, { metric: "wait.p90_s", scope: { area, window: { start_s, end_s: start_s + 3600 } } }, format.minutes);
}

/** The visits of one car, by car id, memoised per log so a ticker line never walks every visit again. */
const visitsByCar = new WeakMap();
function carVisits(log, car) {
  let index = visitsByCar.get(log);
  if (index === undefined) {
    index = new Map();
    for (const visit of log.visits) {
      const list = index.get(visit.car);
      if (list === undefined) index.set(visit.car, [visit]);
      else list.push(visit);
    }
    visitsByCar.set(log, index);
  }
  return index.get(car) ?? [];
}

/** The visit of `car` that is open at second `t_s`, or null. */
function openVisit(log, car, t_s) {
  return carVisits(log, car).find((v) => v.arrival_s <= t_s && (v.ready_s === null || v.ready_s >= t_s)) ?? null;
}

/** Areas of this replay's requests, by request id, memoised per log. */
const originsByRequest = new WeakMap();
function requestOrigin(log, id) {
  let index = originsByRequest.get(log);
  if (index === undefined) {
    index = new Map(log.requests.map((r) => [r.id, r.origin]));
    originsByRequest.set(log, index);
  }
  return index.get(id) ?? null;
}

/**
 * The ticker's lines at second `t_s`, newest first: what just happened in this replay, in the log's own words.
 * Each line is `{ord, clock, text}`. The recall is one line carrying the count of the cars it sent, so the burst of
 * depot assignments it caused collapses into the event that caused them instead of filling the ticker with itself.
 */
export function tickerLines(log, scenario, t_s, limit = TICKER_LINES) {
  const out = [];
  const start = eventIndexAt(log.events, t_s);
  for (let i = start; i >= 0 && out.length < limit && start - i < TICKER_SCAN; i -= 1) {
    const event = log.events[i];
    const clock = format.clock(event.t);
    if (event.kind === "REQUEST_UNSERVED") {
      const area = requestOrigin(log, event.req);
      if (area === null) continue;
      out.push({ ord: event.ord, clock, text: labels.tickerUnserved({ area: MAP.areas[area] ?? area, after: format.minutes(scenario.patience_s) }) });
    } else if (event.kind === "RECALL_ORDERED") {
      out.push({ ord: event.ord, clock, text: labels.tickerRecall(eventsAt(log, "DEPOT_ASSIGNED", event.t)) });
    } else if (event.kind === "MORNING_RELEASE") {
      out.push({ ord: event.ord, clock, text: PRESENT.tickerRelease });
    } else if (event.kind === "SERVICE_STARTED") {
      const visit = openVisit(log, event.car, event.t);
      // Only the task that ended the car's wait: a second task in the same visit began when a bay was already its own.
      if (visit === null || visit.first_task_s !== event.t || visit.intake_end_s === null) continue;
      out.push({ ord: event.ord, clock, text: labels.tickerBay({ car: event.car, after: format.minutes(visit.first_task_s - visit.intake_end_s) }) });
    } else if (event.kind === "INTAKE_COMPLETED") {
      const visit = openVisit(log, event.car, event.t);
      if (visit === null || (visit.first_task_s !== null && visit.first_task_s <= event.t)) continue;
      out.push({ ord: event.ord, clock, text: labels.tickerQueued({ car: event.car, depot: event.depot }) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The chapters. Every beat is data: where the clock goes, what it pins, what it opens, which figures it projects, the
// model rule it shows and the caveat that rule owes. Chapters 2 to 4 carry their titles, clocks, pins and narration
// here; their figures are a mount point the next part fills.

const replayChip = (ctx) => (ctx.seed === null ? labels.REGISTERS.thisReplay : labels.thisReplayChip(ctx.seed));

/** A figure of this replay: one label, one value, one register chip. */
const replayFigure = (key, label, value) => ({ key, label, value, register: "replay" });

const OPERATIONS = [
  {
    key: "peak",
    clock: (s) => at(1, eveningPeak(s).start_h) + 5400,
    play: (s) => at(1, eveningPeak(s).start_h) + 7200,
    limits: ["dispatchBaseline", "noRepositioning"],
    table: true,
    figures: (ctx) => [
      replayFigure("waiting", PRESENT.figures.ridersWaiting, format.count(areaTotal(ctx.model, "waiting"))),
      replayFigure("riders", PRESENT.figures.carsWithRiders, labels.outOf({ count: familyTotal(ctx.model, "riderWork"), total: ctx.fleet })),
    ],
    narration: (ctx) => [
      labels.narrationPeak({ clock: ctx.clock, waiting: areaTotal(ctx.model, "waiting"), riders: familyTotal(ctx.model, "riderWork"), fleet: ctx.fleet }),
    ],
  },
  {
    key: "unservedHour",
    clock: (s) => at(1, eveningPeak(s).end_h),
    limits: ["fixedPatience", "waitCountsCompleted"],
    table: true,
    figures: (ctx) => [
      replayFigure("unserved", PRESENT.figures.unservedLastHour, format.count(areaTotal(ctx.model, "unservedLastHour"))),
      replayFigure(
        "waitHour",
        labels.areaHourFigure({ label: PRESENT.figures.waitP90, area: MAP.areas[ctx.area] ?? ctx.area, clock: format.clock(ctx.hourStart) }),
        waitP90InHour(ctx.log, ctx.scenario, ctx.hourStart, ctx.area),
      ),
    ],
    narration: (ctx) => [
      labels.narrationUnservedHour({
        clock: format.clock(ctx.hourStart),
        unserved: areaTotal(ctx.model, "unservedLastHour"),
        area: MAP.areas[ctx.area] ?? ctx.area,
        wait: waitP90InHour(ctx.log, ctx.scenario, ctx.hourStart, ctx.area),
      }),
    ],
  },
  {
    key: "recall",
    clock: (s) => s.policies.recall_s,
    play: (s) => s.policies.recall_s + 900,
    limits: ["recallActsOnce"],
    table: true,
    figures: (ctx) => [
      replayFigure("sent", PRESENT.figures.sentThisSecond, format.count(eventsAt(ctx.log, "DEPOT_ASSIGNED", ctx.scenario.policies.recall_s))),
      replayFigure("toDepot", PRESENT.figures.drivingToDepot, format.count(carsInState(ctx.frame, "TO_DEPOT"))),
    ],
    narration: (ctx) => [
      labels.narrationRecall({
        clock: format.clock(ctx.scenario.policies.recall_s),
        sent: eventsAt(ctx.log, "DEPOT_ASSIGNED", ctx.scenario.policies.recall_s),
        driving: carsInState(ctx.frame, "TO_DEPOT"),
      }),
    ],
  },
  {
    key: "depotNight",
    clock: (s) => s.policies.recall_s + 5400,
    open: (ctx) => ({ depot: ctx.depot }),
    limits: ["stallsNotBays"],
    table: true,
    figures: (ctx) => {
      const views = depotViews(ctx.log, ctx.scenario, ctx.at_s);
      const here = views.find((v) => v.id === ctx.depot);
      return [
        replayFigure("queued", PRESENT.figures.queuedAcross, format.count(views.reduce((n, v) => n + v.queued, 0))),
        replayFigure(
          "held",
          labels.depotFigure({ depot: ctx.depot, label: PRESENT.figures.stallsHeld }),
          here === undefined ? labels.absentValue(labels.ABSENT_REASONS.notComputed) : labels.lotFill(here.held, here.stalls),
        ),
        replayFigure("waiting", PRESENT.figures.ridersWaiting, format.count(areaTotal(ctx.model, "waiting"))),
      ];
    },
    narration: (ctx) => {
      const views = depotViews(ctx.log, ctx.scenario, ctx.at_s);
      const here = views.find((v) => v.id === ctx.depot);
      if (here === undefined) return [];
      return [labels.narrationDepots({ clock: ctx.clock, queued: views.reduce((n, v) => n + v.queued, 0), depot: here.id, held: here.held, stalls: here.stalls })];
    },
  },
  {
    key: "morning",
    clock: (s) => s.policies.release_s ?? s.policies.recall_s + 18900,
    pin: (ctx) => longestBayWait(ctx.log, ctx.depot, ctx.at_s)?.car ?? null,
    limits: ["recallActsOnce"],
    table: true,
    figures: (ctx) => {
      const views = depotViews(ctx.log, ctx.scenario, ctx.at_s);
      const cleared = queueClearedAt(ctx.log, ctx.depot, ctx.scenario.policies.recall_s);
      return [
        replayFigure("ready", PRESENT.figures.readyAtDepots, format.count(views.reduce((n, v) => n + v.ready, 0))),
        replayFigure("home", PRESENT.figures.drivingHome, format.count(carsInState(ctx.frame, "REPOSITIONING"))),
        replayFigure(
          "cleared",
          labels.depotFigure({ depot: ctx.depot, label: PRESENT.figures.queueCleared }),
          cleared === null ? labels.absentValue(labels.ABSENT_REASONS.noVisitStarted) : format.clock(cleared),
        ),
      ];
    },
    narration: (ctx) => {
      const views = depotViews(ctx.log, ctx.scenario, ctx.at_s);
      const release_s = ctx.scenario.policies.release_s;
      const release = release_s === null ? null : format.clock(release_s);
      const lines = [labels.narrationRelease({ clock: ctx.clock, home: carsInState(ctx.frame, "REPOSITIONING"), ready: views.reduce((n, v) => n + v.ready, 0) })];
      const waited = longestBayWait(ctx.log, ctx.depot, ctx.at_s);
      // The comparing word is read off the two clocks this replay produced; nothing here writes a direction into the
      // sentence, and test/captions.test.mjs pins both lines on OPS-01 at seed 1001 (H-9).
      if (waited !== null && waited.ready_s !== null) {
        lines.push(labels.narrationPinnedBay({
          car: waited.car,
          took: format.clock(waited.took_s),
          ready: format.clock(waited.ready_s),
          release,
          before: release_s !== null && waited.ready_s < release_s,
        }));
      }
      const cleared = queueClearedAt(ctx.log, ctx.depot, ctx.scenario.policies.recall_s);
      if (cleared !== null && release_s !== null) {
        lines.push(labels.narrationQueueCleared({ depot: ctx.depot, cleared: format.clock(cleared), release, before: cleared < release_s }));
      }
      return lines;
    },
  },
];

/** The label the verdict beat's figure carries, in the verdict card's own words. */
const MEAN_DELTA = labels.candidateMinusBaseline(labels.VERDICT.meanDelta);

/** One registry row of this replay, so a ledger figure and the registry under it can only read one value. */
function registryRow(ctx, metric) {
  const missing = labels.absentValue(labels.ABSENT_REASONS.notComputed);
  return registryRows({ summaries: ctx.summaries, seed: ctx.seed }).find((row) => row.metric === metric) ?? { replay: missing, across: missing };
}

/**
 * Where the drawn frame came from: the snapshot playback sought and the second it is drawing. Whether the positions
 * are interpolated is read from the frame itself (`at_s` past `snapshot_t`), never from the option that was passed in,
 * which says what was asked for and not what the frame holds (demo plan graft 2).
 */
const frameLineOf = (ctx) => labels.frameLine({
  // Both clocks carry their seconds: the two are usually inside one minute, and a line that printed the same clock
  // twice beside the word "interpolated" would hide the very thing the beat exists to show.
  snapshot: format.clockSeconds(ctx.frame.snapshot_t),
  drawn: format.clockSeconds(ctx.frame.at_s),
  interpolated: ctx.frame.at_s !== ctx.frame.snapshot_t,
});

/**
 * The two arms of the watched verdict seed at the depot the frozen spec's guardrail names, each read from its own log
 * at the second the beat stands at (demo plan beat 3.2). Nothing here compares the two: the rows carry the numbers and
 * the reader does the arithmetic, because a comparing word for one seed would be a direction the verdict did not pin
 * (H-9). Empty while the pair is still running or a depot is missing from an arm.
 */
function armRows(ctx) {
  if (ctx.pair === null) return [];
  const arms = [["A", ctx.pair.baseline], ["B", ctx.pair.candidate]];
  const rows = [];
  for (const [lane, arm] of arms) {
    const view = arm?.log === undefined || arm.log === null ? null : depotView(arm.log, ctx.depot, ctx.at_s);
    if (view === null) return [];
    rows.push(el("p", { class: "fl-mono", "data-role": "present-arm", "data-arm": lane }, labels.armDepotLine({
      arm: labels.INSPECTOR.forkArms[lane],
      depot: view.id,
      held: labels.lotFill(view.held, view.stalls),
      queued: view.queued,
    })));
  }
  return [el("p", { class: "fl-small-label" }, PRESENT.armsHeading), ...rows];
}

const ANALYTICS = [
  {
    key: "registers",
    limits: ["seedsVaryTravel", "waitCountsCompleted"],
    figures: (ctx) => {
      // One row, both registers: the same metric under two chips, which is what the beat is about (H-10).
      const wait = registryRow(ctx, "wait.p90_s");
      return [
        replayFigure("waitReplay", labels.NOW_PANEL.waitP90, wait.replay),
        { key: "waitAcross", label: labels.NOW_PANEL.waitP90, value: wait.across, register: "across" },
      ];
    },
    content: (ctx, ui) => [
      renderRegistry({ summaries: ctx.summaries, seed: ctx.seed, all: ui.registryAll, onToggleAll: ui.onToggleAll, scenario: ctx.scenario }),
      renderHourly({ summaries: ctx.summaries, seed: ctx.seed, scenario: ctx.scenario, log: ctx.log, area: ctx.area, depot: ctx.depot }),
    ],
    narration: (ctx) => [labels.narrationRegisters(ctx.replications)],
  },
  {
    key: "verdict",
    limits: ["intervalIsSimulationOnly"],
    figures: (ctx) => {
      // The verdict's own register is its paired seeds, not the replications the window ran, so the chip carries them.
      if (ctx.verdict === null || ctx.frozen === null || ctx.verdict.validity !== "VALID") {
        return [{ key: "meanDelta", label: MEAN_DELTA, value: labels.absentValue(labels.ABSENT_REASONS.notRunYet), register: "across", count: ctx.spec?.seeds.length }];
      }
      const p = ctx.verdict.primary;
      return [{
        key: "meanDelta",
        label: MEAN_DELTA,
        value: valueWithMinutes(p.metric, p.mean_delta, { withSign: true }),
        register: "across",
        count: ctx.frozen.spec.seeds.length,
      }];
    },
    content: (ctx) => {
      if (ctx.verdict === null || ctx.frozen === null) return [];
      return [
        el("p", { class: "fl-small-label", "data-role": "present-spec" }, specInWords(ctx.frozen.spec)),
        renderReadout({ verdict: ctx.verdict, frozen: ctx.frozen }),
      ];
    },
    narration: (ctx) => (ctx.spec === null ? [] : [labels.narrationVerdict({ seeds: ctx.spec.seeds.length, resamples: ctx.spec.resamples })]),
  },
];

const SIMULATION = [
  {
    key: "frame",
    clock: (s) => s.policies.recall_s + 900,
    play: (s) => s.policies.recall_s + 1800,
    limits: ["interpolation"],
    figures: (ctx) => [
      replayFigure("onLeg", PRESENT.figures.carsOnLeg, labels.outOf({ count: ctx.model.onRoutes.length, total: ctx.fleet })),
      replayFigure("events", PRESENT.figures.eventsSoFar, labels.outOf({ count: format.count(eventsSoFar(ctx.log, ctx.at_s)), total: format.count(ctx.log.events.length) })),
    ],
    content: (ctx, ui) => {
      const took = ui.times();
      const snapshots = ctx.log.snapshots;
      const step = snapshots.length > 1 ? snapshots[1].t - snapshots[0].t : null;
      return [
        el("p", { class: "fl-mono", "data-role": "present-frame-line" }, frameLineOf(ctx)),
        el("p", { class: "fl-muted", "data-role": "present-snapshots" }, labels.snapshotsLine({
          snapshots: snapshots.length,
          every: step === null ? labels.absentValue(labels.ABSENT_REASONS.notComputed) : format.minutes(step),
          engine: ctx.engine === null ? labels.absentValue(labels.ABSENT_REASONS.enginePathNotReported) : labels.enginePath(ctx.engine),
          replications: ctx.replications,
          took: took === null ? null : format.seconds(took.windowMs / 1000, 1),
        })),
        el("p", { class: "fl-small-label", "data-role": "present-validation" }, labels.validationLine({ invariants: CHECK_IDS.length, cases: CASEBOOK_COUNT })),
      ];
    },
    // The frame line moves with the clock, so it is written in place rather than rebuilt: a beat's content holds a
    // table and two charts, and rebuilding those on every frame would cost more than the picture does.
    update: (ctx, root) => {
      const line = root.querySelector('[data-role="present-frame-line"]');
      if (line !== null) setText(line, frameLineOf(ctx));
    },
    // Both clocks carry their seconds, for the reason the frame line carries them: the snapshot and the drawn second
    // are usually inside one minute, and a sentence that printed the same clock twice would hide what the beat shows.
    narration: (ctx) => [labels.narrationFrame({ snapshot: format.clockSeconds(ctx.frame.snapshot_t), drawn: format.clockSeconds(ctx.frame.at_s) })],
  },
  {
    key: "arms",
    clock: (s) => s.policies.recall_s + 5400,
    limits: ["seedsVaryTravel"],
    // Phase B watches the seed in the fork the page already has; the map region steps aside for it and says why.
    watchSeed: (ctx) => (ctx.frozen === null || ctx.verdictSeed === null ? null : ctx.verdictSeed),
    content: (ctx) => {
      if (ctx.spec === null || ctx.verdictSeed === null) return [];
      const index = ctx.spec.seeds.indexOf(ctx.verdictSeed);
      if (index < 0) return [];
      return [
        el("p", { "data-role": "present-now-watching" }, labels.nowWatching({ seed: ctx.verdictSeed, index: index + 1, total: ctx.spec.seeds.length })),
        // The picture steps aside for this beat, so the two arms owe the ledger their own numbers: the depot the frozen
        // spec watches, read from each arm's log at the one second both are standing at.
        ...armRows(ctx),
        el("p", { class: "fl-muted", "data-role": "present-fork-note" }, labels.FORK.verdictSeedNote),
        el("p", { class: "fl-muted", "data-role": "present-fork-caption" }, labels.HONESTY.forkCaption),
      ];
    },
    narration: (ctx) => {
      if (ctx.spec === null || ctx.verdictSeed === null) return [];
      const index = ctx.spec.seeds.indexOf(ctx.verdictSeed);
      if (index < 0) return [];
      return [labels.narrationArms({ seed: ctx.verdictSeed, index: index + 1, total: ctx.spec.seeds.length })];
    },
  },
];

const PRODUCT = [
  {
    key: "standsFor",
    limits: ["noStaff"],
    content: (ctx) => {
      // Prepare loaded this record's own declared experiment, so the block is the record's copy, verbatim, exactly as
      // the setup sheet shows it (decision 41): no paraphrase, and no verdict inside it.
      const nodes = [...situationBlock(presetById(PRESENT_PRESET_ID), true)];
      const sentence = tradeOffSentence({ verdict: ctx.verdict, frozen: ctx.frozen });
      if (ctx.verdict === null || sentence !== null) {
        nodes.push(el("p", { class: "fl-small-label" }, PRESENT.tradeOffHeading));
        nodes.push(el("p", { "data-role": "present-trade-off" }, sentence ?? labels.absentValue(labels.ABSENT_REASONS.notRunYet)));
      }
      return nodes;
    },
    narration: () => [labels.narrationSituation(PRESENT_PRESET_ID)],
  },
  {
    key: "refusals",
    limits: ["intervalIsSimulationOnly"],
    content: (ctx, ui) => {
      const nodes = [
        el("h3", { class: "fl-title" }, PRESENT.refusalsHeading),
        el("ul", { class: "fl-refusals", "data-role": "present-refusals" }, PRESENT.refusals.map((row) => el("li", {}, row))),
      ];
      const next = nextCasebookPreset();
      // A title and a situation, never a verdict and never a direction for a case this page has not run (H-9).
      if (next !== null) {
        nodes.push(el("h3", { class: "fl-title" }, PRESENT.nextHeading));
        nodes.push(el("p", { class: "fl-mono", "data-role": "present-next-title" }, labels.presetOption({ id: next.id, title: next.title })));
        nodes.push(el("p", { "data-role": "present-next-situation" }, next.situation));
        nodes.push(el("button", {
          type: "button",
          class: "fl-button",
          "data-role": "present-open-next",
          on: { click: () => ui.onOpenNext(next.id) },
        }, PRESENT.openInExperiment));
      }
      return nodes;
    },
    narration: (ctx) => (ctx.next === null ? [] : [labels.narrationNext(ctx.next)]),
  },
];

/** A beat with its defaults filled in, so every beat answers the same questions. */
function beatOf(chapterKey, beat) {
  return Object.freeze({
    chapter: chapterKey,
    clock: null,
    play: null,
    pin: null,
    open: null,
    limits: [],
    table: false,
    watchSeed: null,
    update: null,
    figures: () => [],
    content: () => [],
    narration: () => [],
    ...beat,
    title: PRESENT.beats[beat.key],
    rule: PRESENT.rules[beat.key],
  });
}

/** The four chapters of the walkthrough, in order; each beat is data (demo plan section 4.4). */
export const CHAPTERS = Object.freeze([
  ["operations", OPERATIONS],
  ["analytics", ANALYTICS],
  ["simulation", SIMULATION],
  ["product", PRODUCT],
].map(([key, beats]) => Object.freeze({ key, title: PRESENT.chapters[key], beats: Object.freeze(beats.map((b) => beatOf(key, b))) })));

/** Every beat of every chapter, in walking order, each `{chapter, beat, ...}` with its indices. */
export const BEAT_ORDER = Object.freeze(
  CHAPTERS.flatMap((chapter, c) => chapter.beats.map((beat, b) => Object.freeze({ chapter: c, beat: b, key: beat.key }))),
);

/** Where a chapter and beat index sit in the walking order (clamped into range). */
export function beatPosition(chapter, beat) {
  const found = BEAT_ORDER.findIndex((p) => p.chapter === chapter && p.beat === beat);
  return found === -1 ? 0 : found;
}

/** The beat at a chapter and beat index, clamped into range. */
export function beatAt(chapter, beat) {
  const c = CHAPTERS[Math.min(Math.max(chapter, 0), CHAPTERS.length - 1)];
  return c.beats[Math.min(Math.max(beat, 0), c.beats.length - 1)];
}

/** The second a beat puts the clock at, from the scenario's declared knobs, or null when the beat keeps the clock. */
export function beatClock(beat, scenario) {
  return beat.clock === null ? null : beat.clock(scenario);
}

/**
 * A beat's title for this scenario. The morning beat is the release, so a scenario whose release is off says that
 * rather than naming a second the knobs never set (the beat still stands, at the recall plus its own span).
 */
export function beatTitle(beat, scenario) {
  if (beat.key === "morning" && scenario.policies.release_s === null) return PRESENT.beats.morningNoRelease;
  return beat.title;
}

// ---------------------------------------------------------------------------------------------------------------
// The mounted walkthrough.

const smallLabel = (role, text = "") => el("p", { class: "fl-small-label", "data-role": role }, text);

/**
 * Mounts the walkthrough into the shell's `ledger` and `rail` containers and returns the reading card for the caller to
 * place. `modelOf(state)` gives the one frame model the whole page is drawing (map.js frameModel, so the walkthrough
 * takes no second frame of its own), `frameOf(state)` and `scenarioOf(state)` the frame and the scenario that model was
 * built from, `prepare()` runs the two runs once and `times()` gives what they took on this visitor's own clock.
 * `onGoToKnobs()` is where the reading card's first button sends a reader who would rather set the knobs.
 * Returns `{card, open, close, destroy}`.
 */
export function mountPresent({ store, playback, ledger, rail, modelOf, frameOf, scenarioOf, prepare, times = () => null, onGoToKnobs = () => {}, onWatchSeed = () => {} }) {
  const dispatch = (action) => store.dispatch(action);
  let preparing = false;
  let applying = 0;
  let cardClosed = false;
  let lastTickerOrd = null;
  let rendered = null;
  let renderedContent = null;
  /** The depot table's body, built once and then written cell by cell. */
  let depotBody = null;
  /** What a chapter's own content may read and change: the reader's choice inside it, the measured times, the handoff. */
  const ui = {
    registryAll: false,
    onToggleAll: (next) => {
      ui.registryAll = next;
      render(store.getState());
    },
    times,
    onOpenNext: (id) => openNext(id),
  };

  // ---- the ledger --------------------------------------------------------------------------------------------------

  const chapterTitle = smallLabel("present-chapter");
  const beatTitleNode = el("h2", { class: "fl-title fl-ledger__beat", "data-role": "present-beat" });
  const beatClockText = el("p", { class: "fl-clock", "data-role": "present-clock" });
  // A beat that has somewhere to run to says so: nothing starts the clock on its own, so the reader is told whose hand
  // it is in.
  const playHint = smallLabel("present-play-hint");
  const prepareButton = el("button", {
    type: "button",
    class: "fl-button fl-button--primary",
    "data-role": "present-prepare",
    on: { click: () => runPrepare() },
  }, PRESENT.prepare);
  const prepareWhat = el("p", { class: "fl-muted", "data-role": "present-prepare-what" }, PRESENT.prepareWhat);
  const prepareStatus = el("p", { class: "fl-small-label", role: "status", "data-role": "present-prepare-status" });
  const preparePanel = el("div", { class: "fl-ledger__prepare", "data-role": "present-prepare-panel" }, [prepareButton, prepareWhat, prepareStatus]);
  const figures = el("div", { class: "fl-ledger__figures", "data-role": "present-figures" });
  // Chapters 2 to 4 fill this from their own readouts; it carries the beat it belongs to so the next part can find it.
  const beatContent = el("div", { "data-role": "present-beat-content" });
  const depotTable = el("div", { class: "fl-scroll", "data-role": "present-depot-table" });
  const narration = el("div", { class: "fl-learn-text", "data-role": "present-narration", "aria-live": "polite" });
  const ruleLine = smallLabel("present-rule");
  const caveat = el("p", { class: "fl-limits-chip", "data-role": "present-caveat" });
  const tickerHeading = smallLabel("present-ticker-heading", PRESENT.ticker);
  const tickerLinesNode = el("div", { class: "fl-ticker", "data-role": "present-ticker" });
  // What just happened stands at the ledger's foot and stays there: a beat whose figures, table and narration are
  // taller than the box would otherwise push the ticker below the fold, which is where the steps of the day live.
  const tickerFoot = el("div", { class: "fl-ledger__foot", "data-role": "present-ticker-foot" }, [tickerHeading, tickerLinesNode]);
  ledger.setAttribute("aria-label", PRESENT.ledgerName);
  // The ledger scrolls, so it is a tab stop: a beat with no control inside it would otherwise put its overflow out of
  // every keyboard's reach (WCAG 2.1.1). The rail's keys are bound to the rail, so Home, End and the arrows keep their
  // ordinary scrolling behaviour here.
  ledger.setAttribute("tabindex", "0");
  ledger.replaceChildren(
    chapterTitle,
    beatTitleNode,
    beatClockText,
    playHint,
    preparePanel,
    figures,
    beatContent,
    depotTable,
    narration,
    ruleLine,
    caveat,
    tickerFoot,
  );

  // ---- the rail ----------------------------------------------------------------------------------------------------

  const railButton = (text, role, onClick, attrs = {}) =>
    el("button", { type: "button", class: "fl-button", "data-role": role, ...attrs, on: { click: onClick } }, text);

  const playButton = railButton(PRESENT.play, "present-play", () => playback.toggle(), { "aria-pressed": "false" });
  const backButton = railButton(PRESENT.back, "present-back", () => move(-1));
  const nextButton = el("button", {
    type: "button",
    class: "fl-button fl-button--primary",
    "data-role": "present-next",
    "data-focus-key": "present-next",
    on: { click: () => move(1) },
  }, PRESENT.next);
  const chapterButtons = CHAPTERS.map((chapter, index) =>
    railButton(chapter.title, "present-chapter-button", () => goto(index, 0), { "data-chapter": chapter.key }));
  const stepText = el("span", { class: "fl-mono fl-small-label", "data-role": "present-step" });
  const speedText = el("span", { class: "fl-mono fl-small-label", "data-role": "present-speed" }, labels.speedText(PRESENT_SPEED));
  const leaveButton = railButton(PRESENT.leave, "present-leave", () => close());
  const shortcuts = el("details", { "data-role": "present-shortcuts" }, [
    el("summary", {}, labels.PLAYBACK.shortcuts),
    el("ul", { class: "fl-list-plain" }, PRESENT.shortcutList.map((line) => el("li", {}, line))),
    el("p", { class: "fl-muted" }, PRESENT.shortcutsScope),
  ]);
  rail.setAttribute("aria-label", PRESENT.name);
  rail.replaceChildren(
    playButton,
    backButton,
    nextButton,
    el("div", { class: "fl-group", role: "group", "aria-label": PRESENT.chaptersName }, chapterButtons),
    stepText,
    speedText,
    leaveButton,
    shortcuts,
  );

  // The walkthrough's keys act inside the rail and nowhere else, so nothing here changes what the page does elsewhere.
  const unbindKeys = bindShortcuts(rail, {
    ArrowRight: () => move(1),
    ArrowLeft: () => move(-1),
    Home: () => goto(0, 0),
    End: () => goto(CHAPTERS.length - 1, CHAPTERS[CHAPTERS.length - 1].beats.length - 1),
    " ": () => playback.toggle(),
    Escape: () => close(),
    "?": () => shortcuts.toggleAttribute("open"),
    ...Object.fromEntries(CHAPTERS.map((_, index) => [String(index + 1), () => goto(index, 0)])),
  });
  // Space activates a focused button on keyup; the keydown handler above already played or paused, so keyup is
  // swallowed. Without this, Space on the rail's own Play button toggles twice and does nothing (playback.js does the
  // same for the transport, and says so there).
  const onRailKeyup = (event) => {
    if ((event.key === " " || event.key === "Spacebar") && typeof event.preventDefault === "function") event.preventDefault();
  };
  rail.addEventListener("keyup", onRailKeyup);

  // ---- the reading card --------------------------------------------------------------------------------------------

  const card = el("section", { class: "fl-reading-card fl-panel", "data-role": "reading-card", "aria-label": PRESENT.card.lead }, [
    el("p", {}, PRESENT.card.lead),
    el("div", { class: "fl-group" }, [
      railButton(PRESENT.card.sandbox, "reading-card-sandbox", () => {
        cardClosed = true;
        render(store.getState());
        onGoToKnobs();
      }),
      el("button", {
        type: "button",
        class: "fl-button fl-button--primary",
        "data-role": "reading-card-walk",
        on: {
          click: () => {
            cardClosed = true;
            open();
            runPrepare();
          },
        },
      }, PRESENT.card.walk),
      railButton(PRESENT.card.close, "reading-card-close", () => {
        cardClosed = true;
        render(store.getState());
      }),
    ]),
  ]);

  // ---- moving between beats ----------------------------------------------------------------------------------------

  /**
   * Runs the dispatches of one beat change as a single move, and renders once when they have all landed. A beat change
   * is several dispatches (the position, the seek, the pin, the open, the stop clock), and the store renders after each
   * of them; without this the narration would be written between two of them and would describe the second the walk is
   * leaving rather than the one it is arriving at. The count, not a flag, is what lets `goto` wrap `applyBeat`.
   */
  function settle(apply) {
    const doc = rail.ownerDocument;
    const before = doc.activeElement;
    applying += 1;
    try {
      apply();
    } finally {
      applying -= 1;
    }
    if (applying !== 0) return;
    render(store.getState());
    keepRailFocus(before);
  }

  /**
   * Puts the presenter's hands back on the rail. A beat that opens the depot drawer hands focus to the drawer's Close
   * button, and the walkthrough's keys are bound to the rail alone, so the next Right arrow would do nothing three
   * minutes into a walk whose premise is one Next button that keeps focus. A beat that disables Next (the last one)
   * would drop focus out of the rail entirely, and Escape would no longer leave. Only a change the rail itself drove
   * is restored, so a reader who tabbed into the drawer keeps the focus they chose.
   */
  function keepRailFocus(before) {
    const doc = rail.ownerDocument;
    if (before === null || before === undefined || !rail.contains(before)) return;
    if (before.isConnected && !before.disabled) {
      if (doc.activeElement !== before) before.focus();
      return;
    }
    leaveButton.focus();
  }

  /** Applies a beat: a silent seek, the pin, the open and the stop clock. Nothing here starts the clock. */
  function applyBeat(chapter, beat) {
    settle(() => {
      const state = store.getState();
      const scenario = scenarioOf(state);
      const current = beatAt(chapter, beat);
      const clock = beatClock(current, scenario);
      // An untagged clock/set is a scrub, which the announcer stays silent for: the narration is the beat's one voice.
      if (clock !== null) playback.seek(clock);
      const after = store.getState();
      const ctx = contextOf(after);
      dispatch({ type: "fork/pin", car: current.pin === null || ctx === null ? null : current.pin(ctx) });
      const open = current.open === null || ctx === null ? null : current.open(ctx);
      if (open !== null) dispatch({ type: "inspector/open", target: open });
      else if (after.inspector !== null) dispatch({ type: "inspector/close" });
      // One THIS REPLAY seed on screen (design §7.4, H-10): the beat that watches a verdict seed opens the page's own
      // fork on it, and every other beat closes that fork again, so the picture is the world the walk is playing.
      const watching = current.watchSeed === null || ctx === null ? null : current.watchSeed(ctx);
      if (watching !== null) onWatchSeed(watching);
      else if (store.getState().fork.status !== "closed") dispatch({ type: "fork/close" });
      const stop = current.play === null ? null : current.play(scenario);
      dispatch({ type: "present/stop", stop_s: stop });
      // A beat lands on the second it declared and stays there. The script reads its still frame first and the
      // presenter starts the motion with Play or Space; autoplaying on arrival would leave the declared second within
      // one frame and replace every number the beat was written around before it could be read.
      if (store.getState().playing) playback.pause();
    });
  }

  function goto(chapter, beat) {
    const state = store.getState();
    if (!state.present.on) return;
    settle(() => {
      // The position first: it clears the stop clock, which the beat about to be applied then sets for itself.
      dispatch({ type: "present/goto", chapter, beat });
      if (state.present.prepared) applyBeat(chapter, beat);
    });
  }

  /** One step forward or back through every chapter's beats in order. */
  function move(by) {
    const { chapter, beat } = store.getState().present;
    const index = beatPosition(chapter, beat) + by;
    if (index < 0 || index >= BEAT_ORDER.length) return;
    const target = BEAT_ORDER[index];
    goto(target.chapter, target.beat);
  }

  async function runPrepare() {
    if (preparing || store.getState().present.prepared) return;
    const doc = rail.ownerDocument;
    preparing = true;
    render(store.getState());
    try {
      await prepare();
    } finally {
      preparing = false;
      const state = store.getState();
      if (state.present.prepared) applyBeat(state.present.chapter, state.present.beat);
      render(store.getState());
      // Prepare hides the button that was pressed, and a browser drops focus to the body when the focused control
      // goes. The walk is about to begin, so the hands go to the control that walks it.
      const active = doc.activeElement;
      if (store.getState().present.prepared && (active === null || active === doc.body)) nextButton.focus();
    }
  }

  function open() {
    if (store.getState().present.on) return;
    settle(() => {
      dispatch({ type: "present/open" });
      playback.setSpeed(PRESENT_SPEED);
      if (store.getState().present.prepared) applyBeat(0, 0);
    });
  }

  function close() {
    if (!store.getState().present.on) return;
    if (store.getState().playing) playback.pause();
    dispatch({ type: "present/close" });
  }

  /** The handoff the last beat offers: leave the walkthrough, and open the next casebook question in Experiment. */
  function openNext(id) {
    close();
    dispatch({ type: "mode/set", mode: "experiment" });
    startFromPreset(dispatch, id);
  }

  // ---- rendering ---------------------------------------------------------------------------------------------------

  /** Everything a beat's figures and narration may read, or null before a run has produced a log. */
  function contextOf(state) {
    const log = state.run.log;
    if (log === null) return null;
    const scenario = scenarioOf(state);
    const frame = frameOf(state);
    if (frame === null) return null;
    const model = modelOf(state);
    const spec = state.experiment.frozen?.spec ?? null;
    return {
      state,
      log,
      scenario,
      frame,
      model,
      spec,
      summaries: state.run.summaries,
      verdict: state.experiment.verdict,
      frozen: state.experiment.frozen,
      engine: state.engine.path,
      at_s: frame.at_s,
      clock: format.clock(state.clock_s),
      hourStart: Math.floor(state.clock_s / 3600) * 3600 - 3600,
      fleet: log.cars.length,
      seed: state.run.selectedSeed,
      replications: state.run.summaries.length,
      depot: focusDepot(state),
      area: focusArea(state),
      // The seed the walk watches in the fork: the verdict's own median-delta seed once a verdict exists, and until
      // then the replay already on screen, which is the frozen spec's first seed.
      verdictSeed: state.experiment.selectedSeed ?? state.run.selectedSeed,
      // Both arms of the watched seed, once the page's own fork has run them; null until then.
      pair: state.fork.pair,
      next: nextCasebookQuestion(),
    };
  }

  function figureNode(row) {
    const node = el("div", { class: "fl-ledger__figure", "data-figure": row.key }, [
      el("span", { class: "fl-small-label", "data-role": "figure-label" }),
      el("span", { class: "fl-ledger__value", "data-role": "figure-value" }),
      el("span", { "data-role": "figure-chip" }),
    ]);
    updateFigure(node, row);
    return node;
  }

  /** Writes one figure behind same-value guards: a value never counts up, and an absence never reads as a zero. */
  function updateFigure(node, row) {
    const [label, value, chip] = node.children;
    setText(label, row.label);
    setText(value, row.value);
    value.classList.toggle("fl-absent", row.value.startsWith(labels.ABSENT_PREFIX));
    setText(chip, row.chip);
    chip.setAttribute("class", row.register === "replay" ? "fl-chip-replay" : "fl-chip-across");
  }

  function renderFigures(beat, ctx) {
    const missing = labels.absentValue(labels.ABSENT_REASONS.notRunYet);
    const rows = ctx === null ? [] : beat.figures(ctx);
    // Before the runs land the beat still names what it will show, with its absence reason in place of every value.
    const shown = ctx === null
      // A figure with no value still names the register it will be read in, because a chip with nothing in it would
      // render the word its own absence produced rather than a register (H-10).
      ? PLACEHOLDERS[beat.key]?.map((label, i) => ({ key: `absent-${String(i)}`, label, value: missing, register: "replay", chip: labels.REGISTERS.thisReplay })) ?? []
      // A figure across replications names its own count: a verdict's register is its paired seeds, not the
      // replications the window ran, and the two must never be read as one (H-10).
      : rows.map((row) => ({ ...row, chip: row.register === "replay" ? replayChip(ctx) : labels.acrossReplicationsChip(row.count ?? ctx.replications) }));
    keyedList(figures, shown, { key: (row) => row.key, create: figureNode, update: updateFigure });
  }

  /** One depot's five cells, in the table's column order. */
  const depotCells = (view) => [
    view.id,
    labels.lotFill(view.held, view.stalls),
    format.count(view.queued),
    labels.lotFill(view.inBays, view.bays),
    format.count(view.ready),
  ];

  /**
   * The four-depot table: built once, then twenty cells compared in place. A played beat renders on every animation
   * frame, and rebuilding the table there would allocate a table, a head, four rows and twenty cells sixty times a
   * second, throw away a screen reader's view of it that often, and drop any selection inside it.
   */
  function renderDepotTable(beat, ctx) {
    if (!beat.table || ctx === null) {
      depotTable.hidden = true;
      return;
    }
    depotTable.hidden = false;
    if (depotBody === null) {
      const heads = MAP.tableHeads;
      depotBody = el("tbody", {});
      depotTable.replaceChildren(
        el("table", { class: "fl-table fl-ledger__table" }, [
          el("thead", {}, el("tr", {}, [heads.depot, heads.stallsHeld, heads.queue, heads.inBays, heads.ready].map((h) => el("th", { scope: "col" }, h)))),
          depotBody,
        ]),
      );
    }
    keyedList(depotBody, depotViews(ctx.log, ctx.scenario, ctx.at_s), {
      key: (view) => view.id,
      create: (view) => el("tr", { "data-depot": view.id }, depotCells(view).map((cell) => el("td", {}, cell))),
      update: (row, view) => depotCells(view).forEach((cell, i) => setText(row.children[i], cell)),
    });
  }

  function renderTicker(ctx) {
    if (ctx === null) {
      if (lastTickerOrd !== null) {
        lastTickerOrd = null;
        tickerLinesNode.replaceChildren();
      }
      tickerFoot.hidden = true;
      return;
    }
    tickerFoot.hidden = false;
    const lines = tickerLines(ctx.log, ctx.scenario, ctx.at_s);
    const newest = lines.length === 0 ? null : lines[0].ord;
    // The ticker is a list of what has already happened, so it is redrawn only when a new event has joined it.
    if (newest === lastTickerOrd) return;
    lastTickerOrd = newest;
    tickerLinesNode.replaceChildren(
      ...lines.map((line) => el("p", { class: "fl-ticker__line", "data-ord": line.ord }, [
        el("span", { class: "fl-mono" }, line.clock),
        el("span", {}, line.text),
      ])),
    );
  }

  /** The narration's lines, written in place so the polite region says only the words that changed. */
  function writeNarration(lines) {
    keyedList(narration, lines.map((line, i) => ({ key: String(i), line })), {
      key: (row) => row.key,
      create: (row) => el("p", { "data-role": "narration-line" }, row.line),
      update: (node, row) => setText(node, row.line),
    });
  }

  function renderPrepare(state) {
    const prepared = state.present.prepared;
    for (const node of [prepareButton, prepareWhat]) {
      node.hidden = prepared;
      node.toggleAttribute("inert", prepared);
    }
    prepareButton.disabled = preparing;
    setText(prepareStatus, prepareStatusText(state));
  }

  function prepareStatusText(state) {
    if (state.present.prepared) {
      const took = times();
      if (took === null) return "";
      return labels.yourClock(labels.prepareTimes({ window: format.seconds(took.windowMs / 1000, 1), experiment: format.seconds(took.experimentMs / 1000, 1) }));
    }
    if (state.experiment.status === "running" && state.experiment.progress !== null) {
      return labels.experimentRunProgress(state.experiment.progress.done, state.experiment.progress.total);
    }
    if (state.run.status === "running" && state.run.progress !== null) {
      return labels.replicationProgress(Math.min(state.run.progress.done + 1, state.run.progress.total), state.run.progress.total);
    }
    return preparing ? PRESENT.preparing : PRESENT.prepareWait;
  }

  function renderRail(state) {
    const position = beatPosition(state.present.chapter, state.present.beat);
    const chapter = CHAPTERS[Math.min(state.present.chapter, CHAPTERS.length - 1)];
    setText(playButton, state.playing ? PRESENT.pause : PRESENT.play);
    playButton.setAttribute("aria-pressed", state.playing ? "true" : "false");
    playButton.disabled = !state.present.prepared;
    backButton.disabled = !state.present.prepared || position === 0;
    nextButton.disabled = !state.present.prepared || position === BEAT_ORDER.length - 1;
    for (const [index, button] of chapterButtons.entries()) {
      button.disabled = !state.present.prepared;
      if (index === state.present.chapter) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
    setText(stepText, labels.stepOf(Math.min(state.present.beat, chapter.beats.length - 1) + 1, chapter.beats.length));
  }

  function render(state) {
    const on = state.present.on;
    card.hidden = on || cardClosed || state.run.log !== null;
    if (!on) {
      // Nothing of the walkthrough speaks or takes a tab stop while it is closed.
      if (narration.children.length > 0) writeNarration([]);
      if (beatContent.children.length > 0) beatContent.replaceChildren();
      rendered = null;
      renderedContent = null;
      return;
    }
    const beat = beatAt(state.present.chapter, state.present.beat);
    // While Prepare's runs are still arriving the beat has nothing to project, so every figure reads its absence
    // rather than a number from a half-filled store.
    const ctx = state.present.prepared && !preparing ? contextOf(state) : null;
    const chapter = CHAPTERS[Math.min(state.present.chapter, CHAPTERS.length - 1)];
    setText(chapterTitle, chapter.title);
    setText(beatTitleNode, beatTitle(beat, scenarioOf(state)));
    const clock = beatClock(beat, scenarioOf(state));
    beatClockText.hidden = clock === null;
    if (clock !== null) setText(beatClockText, format.clock(state.clock_s));
    const stop = beat.play === null ? null : beat.play(scenarioOf(state));
    // Only while there is somewhere left to run to: once the beat has reached its stop clock the line would be an
    // instruction to watch a second the page is already standing on.
    playHint.hidden = stop === null || !state.present.prepared || state.playing || state.clock_s >= stop;
    if (!playHint.hidden) setText(playHint, labels.playToWatch(format.clock(stop)));
    beatContent.setAttribute("data-beat", beat.key);
    setText(ruleLine, beat.rule);
    setText(caveat, beat.limits.map((key) => MODEL_LIMITS[key]).join(" "));
    renderRail(state);
    renderPrepare(state);
    renderFigures(beat, ctx);
    renderDepotTable(beat, ctx);
    renderTicker(ctx);
    // The narration is written when the beat changes and again when the clock comes to rest, never on every frame.
    // Resting is part of what there is to say: the figures beside the narration are the second the picture is drawing,
    // so a sentence left standing from the second the beat arrived at would put two seconds of one replay in one panel
    // with nothing to tell them apart. Writing behind setText keeps the polite region to the words that changed.
    // Whether there was a run to read is part of the beat's identity too: the same beat with its figures absent and
    // with them filled in are two different things to say, and Prepare turns the first into the second.
    const key = `${String(state.present.chapter)}:${String(state.present.beat)}:${String(ctx !== null)}:${String(state.playing)}`;
    if (applying === 0 && key !== rendered) {
      rendered = key;
      writeNarration(ctx === null ? [] : beat.narration(ctx).slice(0, 3));
    }
    // A chapter's own content is built when the beat, the run behind it, the fork it watches or a reader's choice
    // inside it changes, and never on a frame: it holds a table and two charts, and what moves with the clock is
    // written in place by `update`.
    const contentKey = `${key}:${String(ui.registryAll)}:${String(state.fork.id)}:${state.fork.status}`;
    if (applying === 0 && contentKey !== renderedContent) {
      renderedContent = contentKey;
      beatContent.replaceChildren(...(ctx === null ? [] : beat.content(ctx, ui)));
    }
    if (ctx !== null && beat.update !== null) beat.update(ctx, beatContent);
  }

  /** Pauses a played beat at the second it declared; the clock is the store's, so nothing here drives a frame. */
  const stopWatch = store.subscribe((state) => {
    const stop = state.present.stop_s;
    if (!state.present.on || stop === null || !state.playing || state.clock_s < stop) return;
    dispatch({ type: "present/stop", stop_s: null });
    playback.pause();
  });

  const unsubscribe = store.subscribe(render);
  const unsubscribePlayback = playback.onChange(() => render(store.getState()));
  render(store.getState());

  return {
    card,
    ledger,
    rail,
    open,
    close,
    prepare: runPrepare,
    destroy() {
      unbindKeys();
      rail.removeEventListener("keyup", onRailKeyup);
      stopWatch();
      unsubscribe();
      unsubscribePlayback();
    },
  };
}

/**
 * What each beat's figures are called before a run has produced them. A beat names what it will show and reads
 * `not available` in place of every value, so an absence is never a zero and never a blank (H-5).
 */
const PLACEHOLDERS = Object.freeze({
  peak: [PRESENT.figures.ridersWaiting, PRESENT.figures.carsWithRiders],
  unservedHour: [PRESENT.figures.unservedLastHour, PRESENT.figures.waitP90],
  recall: [PRESENT.figures.sentThisSecond, PRESENT.figures.drivingToDepot],
  depotNight: [PRESENT.figures.queuedAcross, PRESENT.figures.stallsHeld, PRESENT.figures.ridersWaiting],
  morning: [PRESENT.figures.readyAtDepots, PRESENT.figures.drivingHome, PRESENT.figures.queueCleared],
  registers: [labels.NOW_PANEL.waitP90, labels.NOW_PANEL.waitP90],
  verdict: [MEAN_DELTA],
  frame: [PRESENT.figures.carsOnLeg, PRESENT.figures.eventsSoFar],
});
