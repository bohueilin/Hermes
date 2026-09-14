// Engine runtime core: the run generators, the time slicer, the worker message handler and the host.
// This module imports nothing, so it runs under node --test with an injected model api. worker.js and
// host.js bind it to the teaching model (contract section 7, design §5.9 and §9.4).

/** Message types that start a run. */
export const RUN_TYPES = Object.freeze(["run_window", "run_pair", "run_experiment"]);

/** Engine events per `run.step` call; one step is one slice point (count, not time). */
export const STEP_EVENTS = 250;

/** Default slice budgets in milliseconds: the page thread and the worker thread. */
export const MAIN_SLICE_MS = 8;
export const WORKER_SLICE_MS = 50;

/** Milliseconds the host waits for the worker's `ready` before it runs on the main thread. */
export const READY_TIMEOUT_MS = 1000;

const RUN_FIELDS = Object.freeze({
  run_window: ["scenario", "seeds", "logSeed", "lambdaMaxPermille"],
  run_pair: ["baseline", "candidate", "seed", "lambdaMaxPermille"],
  run_experiment: ["spec"],
});

const LOG_KEYS = ["events", "intervals", "visits", "requests", "cars", "depots", "snapshots", "drain_end_s"];

/** A progress marker a run generator yields; `done` and `total` count units of work. */
function progress(done, total, label) {
  return { done, total, label };
}

/** The message text of any thrown value. */
export function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** The rejection a cancelled run receives. */
export function cancelledError() {
  const error = new Error("cancelled");
  error.name = "AbortError";
  return error;
}

function assertSafeInteger(value, what) {
  if (!Number.isSafeInteger(value)) throw new Error(`${what} must be a safe integer`);
}

function worldOptions(seed, lambdaMaxPermille) {
  return lambdaMaxPermille === undefined ? { seed } : { seed, lambdaMaxPermille };
}

function logOf(seed, result) {
  const log = { seed };
  for (const key of LOG_KEYS) log[key] = result[key];
  return log;
}

/**
 * The run generators over a model api `{buildWorld, createRun, computeAll, computeSeries, experimentSteps,
 * freezeSpec}`. Each takes a run message, yields progress objects or undefined ticks, and returns the
 * contract section 7 payload.
 */
export function createDrivers(api) {
  // Every model call below sits alone between two yields, so the slicer can hand control back between any two of
  // them (contract section 7): buildWorld, createRun, each run.step, run.result, computeAll and computeSeries.
  function* drive(scenario, world, seed, keepLogs) {
    yield;
    const run = api.createRun(scenario, world, { seed, keepLogs });
    yield;
    while (!run.step(STEP_EVENTS)) yield;
    yield;
    const result = run.result();
    yield;
    return result;
  }

  /** The metrics and series of one result, each computed in a step of its own. */
  function* measure(result, scenario) {
    const metrics = api.computeAll(result);
    yield;
    const series = api.computeSeries(result, scenario);
    yield;
    return { metrics, series };
  }

  function* run_window(message) {
    const { scenario, seeds, logSeed, lambdaMaxPermille } = message;
    if (!Array.isArray(seeds) || seeds.length === 0) throw new Error("seeds must be a non-empty array");
    seeds.forEach((seed) => assertSafeInteger(seed, "seed"));
    const runs = [];
    let log = null;
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i];
      yield progress(i, seeds.length, `Replication ${i + 1} of ${seeds.length}`);
      const keepLogs = seed === logSeed && log === null;
      const world = api.buildWorld(scenario, worldOptions(seed, lambdaMaxPermille));
      const result = yield* drive(scenario, world, seed, keepLogs);
      const { metrics, series } = yield* measure(result, scenario);
      runs.push({
        seed,
        world_digest: result.world_digest,
        metrics,
        series,
        invariant_violations: result.invariant_violations,
      });
      if (keepLogs) log = logOf(seed, result);
    }
    return log === null ? { runs } : { runs, log };
  }

  function* run_pair(message) {
    const { baseline, candidate, seed, lambdaMaxPermille } = message;
    assertSafeInteger(seed, "seed");
    // One world from the declared baseline scenario and the shared envelope; both arms read it (design §5.4 item 5).
    const world = api.buildWorld(baseline, worldOptions(seed, lambdaMaxPermille));
    const arms = [];
    for (const [i, scenario, label] of [[0, baseline, "Baseline arm"], [1, candidate, "Candidate arm"]]) {
      yield progress(i, 2, label);
      const result = yield* drive(scenario, world, seed, true);
      const { metrics, series } = yield* measure(result, scenario);
      arms.push({ digest: result.world_digest, arm: { metrics, series, log: logOf(seed, result) } });
    }
    if (arms[0].digest !== arms[1].digest) throw new Error("the two arms do not share one world");
    return { world_digest: arms[0].digest, baseline: arms[0].arm, candidate: arms[1].arm };
  }

  function* run_experiment(message) {
    // Re-freeze at the boundary: the digest and label come from the model, never from the page.
    const frozen = api.freezeSpec(message.spec);
    const out = yield* api.experimentSteps(frozen.spec);
    if (out.digest !== undefined && out.digest !== frozen.digest) {
      throw new Error("the experiment ran a spec whose digest differs from the frozen spec");
    }
    return {
      verdict: out.verdict,
      digest: frozen.digest,
      label: frozen.label,
      lambdaMaxPermille: out.lambdaMaxPermille,
      per_seed: out.per_seed,
    };
  }

  return Object.freeze({ run_window, run_pair, run_experiment });
}

