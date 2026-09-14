import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PLAYGROUND_ROOT = fileURLToPath(new URL("../", import.meta.url));
const DESIGN = readFileSync(join(REPO_ROOT, "docs/plans/2026-09-13-fleetlab-playground-design.md"), "utf8");

/** FleetLab's label tuple, read from its source so this test never spells the strings (design H-8). */
function requiredLabels() {
  const source = readFileSync(join(REPO_ROOT, "src/hermes/fleet/contracts.py"), "utf8");
  const block = source.match(/REQUIRED_LABELS: tuple\[str, \.\.\.\] = \(([\s\S]*?)\n\)/);
  assert.ok(block, "REQUIRED_LABELS tuple found in contracts.py");
  const found = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(found.length, 5);
  return found;
}

/** Rows of the design §1.3 "Exact copy for the first build" table as `{where, text}`. */
function exactCopyRows() {
  const start = DESIGN.indexOf("**Exact copy for the first build**");
  const end = DESIGN.indexOf("### 1.4", start);
  assert.ok(start > 0 && end > start, "design §1.3 exact copy table found");
  const rows = [];
  for (const line of DESIGN.slice(start, end).split("\n")) {
    if (!line.startsWith("| ") || line.startsWith("| Where") || line.startsWith("|---")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const where = cells[1];
    const cell = cells[2];
    let text;
    if (cell.startsWith("`")) text = cell.slice(1, cell.indexOf("`", 1));
    else if (cell.startsWith('"')) text = cell.slice(1, cell.lastIndexOf('"'));
    else assert.fail(`unexpected copy cell for ${where}`);
    rows.push({ where, text });
  }
  return rows;
}

/** What the playground renders for each §1.3 row, using the design's own sample inputs. */
const RENDERED_ROWS = {
  "Top strip (not dismissable)": () => labels.HONESTY.strip,
  "Top strip, phone": () => labels.HONESTY.stripPhone,
  Popover: () => labels.HONESTY.popover,
  // H2 free flow 55 min = 3300 s.
  "Route shield": () => labels.routeShield({ routeId: "H2", freeFlow: format.minutes(3300) }),
  "Traffic label": () =>
    labels.trafficLabel({
      period: "evening",
      roadClass: "highway",
      parts: [
        { awayFrom: "SF", factor: format.multiplier(1600) },
        { toward: "SF", factor: format.multiplier(1200) },
      ],
      start: format.hourClock(16),
      end: format.hourClock(19),
    }),
  // Contract 6.3 check: H2 from 66,600 s (D1 18:30) plans 1800 + 2828 = 4628 s, 77.13 min, shown as 77 min.
  "Route tooltip": () =>
    labels.routeTooltip({ clock: format.clock(66600), planned: format.minutes(4628), freeFlow: format.minutes(3300) }),
  "Verdict chip, inside the verdict box": () => labels.HONESTY.verdictChip,
  "Verdict footer (not collapsible)": () => labels.HONESTY.verdictFooter,
  "Absent value": () => format.valueText({ absent: labels.ABSENT_REASONS.noPickupThisHour }, format.minutes),
  "Axis FleetLab cannot run": () => labels.HONESTY.axisFleetLabCannotRun,
  "FLEET-005 reference panel": () => labels.HONESTY.fleet005Panel,
  "Two-zone probe panel": () => labels.HONESTY.twoZoneProbePanel,
  "Car fork caption": () => labels.HONESTY.forkCaption,
};

/** Sample arguments for every exported template, by export path. */
const SAMPLES = {
  plural: [[3, "knob"]],
  routeShield: [[{ routeId: "H2", freeFlow: "55 min" }]],
  trafficLabel: [
    [{ period: "late", roadClass: "highway", parts: [{ factor: "×1.3" }], start: "19:00", end: "20:00" }],
    [{ period: "morning", roadClass: "local", parts: [{ factor: "×1.3" }], start: "07:00", end: "09:00" }],
    [{ period: "evening", roadClass: "in_area", parts: [{ factor: "×1.3" }], start: "16:00", end: "19:00" }],
    [{ period: "evening", roadClass: "highway", parts: [{ from: "SF", to: "PEN", factor: "×1.6" }, { from: "SJ", to: "PEN", factor: "×1.2" }], start: "16:00", end: "19:00" }],
  ],
  routeTooltip: [[{ clock: "D1 18:30", planned: "77 min", freeFlow: "55 min" }], [{ clock: "D1 03:00", planned: "55 min", freeFlow: "55 min", slowed: false }]],
  absentValue: [["no completed request in scope"]],
  visitsUnfinished: [[1], [2]],
  topBarStatus: [[{ clock: "D1 18:30", replay: 1, replays: 5, seed: 1001 }]],
  verdictSeedStatus: [[{ clock: "D1 18:30", seed: 1005, index: 5, total: 20 }]],
  freezeNotice: [[{ frozenAt: "14:02", changedKnobs: 3 }], [{ frozenAt: "14:02", changedKnobs: 1 }], [{ frozenAt: "14:02", changedKnobs: 0 }]],
  enginePath: [["worker"], ["main thread"]],
  seedSetText: [[{ seedSet: 1, firstSeed: 1001, lastSeed: 1020 }]],
  sessionLogEntry: [
    [{ seedSet: 1, firstSeed: 1001, lastSeed: 1020, label: "playground-spec:3f9a1c2e", validity: "VALID", outcome: "IMPROVED", recommendation: "ADVANCE_TO_NEXT_TEST", engine: "worker" }],
    [{ seedSet: 2, firstSeed: 2001, lastSeed: 2020, label: "playground-spec:0badc0de", validity: "INVALID_EXPERIMENT", outcome: null, recommendation: "NO_RECOMMENDATION", engine: "main thread" }],
    [{ seedSet: 1, firstSeed: 1001, lastSeed: 1010, label: "playground-spec:3f9a1c2e", validity: "VALID", outcome: "UNCHANGED", recommendation: "NO_RECOMMENDATION", engine: null }],
  ],
  thisReplayChip: [[1001]],
  acrossReplicationsChip: [[5]],
  acrossReplications: [[5]],
  replicationBandLegend: [[5]],
  speedText: [[900]],
  nowWatching: [[{ seed: 1007, index: 7, total: 20 }]],
  verdictHeader: [[10], [1]],
  marginBand: [["30 s"]],
  guardrailsRegressedCount: [[1]],
  tradeOff: [[{ lower: "out-of-service time", higher: "morning drive" }]],
  baselineLine: [[{ presetName: "Evening depot visit in San Jose", changes: 0 }]],
  aboutDuration: [["6 s"]],
  invalidScope: [[{ metric: "depot.parking_peak_fraction", key: "area" }]],
  changesCount: [[3], [1]],
  knobsDrawer: [[3]],
  presetLine: [["Bay teaching map"]],
  resetKnob: [["Cleaning bays per depot, SJ-1"]],
  changeItem: [[{ knobName: "Cleaning bays per depot, SJ-1", from: "3 bays", to: "1 bay" }]],
  outOfRange: [[{ value: "130", min: "0", max: "120", unit: "requests per hour" }]],
  knobPath: [["Depots", "Depots per area"]],
  invalidCombinationText: [[labels.CHECKS.noDepot()], [labels.CHECKS.patienceBelowPickup({ area: "SJ", patience: "5 min", pickup: "8 min" }), { warning: true }]],
  "CHECKS.noDepot": [[]],
  "CHECKS.tooManyCars": [[{ total: 612 }]],
  "CHECKS.noCars": [[]],
  "CHECKS.peakBelowOffPeak": [[{ area: "SJ", peak: "8", offPeak: "10" }]],
  "CHECKS.overlappingPeaks": [[{ morning: "07:00 to 10:00", evening: "09:00 to 12:00" }]],
  "CHECKS.congestionMissingHour": [[{ roadClass: "highways", direction: "toward SF", clock: "D2 07:00" }]],
  "CHECKS.noServiceBay": [[]],
  "CHECKS.releaseBeforeRecall": [[{ recall: "D2 00:30", release: "D2 00:15" }]],
  "CHECKS.patienceBelowPickup": [[{ area: "SJ", patience: "5 min", pickup: "8 min" }]],
  replicationProgress: [[3, 5]],
  seedProgress: [[7, 20]],
  invariantFailure: [[{ rule: labels.INVARIANT_RULES[2], id: 2 }], [{ rule: labels.INVARIANT_RULES.P13, id: "P13" }]],
  slowExperimentAdvice: [[{ estimate: "about 90 s", seeds: 40, fewerSeeds: 20, widening: "1.4 times" }]],
  waitPopulation: [["412"]],
  withWaitPopulation: [[{ value: "8.2 to 9.1 min", population: "from 1,350 to 1,420 completed rides" }]],
  unservedCount: [[4]],
  depotName: [[{ depotId: "SJ-1", areaName: "San Jose" }]],
  lotFill: [[22, 30]],
  waitingRiders: [[1], [3]],
  routeDirection: [[{ routeId: "H2", from: "San Jose", to: "San Francisco" }]],
  pinnedCarName: [[{ car: "SF-017", state: "on a trip" }]],
  mapAnnouncement: [[{ clock: "D1 18:30", waiting: 23, unservedLastHour: 4 }], [{ clock: "D1 06:00", waiting: 1, unservedLastHour: 0 }]],
  ledgerAcross: [[5]],
  fleetStateSummary: [[{ register: "This replay", atDepot: 23, fleet: 90, clock: "D1 18:00" }]],
  metricByHourSummary: [
    [{ register: "This replay", metric: "wait.p90_s", highest: "11 min", clock: "D1 18:00", absentHours: 0 }],
    [{ register: "Across 5 replications", metric: "depot.bay_wait_p90_s", highest: "14 min", clock: "D1 19:00", absentHours: 2 }],
    [{ register: "This replay", metric: "depot.bay_wait_p90_s", highest: { absent: "no visit started a task" }, absentHours: 24 }],
  ],
  demandSummary: [[{ area: "SJ", peakRate: "35", accepted: "412" }]],
  trafficSummary: [[{ roadClass: "highways", direction: "away from SF", factor: "×1.6", start: "16:00", end: "19:00" }]],
  armComparisonSummary: [[{ count: 20, metric: "wait.p90_s", baseline: "10.2 min", candidate: "9.1 min" }]],
  availableSummary: [[{ register: "This replay", area: "San Francisco", lowest: "4.1%", clock: "D1 17:00" }]],
  carTimelineSummary: [[{ car: "SF-017", atDepots: "2 h 20 min", congestedEmpty: "77 min" }]],
  depotBoardSummary: [[{ depot: "SJ-1", held: 29, stalls: 30, bayWait: "11 min" }]],
  verdictStripSummary: [[{ count: 10, metric: "wait.p90_s", low: "+735.9 s", high: "+919.2 s", outcome: "REGRESSED" }]],
  chartTitle: [[{ title: "Arm comparison", subject: "wait.p90_s" }]],
  scopedMetric: [[{ metric: "wait.p90_s", scopes: ["SF", "D2 07:00 to 09:00"] }], [{ metric: "unserved.fraction", scopes: [] }]],
  windowScope: [[{ start: "D2 07:00", end: "09:00" }], [{ start: "D2 23:00", end: "D3 01:00" }]],
  availableCarsTitle: [["San Francisco"]],
  bayLane: [[{ task: "CLEAN", index: 1 }], [{ task: "SERVICE", index: 2 }]],
  trafficDirection: [[{ from: "SF", to: "PEN" }]],
  fleetStateHourSummary: [[{ register: "This replay", clock: "D1 19:00", atDepot: "23.4", fleet: 90 }]],
  chartAbsentSummary: [[{ register: "Across 10 replications", subject: "wait.p90_s", reason: "metric absent in some replication" }]],
  forkTimelineSummary: [[{ car: "SF-017", atDepotsA: "2 h 20 min", atDepotsB: "1 h 5 min" }]],
  forkDepotSummary: [[{ lane: "B: candidate", depot: "SJ-1", held: 29, stalls: 30, bayWait: "11 min" }]],
  forkAvailableSummary: [[{ area: "San Francisco", lowestA: "3.2", clockA: "D2 07:00", lowestB: "1.0", clockB: "D2 08:00" }]],
  bayLanesSummary: [[{ depot: "SJ-1", bays: 4, tasks: 31 }], [{ depot: "SJ-1", bays: 1, tasks: 1 }]],
  guardrailRowSummary: [[{ count: 10, metric: "unserved.fraction", harm: "+0.057", maxHarm: "0.020", status: "REGRESSED" }]],
  notEvaluableSummary: [[{ count: 10, metric: "depot.bay_wait_p90_s" }]],
  momentPosition: [[2, 5]],
  // Knob panel and inspector (src/ui/controls.js, src/ui/inspector.js).
  knobPart: [[{ knobName: "Cleaning bays per depot", part: "SJ-1" }]],
  stepDown: [["Clean time"]],
  stepUp: [["Clean time"]],
  valueWithUnit: [[{ value: "20", unit: "min" }], [{ value: "16:00 to 19:00", unit: "×1.6" }]],
  weightPart: [[{ period: "morning peak", origin: "SF", dest: "PEN" }]],
  notReadable: [[{ value: "twenty", example: "20" }]],
  notAStep: [[{ value: "0.07", step: "0.05", unit: "σ" }]],
  outOfClockRange: [[{ value: "D2 11:00", min: "D1 05:00", max: "D2 10:00" }]],
  lockedUntilReset: [["Depots per area"]],
  inspectorTitle: [[{ heading: "DEPOT", name: "SJ-1 · San Jose" }], [{ heading: "CAR", name: "SF-017" }]],
  inspectorStamp: [[{ seed: 1001, clock: "D1 19:30" }]],
  depotStatus: [[{ held: 22, stalls: 30, inBays: 3, cleanBays: 3, serviceBays: 1 }]],
  flowStage: [[{ stage: "Arriving", count: 3 }]],
  queueStage: [[{ count: 2, oldest: "11 min" }], [{ count: 0, oldest: null }]],
  bayId: [[{ task: "CLEAN", index: 1 }], [{ task: "SERVICE", index: 2 }]],
  bayBusy: [[{ bay: "C1", car: "SJ-022", task: "CLEAN", done: 14, total: 20 }], [{ bay: "S1", car: "SJ-011", task: "SERVICE", done: 45, total: 45, blocked: true }]],
  bayFree: [["C3"]],
  carHome: [[{ area: "SF", depot: "SF-1" }]],
  carStateText: [[{ state: "IN_SERVICE", task: "CLEAN", blocked: true }], [{ state: "IDLE" }]],
  acrossRange: [[{ low: "9 min", high: "14 min" }]],
  decisionLine: [[{ clock: "D1 18:30", kind: "DEPOT_ASSIGNED", depot: "SJ-1", target: "SERVICE_DUE", cause: "nearest_depot" }]],
  // Experiment sheet, verdict, reference panels and Learn (src/ui/experiment.js, src/ui/learn.js).
  openReferencePanel: [["FLEET-005 depot turnaround"]],
  suppressedMetric: [["fleet.utilization_fraction"]],
  withheldReason: [["fleet.utilization_fraction"], ["business_proxy.served_trips"], ["business_proxy.unserved_demand"]],
  primaryDeltaCaption: [["lower_is_better"], ["higher_is_better"]],
  candidateMinusBaseline: [["mean delta"]],
  referenceAxisLine: [[{ axis: "parameter:service_bays", baseline: "4", candidate: "2" }]],
  intervalText: [[{ low: "+735.9", high: "+919.2 s" }]],
  guardrailsNotEvaluableCount: [[1]],
  experimentRunProgress: [[7, 23]],
  directionUnit: [[{ direction: "lower is better", unit: "s" }]],
  marginUnit: [["s"]],
  removeGuardrailNumber: [[2]],
  guardrailNumber: [[2]],
  testItProperlyFor: [["Bays are not always the bottleneck"]],
  presetOption: [[{ id: "UC-01", title: "Null check" }]],
  timesAsWide: [["1.4"]],
  hoursChanged: [[6], [1]],
  checkState: [[{ check: "margin above 0", passes: false }], [{ check: "one axis", passes: true }]],
  learnCaption: [["learn.L1.m1"], ["learn.L2.m2"], ["learn.L3.m1"]],
  momentLine: [[{ clock: "D1 18:30", title: "SF-017 finishes a trip in San Jose" }]],
  learnPinnedCar: [["SF-017"]],
  // Shell panels (src/ui/app.js).
  nowLot: [["SJ-1"]],
};

/** Every string reachable from the labels exports, with template outputs for the sample inputs. */
function everyString() {
  const out = [];
  const missing = [];
  const visit = (value, path) => {
    if (typeof value === "string") out.push({ path, text: value });
    else if (typeof value === "function") {
      const samples = SAMPLES[path];
      if (samples === undefined) {
        missing.push(path);
        return;
      }
      samples.forEach((args, i) => visit(value(...args), `${path}(${String(i)})`));
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${path}[${String(i)}]`));
    else if (value !== null && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) visit(v, path.length === 0 ? k : `${path}.${k}`);
    }
  };
  for (const [name, value] of Object.entries(labels)) {
    if (typeof value === "function") visit(value, name);
    else visit(value, name);
  }
  return { out, missing };
}

const BANNED_WORDS = /\b(predict|forecast|live|real-time|realtime|real time|monitoring)\b|expected traffic/i;
// Design H-6 and §8.5: no score, winner, gauge, grade, leaderboard, revenue or cost; no wins, beats or better option.
const H6_WORDS = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
// The design §7.1 mode table's Experiment "Never" cell is a negated statement quoted verbatim, so it names two of the
// words. Only that path is exempt, and a test below proves it still equals the design cell, so it cannot hide new words.
const H6_EXEMPT = new Set(["MODES.experiment.never"]);
const DASHES = /[\u2013\u2014]/; // en dash, em dash

describe("design §1.3 exact copy", () => {
  const rows = exactCopyRows();

  test("the table has the thirteen rows this test maps", () => {
    assert.deepEqual(
      rows.map((r) => r.where).sort(),
      Object.keys(RENDERED_ROWS).sort(),
    );
  });

  for (const { where, text } of rows) {
    test(`${where} renders the design's string`, () => {
      assert.equal(RENDERED_ROWS[where](), text);
    });
  }
});

