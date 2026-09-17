// Learn captions (design H-9, §9.5 captions suite): a caption states a direction only when this file runs its preset
// and asserts that direction; every other caption uses the run-it-and-see form.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { presetById } from "../src/model/presets.js";
import { metricWords } from "../src/ui/charts.js";
import { tradeOffSentence } from "../src/ui/experiment.js";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import * as learn from "../src/ui/learn.js";
import { frameAt } from "../src/ui/playback.js";
import { longestBayWait, PRESENT_PRESET_ID, queueClearedAt } from "../src/ui/present.js";
import { depotView } from "../src/ui/inspector.js";
import { experimentPayload, frozenExperiment, ops01Payload, presetScenario, windowPayload } from "./helpers/model-payloads.mjs";

/** Words that state a direction. */
const DIRECTION = /\b(lower|higher|unchanged|more|fewer|less|rises?|rising|falls?|falling|longer|shorter|slower|faster|increases?|increased|decreases?|decreased|grows?|drops?|up|down|above|below|better|worse)\b/i;

const HOUR = 3600;

/** The series of a Learn preset's replay (seed 1001 of seed set 1). */
async function series(presetId) {
  const payload = await windowPayload({ presetId, seeds: [1001] });
  return payload.runs[0].series;
}

/** Index of the reporting bucket that holds second `t_s`. */
function bucketAt(s, t_s) {
  const i = s.starts_s.findIndex((start, k) => start <= t_s && (k + 1 === s.starts_s.length || s.starts_s[k + 1] > t_s));
  assert.ok(i >= 0, `a bucket holds ${String(t_s)} s`);
  return i;
}

/** Every area's declared requests per hour are higher in the bucket at `hour` than in the hour before. */
async function demandRisesAt(presetId, hour) {
  const scenario = presetById(presetId).scenario;
  const peak = scenario.peaks.find((p) => p.start_h === hour);
  assert.ok(peak, `a peak window of the preset starts at ${String(hour)}:00`);
  assert.equal(scenario.demand_shape, "peaked");
  const demand = (await series(presetId)).demand_by_hour;
  const now = bucketAt(demand, hour * HOUR);
  const before = bucketAt(demand, (hour - 1) * HOUR);
  for (const area of scenario.areas) {
    const { declared_per_h } = demand.areas[area.id];
    // Inside a peak window the profile is the area's peak rate; the hour before is off-peak.
    assert.equal(declared_per_h[now], area.peak_per_h, `${area.id} peak rate`);
    assert.equal(declared_per_h[before], area.offpeak_per_h, `${area.id} off-peak rate`);
    assert.ok(declared_per_h[now] > declared_per_h[before], `${area.id}: ${String(declared_per_h[now])} is more than ${String(declared_per_h[before])}`);
  }
}

