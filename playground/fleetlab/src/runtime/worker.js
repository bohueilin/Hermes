// Engine worker entry (contract section 7, design §9.4). The message handling lives in protocol.js so tests
// can inject a fake model; this file binds it to the teaching model and to the worker's own scope.

import { computeAll, computeSeries } from "../model/metrics.js";
import { createRun } from "../model/engine.js";
import { experimentSteps, freezeSpec } from "../model/experiment.js";
import { buildWorld } from "../model/world.js";
import { createWorkerHandler } from "./protocol.js";

/** The model functions the run generators call, by their contract names. */
export const MODEL_API = Object.freeze({ buildWorld, createRun, computeAll, computeSeries, experimentSteps, freezeSpec });

// Bind only inside a worker scope, so importing this file on the page or under node binds nothing.
if (typeof WorkerGlobalScope === "function" && typeof self === "object" && self instanceof WorkerGlobalScope) {
  const handle = createWorkerHandler(MODEL_API, (message) => self.postMessage(message));
  self.onmessage = (event) => handle(event.data);
}