/** Keeps a run message's contract fields only, so both paths receive the same message. */
export function runMessage(type, id, args) {
  const fields = RUN_FIELDS[type];
  if (!fields) throw new Error(`unknown run type: ${type}`);
  const message = { type, id };
  for (const key of fields) {
    if (args && args[key] !== undefined) message[key] = args[key];
  }
  return message;
}

/**
 * Drives generator `gen` in slices of at most `budgetMs` milliseconds of `now()` time, handing control back
 * through `schedule` between slices. A slice always makes one step, then stops before a step whose estimated
 * cost would cross the budget. A step's cost includes the `onProgress` call it triggers (on the page that call
 * renders synchronously), so the clock is read after the callback. Resolves with the generator's return value;
 * rejects on a throw or when `job.cancelled` becomes true. Progress objects reach `onProgress` only when they change.
 */
export function runSliced(gen, job, { now, schedule, budgetMs, onProgress }) {
  return new Promise((resolve, reject) => {
    let last = null;
    let estimate = 0;
    const stop = (error) => {
      try {
        gen.return(undefined);
      } catch {
        // The generator already failed; the original error wins.
      }
      reject(error);
    };
    const slice = () => {
      if (job.cancelled) return stop(cancelledError());
      const start = now();
      try {
        for (;;) {
          const before = now();
          const step = gen.next();
          if (step.done) return resolve(step.value);
          const p = step.value;
          if (p && typeof p === "object" &&
              (!last || p.done !== last.done || p.total !== last.total || p.label !== last.label)) {
            last = { done: p.done, total: p.total, label: p.label };
            if (onProgress) onProgress({ ...last });
          }
          if (job.cancelled) return stop(cancelledError());
          const end = now();
          estimate = Math.max(end - before, estimate / 2);
          if (end - start + estimate > budgetMs) break;
        }
      } catch (error) {
        return reject(error);
      }
      schedule(slice);
    };
    schedule(slice);
  });
}

function defaultNow() {
  return performance.now();
}

function defaultSchedule(fn) {
  setTimeout(fn, 0);
}

/**
 * The worker's message handler over a model api. Posts `{type: "ready"}` once, then progress, result and
 * error messages with ids (contract section 7). Returns `handle(message)`.
 */
export function createWorkerHandler(api, post, options = {}) {
  const now = options.now ?? defaultNow;
  const schedule = options.schedule ?? defaultSchedule;
  const budgetMs = options.sliceBudgetMs ?? WORKER_SLICE_MS;
  const drivers = createDrivers(api);
  const jobs = new Map();

  const postError = (id, error) => post({ type: "error", id, message: messageOf(error) });

  function handle(message) {
    if (!message || typeof message !== "object") return;
    const { type, id } = message;
    if (type === "cancel") {
      const job = jobs.get(id);
      if (job) {
        job.cancelled = true;
        jobs.delete(id);
      }
      return;
    }
    if (!RUN_TYPES.includes(type)) return postError(id, new Error(`unknown message type: ${type}`));
    if (jobs.has(id)) return postError(id, new Error(`a run with id ${id} is already active`));
    const job = { cancelled: false };
    jobs.set(id, job);
    const onProgress = (p) => post({ type: "progress", id, done: p.done, total: p.total, label: p.label });
    runSliced(drivers[type](message), job, { now, schedule, budgetMs, onProgress }).then(
      (payload) => {
        if (job.cancelled) return;
        jobs.delete(id);
        try {
          post({ type: "result", id, payload });
        } catch (error) {
          postError(id, error);
        }
      },
      (error) => {
        if (job.cancelled) return;
        jobs.delete(id);
        postError(id, error);
      },
    );
  }

  post({ type: "ready" });
  return handle;
}

