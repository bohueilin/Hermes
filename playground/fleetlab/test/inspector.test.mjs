// Inspect drawer (design §7.2) on the fake DOM with a real run_window payload.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, before, describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, windowPayload } from "./helpers/model-payloads.mjs";
import { computeMetric } from "../src/model/metrics.js";
import { DEFAULT_PRESET_ID } from "../src/model/presets.js";
import { clock, minutes, percent, valueText } from "../src/ui/format.js";
import { mountInspector } from "../src/ui/inspector.js";
import * as labels from "../src/ui/labels.js";
import { createInitialState, createStore } from "../src/ui/store.js";

const { INSPECTOR } = labels;
const D1_1930 = 19 * 3600 + 30 * 60; // 70,200 s, a snapshot second (a multiple of 300 from the 18,000 s start)

let payload;
let ctx = null;

before(async () => {
  payload = await windowPayload();
});

function setup() {
  const uninstall = installFakeDom(globalThis);
  const { document } = uninstall.dom;
  const region = document.createElement("aside");
  region.setAttribute("id", "fleetlab-region-inspector");
  region.hidden = true;
  region.setAttribute("inert", "");
  const trigger = document.createElement("button");
  document.body.append(trigger, region);
  const store = createStore(createInitialState({ presetId: DEFAULT_PRESET_ID, scenario: presetScenario() }));
  store.dispatch({ type: "run/queued", id: "w1", total: 2 });
  store.dispatch({ type: "run/done", id: "w1", payload });
  store.dispatch({ type: "clock/set", clock_s: D1_1930 });
  const forks = [];
  const inspector = mountInspector({ store, region, onOpenFork: (car) => forks.push(car) });
  ctx = { uninstall, document, region, trigger, store, forks, inspector };
  return ctx;
}

afterEach(() => {
  ctx?.inspector.destroy();
  ctx?.uninstall();
  ctx = null;
});

const texts = (nodes) => nodes.map((n) => n.textContent);
const metricText = (m, format) => valueText("absent" in m ? m : m.value, format);
const result = () => ({ ...payload.log, scenario: presetScenario(), window: presetScenario().window });

function open(target) {
  ctx.trigger.focus();
  ctx.store.dispatch({ type: "inspector/open", target });
}