describe("copy quoted elsewhere in the design", () => {
  // Each string below is exact copy from design §5.8, §6 P-8 or §7; the design must contain it verbatim.
  const quoted = [
    labels.freezeNotice({ frozenAt: "14:02", changedKnobs: 3 }),
    labels.topBarStatus({ clock: "D1 18:30", replay: 1, replays: 5, seed: 1001 }),
    labels.SEED_WATCH.watchMedian,
    labels.SEED_WATCH.watchLargest,
    labels.SEED_WATCH.backToSetup,
    labels.SEED_WATCH.largestWarning,
    labels.nowWatching({ seed: 1007, index: 7, total: 20 }),
    labels.replicationBandLegend(5),
    labels.REGISTERS.thisReplay,
    labels.acrossReplicationsChip(5),
    labels.REGISTERS.warmUp,
    ...Object.values(labels.PLAYBACK.jumps),
    labels.MAP.cornerStamp,
    labels.MAP.unitBarLegend,
    labels.KNOB_PANEL.greyed.charging,
    labels.KNOB_PANEL.greyed.staff,
    labels.KNOB_PANEL.stale,
    labels.KNOB_PANEL.runWindow,
    labels.knobsDrawer(3),
    labels.changesCount(3),
    labels.INVALID_COMBINATION.heading,
    labels.INVALID_COMBINATION.what,
    labels.INVALID_COMBINATION.why,
    labels.INVALID_COMBINATION.fix,
    labels.INVALID_COMBINATION.knob,
    labels.KNOB_PANEL.goToKnob,
    labels.CHECKS.noDepot().what,
    labels.CHECKS.noDepot().why,
    labels.CHECKS.noDepot().fix,
    labels.CHECKS.noDepot().knob,
    labels.STATES.nothingRun,
    labels.replicationProgress(3, 5),
    labels.seedProgress(7, 20),
    labels.invariantFailure({ rule: labels.INVARIANT_RULES[2], id: 2 }),
    labels.STATES.copyDetails,
    labels.STATES.engineStopped,
    labels.STATES.retry,
    labels.STATES.simplifiedDrawing,
    labels.STATES.useFullDrawing,
    labels.NOT_EVALUABLE_TEXT,
    labels.REFERENCE.suppressedRow,
    labels.HONESTY.verdictChip,
    labels.verdictHeader(10),
    labels.OUTCOME_SENTENCES.REGRESSED,
    labels.RECOMMENDATION_REASONS.guardrailHarmed,
    labels.VERDICT.descriptive,
    labels.EXPERIMENT_SETUP.freezeAndRun,
    labels.EXPERIMENT_SETUP.marginHint,
    labels.EXPERIMENT_SETUP.testItProperly,
    labels.SESSION_LOG.useAnotherSeedSet,
    labels.baselineLine({ presetName: "Evening depot visit in San Jose", changes: 0 }),
    labels.enginePath("worker"),
    labels.enginePath("main thread"),
    labels.thisReplayChip(1001),
    labels.REGISTERS.nowThisReplay,
    labels.visitsUnfinished(2),
    labels.INSPECTOR.ledger,
    labels.ledgerAcross(5),
    labels.VERDICT.shownNotNeeded,
    labels.VERDICT.limitationItems.join(" · "),
    labels.VERDICT.perSeedDelta,
    labels.VERDICT.leftIsBetter,
    Object.values(labels.CHARTS.phoneSegments).join(" | "),
    labels.EXPERIMENT_SETUP.frozenWhenYouRun,
    ...Object.values(labels.KNOB_PANEL.groups),
    ...Object.values(labels.EXPERIMENT_SETUP.checks),
    // The depot inspector wireframe of §7.2.
    labels.inspectorTitle({ heading: labels.INSPECTOR.depotHeading, name: labels.depotName({ depotId: "SJ-1", areaName: "San Jose" }) }),
    labels.inspectorStamp({ seed: 1001, clock: "D1 19:30" }),
    labels.depotStatus({ held: 22, stalls: 30, inBays: 3, cleanBays: 3, serviceBays: 1 }),
    labels.flowStage({ stage: labels.INSPECTOR.stages.arriving, count: 3 }),
    labels.queueStage({ count: 2, oldest: "11 min" }),
    labels.bayBusy({ bay: "C1", car: "SJ-022", task: "CLEAN", done: 14, total: 20 }),
    labels.MODEL_LIMITS.noStaff,
  ];
  // The design wraps long lines, so compare against its text with every whitespace run as one space.
  const flat = DESIGN.replace(/\s+/g, " ");
  // A match counts only when no letter or digit touches it, so a string cut inside a word ("HIS REPLAY · seed 100"
  // inside "THIS REPLAY · seed 1001") does not pass as the design's copy. A dropped whole word needs a delimited
  // check, which the chip tests below add.
  const containsPhrase = (haystack, text) => {
    const alnum = /[A-Za-z0-9]/;
    for (let at = haystack.indexOf(text); at !== -1; at = haystack.indexOf(text, at + 1)) {
      const before = haystack[at - 1];
      const after = haystack[at + text.length];
      const openStart = !alnum.test(text[0]) || before === undefined || !alnum.test(before);
      const openEnd = !alnum.test(text[text.length - 1]) || after === undefined || !alnum.test(after);
      if (openStart && openEnd) return true;
    }
    return false;
  };
  for (const text of quoted) {
    test(`design contains: ${text}`, () => {
      assert.ok(containsPhrase(flat, text), `not found verbatim in the design: ${text}`);
    });
  }

  test("the verbatim check refuses a truncated phrase", () => {
    assert.ok(containsPhrase("a `THIS REPLAY · seed 1001` chip", "THIS REPLAY · seed 1001"));
    assert.ok(!containsPhrase("a `THIS REPLAY · seed 1001` chip", "HIS REPLAY · seed 1001"));
    assert.ok(!containsPhrase("a `THIS REPLAY · seed 1001` chip", "THIS REPLAY · seed 100"));
  });

  test("short words from the §7.2 layouts appear in their layout context", () => {
    // "decides" and "always available" are ordinary words the design also uses in prose, so a whole-design search
    // would prove nothing; the §7.2 verdict and setup mockups hold them next to their neighbours.
    const start = DESIGN.indexOf("### 7.2");
    const end = DESIGN.indexOf("### 7.3", start);
    assert.ok(start > 0 && end > start, "design §7.2 found");
    const layouts = DESIGN.slice(start, end).replace(/\s+/g, " ");
    assert.ok(layouts.includes(`${labels.VERDICT.decides} ${labels.VERDICT.shownNotNeeded}`), labels.VERDICT.decides);
    assert.ok(layouts.includes(` · ${labels.EXPERIMENT_SETUP.alwaysAvailable} `), labels.EXPERIMENT_SETUP.alwaysAvailable);
    // The register chip and heading with their mockup delimiters, so a dropped word fails (design H-10 wording).
    assert.ok(layouts.includes(`[${labels.thisReplayChip(1001)}]`), labels.thisReplayChip(1001));
    assert.ok(layouts.includes(`│ ${labels.REGISTERS.nowThisReplay} │`), labels.REGISTERS.nowThisReplay);
  });

  test("every quoted model-limits chip of §5.8 is exported verbatim", () => {
    const start = DESIGN.indexOf("### 5.8");
    const end = DESIGN.indexOf("### 5.9", start);
    const chips = [...DESIGN.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((t) => t.endsWith("."));
    assert.ok(chips.length >= 10, "§5.8 chips found");
    const exported = Object.values(labels.MODEL_LIMITS);
    for (const chip of chips) assert.ok(exported.includes(chip), `missing chip: ${chip}`);
  });

  test("the H-9 fallback caption covers every Learn moment", () => {
    assert.equal(labels.LEARN_CASES.length, 3);
    for (const c of labels.LEARN_CASES) {
      assert.ok(c.moments.length >= 3 && c.moments.length <= 5, `${c.id} has three to five moments`);
      for (const m of c.moments) assert.equal(labels.LEARN_CAPTIONS[m.key], labels.RUN_IT_AND_SEE);
    }
    assert.match(labels.RUN_IT_AND_SEE, /^run it and see\.$/i);
    assert.deepEqual(labels.LEARN_CASES.map((c) => c.useCase), ["UC-04", "UC-09", "UC-07"]);
  });
});

describe("copy rules on every exported string", () => {
  const { out, missing } = everyString();

  test("every exported template has sample inputs in this test", () => {
    assert.deepEqual(missing, []);
  });

  test("the walk reaches a large set of strings", () => {
    assert.ok(out.length > 300, `only ${String(out.length)} strings reached`);
  });

  test("no em dash or en dash", () => {
    const bad = out.filter((s) => DASHES.test(s.text)).map((s) => s.path);
    assert.deepEqual(bad, []);
  });

  test("no word banned by design H-3, as a whole word, ignoring case", () => {
    const bad = out.filter((s) => BANNED_WORDS.test(s.text)).map((s) => `${s.path}: ${s.text}`);
    assert.deepEqual(bad, []);
  });

  test("no winner wording banned by design H-6", () => {
    const bad = out.filter((s) => !H6_EXEMPT.has(s.path) && H6_WORDS.test(s.text)).map((s) => `${s.path}: ${s.text}`);
    assert.deepEqual(bad, []);
  });

  test("the H-6 check itself catches each banned word", () => {
    const caught = [
      "Candidate wins", "it can win", "the winner", "two winners", "beats baseline", "Score: 87", "scores", "scoring",
      "a gauge", "gauges", "Grade A", "grades", "leaderboard", "leaderboards", "revenue per car", "cost per trip",
      "costs", "a better option", "the best configuration",
    ];
    for (const text of caught) assert.ok(H6_WORDS.test(text), text);
    for (const text of ["upgrade", "costume", "winding", "gaugeless"]) assert.ok(!H6_WORDS.test(text), text);
  });

  test("the only H-6 exemption equals the design §7.1 Experiment Never cell", () => {
    const row = DESIGN.split("\n").find((line) => line.startsWith("| **Experiment** |"));
    assert.ok(row, "design §7.1 Experiment row found");
    const never = row.split("|").map((cell) => cell.trim())[4];
    assert.equal(labels.MODES.experiment.never, `${never[0].toUpperCase()}${never.slice(1)}.`);
    assert.deepEqual([...H6_EXEMPT], ["MODES.experiment.never"]);
  });

  test("the banned-word check itself catches each banned word", () => {
    for (const text of ["We predict this", "a Forecast", "LIVE view", "real-time feed", "not monitoring", "expected traffic"]) {
      assert.ok(BANNED_WORDS.test(text), text);
    }
    for (const text of ["delivery", "alive", "livery"]) assert.ok(!BANNED_WORDS.test(text), text);
  });

  test("exported string tables are frozen", () => {
    for (const name of ["HONESTY", "MODES", "VERDICT", "STATUS_WORDS", "MODEL_LIMITS", "LEARN_CASES", "CHECKS"]) {
      assert.ok(Object.isFrozen(labels[name]), name);
    }
  });
});

describe("REQUIRED_LABELS never appear (design H-8)", () => {
  const files = ["labels.js", "format.js", "dom.js", "store.js"].map((f) => join(PLAYGROUND_ROOT, "src/ui", f));
  const required = requiredLabels();
  for (const file of files) {
    test(`${file.slice(PLAYGROUND_ROOT.length)} holds none of them`, () => {
      const text = readFileSync(file, "utf8");
      for (const label of required) assert.ok(!text.includes(label), "a REQUIRED_LABELS string was found");
    });
  }
  test("no exported string holds one", () => {
    for (const { text } of everyString().out) {
      for (const label of required) assert.ok(!text.includes(label));
    }
  });
});

describe("status words", () => {
  test("every outcome, recommendation and validity word is literal, with a glyph and a token family", () => {
    const families = new Set(["pass", "cond", "hold", "invalid", "neutral"]);
    for (const group of ["validity", "outcome", "recommendation", "invalidityReason"]) {
      for (const [key, entry] of Object.entries(labels.STATUS_WORDS[group])) {
        assert.equal(entry.word, key);
        assert.ok(entry.glyph.length > 0);
        assert.ok(families.has(entry.status));
      }
    }
    // Design §8.1: UNCHANGED and NO_RECOMMENDATION take no status colour; NOT EVALUABLE is conditional.
    assert.equal(labels.STATUS_WORDS.outcome.UNCHANGED.status, "neutral");
    assert.equal(labels.STATUS_WORDS.recommendation.NO_RECOMMENDATION.status, "neutral");
    assert.equal(labels.STATUS_WORDS.guardrail.NOT_EVALUABLE.status, "cond");
    assert.equal(labels.STATUS_WORDS.guardrail.NOT_EVALUABLE.word, "NOT EVALUABLE");
    assert.equal(labels.STATUS_WORDS.outcome.INCONCLUSIVE.status, "cond");
    assert.equal(labels.STATUS_WORDS.recommendation.HOLD.status, "hold");
    assert.equal(labels.STATUS_WORDS.validity.INVALID_EXPERIMENT.status, "invalid");
  });

  test("glyphs are unique within the outcome group so colour is never the only cue", () => {
    const glyphs = Object.values(labels.STATUS_WORDS.outcome).map((e) => e.glyph);
    assert.equal(new Set(glyphs).size, glyphs.length);
  });
});

describe("templates", () => {
  test("freeze notice counts knobs in the right number", () => {
    assert.equal(
      labels.freezeNotice({ frozenAt: "09:15", changedKnobs: 1 }),
      "Spec frozen at 09:15. Sandbox has changed since (1 knob). This verdict is about the frozen spec.",
    );
  });

  test("traffic label with one value for both directions names no direction", () => {
    assert.equal(
      labels.trafficLabel({ period: "late", roadClass: "highway", parts: [{ factor: "×1.3" }], start: "19:00", end: "20:00" }),
      "Late evening slowdown you set: highways ×1.3, 19:00 to 20:00",
    );
  });

  test("session log entry carries seed set, label, words and engine path", () => {
    assert.equal(
      labels.sessionLogEntry({ seedSet: 2, firstSeed: 2001, lastSeed: 2020, label: "playground-spec:0badc0de", validity: "INVALID_EXPERIMENT", outcome: null, recommendation: "NO_RECOMMENDATION", engine: "main thread" }),
      "seed set 2 (seeds 2001 to 2020) · playground-spec:0badc0de · INVALID_EXPERIMENT · no outcome · NO_RECOMMENDATION · engine: main thread",
    );
  });

  test("invalid combination text keeps the four slots in order", () => {
    assert.equal(
      labels.invalidCombinationText(labels.CHECKS.noDepot()),
      "Can't run this window\nWHAT FAILED: Depots on the map: 0\nWHY: Cars need at least one depot to be cleaned.\nHOW TO FIX: Add a depot in any area.\nWHICH KNOB: Depots › Depots per area",
    );
  });

  test("metric by hour summary with no value in any hour names no hour and no value (design H-5)", () => {
    assert.equal(
      labels.metricByHourSummary({ register: "This replay", metric: "depot.bay_wait_p90_s", highest: { absent: labels.ABSENT_REASONS.noVisitStarted }, absentHours: 24 }),
      "This replay: depot.bay_wait_p90_s had no value in any hour; not available: no visit started a task.",
    );
    assert.equal(
      labels.metricByHourSummary({ register: "This replay", metric: "wait.p90_s", highest: "11 min", clock: "D1 18:00", absentHours: 2 }),
      "This replay: wait.p90_s was highest in the hour from D1 18:00, at 11 min; 2 hours had no value.",
    );
    const base = { register: "This replay", metric: "wait.p90_s", clock: "D1 18:00", absentHours: 24 };
    for (const highest of [undefined, null, 0, "", "  ", labels.absentValue("no visit in scope"), { absent: 1 }]) {
      assert.throws(() => labels.metricByHourSummary({ ...base, highest }), TypeError, String(highest));
    }
  });

  test("an absent value without a reason is refused", () => {
    assert.throws(() => labels.absentValue(""), TypeError);
    assert.throws(() => labels.enginePath("gpu"), TypeError);
    assert.throws(() => labels.trafficLabel({ period: "noon", roadClass: "highway", parts: [{ factor: "×1.0" }], start: "12:00", end: "13:00" }), TypeError);
  });
});

describe("format", () => {
  test("clock from seconds since day 1 00:00", () => {
    assert.equal(format.clock(0), "D1 00:00");
    assert.equal(format.clock(18000), "D1 05:00"); // 5 × 3600
    assert.equal(format.clock(66600), "D1 18:30"); // 18.5 × 3600
    assert.equal(format.clock(66659), "D1 18:30"); // seconds below a minute dropped
    assert.equal(format.clock(107100), "D2 05:45"); // 86400 + 5.75 × 3600
    assert.equal(format.clock(122400), "D2 10:00");
    assert.equal(format.clockHour(111600), "D2 07");
    assert.throws(() => format.clock(-1), RangeError);
    assert.throws(() => format.clock(Number.NaN), TypeError);
  });

  test("hour and session clocks", () => {
    assert.equal(format.hourClock(7), "07:00");
    assert.equal(format.hourClock(24), "24:00");
    assert.equal(format.sessionClock(14, 2), "14:02");
    assert.throws(() => format.sessionClock(24, 0), RangeError);
  });

  test("durations in whole minutes, half to even", () => {
    assert.equal(format.minutes(4628), "77 min"); // 77.13
    assert.equal(format.minutes(90), "2 min"); // 1.5 to even
    assert.equal(format.minutes(150), "2 min"); // 2.5 to even
    assert.equal(format.hoursMinutes(8400), "2 h 20 min"); // 140 min
    assert.equal(format.hoursMinutes(3000), "50 min");
    assert.equal(format.hoursMinutes(7200), "2 h");
  });

  test("numbers, signs and percentages with declared precision", () => {
    assert.equal(format.number(2628.25, 1), "2,628.2"); // 26282.5 to even
    assert.equal(format.number(1234567), "1,234,567");
    assert.equal(format.number(-0.04, 1), "0.0");
    assert.equal(format.signed(826.1, 1), "+826.1");
    assert.equal(format.signed(-25.5, 1), "-25.5");
    assert.equal(format.signed(0, 1), "0.0");
    assert.equal(format.percent(0.031, 1), "3.1%");
    assert.equal(format.percent(0.42, 0), "42%");
    assert.equal(format.seconds(30), "30 s");
    assert.equal(format.count(2628), "2,628");
    assert.throws(() => format.percent(0.5), RangeError);
    assert.throws(() => format.count(1.5), TypeError);
  });

  test("numbers round the exact decimal value half to even, as FleetLab's Python text does", () => {
    // Python: f"{0.15:.1f}" is 0.1, f"{0.45:.1f}" is 0.5, f"{2.675:.2f}" is 2.67, f"{1.015:.2f}" is 1.01.
    assert.equal(format.number(0.15, 1), "0.1");
    assert.equal(format.number(0.45, 1), "0.5");
    assert.equal(format.number(2.675, 2), "2.67");
    assert.equal(format.number(1.015, 2), "1.01");
    assert.equal(format.number(0.5), "0"); // exact tie to even
    assert.equal(format.number(1.5), "2");
    assert.equal(format.number(2.5), "2");
    assert.equal(format.number(-2.5), "-2");
    assert.equal(format.number(-0.05, 1), "-0.1"); // the double is -0.05000000000000000277..., past the tie
    assert.equal(format.number(-0.049, 1), "0.0"); // rounds to zero: never -0 (Python prints -0.0)
    assert.equal(format.number(-0.25, 1), "-0.2");
    assert.equal(format.number(999999.9999995, 6), "999,999.999999"); // the double lies just below the tie
    assert.equal(format.number(1e20), "100,000,000,000,000,000,000");
    assert.throws(() => format.number(1e21), RangeError);
    assert.throws(() => format.number(-1e21), RangeError);
    // Means over 20 or 40 replications are k/20 or k/40, often near a tie; these match Python on the same double.
    assert.equal(format.number(7 / 40, 2), "0.17"); // 0.175 as a double is 0.17499999999999998889...
    assert.equal(format.number(3 / 40, 2), "0.07"); // 0.075 is 0.07499999999999999722...
    assert.equal(format.number(5 / 40, 2), "0.12"); // 0.125 is exact: a tie, to even
    assert.equal(format.number(27 / 20, 1), "1.4"); // 1.35 is 1.35000000000000008882...
  });

  test("multipliers from per-mille", () => {
    assert.equal(format.multiplier(1600), "×1.6");
    assert.equal(format.multiplier(1000), "×1.0");
    assert.equal(format.multiplier(1250), "×1.25");
    assert.equal(format.multiplier(3000), "×3.0");
  });

  test("the spec label shows 8 characters and refuses anything but a full digest", () => {
    const digest = "3f9a1c2e7b4d5a6c8e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f";
    assert.equal(format.specLabel(digest), "playground-spec:3f9a1c2e");
    assert.throws(() => format.specLabel("3f9a1c2e"), TypeError);
  });

  test("absence is never 0, blank or a dash", () => {
    assert.equal(format.valueText({ absent: "no visit in scope" }, format.minutes), "not available: no visit in scope");
    assert.equal(format.valueText(0, (v) => format.number(v)), "0");
    assert.throws(() => format.valueText(null, format.minutes), TypeError);
    assert.throws(() => format.valueText(undefined, format.minutes), TypeError);
    assert.throws(() => format.valueText(Number.NaN, format.minutes), TypeError);
    assert.throws(() => format.absent(""), TypeError);
  });
});

describe("honesty copy reaches the page (review: honesty-copy lens)", () => {
  const UI_SOURCES = ["a11y.js", "app.js", "charts.js", "controls.js", "experiment.js", "inspector.js", "learn.js", "map.js", "playback.js"]
    .map((f) => readFileSync(join(PLAYGROUND_ROOT, "src/ui", f), "utf8"))
    .join("\n");

  test("every §1.3 copy helper is called by some interface module, not only defined", () => {
    for (const name of ["routeShield", "trafficLabel", "routeTooltip", "waitPopulation"]) {
      assert.match(UI_SOURCES, new RegExp(`\\b${name}\\(`), `${name} is rendered somewhere`);
    }
  });

  test("every HONESTY string of the §1.3 exact copy table is read by some interface module", () => {
    const table = new Set(exactCopyRows().map((row) => row.text));
    const keys = Object.entries(labels.HONESTY).filter(([, text]) => table.has(text)).map(([key]) => key);
    assert.ok(keys.length >= 9, "the table's fixed strings are HONESTY entries");
    for (const key of keys) assert.match(UI_SOURCES, new RegExp(`HONESTY\\.${key}(?![A-Za-z])`), `HONESTY.${key} is rendered somewhere`);
  });

  test("the suppressed row is the design §7.2 copy, split only where its link starts", () => {
    assert.equal(labels.REFERENCE.suppressedRow, `${labels.REFERENCE.suppressedRowLead}${labels.REFERENCE.suppressedRowLink}`);
    assert.ok(DESIGN.replace(/\s+/g, " ").includes(`\`${labels.REFERENCE.suppressedRow}\``), "design §7.2 names the suppressed values with this copy");
    assert.throws(() => labels.withheldReason("wait.p90_s"), RangeError);
  });

  test("the primary delta caption follows design P-7: the §7.2 heading when lower is better, normalized when higher", () => {
    assert.ok(DESIGN.includes(`wait.p90_s · ${labels.primaryDeltaCaption("lower_is_better")}`), "the §7.2 verdict mockup heading");
    assert.equal(labels.primaryDeltaCaption("higher_is_better"), labels.CHART_TEXT.normalizedDelta);
    assert.ok(!labels.primaryDeltaCaption("higher_is_better").includes(labels.VERDICT.perSeedDelta));
    assert.ok(!labels.candidateMinusBaseline(labels.VERDICT.meanDelta).includes(labels.VERDICT.leftIsBetter));
  });
});