/**
 * The engine host (contract section 7). `createWorker()` builds a worker; the host uses it when construction
 * does not throw and `ready` arrives within `readyTimeoutMs` of `now()` time, otherwise it terminates any
 * worker and drives `drivers` on this thread in slices of at most `sliceBudgetMs`. `path` reads "starting"
 * until the choice is made, then "worker" or "main thread"; `ready` resolves with the chosen path.
 */
export function createHost({
  createWorker,
  drivers,
  now = defaultNow,
  schedule = defaultSchedule,
  readyTimeoutMs = READY_TIMEOUT_MS,
  sliceBudgetMs = MAIN_SLICE_MS,
}) {
  if (!drivers) throw new Error("createHost needs drivers");
  let path = "starting";
  let worker = null;
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const jobs = new Map();
  const waiting = [];
  let counter = 0;

  function settle(job, error, payload) {
    if (jobs.get(job.id) !== job) return;
    jobs.delete(job.id);
    if (error) job.reject(error);
    else job.resolve(payload);
  }

  function startOnMain(job) {
    const message = typeof structuredClone === "function" ? structuredClone(job.message) : job.message;
    const onProgress = (p) => {
      if (jobs.get(job.id) === job && job.onProgress) job.onProgress(p);
    };
    runSliced(drivers[message.type](message), job, { now, schedule, budgetMs: sliceBudgetMs, onProgress }).then(
      (payload) => settle(job, null, payload),
      (error) => settle(job, error.name === "AbortError" ? error : new Error(messageOf(error))),
    );
  }

  function start(job) {
    if (path === "worker") worker.postMessage(job.message);
    else startOnMain(job);
  }

  function choose(chosen) {
    if (path !== "starting") return;
    path = chosen;
    if (chosen === "main thread" && worker) {
      try {
        worker.terminate();
      } catch {
        // A worker that cannot terminate is dropped all the same.
      }
      worker = null;
    }
    resolveReady(path);
    for (const job of waiting.splice(0)) {
      if (jobs.get(job.id) === job) start(job);
    }
  }

  function onWorkerMessage(event) {
    const data = event && event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "ready") return choose("worker");
    if (path !== "worker") return;
    const job = jobs.get(data.id);
    if (data.type === "error" && data.id === undefined) {
      for (const each of [...jobs.values()]) settle(each, new Error(messageOf(data.message)));
      return;
    }
    if (!job) return;
    if (data.type === "progress") {
      if (job.onProgress) job.onProgress({ done: data.done, total: data.total, label: data.label });
    } else if (data.type === "result") {
      settle(job, null, data.payload);
    } else if (data.type === "error") {
      settle(job, new Error(messageOf(data.message)));
    }
  }

  function onWorkerError(event) {
    if (path === "starting") return choose("main thread");
    if (path !== "worker") return;
    const message = (event && event.message) || "the engine worker stopped";
    for (const job of [...jobs.values()]) settle(job, new Error(message));
  }

  try {
    worker = typeof createWorker === "function" ? createWorker() : null;
  } catch {
    worker = null;
  }
  if (!worker) {
    choose("main thread");
  } else {
    worker.onmessage = onWorkerMessage;
    worker.onerror = onWorkerError;
    worker.onmessageerror = onWorkerError;
    const startedAt = now();
    const poll = () => {
      if (path !== "starting") return;
      if (now() - startedAt >= readyTimeoutMs) choose("main thread");
      else schedule(poll);
    };
    schedule(poll);
  }

  function submit(type, args, options = {}) {
    counter += 1;
    const id = `run-${counter}`;
    let job;
    const promise = new Promise((resolve, reject) => {
      job = { id, message: runMessage(type, id, args), resolve, reject, onProgress: options.onProgress, cancelled: false };
    });
    jobs.set(id, job);
    if (path === "starting") waiting.push(job);
    else start(job);
    promise.id = id;
    return promise;
  }

  function cancel(id) {
    const targets = id === undefined ? [...jobs.values()] : [jobs.get(id)].filter(Boolean);
    for (const job of targets) {
      job.cancelled = true;
      if (path === "worker") worker.postMessage({ type: "cancel", id: job.id });
      settle(job, cancelledError());
    }
  }

  return {
    get path() {
      return path;
    },
    ready,
    /** Runs a Sandbox window: `{scenario, seeds, logSeed, lambdaMaxPermille?}`; resolves with the payload. */
    runWindow: (args, options) => submit("run_window", args, options),
    /** Runs the fork: `{baseline, candidate, seed, lambdaMaxPermille}`; resolves with the payload. */
    runPair: (args, options) => submit("run_pair", args, options),
    /** Runs a frozen experiment: `{spec}`; resolves with the payload. */
    runExperiment: (args, options) => submit("run_experiment", args, options),
    /** Cancels one run by the id on its promise, or every active run when no id is given. */
    cancel,
  };
}
