// Real engine payloads for interface tests, built from src/model through the same message handler the engine worker
// uses (src/runtime/protocol.js createWorkerHandler over MODEL_API from src/runtime/worker.js), driven with a fake
// clock that never ends a slice and a task queue drained at once. Every message the handler posts is structured-
// cloned as a browser worker's postMessage would clone it. Payloads are cached per process by their arguments and
// deep-frozen, so a module that mutates a payload throws instead of corrupting other tests.
//
// Every function is async (the handler posts its result from a promise callback) and returns the contract section 7
// payload itself, with these shapes:
//
// windowPayload({presetId, seeds, logSeed}) -> run_window payload
//   presetId defaults to the default preset, seeds to seed set 1 for two replications [1001, 1002], logSeed to seeds[0].
//   {
//     runs: [{seed, world_digest, metrics, series, invariant_violations}],   one per seed, in seed order
//     log:  {seed, events, intervals, visits, requests, cars, depots, snapshots, drain_end_s}
//   }
//   `log` is present only when logSeed is one of seeds.
//   metrics: {"<metric key>": {value: number} | {absent: string}}, e.g. "wait.p90_s", "depot.turnaround_p50_s"
//   series: {fleet_state, wait_p90_by_hour, available_by_area, bay_wait_by_depot, turnaround_by_arrival_hour,
//            congested_empty_by_hour, demand_by_hour, traffic_by_hour}; each holds `starts_s` (hour starts in seconds)
//            and per-hour entries that are numbers, objects or {absent: string}
//   invariant_violations: [string]
//   events: [{ord, t, kind, ...}]; intervals: {"<car id>": [{state, t0, t1, location, ...}]};
//   visits: [{car, depot, arrival_s, intake_end_s, first_task_s, clean_start_s, clean_end_s, service_start_s,
//             service_end_s, ready_s, censored}];
//   requests: [{id, time_s, origin, dest, state, car, assigned_s, pickup_s, dropoff_s, unserved_s}];
//   cars: [{id, home_area, home_depot, state, trips_since_visit, visits}];
//   depots: [{id, area, parking, cleaning_bays, service_bays, diversions_s, holds, series_fields, series}];
//   snapshots: [{t, cars: [{id, state, location, ...}]}] every 300 simulated seconds; drain_end_s: number
//
// pairPayload({baselineScenario, candidateScenario, seed, lambdaMaxPermille}) -> run_pair payload
//   baselineScenario defaults to the default preset's scenario, candidateScenario to that scenario with San Jose at
//   16 cars (FORK_AXIS), seed to 1001 and lambdaMaxPermille to the shared envelope of the two scenarios.
//   {world_digest, baseline: {metrics, series, log}, candidate: {metrics, series, log}}   (log as above)
//
// experimentPayload({presetId, replications, seedSet, resamples}) -> run_experiment payload
//   presetId defaults to "UC-01", replications to 10 (the fewest the spec rules allow), seedSet and resamples to the
//   preset's. The draft is experimentDraft(...) below.
//   {
//     verdict: {validity, invalidity_reason, invalidity_detail, outcome, recommendation, primary, guardrail_results,
//               guardrail_regressions, descriptives, guardrail_statuses},
//     digest: 64 lowercase hex characters, label: "playground-spec:" plus the digest's first 8,
//     lambdaMaxPermille: {SF, PEN, SJ, EB},
//     per_seed: [{seed, baseline_metrics, candidate_metrics}]                  metrics maps as above
//   }
//
// Helpers for the arguments a test also needs:
//   presetScenario(presetId)        a mutable clone of a preset's scenario
//   forkCandidate(scenario)         the default fork candidate of a scenario
//   experimentDraft(options)        the mutable draft experimentPayload freezes
//   frozenExperiment(options)       freezeSpec(experimentDraft(options)): {spec, digest, label}
//   runThroughWorkerHandler(message) {payload, messages}: an uncached run with every posted message, in order

import { canonicalJson } from "../../src/core/canon.js";
import { freezeSpec } from "../../src/model/experiment.js";
import { DEFAULT_PRESET_ID, presetById, seedSet } from "../../src/model/presets.js";
import { applyAxis, cloneScenario } from "../../src/model/schema.js";
import { sharedLambdaMaxPermille } from "../../src/model/world.js";
import { createWorkerHandler } from "../../src/runtime/protocol.js";
import { MODEL_API } from "../../src/runtime/worker.js";