describe("depot inspector", () => {
  test("opens with THIS REPLAY, the seed and the clock, the depot status, the staff chip and the NOW flow", () => {
    setup();
    open({ depot: "SJ-1" });
    const { region, document } = ctx;
    assert.equal(region.hidden, false);
    assert.equal(region.hasAttribute("inert"), false);
    assert.equal(region.getAttribute("data-open"), "true");
    assert.equal(document.activeElement.textContent, INSPECTOR.close, "focus moves into the drawer");
    assert.equal(region.querySelector("h2").textContent, labels.inspectorTitle({ heading: INSPECTOR.depotHeading, name: "SJ-1 · San Jose" }));
    assert.equal(region.querySelector(".fl-chip-replay").textContent, labels.inspectorStamp({ seed: 1001, clock: "D1 19:30" }));

    const snapshot = payload.log.snapshots.find((s) => s.t === D1_1930);
    const view = snapshot.depots.find((d) => d.id === "SJ-1");
    const inBays = snapshot.cars.filter((c) => c.state === "IN_SERVICE" && c.location?.depot === "SJ-1").length;
    assert.ok(region.textContent.includes(labels.depotStatus({ held: view.stalls_held, stalls: 30, inBays, cleanBays: 3, serviceBays: 1 })));
    assert.equal(region.querySelector(".fl-limits-chip").textContent, labels.MODEL_LIMITS.noStaff);

    const flow = texts(region.querySelectorAll("ol > li"));
    // Arriving, Intake, Queue, three cleaning bays, one service bay, Ready.
    assert.equal(flow.length, 3 + 3 + 1 + 1);
    assert.ok(flow[0].startsWith(`${INSPECTOR.stages.arriving} `));
    assert.ok(flow[1].startsWith(`${INSPECTOR.stages.intake} `));
    assert.ok(flow[2].startsWith(`${INSPECTOR.stages.queue} `));
    assert.deepEqual(flow.slice(3, 7).map((line) => line.split(" ")[0]), ["C1", "C2", "C3", "S1"]);
    assert.equal(flow[7], labels.flowStage({ stage: INSPECTOR.stages.ready, count: view.ready }));
    // Stages are an ordered flow with arrows, never numbered markers (design §8.5, §7.2 depot inspector).
    const list = region.querySelector("ol");
    assert.equal(list.getAttribute("class"), "fl-flow");
    const arrows = list.querySelectorAll(".fl-flow__arrow");
    assert.equal(arrows.length, flow.length - 1, "an arrow after every stage but the last");
    for (const arrow of arrows) {
      assert.equal(arrow.getAttribute("aria-hidden"), "true");
      assert.equal(arrow.textContent, labels.FLOW_ARROW);
    }
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /\.fl-flow \{[^}]*list-style: none/);
    assert.match(css, /@media \(max-width: 767\.98px\) \{\s*\.fl-flow \{ flex-direction: column; \}\s*\.fl-flow__arrow \{ display: none; \}/);
  });

  test("a busy bay reads its car, the task, whole minutes done of the task's total, and blocked when the car is", () => {
    setup();
    const scenario = presetScenario();
    const log = payload.log;
    const tasks = { CLEAN: ["clean_start_s", scenario.clean_s], SERVICE: ["service_start_s", scenario.service_s] };
    // The first snapshot with a car part-way through a task and alone in its depot's bays of that task, so it holds bay 1.
    let found = null;
    for (const snap of log.snapshots) {
      for (const car of snap.cars.filter((c) => c.state === "IN_SERVICE" && typeof c.location?.depot === "string")) {
        const depotId = car.location.depot;
        const [startKey, seconds] = tasks[car.task];
        const sameTask = snap.cars.filter((c) => c.state === "IN_SERVICE" && c.location?.depot === depotId && c.task === car.task);
        const visit = log.visits.find((v) => v.car === car.id && v.depot === depotId && v.arrival_s <= snap.t && (v.ready_s === null || v.ready_s > snap.t));
        const start = visit?.[startKey];
        if (sameTask.length !== 1 || typeof start !== "number") continue;
        const done = Math.floor(Math.min(seconds, snap.t - start) / 60);
        const total = Math.round(seconds / 60);
        if (done < total) {
          found = { t: snap.t, car, depotId, done, total };
          break;
        }
      }
      if (found !== null) break;
    }
    assert.ok(found !== null, "the fixture run has a car part-way through a task");
    const { t, car, depotId, done, total } = found;
    const depot = scenario.depots.find((d) => d.id === depotId);
    const line = 3 + (car.task === "CLEAN" ? 0 : depot.cleaning_bays);
    const bay = labels.bayId({ task: car.task, index: 1 });
    // A stage's text without the arrow span that follows it.
    const flow = () => ctx.region.querySelectorAll("ol > li").map((li) => li.childNodes.filter((n) => n.getAttribute?.("class") !== "fl-flow__arrow").map((n) => n.textContent).join(""));
    ctx.store.dispatch({ type: "clock/set", clock_s: t });
    open({ depot: depotId });
    assert.equal(flow()[line], labels.bayBusy({ bay, car: car.id, task: car.task, done, total, blocked: false }));

    // No fixture snapshot has a car blocked in its bay, so this run marks the found car blocked at that second.
    const blockedPayload = structuredClone(payload);
    blockedPayload.log.snapshots.find((s) => s.t === t).cars.find((c) => c.id === car.id).blocked = true;
    ctx.store.dispatch({ type: "run/queued", id: "w2", total: 2 });
    ctx.store.dispatch({ type: "run/done", id: "w2", payload: blockedPayload });
    ctx.store.dispatch({ type: "clock/set", clock_s: t });
    if (ctx.store.getState().inspector === null) open({ depot: depotId });
    assert.equal(flow()[line], labels.bayBusy({ bay, car: car.id, task: car.task, done, total, blocked: true }));
  });

  test("the ledger keeps this replay and across replications in their own columns, with absence reasons", () => {
    setup();
    open({ depot: "SJ-1" });
    const ledger = ctx.region.querySelectorAll("table").at(-1);
    assert.deepEqual(texts(ledger.querySelectorAll("th")), [INSPECTOR.ledger, INSPECTOR.value, labels.ledgerAcross(2)]);
    const rows = ledger.querySelectorAll("tbody > tr").map((tr) => texts(tr.children));
    assert.deepEqual(rows.map((r) => r[0]), Object.values(INSPECTOR.ledgerRows));
    const byName = Object.fromEntries(rows.map((r) => [r[0], r]));

    const scoped = (metric) => computeMetric(result(), { metric, scope: { depot: "SJ-1" } });
    const turnaround = scoped("depot.turnaround_p90_s");
    assert.ok("absent" in turnaround && /unfinished at drain end$/.test(turnaround.absent), "the fixture run leaves SJ-1 visits unfinished");
    assert.equal(byName[INSPECTOR.ledgerRows.timeToReady][1], labels.absentValue(turnaround.absent));
    assert.equal(byName[INSPECTOR.ledgerRows.bayWait][1], metricText(scoped("depot.bay_wait_p90_s"), minutes));
    // Depot-scoped percentiles are computed only for the logged replay; the lot peak is in every replication's metrics.
    assert.equal(byName[INSPECTOR.ledgerRows.bayWait][2], labels.absentValue(labels.ABSENT_REASONS.onlyThisReplay));
    const lot = payload.runs.map((r) => r.metrics["depot.parking_peak_fraction{depot=SJ-1}"].value);
    assert.equal(byName[INSPECTOR.ledgerRows.lotPeak][2], labels.acrossRange({ low: percent(Math.min(...lot), 1), high: percent(Math.max(...lot), 1) }));
    for (const row of rows) {
      for (const cell of row.slice(1)) assert.ok(cell.length > 0 && cell !== "-", `a ledger cell reads ${cell}`);
    }
    for (const td of ledger.querySelectorAll("td")) {
      assert.equal((td.getAttribute("class") ?? "").includes("fl-absent"), td.textContent.startsWith(labels.ABSENT_PREFIX));
    }
  });

  test("the depot board is the charts.js board for this depot, after the NOW flow and before the ledger", () => {
    setup();
    open({ depot: "SJ-1" });
    const board = ctx.region.querySelector('[data-chart-group="depot-board"]');
    assert.ok(board, "the board group is drawn");
    assert.deepEqual(board.querySelectorAll("figure").map((f) => f.getAttribute("data-chart")), ["bay_lanes", "lot_and_queue"]);
    const sections = texts(ctx.region.querySelectorAll("h3.fl-title")).filter((text) => [INSPECTOR.now, INSPECTOR.board].includes(text));
    assert.deepEqual(sections, [INSPECTOR.now, INSPECTOR.board]);
  });

  test("Escape closes the drawer and focus returns to where it was", () => {
    setup();
    open({ depot: "SJ-1" });
    ctx.document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.equal(ctx.store.getState().inspector, null);
    assert.equal(ctx.region.hidden, true);
    assert.equal(ctx.region.hasAttribute("inert"), true);
    assert.equal(ctx.region.getAttribute("data-open"), "false");
    assert.equal(ctx.document.activeElement, ctx.trigger);
  });

  test("before any run the drawer says nothing has run and shows no replay stamp", () => {
    const uninstall = installFakeDom(globalThis);
    const region = document.createElement("aside");
    document.body.appendChild(region);
    const store = createStore(createInitialState({ presetId: DEFAULT_PRESET_ID, scenario: presetScenario() }));
    const inspector = mountInspector({ store, region });
    store.dispatch({ type: "inspector/open", target: { depot: "SJ-1" } });
    assert.equal(region.querySelector(".fl-chip-replay").hidden, true);
    assert.ok(region.textContent.includes(labels.STATES.nothingRun));
    inspector.destroy();
    uninstall();
  });
});