/** The finding each directional caption states, asserted on its preset. */
const ASSERTIONS = {
  // L1 peaks are 07:00 to 09:00 and 16:00 to 19:00 (design DEM-3); SF 60 against 8, PEN 20 against 8, SJ 35 against 10,
  // EB 30 against 8 requests per hour.
  "learn.L1.m1": () => demandRisesAt("L1", 7),
  "learn.L1.m2": () => demandRisesAt("L1", 16),
  // L3 sets highways to ×1.6 in both directions from 16:00 to 19:00 (design §3.5); 15:00 to 16:00 is ×1.0. The moment
  // moved from 18:30 to 17:14 (the replay's SF-005 trip end, see presets.js), still inside the ×1.6 hours: 17:14 falls in
  // the 17:00 bucket and 15:30 in the 15:00 bucket. The assertion also reads the moment's own clock from the preset.
  "learn.L3.m1": async () => {
    const clock_s = presetById("L3").moments[0].clock_s;
    assert.equal(clock_s, 17 * HOUR + 14 * 60); // 61200 + 840 = 62040
    const traffic = (await series("L3")).traffic_by_hour;
    const row = traffic.HIGHWAY["SJ>SF"];
    const atMoment = row[bucketAt(traffic, clock_s)];
    const at1530 = row[bucketAt(traffic, 15 * HOUR + 1800)];
    assert.equal(atMoment, 1600);
    assert.equal(at1530, 1000);
    assert.ok(atMoment > at1530, "a larger multiplier is a slower highway");
  },
  // L1's fleet-state stack counts car-seconds per hour; divided by 3,600 it is cars on average. Seed 1001 at σ 0 (review
  // run): 1.89 cars at a depot in the 17:00 hour, inside the 16:00 to 19:00 peak, and 6.50 in the 20:00 hour.
  "learn.L1.m4": async () => {
    const clock_s = presetById("L1").moments[3].clock_s;
    assert.equal(clock_s, 20 * HOUR + 30 * 60); // 72000 + 1800 = 73800
    const scenario = presetById("L1").scenario;
    assert.ok(scenario.peaks.some((p) => p.start_h <= 17 && 17 < p.end_h), "17:00 is inside a peak window");
    assert.ok(!scenario.peaks.some((p) => p.start_h <= 20 && 20 < p.end_h), "20:00 is after every peak window");
    const stack = (await series("L1")).fleet_state;
    const atDepot = (t_s) => stack.families.atDepot[bucketAt(stack, t_s)] / HOUR;
    const inPeak = atDepot(17 * HOUR);
    const after = atDepot(clock_s);
    assert.ok(after > inPeak, `${String(after)} cars at a depot in the 20:00 hour is more than ${String(inPeak)} in the 17:00 hour`);
  },
};

const MOMENTS = labels.LEARN_CASES.flatMap((c) => learn.learnCase(c.id).moments.map((m) => ({ caseId: c.id, ...m })));

describe("caption form", () => {
  test("the direction detector catches direction words and passes plain ones", () => {
    for (const text of ["wait is higher", "Fewer cars", "the queue rises", "slower at 18:30", "UNCHANGED"]) assert.match(text, DIRECTION);
    for (const text of ["read the fleet-state stack", "open the fork", "drives home", "Run it and see."]) assert.doesNotMatch(text, DIRECTION);
  });

  test("every Learn moment has a caption of exactly two sentences: what to look at, then a finding or the fallback", () => {
    assert.equal(MOMENTS.length, 11);
    for (const m of MOMENTS) {
      const look = labels.LEARN_LOOK[m.key];
      const second = labels.LEARN_FINDINGS[m.key] ?? labels.LEARN_CAPTIONS[m.key];
      assert.equal(m.caption, `${look} ${second}`);
      assert.equal(m.caption.split(/(?<=\.)\s+(?=[A-Z])/).length, 2, m.key);
      assert.doesNotMatch(look, DIRECTION, `${m.key}: the look sentence states no direction`);
    }
  });

  test("a look sentence that names a clock names its moment's clock", () => {
    for (const m of MOMENTS) {
      const named = labels.LEARN_LOOK[m.key].match(/D[12] [0-9]{2}:[0-9]{2}/);
      if (named) assert.equal(named[0], format.clock(m.clock_s), m.key);
    }
  });

  test("a caption with no asserted finding ends with the run-it-and-see form", () => {
    for (const m of MOMENTS.filter((x) => labels.LEARN_FINDINGS[x.key] === undefined)) {
      assert.ok(m.caption.endsWith(` ${labels.RUN_IT_AND_SEE}`), m.key);
      assert.doesNotMatch(m.caption, DIRECTION, `${m.key} states no direction`);
    }
    assert.match(labels.RUN_IT_AND_SEE, /^run it and see\.$/i);
  });

  test("every finding states a direction and has its assertion here, and no assertion is left without a finding", () => {
    assert.deepEqual(Object.keys(labels.LEARN_FINDINGS).sort(), Object.keys(ASSERTIONS).sort());
    for (const text of Object.values(labels.LEARN_FINDINGS)) assert.match(text, DIRECTION);
    for (const key of Object.keys(ASSERTIONS)) assert.ok(MOMENTS.some((m) => m.key === key), `${key} is a Learn moment`);
  });
});

