// Engine host (contract section 7, design §5.9 and §9.4): a worker when the page allows one, otherwise the same
// run generators time-sliced on the main thread. The page passes the worker factory; this file never reads the
// module's own URL.

import { createDrivers, createHost } from "./protocol.js";
import { MODEL_API } from "./worker.js";

/**
 * Creates the engine host. `createWorker()` returns a worker or throws; `drivers` defaults to the model-backed
 * generators, `now` to `performance.now()` in milliseconds and `schedule` to a zero-delay task. Returns
 * `{path, ready, runWindow, runPair, runExperiment, cancel}`.
 */
export function createEngineHost({ createWorker, drivers, now, schedule } = {}) {
  const options = { createWorker, drivers: drivers ?? createDrivers(MODEL_API) };
  if (now) options.now = now;
  if (schedule) options.schedule = schedule;
  return createHost(options);
}
