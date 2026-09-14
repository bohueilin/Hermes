// Determinism, packed-file part (contract section 10, design §9.4 and §9.5): pack the playground into
// dist/fleetlab-playground.html, pull the worker bundle out of the packed file, run it under node:vm with a fake worker
// scope, send run_window for the default preset and one seed, and require the event-log digest, metrics, series and
// invariant result of an in-process run of the same scenario and seed.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { createRun } from "../src/model/engine.js";
import { computeAll, computeSeries } from "../src/model/metrics.js";
import { DEFAULT_PRESET_ID, presetById } from "../src/model/presets.js";
import { cloneScenario } from "../src/model/schema.js";
import { buildWorld, worldDigest } from "../src/model/world.js";
import { CONTENT_SECURITY_POLICY, main as packMain } from "../tools/pack.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = join(REPO_ROOT, "dist/fleetlab-playground.html");
const SEED = 1001;

const eventsDigest = (events) => createHash("sha256").update(JSON.stringify(events)).digest("hex");

/** Runs the packed worker source in a fresh context whose `self` is a worker scope; resolves with its messages. */
function runPackedWorker(source, message) {
  class WorkerGlobalScope {}
  const self = new WorkerGlobalScope();
  const posted = [];
  const settled = new Promise((resolve) => {
    // A browser structured-clones every posted message; cloning here also brings the payload into this realm.
    self.postMessage = (data) => {
      const copy = structuredClone(data);
      posted.push(copy);
      if (copy.type === "result" || copy.type === "error") resolve(copy);
    };
  });
  const context = vm.createContext({ self, WorkerGlobalScope, setTimeout, clearTimeout, performance, structuredClone });
  vm.runInContext(source, context, { filename: "fleetlab-worker-bundle.js" });
  assert.equal(typeof self.onmessage, "function", "the packed worker binds onmessage in a worker scope");
  assert.deepEqual(posted, [{ type: "ready" }], "the packed worker posts ready once after loading");
  // A worker receives a copy made in its own realm, so the message is parsed inside the context: the model's
  // canonical JSON accepts only plain objects of the realm it runs in.
  context.FLEETLAB_TEST_MESSAGE = JSON.stringify(message);
  vm.runInContext("self.onmessage({ data: JSON.parse(FLEETLAB_TEST_MESSAGE) });", context);
  return settled.then((last) => ({ last, posted }));
}

test("the packed worker gives the in-process event-log digest and metrics for the default preset and one seed", async () => {
  const output = [];
  const status = packMain(["--out", OUT], { log: (line) => output.push(line), error: (line) => output.push(line) });
  assert.equal(status, 0, output.join("\n"));
  const html = readFileSync(OUT, "utf8");
  assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`));

  const literal = html.match(/^const FLEETLAB_WORKER_SOURCE = (".*");$/m);
  assert.ok(literal, "the packed file defines the worker source as one string literal");
  const source = JSON.parse(literal[1]);
  assert.ok(!source.includes("import.meta") && !/^\s*(?:import|export)\s/m.test(source), "the worker bundle holds no module syntax");

  const scenario = cloneScenario(presetById(DEFAULT_PRESET_ID).scenario);
  const { last, posted } = await runPackedWorker(source, { type: "run_window", id: "packed-1", scenario, seeds: [SEED], logSeed: SEED });
  assert.equal(last.type, "result", last.message);
  assert.equal(last.id, "packed-1");
  assert.deepEqual(posted.filter((m) => m.type === "progress").map((m) => [m.done, m.total]), [[0, 1]]);

  const world = buildWorld(scenario, { seed: SEED });
  const expected = createRun(scenario, world, { seed: SEED, keepLogs: true }).runToEnd();
  const { runs, log } = last.payload;
  assert.equal(runs.length, 1);
  assert.equal(log.seed, SEED);
  assert.ok(expected.events.length > 1000, "the log is not trivially empty");
  assert.equal(eventsDigest(log.events), eventsDigest(expected.events), "one event-log digest in the packed worker and in process");
  assert.equal(runs[0].world_digest, worldDigest(world));
  assert.deepEqual(runs[0].metrics, computeAll(expected));
  assert.deepEqual(runs[0].series, computeSeries(expected, scenario));
  assert.deepEqual(runs[0].invariant_violations, expected.invariant_violations);
  assert.deepEqual(log.snapshots, expected.snapshots);
});
