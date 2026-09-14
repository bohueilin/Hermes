import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MAIN_SLICE_MS,
  READY_TIMEOUT_MS,
  STEP_EVENTS,
  createDrivers,
  createHost,
  createWorkerHandler,
  runMessage,
  runSliced,
} from "../src/runtime/protocol.js";

const PLAYGROUND_ROOT = fileURLToPath(new URL("../", import.meta.url));

// ---------------------------------------------------------------------------------------------------------------
// Fakes: a manual task loop with a fake millisecond clock, a fake model api, and a fake worker that runs the real
// handler on the same loop and structured-clones every message both ways, as a browser worker does.
// ---------------------------------------------------------------------------------------------------------------

function createLoop() {
  let clock = 0;
  let queue = [];
  return {
    now: () => clock,
    advance(ms) {
      clock += ms;
    },
    schedule(fn) {
      queue.push(fn);
    },
    /** Runs the tasks queued so far; tasks they queue wait for the next call. */
    runPending() {
      const batch = queue;
      queue = [];
      for (const fn of batch) fn();
      return batch.length;
    },
    get pending() {
      return queue.length;
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Turns the loop until `promise` settles; fails when the loop goes idle first. */
async function settle(loop, promise, maxRounds = 20000) {
  let outcome = null;
  promise.then(
    (value) => {
      outcome = { value };
    },
    (error) => {
      outcome = { error };
    },
  );
  for (let round = 0; round < maxRounds; round += 1) {
    await flush();
    if (outcome) return outcome;
    if (loop.pending === 0) break;
    loop.runPending();
  }
  await flush();
  if (outcome) return outcome;
  throw new Error("the loop stopped before the run settled");
}

const SCENARIO = { name: "fake_map", events: 3000 }; // 3000 / 250 events per step = 12 steps per run

function createFakeApi(loop, { stepCost = 3, failSeed = null } = {}) {
  const calls = { buildWorld: [], steps: 0 };
  const api = {
    buildWorld(scenario, options) {
      calls.buildWorld.push(structuredClone(options));
      const lmax = options.lambdaMaxPermille === undefined ? "own" : JSON.stringify(options.lambdaMaxPermille);
      return Object.freeze({ digest: `world-${scenario.name}-${options.seed}-${lmax}` });
    },
    createRun(scenario, world, { seed, keepLogs }) {
      if (seed === failSeed) throw new Error(`fake model rule broke at seed ${seed}`);
      let remaining = scenario.events;
      return {
        step(maxEvents) {
          loop.advance(stepCost);
          calls.steps += 1;
          remaining -= maxEvents;
          return remaining <= 0;
        },
        result() {
          return {
            scenario_digest: `scenario-${scenario.name}`,
            world_digest: world.digest,
            seed,
            events: keepLogs ? [{ ord: 0, t: 18000, kind: "REQUEST_CREATED", req: `r-SF-${seed}` }] : [],
            intervals: keepLogs ? { "SF-001": [{ state: "IDLE", t0: 18000, t1: 18060, location: { area: "SF" } }] } : {},
            visits: [],
            requests: [{ id: `r-SF-${seed}`, time_s: 18000, origin: "SF", dest: "PEN" }],
            cars: ["SF-001"],
            depots: ["SF-1"],
            drain_end_s: 122400,
            snapshots: keepLogs ? [{ t: 18000 }] : [],
            invariant_violations: [],
            counters: { events: scenario.events },
          };
        },
      };
    },
    computeAll(result) {
      return { "wait.p90_s": { value: result.seed * 2 }, "unserved.fraction": { absent: "no requests in scope" } };
    },
    computeSeries(result, scenario) {
      return { demand_by_hour: [result.seed, scenario.events], traffic_by_hour: [{ absent: "outside the window" }] };
    },
    freezeSpec(draft) {
      return { spec: { ...draft, frozen: true }, digest: "ab".repeat(32), label: "playground-spec:abababab" };
    },
    *experimentSteps(spec) {
      const total = spec.seeds.length;
      for (let i = 0; i < total; i += 1) {
        yield { done: i, total, label: `Seed ${i + 1} of ${total}, both arms` };
        for (let k = 0; k < 3; k += 1) {
          loop.advance(stepCost);
          calls.steps += 1;
          yield { done: i, total, label: `Seed ${i + 1} of ${total}, both arms` };
        }
      }
      return {
        verdict: { outcome: "fake outcome", frozen: spec.frozen },
        lambdaMaxPermille: { SF: 60000 },
        per_seed: spec.seeds.map((seed) => ({ seed, baseline_metrics: { a: seed }, candidate_metrics: { a: seed + 1 } })),
      };
    },
  };
  return { api, calls };
}

/** A fake worker. `silent` never posts; otherwise it builds the real handler in its first task. */
function createFakeWorker(loop, api, { silent = false } = {}) {
  let handle = null;
  const worker = {
    onmessage: null,
    onerror: null,
    terminated: false,
    received: [],
    posted: [],
    postMessage(message) {
      if (worker.terminated) return;
      const data = structuredClone(message);
      worker.received.push(data);
      if (!silent) loop.schedule(() => handle && !worker.terminated && handle(data));
    },
    terminate() {
      worker.terminated = true;
    },
  };
  if (!silent) {
    loop.schedule(() => {
      const post = (message) => {
        const data = structuredClone(message);
        worker.posted.push(data);
        loop.schedule(() => {
          if (!worker.terminated && worker.onmessage) worker.onmessage({ data });
        });
      };
      handle = createWorkerHandler(api, post, { now: loop.now, schedule: loop.schedule });
    });
  }
  return worker;
}

function throwingFactory() {
  throw new Error("workers are blocked here");
}

const WINDOW_ARGS = { scenario: SCENARIO, seeds: [1001, 1002], logSeed: 1002 };
const PAIR_ARGS = {
  baseline: SCENARIO,
  candidate: { ...SCENARIO, events: 2000 },
  seed: 1001,
  lambdaMaxPermille: { SF: 60000, PEN: 20000, SJ: 35000, EB: 30000 },
};
const EXPERIMENT_ARGS = { spec: { question: "fake", seeds: [1001, 1002, 1003] } };

/** Runs all three run kinds on one host and records payloads, progress and world calls. */
async function runAll(path) {
  const loop = createLoop();
  const { api, calls } = createFakeApi(loop);
  const worker = path === "worker" ? createFakeWorker(loop, api) : null;
  const host = createHost({
    createWorker: path === "worker" ? () => worker : throwingFactory,
    drivers: createDrivers(api),
    now: loop.now,
    schedule: loop.schedule,
  });
  const progress = { window: [], pair: [], experiment: [] };
  const windowRun = await settle(loop, host.runWindow(WINDOW_ARGS, { onProgress: (p) => progress.window.push(p) }));
  const pairRun = await settle(loop, host.runPair(PAIR_ARGS, { onProgress: (p) => progress.pair.push(p) }));
  const experimentRun = await settle(
    loop,
    host.runExperiment(EXPERIMENT_ARGS, { onProgress: (p) => progress.experiment.push(p) }),
  );
  return { host, worker, calls, progress, windowRun, pairRun, experimentRun };
}

// ---------------------------------------------------------------------------------------------------------------

describe("worker path and main-thread path", () => {
  test("give identical payloads, progress and world options for one fake scenario and seed set", async () => {
    const viaWorker = await runAll("worker");
    const viaMain = await runAll("main thread");
    assert.equal(viaWorker.host.path, "worker");
    assert.equal(viaMain.host.path, "main thread");
    assert.equal(await viaWorker.host.ready, "worker");
    assert.equal(await viaMain.host.ready, "main thread");
    for (const key of ["windowRun", "pairRun", "experimentRun"]) {
      assert.equal(viaWorker[key].error, undefined, `${key} on the worker path`);
      assert.equal(viaMain[key].error, undefined, `${key} on the main thread`);
      assert.deepEqual(viaWorker[key].value, viaMain[key].value, key);
    }
    assert.deepEqual(viaWorker.progress, viaMain.progress);
    assert.deepEqual(viaWorker.calls.buildWorld, viaMain.calls.buildWorld);
    // The worker path really ran in the worker: every run message crossed, and nothing was terminated.
    assert.deepEqual(viaWorker.worker.received.map((m) => m.type), ["run_window", "run_pair", "run_experiment"]);
    assert.equal(viaWorker.worker.terminated, false);
  });

  test("payloads have exactly the contract section 7 shapes", async () => {
    const { windowRun, pairRun, experimentRun } = await runAll("main thread");
    const win = windowRun.value;
    assert.deepEqual(Object.keys(win).sort(), ["log", "runs"]);
    assert.deepEqual(win.runs.map((r) => r.seed), [1001, 1002]);
    for (const run of win.runs) {
      assert.deepEqual(Object.keys(run).sort(), ["invariant_violations", "metrics", "seed", "series", "world_digest"]);
    }
    // No lambdaMaxPermille in the message: buildWorld receives no envelope and uses the scenario's own.
    assert.equal(win.runs[0].world_digest, "world-fake_map-1001-own");
    assert.deepEqual(
      Object.keys(win.log).sort(),
      ["cars", "depots", "drain_end_s", "events", "intervals", "requests", "seed", "snapshots", "visits"],
    );
    assert.equal(win.log.seed, 1002);
    assert.equal(win.log.events[0].req, "r-SF-1002");

    const pair = pairRun.value;
    assert.deepEqual(Object.keys(pair).sort(), ["baseline", "candidate", "world_digest"]);
    assert.equal(pair.world_digest, 'world-fake_map-1001-{"SF":60000,"PEN":20000,"SJ":35000,"EB":30000}');
    for (const arm of [pair.baseline, pair.candidate]) {
      assert.deepEqual(Object.keys(arm).sort(), ["log", "metrics", "series"]);
      assert.equal(arm.log.seed, 1001);
    }
    assert.deepEqual(pair.candidate.series.demand_by_hour, [1001, 2000]);

    const exp = experimentRun.value;
    assert.deepEqual(Object.keys(exp).sort(), ["digest", "label", "lambdaMaxPermille", "per_seed", "verdict"]);
    assert.equal(exp.digest, "ab".repeat(32));
    assert.equal(exp.label, "playground-spec:abababab");
    assert.equal(exp.verdict.frozen, true, "the experiment runs the spec returned by freezeSpec");
    assert.deepEqual(Object.keys(exp.per_seed[0]).sort(), ["baseline_metrics", "candidate_metrics", "seed"]);
  });

  test("a window without a log seed carries no log", async () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    const host = createHost({ createWorker: throwingFactory, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    const { value } = await settle(loop, host.runWindow({ scenario: SCENARIO, seeds: [7] }));
    assert.deepEqual(Object.keys(value), ["runs"]);
  });
});

describe("fallback to the main thread", () => {
  test("a throwing factory chooses the main thread at once", async () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    const host = createHost({ createWorker: throwingFactory, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    assert.equal(host.path, "main thread");
    assert.equal(await host.ready, "main thread");
    const { value } = await settle(loop, host.runWindow({ scenario: SCENARIO, seeds: [1001] }));
    assert.equal(value.runs.length, 1);
  });

  test("a factory that returns nothing chooses the main thread", () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    const host = createHost({ createWorker: () => undefined, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    assert.equal(host.path, "main thread");
  });

  test("no ready within 1 s of the injected clock terminates the worker and runs queued work on the main thread", async () => {
    const loop = createLoop();
    const { api, calls } = createFakeApi(loop);
    const worker = createFakeWorker(loop, api, { silent: true });
    const host = createHost({ createWorker: () => worker, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    assert.equal(host.path, "starting");
    const run = host.runWindow({ scenario: SCENARIO, seeds: [1001] });

    loop.advance(READY_TIMEOUT_MS - 1);
    loop.runPending();
    await flush();
    assert.equal(host.path, "starting", "999 ms is still inside the wait");
    assert.equal(worker.terminated, false);
    assert.equal(calls.steps, 0, "queued work waits for the choice");

    loop.advance(1);
    loop.runPending();
    assert.equal(host.path, "main thread");
    assert.equal(worker.terminated, true);
    assert.equal(await host.ready, "main thread");
    assert.deepEqual(worker.received, [], "nothing was posted to the silent worker");

    const outcome = await settle(loop, run);
    assert.equal(outcome.error, undefined);
    assert.equal(outcome.value.runs[0].seed, 1001);

    // A ready that arrives late changes nothing.
    worker.onmessage({ data: { type: "ready" } });
    assert.equal(host.path, "main thread");
  });

  test("a worker error before ready falls back and terminates the worker", async () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    const worker = createFakeWorker(loop, api, { silent: true });
    const host = createHost({ createWorker: () => worker, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    worker.onerror({ message: "script failed to load" });
    assert.equal(host.path, "main thread");
    assert.equal(worker.terminated, true);
  });
});

describe("time slicing", () => {
  /** Measures every scheduled task's duration on the fake clock. */
  function measuredSchedule(loop, durations) {
    return (fn) =>
      loop.schedule(() => {
        const start = loop.now();
        fn();
        durations.push(loop.now() - start);
      });
  }

  for (const stepCost of [1, 3, 5, 8]) {
    test(`slices never exceed ${MAIN_SLICE_MS} ms with steps of ${stepCost} ms`, async () => {
      const loop = createLoop();
      const { api, calls } = createFakeApi(loop, { stepCost });
      const durations = [];
      const host = createHost({
        createWorker: throwingFactory,
        drivers: createDrivers(api),
        now: loop.now,
        schedule: measuredSchedule(loop, durations),
      });
      const { value } = await settle(loop, host.runWindow({ scenario: SCENARIO, seeds: [1001, 1002] }));
      assert.equal(value.runs.length, 2);
      // 3000 events / STEP_EVENTS 250 = 12 steps per run, 24 in all.
      assert.equal(STEP_EVENTS, 250);
      assert.equal(calls.steps, 24);
      const slices = durations.filter((d) => d > 0);
      assert.ok(slices.length > 1, "the run was split into several slices");
      for (const d of slices) assert.ok(d <= MAIN_SLICE_MS, `slice of ${d} ms`);
      // Constant cost c: a slice takes floor(8 / c) steps (at least one), so it lasts c × floor(8 / c) ms.
      assert.equal(Math.max(...slices), stepCost * Math.max(1, Math.floor(MAIN_SLICE_MS / stepCost)));
    });
  }

  test("a step longer than the budget runs alone in its slice", async () => {
    const loop = createLoop();
    const durations = [];
    let steps = 0;
    const gen = (function* () {
      for (let i = 0; i < 5; i += 1) {
        loop.advance(12);
        steps += 1;
        yield;
      }
      return "finished";
    })();
    const promise = runSliced(gen, { cancelled: false }, {
      now: loop.now,
      schedule: measuredSchedule(loop, durations),
      budgetMs: MAIN_SLICE_MS,
    });
    const outcome = await settle(loop, promise);
    assert.equal(outcome.value, "finished");
    assert.equal(steps, 5);
    assert.deepEqual(durations.filter((d) => d > 0), [12, 12, 12, 12, 12]);
  });

  test("a later expensive step shortens the next slice", async () => {
    // Costs 1, 1, 6, 1, 1, 1, 1: slice 1 runs 1+1 (elapsed 2, estimate 1, 3 <= 8) then 6 (elapsed 8, estimate 6,
    // 14 > 8, stop). Slice 2: 1 (estimate max(1, 6/2)=3, 1+3 <= 8), 1 (estimate 1.5, 2+1.5 <= 8), 1, 1, done.
    const loop = createLoop();
    const durations = [];
    const costs = [1, 1, 6, 1, 1, 1, 1];
    const gen = (function* () {
      for (const cost of costs) {
        loop.advance(cost);
        yield;
      }
      return costs.length;
    })();
    const promise = runSliced(gen, { cancelled: false }, {
      now: loop.now,
      schedule: measuredSchedule(loop, durations),
      budgetMs: MAIN_SLICE_MS,
    });
    const outcome = await settle(loop, promise);
    assert.equal(outcome.value, 7);
    assert.deepEqual(durations.filter((d) => d > 0), [8, 4]);
  });
});

describe("cancellation", () => {
  test("on the main thread, cancel stops stepping and rejects the run", async () => {
    const loop = createLoop();
    const { api, calls } = createFakeApi(loop);
    const host = createHost({ createWorker: throwingFactory, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    const run = host.runWindow({ scenario: SCENARIO, seeds: [1001, 1002, 1003] });
    const outcome = settle(loop, run);
    for (let i = 0; i < 3; i += 1) loop.runPending();
    const stepsAtCancel = calls.steps;
    assert.ok(stepsAtCancel > 0 && stepsAtCancel < 36);
    host.cancel(run.id);
    const { error } = await outcome;
    assert.equal(error.name, "AbortError");
    for (let i = 0; i < 20; i += 1) loop.runPending();
    assert.equal(calls.steps, stepsAtCancel, "no step ran after cancel");
    assert.equal(loop.pending, 0, "no slice is left scheduled");
  });

  test("on the worker path, cancel posts cancel, the worker stops and posts no result", async () => {
    const loop = createLoop();
    const { api, calls } = createFakeApi(loop);
    const worker = createFakeWorker(loop, api);
    const host = createHost({ createWorker: () => worker, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    const progress = [];
    const run = host.runWindow({ scenario: SCENARIO, seeds: [1001, 1002, 1003] }, { onProgress: (p) => progress.push(p) });
    const outcome = settle(loop, run);
    while (calls.steps === 0) loop.runPending();
    host.cancel(run.id);
    const { error } = await outcome;
    assert.equal(error.name, "AbortError");
    // A worker slice queued before the cancel message arrives may still run; after that, stepping stops.
    for (let i = 0; i < 5; i += 1) loop.runPending();
    const stepsAfterCancel = calls.steps;
    for (let i = 0; i < 30; i += 1) loop.runPending();
    assert.equal(calls.steps, stepsAfterCancel, "no step ran once the worker saw the cancel");
    assert.ok(stepsAfterCancel < 36, "the run did not finish");
    assert.equal(loop.pending, 0, "the worker left no slice scheduled");
    assert.deepEqual(worker.received.map((m) => m.type), ["run_window", "cancel"]);
    assert.equal(worker.received[1].id, run.id);
    assert.equal(worker.posted.filter((m) => m.type === "result" || m.type === "error").length, 0);
    const progressAtCancel = progress.length;
    for (let i = 0; i < 10; i += 1) loop.runPending();
    assert.equal(progress.length, progressAtCancel, "no progress reaches the caller after cancel");
  });

  test("cancel with no id cancels every active run, including one queued before the choice", async () => {
    const loop = createLoop();
    const { api, calls } = createFakeApi(loop);
    const worker = createFakeWorker(loop, api, { silent: true });
    const host = createHost({ createWorker: () => worker, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    const a = settle(loop, host.runWindow({ scenario: SCENARIO, seeds: [1] }));
    const b = settle(loop, host.runPair(PAIR_ARGS));
    host.cancel();
    assert.equal((await a).error.name, "AbortError");
    assert.equal((await b).error.name, "AbortError");
    loop.advance(READY_TIMEOUT_MS);
    for (let i = 0; i < 10; i += 1) loop.runPending();
    assert.equal(host.path, "main thread");
    assert.equal(calls.steps, 0, "a cancelled queued run never starts");
  });
});

describe("progress", () => {
  test("reaches the caller by unit of work, without repeats", async () => {
    const { progress } = await runAll("worker");
    assert.deepEqual(progress.window, [
      { done: 0, total: 2, label: "Replication 1 of 2" },
      { done: 1, total: 2, label: "Replication 2 of 2" },
    ]);
    assert.deepEqual(progress.pair, [
      { done: 0, total: 2, label: "Baseline arm" },
      { done: 1, total: 2, label: "Candidate arm" },
    ]);
    // The fake experiment yields each seed's marker four times; the caller sees it once.
    assert.deepEqual(progress.experiment.map((p) => p.label), [
      "Seed 1 of 3, both arms",
      "Seed 2 of 3, both arms",
      "Seed 3 of 3, both arms",
    ]);
  });
});

describe("errors", () => {
  for (const path of ["worker", "main thread"]) {
    test(`a model error rejects the run with its message on the ${path} path`, async () => {
      const loop = createLoop();
      const { api } = createFakeApi(loop, { failSeed: 1002 });
      const worker = path === "worker" ? createFakeWorker(loop, api) : null;
      const host = createHost({
        createWorker: worker ? () => worker : throwingFactory,
        drivers: createDrivers(api),
        now: loop.now,
        schedule: loop.schedule,
      });
      const { error } = await settle(loop, host.runWindow({ scenario: SCENARIO, seeds: [1001, 1002] }));
      assert.ok(error instanceof Error);
      assert.equal(error.message, "fake model rule broke at seed 1002");
      assert.equal(host.path, path);
      // The host still serves the next run.
      const next = await settle(loop, host.runWindow({ scenario: SCENARIO, seeds: [1001] }));
      assert.equal(next.value.runs[0].seed, 1001);
    });
  }

  test("invalid run arguments reject identically on both paths", async () => {
    const messages = [];
    for (const path of ["worker", "main thread"]) {
      const loop = createLoop();
      const { api } = createFakeApi(loop);
      const worker = path === "worker" ? createFakeWorker(loop, api) : null;
      const host = createHost({ createWorker: worker ? () => worker : throwingFactory, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
      messages.push((await settle(loop, host.runWindow({ scenario: SCENARIO, seeds: [] }))).error.message);
      messages.push((await settle(loop, host.runPair({ ...PAIR_ARGS, seed: 1.5 }))).error.message);
    }
    assert.deepEqual(messages, [
      "seeds must be a non-empty array",
      "seed must be a safe integer",
      "seeds must be a non-empty array",
      "seed must be a safe integer",
    ]);
  });

  test("a worker error after ready rejects every pending run", async () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    const worker = createFakeWorker(loop, api);
    const host = createHost({ createWorker: () => worker, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    const run = host.runWindow({ scenario: SCENARIO, seeds: [1001] });
    const outcome = settle(loop, run);
    while (host.path === "starting") loop.runPending();
    await flush();
    worker.onerror({ message: "worker crashed" });
    assert.equal((await outcome).error.message, "worker crashed");
    assert.equal(host.path, "worker");
  });

  test("an experiment whose digest differs from the frozen spec is an error", async () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    const inner = api.experimentSteps;
    api.experimentSteps = function* (spec) {
      const out = yield* inner(spec);
      return { ...out, digest: "cd".repeat(32) };
    };
    const host = createHost({ createWorker: throwingFactory, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    const { error } = await settle(loop, host.runExperiment(EXPERIMENT_ARGS));
    assert.match(error.message, /digest differs/);
  });

  test("the pair driver rejects arms whose world digests differ", async () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    const create = api.createRun;
    api.createRun = (scenario, world, options) => {
      const run = create(scenario, world, options);
      const result = run.result;
      return { step: run.step, result: () => ({ ...result(), world_digest: `${world.digest}-${scenario.events}` }) };
    };
    const host = createHost({ createWorker: throwingFactory, drivers: createDrivers(api), now: loop.now, schedule: loop.schedule });
    const { error } = await settle(loop, host.runPair(PAIR_ARGS));
    assert.equal(error.message, "the two arms do not share one world");
  });
});

describe("worker message handler", () => {
  function handlerHarness(options = {}) {
    const loop = createLoop();
    const { api, calls } = createFakeApi(loop, options);
    const posted = [];
    const handle = createWorkerHandler(api, (m) => posted.push(structuredClone(m)), { now: loop.now, schedule: loop.schedule });
    return { loop, calls, posted, handle };
  }

  async function drain(loop) {
    for (let i = 0; i < 1000 && loop.pending > 0; i += 1) {
      loop.runPending();
      await flush();
    }
    await flush();
  }

  test("posts ready once, first, then progress and result messages with ids", async () => {
    const { loop, posted, handle } = handlerHarness();
    assert.deepEqual(posted, [{ type: "ready" }]);
    handle({ type: "run_window", id: "w1", scenario: SCENARIO, seeds: [5], logSeed: 5 });
    await drain(loop);
    assert.deepEqual(posted.map((m) => m.type), ["ready", "progress", "result"]);
    assert.deepEqual(posted[1], { type: "progress", id: "w1", done: 0, total: 1, label: "Replication 1 of 1" });
    assert.equal(posted[2].id, "w1");
    assert.equal(posted[2].payload.log.seed, 5);
    assert.equal(posted.filter((m) => m.type === "ready").length, 1);
  });

  test("an unknown type and a duplicate active id post errors with the id", async () => {
    const { loop, posted, handle } = handlerHarness();
    handle({ type: "run_everything", id: "x" });
    handle({ type: "run_window", id: "d", scenario: SCENARIO, seeds: [1] });
    handle({ type: "run_window", id: "d", scenario: SCENARIO, seeds: [2] });
    handle(null);
    await drain(loop);
    assert.deepEqual(posted[1], { type: "error", id: "x", message: "unknown message type: run_everything" });
    assert.deepEqual(posted[2], { type: "error", id: "d", message: "a run with id d is already active" });
    assert.equal(posted.filter((m) => m.type === "result").length, 1);
  });

  test("runs with different ids interleave and each finishes", async () => {
    const { loop, posted, handle } = handlerHarness();
    handle({ type: "run_window", id: "a", scenario: SCENARIO, seeds: [1] });
    handle({ type: "run_experiment", id: "b", spec: EXPERIMENT_ARGS.spec });
    await drain(loop);
    const results = posted.filter((m) => m.type === "result").map((m) => m.id).sort();
    assert.deepEqual(results, ["a", "b"]);
  });

  test("a payload that cannot be cloned becomes an error message", async () => {
    const loop = createLoop();
    const { api } = createFakeApi(loop);
    api.computeSeries = () => ({ broken: () => 0 });
    const posted = [];
    const handle = createWorkerHandler(api, (m) => posted.push(structuredClone(m)), { now: loop.now, schedule: loop.schedule });
    handle({ type: "run_window", id: "c", scenario: SCENARIO, seeds: [1] });
    await drain(loop);
    const last = posted[posted.length - 1];
    assert.equal(last.type, "error");
    assert.equal(last.id, "c");
  });

  test("run messages keep only their contract fields", () => {
    assert.deepEqual(runMessage("run_window", "i", { scenario: 1, seeds: [2], logSeed: 2, extra: true }), {
      type: "run_window", id: "i", scenario: 1, seeds: [2], logSeed: 2,
    });
    assert.deepEqual(runMessage("run_experiment", "j", { spec: 3, scenario: 4 }), { type: "run_experiment", id: "j", spec: 3 });
    assert.throws(() => runMessage("cancel", "k", {}), /unknown run type/);
  });
});

describe("entry files", () => {
  const read = (name) => readFileSync(join(PLAYGROUND_ROOT, "src/runtime", name), "utf8");
  const FORBIDDEN = [
    "import.meta", "import(", "fetch(", "WebSocket", "sendBeacon", "XMLHttpRequest", "EventSource", "eval(",
    "new Function", "innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "localStorage",
    "sessionStorage", "indexedDB", "document.cookie", "Math.random", "Date",
  ];

  test("runtime files use no forbidden token and never read import.meta", () => {
    for (const name of ["host.js", "worker.js", "protocol.js"]) {
      const source = read(name);
      for (const token of FORBIDDEN) assert.ok(!source.includes(token), `${name} contains ${token}`);
    }
  });

  test("worker.js imports the model by the contract names and host.js takes its default drivers from it", () => {
    const worker = read("worker.js");
    const imports = [...worker.matchAll(/import \{([^}]+)\} from "([^"]+)"/g)].map((m) => [m[2], m[1].split(",").map((s) => s.trim()).sort()]);
    assert.deepEqual(Object.fromEntries(imports), {
      "../model/metrics.js": ["computeAll", "computeSeries"],
      "../model/engine.js": ["createRun"],
      "../model/experiment.js": ["experimentSteps", "freezeSpec"],
      "../model/world.js": ["buildWorld"],
      "./protocol.js": ["createWorkerHandler"],
    });
    const host = read("host.js");
    assert.match(host, /import \{ MODEL_API \} from "\.\/worker\.js";/);
    assert.match(host, /export function createEngineHost\(/);
    assert.ok(!/from "\.\.\/model\//.test(read("protocol.js")), "protocol.js stays model-free");
  });

  const MODEL_FILES = ["world.js", "engine.js", "metrics.js", "experiment.js"];
  const modelPresent = MODEL_FILES.every((f) => existsSync(join(PLAYGROUND_ROOT, "src/model", f)));
  test(
    "with the model present, host.js loads and binds the model api",
    { skip: modelPresent ? false : "src/model is not built yet" },
    async () => {
      const { MODEL_API } = await import("../src/runtime/worker.js");
      for (const name of ["buildWorld", "createRun", "computeAll", "computeSeries", "experimentSteps", "freezeSpec"]) {
        assert.equal(typeof MODEL_API[name], "function", name);
      }
      const { createEngineHost } = await import("../src/runtime/host.js");
      const host = createEngineHost({ createWorker: throwingFactory, now: () => 0, schedule: () => {} });
      assert.equal(host.path, "main thread");
      for (const name of ["runWindow", "runPair", "runExperiment", "cancel"]) assert.equal(typeof host[name], "function");
    },
  );
});