describe("car inspector", () => {
  test("shows the car's home, state, timeline, visits, decision causes and the fork with its caption", () => {
    setup();
    open({ car: "SF-017" });
    const { region, forks, store } = ctx;
    const log = payload.log;
    assert.equal(region.querySelector("h2").textContent, labels.inspectorTitle({ heading: INSPECTOR.carHeading, name: "SF-017" }));
    const car = log.cars.find((c) => c.id === "SF-017");
    assert.ok(region.textContent.includes(labels.carHome({ area: car.home_area, depot: car.home_depot })));
    const now = log.intervals["SF-017"].find((iv) => iv.t0 <= D1_1930 && D1_1930 < iv.t1);
    assert.ok(region.textContent.includes(labels.carStateText(now)));

    assert.ok(region.querySelector('figure[data-chart="car_timeline"]'), "the timeline is the charts.js car timeline");
    const visitsTable = region.querySelectorAll("table").find((t) => t.querySelector("th").textContent === INSPECTOR.columns.depot);
    const visits = log.visits.filter((v) => v.car === "SF-017");
    assert.ok(visits.length > 0);
    assert.deepEqual(visitsTable.querySelectorAll("tbody > tr").map((tr) => texts(tr.children)), visits.map((v) => [
      v.depot, clock(v.arrival_s), v.ready_s === null ? labels.absentValue(labels.visitsUnfinished(1)) : clock(v.ready_s),
    ]));

    const decisions = log.events.filter((e) => e.car === "SF-017" && (e.kind === "DEPOT_ASSIGNED" || e.kind === "DEPOT_DIVERTED"));
    assert.deepEqual(texts(region.querySelectorAll("ul > li.fl-mono")), decisions.map((e) => labels.decisionLine({
      clock: clock(e.t), kind: e.kind, depot: e.depot, target: e.detail.purpose ?? e.detail.to, cause: e.detail.cause,
    })));

    const buttons = region.querySelectorAll("button");
    buttons.find((b) => b.textContent === INSPECTOR.openFork).click();
    assert.deepEqual(forks, ["SF-017"]);
    buttons.find((b) => b.textContent === INSPECTOR.pinCar).click();
    assert.equal(store.getState().fork.pinnedCar, "SF-017");
    assert.ok(region.querySelectorAll("p").some((p) => p.textContent === labels.HONESTY.forkCaption));
  });

  test("the drawer follows the clock only when it crosses into another snapshot", () => {
    setup();
    open({ car: "SF-017" });
    const first = ctx.region.querySelector("table");
    ctx.store.dispatch({ type: "clock/set", clock_s: D1_1930 + 120 });
    assert.equal(ctx.region.querySelector("table"), first, "no rebuild inside one five-minute snapshot");
    ctx.store.dispatch({ type: "clock/set", clock_s: D1_1930 + 300 });
    assert.equal(ctx.region.querySelector(".fl-chip-replay").textContent, labels.inspectorStamp({ seed: 1001, clock: "D1 19:35" }));
  });
});
