// Determinism, in-process part (contract 10, design 5.4 and 9.5): the same scenario and seed give one event-log digest
// twice in one process, whether the world is rebuilt or reused, and a frozen experiment replays to the same payload.
// The packed-file part of this suite belongs to the pack build.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import { createRun } from "../src/model/engine.js";
import { freezeSpec, runExperimentSpec } from "../src/model/experiment.js";
import { runDigest } from "../src/model/invariants.js";
import { computeAll } from "../src/model/metrics.js";
import { presetById, seedSet } from "../src/model/presets.js";
import { applyAxis, defaultScenario } from "../src/model/schema.js";
import { buildWorld, worldDigest } from "../src/model/world.js";

const eventsDigest = (result) => createHash("sha256").update(JSON.stringify(result.events)).digest("hex");

/** The design 5.9 reference preset: the Bay teaching map with 150 cars. */
function reference(sigma) {
  let s = defaultScenario();
  for (const [area, n] of [["SF", 50], ["PEN", 30], ["SJ", 40], ["EB", 30]]) s = applyAxis(s, `parameter:SUP-1.${area}`, n);
  s.sigma_permille = sigma;
  return s;
}

describe("one scenario and seed, one event-log digest", () => {
  for (const sigma of [0, 150]) {
    test(`reference preset at σ ${sigma / 1000}, seed 1001`, () => {
      const scenario = reference(sigma);
      const worldA = buildWorld(scenario, { seed: 1001 });
      const worldB = buildWorld(scenario, { seed: 1001 });
      assert.equal(worldDigest(worldA), worldDigest(worldB));
      const first = createRun(scenario, worldA, { seed: 1001 }).runToEnd();
      const rebuilt = createRun(scenario, worldB, { seed: 1001 }).runToEnd();
      const reused = createRun(scenario, worldA, { seed: 1001 }).runToEnd();
      assert.ok(first.events.length > 1000, "the log is not trivially empty");
      for (const again of [rebuilt, reused]) {
        assert.equal(eventsDigest(again), eventsDigest(first));
        assert.equal(runDigest(again), runDigest(first));
        assert.deepEqual(again.snapshots, first.snapshots);
        assert.deepEqual(again.counters, first.counters);
      }
      // Logs off changes what is kept, not what happens.
      const quiet = createRun(scenario, worldA, { seed: 1001, keepLogs: false }).runToEnd();
      assert.deepEqual(quiet.events, []);
      assert.deepEqual(computeAll(quiet), computeAll(first));
      assert.deepEqual(quiet.requests, first.requests);
    });
  }

  test("another seed gives another log", () => {
    const scenario = reference(150);
    const a = createRun(scenario, buildWorld(scenario, { seed: 1001 }), { seed: 1001 }).runToEnd();
    const b = createRun(scenario, buildWorld(scenario, { seed: 1002 }), { seed: 1002 }).runToEnd();
    assert.notEqual(eventsDigest(a), eventsDigest(b));
  });
});

describe("a frozen experiment replays to the same payload", () => {
  test("UC-08b on 10 seeds, twice in one process", () => {
    const draft = { ...structuredClone(presetById("UC-08b").experiment), seeds: seedSet(1, 10), resamples: 1000 };
    const first = freezeSpec(draft);
    const second = freezeSpec(structuredClone(draft));
    assert.equal(second.digest, first.digest);
    const a = runExperimentSpec(first.spec);
    const b = runExperimentSpec(second.spec);
    assert.deepEqual(b, a);
    assert.equal(a.verdict.validity, "VALID");
  });
});