describe("caption directions asserted on their presets (H-9)", () => {
  for (const [key, assertDirection] of Object.entries(ASSERTIONS)) {
    test(`${key}: ${labels.LEARN_FINDINGS[key]}`, async () => {
      await assertDirection();
    });
  }
});

// The walkthrough's narration is generated from the run, so the same rule holds for it: a sentence may state a
// direction only where this file runs OPS-01 and asserts it. The comparing lines choose their words from two clocks
// the replay produced; these tests are the pins behind those words (demo plan section 4.7).

/** Paired seeds the casebook's OPS-01 declares, which is what the walkthrough freezes and runs. */
const VERDICT_SEEDS = 20;

describe("the walkthrough's copy states no direction of its own (H-9)", () => {
  test("every string of PRESENT passes the direction scan", () => {
    const out = [];
    const walk = (value, path) => {
      if (typeof value === "string") out.push({ path, text: value });
      else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${String(i)}]`));
      else if (value !== null && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    };
    walk(labels.PRESENT, "PRESENT");
    assert.ok(out.length > 40, `only ${String(out.length)} strings reached`);
    assert.deepEqual(out.filter((s) => DIRECTION.test(s.text)).map((s) => `${s.path}: ${s.text}`), []);
  });
});

describe("the walkthrough's comparing lines, pinned on OPS-01 at seed 1001 and seed set 1 (H-9)", () => {
  test("the car that waited longest for a bay at SF-2 is ready after the release, and its line says so", async () => {
    const payload = await ops01Payload();
    const scenario = presetScenario(PRESENT_PRESET_ID);
    const release_s = scenario.policies.release_s;
    const waited = longestBayWait(payload.log, "SF-2", release_s);
    assert.ok(waited !== null && waited.ready_s !== null, "this replay has such a car");
    assert.ok(waited.ready_s > release_s, `${format.clock(waited.ready_s)} is after the release at ${format.clock(release_s)}`);
    const line = labels.narrationPinnedBay({
      car: waited.car,
      took: format.clock(waited.took_s),
      ready: format.clock(waited.ready_s),
      release: format.clock(release_s),
      before: waited.ready_s < release_s,
    });
    assert.match(line, /after the release/);
    assert.doesNotMatch(line, /before the release/);
  });

  test("SF-2's bay queue clears after a backlog and before the release, and its line says so", async () => {
    const payload = await ops01Payload();
    const scenario = presetScenario(PRESENT_PRESET_ID);
    const release_s = scenario.policies.release_s;
    const recall_s = scenario.policies.recall_s;
    const cleared = queueClearedAt(payload.log, "SF-2", recall_s);
    assert.ok(cleared !== null, "the queue empties inside this run");
    // `cleared` has to be the second a queue that held cars ran out, not any second whose count reads zero: the
    // minutes just after the recall read zero because the backlog has not built yet, and they satisfy the release
    // comparison below just as well. So pin the backlog itself.
    const queued = payload.log.snapshots
      .filter((snapshot) => snapshot.t > recall_s && snapshot.t < cleared)
      .map((snapshot) => depotView(payload.log, "SF-2", snapshot.t).queued);
    assert.ok(Math.max(...queued) >= 20, `SF-2 stood ${String(Math.max(...queued))} cars deep before it cleared`);
    assert.ok(cleared < release_s, `${format.clock(cleared)} is before the release at ${format.clock(release_s)}`);
    const line = labels.narrationQueueCleared({ depot: "SF-2", cleared: format.clock(cleared), release: format.clock(release_s), before: cleared < release_s });
    assert.match(line, /before the release/);
    assert.doesNotMatch(line, /after the release/);
  });

  test("the frame beat's two clocks carry their seconds, so they cannot read the same while the frame says interpolated", async () => {
    const payload = await ops01Payload();
    const scenario = presetScenario(PRESENT_PRESET_ID);
    // A second inside the same minute as its snapshot: the frame line and the narration are about exactly this gap.
    const frame = frameAt(payload.log, scenario.policies.recall_s + 900 + 31, { interpolate: true });
    assert.notEqual(frame.at_s, frame.snapshot_t, "this frame is drawn past its snapshot");
    assert.equal(format.clock(frame.at_s), format.clock(frame.snapshot_t), "and inside the same minute");
    const sentence = labels.narrationFrame({ snapshot: format.clockSeconds(frame.snapshot_t), drawn: format.clockSeconds(frame.at_s) });
    assert.ok(sentence.includes(format.clockSeconds(frame.snapshot_t)) && sentence.includes(format.clockSeconds(frame.at_s)));
    assert.notEqual(format.clockSeconds(frame.at_s), format.clockSeconds(frame.snapshot_t), "the sentence names two seconds, never one twice");
    const line = labels.frameLine({ snapshot: format.clockSeconds(frame.snapshot_t), drawn: format.clockSeconds(frame.at_s), interpolated: true });
    assert.ok(line.includes(labels.PRESENT.simulation.interpolated));
  });

  test("the trade-off sentence names the primary that improved and the guardrail that was harmed", async () => {
    const frozen = frozenExperiment({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS });
    const { verdict } = await experimentPayload({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS });
    assert.equal(verdict.validity, "VALID");
    assert.equal(verdict.outcome, "IMPROVED");
    const harmed = verdict.guardrail_statuses.find((g) => g.status === "REGRESSED");
    assert.ok(harmed, "a guardrail was harmed, which is what makes this a trade");
    // Both of OPS-01's metrics are declared lower is better, so an improved primary went down and a harmed guardrail
    // went up. The words are read here from the declared directions, not from the order of the sentence's two halves.
    assert.equal(frozen.spec.primary.direction, "lower_is_better");
    const harmedIndex = verdict.guardrail_statuses.indexOf(harmed);
    assert.equal(frozen.spec.guardrails[harmedIndex].direction, "lower_is_better");
    const sentence = tradeOffSentence({ verdict, frozen });
    assert.equal(sentence, `${labels.TRADE_WORDS.lower} ${metricWords(verdict.primary.metric)}, ${labels.TRADE_WORDS.higher} ${metricWords(harmed.metric)}`);
    // The two direction words are the gates' own, and each names the metric the gate decided on.
    assert.match(sentence, DIRECTION);
    assert.ok(sentence.startsWith(`${labels.TRADE_WORDS.lower} `), sentence);
  });

  test("a metric declared higher is better turns both words round, because improved means it went up", async () => {
    const frozen = frozenExperiment({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS });
    const { verdict } = await experimentPayload({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS });
    const harmed = verdict.guardrail_statuses.find((g) => g.status === "REGRESSED");
    const harmedIndex = verdict.guardrail_statuses.indexOf(harmed);
    // The same run read under the other declaration: IMPROVED and REGRESSED are already normalised for direction
    // (src/instrument/outcome.js), so a primary declared higher is better improved by rising, and a guardrail
    // declared higher is better was harmed by falling.
    const flipped = {
      ...frozen,
      spec: {
        ...frozen.spec,
        primary: { ...frozen.spec.primary, direction: "higher_is_better" },
        guardrails: frozen.spec.guardrails.map((g, i) => (i === harmedIndex ? { ...g, direction: "higher_is_better" } : g)),
      },
    };
    const sentence = tradeOffSentence({ verdict, frozen: flipped });
    assert.equal(sentence, `${labels.TRADE_WORDS.higher} ${metricWords(verdict.primary.metric)}, ${labels.TRADE_WORDS.lower} ${metricWords(harmed.metric)}`);
  });

  test("a run with no harmed guardrail names no trade", async () => {
    const frozen = frozenExperiment({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS });
    const { verdict } = await experimentPayload({ presetId: PRESENT_PRESET_ID, replications: VERDICT_SEEDS });
    const kept = { ...verdict, guardrail_statuses: verdict.guardrail_statuses.map((g) => ({ ...g, status: "WITHIN" })) };
    assert.equal(tradeOffSentence({ verdict: kept, frozen }), null);
  });
});
