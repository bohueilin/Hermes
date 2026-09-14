// Pairing (design 9.5, P-1, 5.4 item 5, P18): both arms read one frozen world per seed, arm order changes nothing,
// and a demand axis changes only which candidates each arm accepts.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { armScenarios, experimentEnvelope, freezeSpec, seedWorld } from "../src/model/experiment.js";
import { checkArms, runDigest } from "../src/model/invariants.js";
import { computeAll } from "../src/model/metrics.js";
import { createRun } from "../src/model/engine.js";
import { PRESETS, presetById } from "../src/model/presets.js";
import { acceptedRequests, buildWorld, worldDigest } from "../src/model/world.js";

const SEEDS = [1001, 1002];
const specOf = (id, patch = {}) => freezeSpec({ ...structuredClone(presetById(id).experiment), ...patch }).spec;
const run = (scenario, world) => createRun(scenario, world, { seed: world.seed, keepLogs: false }).runToEnd();
const idsOf = (requests) => requests.map((r) => r.id);

describe("both arms share the world digest for every seed (P18)", () => {
  for (const preset of PRESETS.filter((p) => p.experiment !== null)) {
    test(preset.id, () => {
      const spec = freezeSpec(preset.experiment).spec;
      const arms = armScenarios(spec);
      for (const seed of SEEDS) {
        const world = seedWorld(spec, seed);
        const results = [run(arms.baseline, world), run(arms.candidate, world)];
        assert.deepEqual(checkArms(results, world), [], `${preset.id} seed ${seed}`);
        assert.equal(results[0].world_digest, results[1].world_digest);
        // A second build of the same seed is the same world.
        assert.equal(worldDigest(seedWorld(spec, seed)), results[0].world_digest);
      }
      // Different seeds are different worlds.
      assert.notEqual(worldDigest(seedWorld(spec, SEEDS[0])), worldDigest(seedWorld(spec, SEEDS[1])));
    });
  }
});

describe("swapping arm order changes nothing (design 5.4 item 5)", () => {
  // A policy axis, a demand axis without nesting, and a layout axis.
  for (const id of ["L3", "L1", "UC-10"]) {
    test(id, () => {
      const spec = specOf(id);
      const arms = armScenarios(spec);
      const seed = 1003;
      const shared = seedWorld(spec, seed);
      const forward = { baseline: run(arms.baseline, shared), candidate: run(arms.candidate, shared) };
      // Candidate first, on a fresh world and again on the world object the forward order already used.
      const fresh = seedWorld(spec, seed);
      const swappedFresh = { candidate: run(arms.candidate, fresh), baseline: run(arms.baseline, fresh) };
      const swappedShared = { candidate: run(arms.candidate, shared), baseline: run(arms.baseline, shared) };
      for (const swapped of [swappedFresh, swappedShared]) {
        for (const arm of ["baseline", "candidate"]) {
          assert.equal(runDigest(swapped[arm]), runDigest(forward[arm]), `${id} ${arm}`);
          assert.deepEqual(computeAll(swapped[arm]), computeAll(forward[arm]), `${id} ${arm} metrics`);
          assert.deepEqual(swapped[arm].counters, forward[arm].counters, `${id} ${arm} counters`);
        }
      }
    });
  }
});

describe("a demand axis changes accepted requests between arms and nothing else in the world (P-1)", () => {
  // SJ peak 35/h to 50/h: the candidate's rate is at least the baseline's in every hour, so acceptance is nested.
  const spec = specOf("UC-08a", { axis: { id: "parameter:DEM-1.SJ", baseline: 35, candidate: 50 } });
  const arms = armScenarios(spec);
  const envelope = experimentEnvelope(spec);

  test("the envelope is the larger arm's maximum: SJ 50/h is 50,000 thousandths, other areas their own peak", () => {
    assert.deepEqual(envelope, { SF: 60000, PEN: 20000, SJ: 50000, EB: 30000 });
  });

  test("the world is the same whichever arm scenario builds it under the shared envelope", () => {
    for (const seed of SEEDS) {
      const fromDeclared = seedWorld(spec, seed, envelope);
      const fromBaseline = buildWorld(arms.baseline, { seed, lambdaMaxPermille: envelope });
      const fromCandidate = buildWorld(arms.candidate, { seed, lambdaMaxPermille: envelope });
      assert.equal(worldDigest(fromBaseline), worldDigest(fromDeclared));
      assert.equal(worldDigest(fromCandidate), worldDigest(fromDeclared));
      for (const [key, dir, qh] of [["H2", "SF>SJ", 74], ["IN-SJ", "-", 70], ["ACC-SJ-1", "IN", 120]]) {
        assert.equal(fromCandidate.trafficPpm(key, dir, qh), fromBaseline.trafficPpm(key, dir, qh));
      }
      assert.equal(fromCandidate.ridePpm("r-SJ-7"), fromBaseline.ridePpm("r-SJ-7"));
    }
  });

  test("the candidate accepts every baseline request at the same second with the same destination, and more in SJ only", () => {
    const world = seedWorld(spec, 1001, envelope);
    const base = acceptedRequests(world, arms.baseline);
    const cand = acceptedRequests(world, arms.candidate);
    const candById = new Map(cand.map((r) => [r.id, r]));
    for (const r of base) assert.deepEqual(candById.get(r.id), r);
    const extra = cand.filter((r) => !base.some((b) => b.id === r.id));
    assert.ok(extra.length > 0, "the higher SJ peak accepts more requests");
    assert.ok(extra.every((r) => r.origin === "SJ"));
    for (const area of ["SF", "PEN", "EB"]) {
      assert.deepEqual(cand.filter((r) => r.origin === area), base.filter((r) => r.origin === area));
    }
    // The engine reads exactly these requests.
    assert.deepEqual(idsOf(run(arms.baseline, world).requests), idsOf(base));
    assert.deepEqual(idsOf(run(arms.candidate, world).requests), idsOf(cand));
  });

  test("a demand shape axis without nesting still draws from one candidate stream", () => {
    const l1 = specOf("L1");
    const l1Arms = armScenarios(l1);
    const world = seedWorld(l1, 1001);
    const flat = acceptedRequests(world, l1Arms.baseline);
    const peaked = acceptedRequests(world, l1Arms.candidate);
    assert.notDeepEqual(idsOf(flat), idsOf(peaked));
    for (const r of [...flat, ...peaked]) {
      const k = Number(r.id.slice(r.id.lastIndexOf("-") + 1));
      assert.equal(world.candidates[r.origin].t_s[k], r.time_s, r.id);
    }
  });

  test("a non-demand axis leaves the accepted requests identical", () => {
    const uc08b = specOf("UC-08b");
    const uc08bArms = armScenarios(uc08b);
    const world = seedWorld(uc08b, 1002);
    assert.deepEqual(acceptedRequests(world, uc08bArms.candidate), acceptedRequests(world, uc08bArms.baseline));
  });
});