/** The axis change pairPayload applies to make its default candidate. */
export const FORK_AXIS = Object.freeze({ id: "parameter:SUP-1.SJ", value: 16 });
/** Replications experimentPayload uses by default. */
export const FAST_REPLICATIONS = 10;
/** The Experiment preset experimentPayload uses by default. */
export const DEFAULT_EXPERIMENT_PRESET_ID = "UC-01";

const cache = new Map();
let runCounter = 0;

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function preset(presetId) {
  const found = presetById(presetId);
  if (found === null) throw new Error(`no preset with id ${JSON.stringify(presetId)}`);
  return found;
}

/** A mutable clone of a preset's scenario. */
export function presetScenario(presetId = DEFAULT_PRESET_ID) {
  return cloneScenario(preset(presetId).scenario);
}

/** The default fork candidate: `scenario` with FORK_AXIS applied. */
export function forkCandidate(scenario) {
  return applyAxis(scenario, FORK_AXIS.id, FORK_AXIS.value);
}

/**
 * Runs one run message through the worker handler with the real model api and returns `{payload, messages}`:
 * the result payload and every message posted (ready, progress, result), each structured-cloned. Throws with the
 * handler's message when it posts an error. Not cached.
 */
export async function runThroughWorkerHandler(message) {
  const messages = [];
  const queue = [];
  const handle = createWorkerHandler(MODEL_API, (posted) => messages.push(structuredClone(posted)), {
    now: () => 0,
    schedule: (task) => queue.push(task),
  });
  runCounter += 1;
  const id = message.id ?? `helper-${runCounter}`;
  handle(structuredClone({ ...message, id }));
  for (let round = 0; round < 1000; round += 1) {
    while (queue.length > 0) queue.shift()();
    const last = messages.find((m) => m.id === id && (m.type === "result" || m.type === "error"));
    if (last?.type === "result") return { payload: last.payload, messages };
    if (last?.type === "error") throw new Error(`the worker handler posted an error: ${last.message}`);
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("the worker handler never posted a result");
}

function cached(message) {
  const key = canonicalJson(message);
  if (!cache.has(key)) {
    const pending = runThroughWorkerHandler(message).then(({ payload }) => deepFreeze(payload));
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return cache.get(key);
}

/** The run_window payload for a preset's scenario (see the header). */
export function windowPayload({ presetId = DEFAULT_PRESET_ID, seeds = seedSet(1, 2), logSeed = seeds[0] } = {}) {
  return cached({ type: "run_window", scenario: presetScenario(presetId), seeds: [...seeds], logSeed });
}

/** The run_pair payload for two scenarios on one world (see the header). */
export function pairPayload({ baselineScenario, candidateScenario, seed = 1001, lambdaMaxPermille } = {}) {
  const baseline = baselineScenario ?? presetScenario(DEFAULT_PRESET_ID);
  const candidate = candidateScenario ?? forkCandidate(baseline);
  const envelope = lambdaMaxPermille ?? sharedLambdaMaxPermille([baseline, candidate]);
  return cached({ type: "run_pair", baseline, candidate, seed, lambdaMaxPermille: envelope });
}

/**
 * The draft of a preset's experiment with `replications` seeds of seed set `seedSet` (the spec rules allow 10 to
 * 100) and `resamples` bootstrap resamples. Returns a mutable copy.
 */
export function experimentDraft({ presetId = DEFAULT_EXPERIMENT_PRESET_ID, replications = FAST_REPLICATIONS, seedSet: k, resamples } = {}) {
  const found = preset(presetId);
  if (found.experiment === null) throw new Error(`preset ${presetId} has no experiment`);
  const draft = structuredClone(found.experiment);
  draft.seed_set = k ?? draft.seed_set;
  draft.seeds = seedSet(draft.seed_set, replications);
  if (resamples !== undefined) draft.resamples = resamples;
  return draft;
}

/** freezeSpec of experimentDraft(options): `{spec, digest, label}`. */
export function frozenExperiment(options) {
  return freezeSpec(experimentDraft(options));
}

/** The run_experiment payload for a preset's experiment draft (see the header). */
export function experimentPayload(options = {}) {
  return cached({ type: "run_experiment", spec: experimentDraft(options) });
}
