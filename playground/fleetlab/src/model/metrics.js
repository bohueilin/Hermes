// Metrics of the teaching model (contract 6.5; design 5.7 and 7.5).
//
// Every metric reads an engine result (contract 6.4): request records, per-car interval logs with their realized
// segments, visit records and the depot series. The default measurement span is [warmup_end_s, window.end_s); a scope
// window must lie inside it. Time integrals are clipped to the span. Percentiles use FleetLab's interpolation. A value
// is `{value}`; an absent value is `{absent: reason}` and is never 0.
//
// Decisions this file makes where the design and the contract are silent (reported with the build):
// - `validateMetricRef(ref, scenario)` returns `{ok, errors}`; with a scenario it also checks that the area and depot
//   exist and that the window lies inside the measurement span. `computeMetric` throws a RangeError on an invalid ref.
// - `computeAll(result)` without refs computes every metric unscoped, and `depot.parking_peak_fraction` once per depot;
//   keys come from `metricKey(ref)`: the metric name, plus `{area=..,depot=..,window=start-end}` when scoped.
// - `fleet.placement_gap` compares the snapshot with where each car stood at the window start (SUP-1 for a scenario
//   fleet); a car on a leg counts in the leg's destination area.
// - `depot.parking_peak_fraction` reads the depot series, which holds the stalls held at the end of each second.
// - `computeSeries` covers the whole simulated window in reporting buckets. Metric-by-hour charts give buckets inside
//   the warm-up `{absent: "warm-up, not counted"}`; a bucket that straddles the warm-up end is measured on its part
//   after it. The fleet-state stack, demand and traffic cover every bucket.

import { percentileFleetLab } from "../core/stats.js";
import { lambdaProfilePermille } from "./world.js";

/** Version of this registry (design 5.7). */
export const METRICS_VERSION = "playground-metrics 0.1";

/** Absence reasons (design 5.7 "Absent when"), worded as the interface shows them after `not available: `. */
export const ABSENT = Object.freeze({
  noCompletedRequest: "no completed request in scope",
  noDrivingSeconds: "no driving seconds in scope",
  noVisitStarted: "no visit started a task",
  noVisitInScope: "no visit in scope",
  noCompletedVisit: "no completed visit in scope",
  warmUp: "warm-up, not counted",
});

/** Absence reason for censored visits in scope: `2 visits unfinished at drain end` (count is an integer). */
export function visitsUnfinished(count) {
  return `${count} ${count === 1 ? "visit" : "visits"} unfinished at drain end`;
}

const LOWER = "lower_is_better";
const HIGHER = "higher_is_better";
const REQUEST_SCOPES = Object.freeze(["area", "window"]);
const DEPOT_SCOPES = Object.freeze(["depot", "window"]);

function row(name, unit, engine_unit, direction, population, absent_when, scopes, fleetlab_status, extra = {}) {
  return Object.freeze({
    name, unit, engine_unit, direction, population, absent_when, scopes, requires: Object.freeze(extra.requires ?? []),
    fleetlab_status, descriptive_only: extra.descriptive_only ?? false, partition: extra.partition ?? false,
  });
}

/**
 * The registry, one row per design 5.7 metric: name, unit shown, engine unit (s, count or ppm), direction (null when
 * neutral), population, absent_when, allowed scope keys, required scope keys, fleetlab_status, descriptive_only, and
 * partition (a count or seconds metric whose area or depot values sum to the unscoped value, P21).
 */
export const METRICS = Object.freeze([
  row("requests.total", "requests", "count", null, "requests created in the window", "never", REQUEST_SCOPES, "identical", { partition: true }),
  row("requests.served", "requests", "count", HIGHER, "requests that reached COMPLETED", "never", REQUEST_SCOPES, "identical", { partition: true }),
  row("requests.unserved", "requests", "count", LOWER, "requests that reached UNSERVED", "never", REQUEST_SCOPES, "identical", { partition: true }),
  row("unserved.fraction", "fraction", "ppm", LOWER, "unserved over all requests; 0.0 when there are none", "never", REQUEST_SCOPES, "identical"),
  row("wait.p50_s", "s", "s", LOWER, "pickup minus request time over completed requests", ABSENT.noCompletedRequest, REQUEST_SCOPES, "identical"),
  row("wait.p90_s", "s", "s", LOWER, "pickup minus request time over completed requests", ABSENT.noCompletedRequest, REQUEST_SCOPES, "identical"),
  row("wait.population_n", "requests", "count", null, "completed requests the wait percentiles count", "never", REQUEST_SCOPES, "playground_only", { partition: true }),
  row("vehicle.empty_drive_fraction", "fraction", "ppm", LOWER, "empty driving seconds over all driving seconds, clipped to the window", ABSENT.noDrivingSeconds, Object.freeze(["window"]), "playground_only"),
  row("exposure.congested_empty_s", "s", "s", LOWER, "empty vehicle-seconds on legs whose declared multiplier is at least the threshold", "never", REQUEST_SCOPES, "playground_only", { partition: true }),
  row("exposure.congested_loaded_s", "s", "s", LOWER, "loaded vehicle-seconds on legs whose declared multiplier is at least the threshold", "never", REQUEST_SCOPES, "playground_only", { partition: true }),
  row("fleet.available_fraction", "fraction", "ppm", HIGHER, "IDLE seconds in the area plus READY_AT_DEPOT seconds at its depots, over cars times window seconds", "never", REQUEST_SCOPES, "playground_only"),
  row("depot.bay_wait_p90_s", "s", "s", LOWER, "per started visit, seconds from intake end to the first task start, zero waits included", ABSENT.noVisitStarted, DEPOT_SCOPES, "playground_only"),
  row("depot.turnaround_p50_s", "s", "s", LOWER, "arrival to READY_AT_DEPOT over every visit in scope", "no visit in scope, or any visit in scope censored at the drain end", DEPOT_SCOPES, "playground_only"),
  row("depot.turnaround_p90_s", "s", "s", LOWER, "arrival to READY_AT_DEPOT over every visit in scope", "no visit in scope, or any visit in scope censored at the drain end", DEPOT_SCOPES, "playground_only"),
  row("depot.turnaround_completed_p90_s", "s", "s", null, "arrival to READY_AT_DEPOT over visits in scope completed by the drain end", ABSENT.noCompletedVisit, DEPOT_SCOPES, "playground_only", { descriptive_only: true }),
  row("depot.censored_visits", "visits", "count", LOWER, "visits in scope unfinished at the drain end", "never", DEPOT_SCOPES, "playground_only", { partition: true }),
  row("depot.parking_peak_fraction", "fraction", "ppm", LOWER, "the largest share of the depot's stalls held at once inside the window", "never", DEPOT_SCOPES, "playground_only", { requires: ["depot"] }),
  row("depot.diversions", "arrivals", "count", LOWER, "cars turned away because the lot was full, at the depot that turned them away", "never", DEPOT_SCOPES, "playground_only", { partition: true }),
  row("depot.blocked_s", "s", "s", LOWER, "bay-seconds held after a finished task with no stall free, clipped to the window", "never", DEPOT_SCOPES, "playground_only", { partition: true }),
  row("fleet.placement_gap", "cars", "count", LOWER, "half the sum over areas of the absolute difference between cars located there at the snapshot and at the start", "never", Object.freeze([]), "playground_only"),
]);

const BY_NAME = new Map(METRICS.map((m) => [m.name, m]));
const SCOPE_KEYS = ["area", "depot", "window"];
const AREA_IDS = ["SF", "PEN", "SJ", "EB"];

/** The registry row of a metric name, or null. */
export function metricRow(name) {
  return BY_NAME.get(name) ?? null;
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Checks a metric reference `{metric, scope}` against the registry's scope rules (design 5.7). With a scenario it also
 * requires an existing area or depot and a window inside [warmup_end_s, window.end_s) (seconds). Returns `{ok, errors}`.
 */
export function validateMetricRef(ref, scenario = null) {
  const errors = [];
  if (!isPlainObject(ref) || typeof ref.metric !== "string") return { ok: false, errors: ["invalid metric reference: it needs a metric name"] };
  const row = BY_NAME.get(ref.metric);
  if (row === undefined) return { ok: false, errors: [`unknown metric: ${ref.metric}`] };
  const scope = ref.scope === undefined ? {} : ref.scope;
  if (!isPlainObject(scope)) return { ok: false, errors: [`invalid scope: ${ref.metric} needs a scope object`] };
  for (const key of Object.keys(scope)) {
    if (!row.scopes.includes(key)) errors.push(`invalid scope: ${ref.metric} does not accept ${key}`);
  }
  for (const key of row.requires) {
    if (!Object.prototype.hasOwnProperty.call(scope, key)) errors.push(`invalid scope: ${ref.metric} requires ${key}`);
  }
  if (errors.length > 0) return { ok: false, errors };
  if (Object.prototype.hasOwnProperty.call(scope, "area")) {
    const areas = scenario ? scenario.areas.map((a) => a.id) : AREA_IDS;
    if (!areas.includes(scope.area)) errors.push(`invalid scope: ${ref.metric} area ${String(scope.area)} is not an area of this map`);
  }
  if (Object.prototype.hasOwnProperty.call(scope, "depot")) {
    const known = scenario ? scenario.depots.some((d) => d.id === scope.depot) : typeof scope.depot === "string" && /^(SF|PEN|SJ|EB)-[0-9]+$/.test(scope.depot);
    if (!known) errors.push(`invalid scope: ${ref.metric} depot ${String(scope.depot)} is not a depot of this map`);
  }
  if (Object.prototype.hasOwnProperty.call(scope, "window")) {
    const w = scope.window;
    const shaped = isPlainObject(w) && Object.keys(w).sort().join(",") === "end_s,start_s" &&
      Number.isSafeInteger(w.start_s) && Number.isSafeInteger(w.end_s) && w.start_s < w.end_s;
    if (!shaped) {
      errors.push(`invalid scope: ${ref.metric} window must be {start_s, end_s} in whole seconds with start before end`);
    } else if (scenario && (w.start_s < scenario.warmup_end_s || w.end_s > scenario.window.end_s)) {
      errors.push(`invalid scope: ${ref.metric} window must lie inside the measurement span from ${scenario.warmup_end_s} to ${scenario.window.end_s}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** The key a reference has in computeAll's map: the metric name, plus `{area=SF,depot=SF-1,window=start-end}` when scoped. */
export function metricKey(ref) {
  const scope = ref.scope ?? {};
  const parts = [];
  for (const key of SCOPE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(scope, key)) continue;
    parts.push(key === "window" ? `window=${scope.window.start_s}-${scope.window.end_s}` : `${key}=${scope[key]}`);
  }
  return parts.length === 0 ? ref.metric : `${ref.metric}{${parts.join(",")}}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Indexing, cached per result.

const contexts = new WeakMap();

const overlap = (a, b, lo, hi) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));

/** Congested sub-spans [t0, t1) of a segment: seconds whose hour's declared multiplier is at least the threshold. */
function congestedSpans(seg, scenario) {
  if (seg.kind === "PULL_OUT") return [];
  const table = seg.kind === "ROUTE" ? scenario.congestion[seg.cls][seg.dir] : scenario.congestion.IN_AREA;
  const out = [];
  for (let t = seg.t0; t < seg.t1;) {
    const hour = Math.floor(t / 3600);
    const end = Math.min((hour + 1) * 3600, seg.t1);
    if (table[Math.min(hour, 47)] >= scenario.congestion_threshold_permille) {
      const last = out[out.length - 1];
      if (last !== undefined && last[1] === t) last[1] = end;
      else out.push([t, end]);
    }
    t = end;
  }
  return out;
}

function contextOf(result) {
  let ctx = contexts.get(result);
  if (ctx !== undefined) return ctx;
  const scenario = result.scenario;
  const depotAreaOf = new Map(scenario.depots.map((d) => [d.id, d.area]));
  const placeArea = (loc) => (loc.area !== undefined ? loc.area : depotAreaOf.get(loc.depot));
  const segments = [];
  const available = [];
  const blocked = [];
  const starts = {};
  for (const [carId, list] of Object.entries(result.intervals)) {
    if (list.length > 0) {
      const first = list[0];
      starts[carId] = placeArea(first.location ?? first.from);
    }
    for (const iv of list) {
      if (iv.segments !== undefined) {
        for (const seg of iv.segments) {
          let area = null;
          if (seg.kind === "ROUTE") area = seg.dir.split(">")[0];
          else if (seg.kind === "IN_AREA") area = seg.key.slice(3);
          else if (seg.kind === "ACCESS") area = depotAreaOf.get(seg.key.slice(4));
          const cls = seg.kind === "ROUTE" ? seg.cls : seg.kind === "PULL_OUT" ? null : "LOCAL";
          segments.push({ t0: seg.t0, t1: seg.t1, loaded: seg.loaded, area, cls, congested: congestedSpans(seg, scenario) });
        }
      }
      if (iv.state === "IDLE" || iv.state === "READY_AT_DEPOT") available.push({ t0: iv.t0, t1: iv.t1, area: placeArea(iv.location) });
      if (iv.state === "IN_SERVICE" && iv.blocked) blocked.push({ t0: iv.t0, t1: iv.t1, depot: iv.location.depot });
    }
  }
  ctx = { scenario, segments, available, blocked, starts, placeArea, depots: new Map(result.depots.map((d) => [d.id, d])) };
  contexts.set(result, ctx);
  return ctx;
}

const defaultSpan = (scenario) => ({ start_s: scenario.warmup_end_s, end_s: scenario.window.end_s });
const inSpan = (t, w) => t >= w.start_s && t < w.end_s;

// ---------------------------------------------------------------------------------------------------------------
// Metric computation over a resolved scope `{area, depot, window}` (window always present).

function requestsIn(result, s) {
  return result.requests.filter((r) => inSpan(r.time_s, s.window) && (s.area === undefined || r.origin === s.area));
}

function visitsIn(result, s) {
  return result.visits.filter((v) => inSpan(v.arrival_s, s.window) && (s.depot === undefined || v.depot === s.depot));
}

function waitPercentile(result, s, q) {
  const waits = requestsIn(result, s).filter((r) => r.state === "COMPLETED").map((r) => r.pickup_s - r.time_s);
  return waits.length === 0 ? { absent: ABSENT.noCompletedRequest } : { value: percentileFleetLab(waits, q) };
}

function congested(ctx, s, loaded, cls = null) {
  let total = 0;
  for (const seg of ctx.segments) {
    if (seg.loaded !== loaded || seg.congested.length === 0) continue;
    if (s.area !== undefined && seg.area !== s.area) continue;
    if (cls !== null && seg.cls !== cls) continue;
    for (const [a, b] of seg.congested) total += overlap(a, b, s.window.start_s, s.window.end_s);
  }
  return total;
}

function turnaround(result, s, q) {
  const visits = visitsIn(result, s);
  if (visits.length === 0) return { absent: ABSENT.noVisitInScope };
  const censored = visits.filter((v) => v.censored).length;
  if (censored > 0) return { absent: visitsUnfinished(censored) };
  return { value: percentileFleetLab(visits.map((v) => v.ready_s - v.arrival_s), q) };
}

function computeResolved(result, metric, s) {
  const ctx = contextOf(result);
  const w = s.window;
  switch (metric) {
    case "requests.total":
      return { value: requestsIn(result, s).length };
    case "requests.served":
      return { value: requestsIn(result, s).filter((r) => r.state === "COMPLETED").length };
    case "requests.unserved":
      return { value: requestsIn(result, s).filter((r) => r.state === "UNSERVED").length };
    case "unserved.fraction": {
      const reqs = requestsIn(result, s);
      return { value: reqs.length === 0 ? 0 : reqs.filter((r) => r.state === "UNSERVED").length / reqs.length };
    }
    case "wait.p50_s":
      return waitPercentile(result, s, 0.5);
    case "wait.p90_s":
      return waitPercentile(result, s, 0.9);
    case "wait.population_n":
      return { value: requestsIn(result, s).filter((r) => r.state === "COMPLETED").length };
    case "vehicle.empty_drive_fraction": {
      let empty = 0;
      let all = 0;
      for (const seg of ctx.segments) {
        const c = overlap(seg.t0, seg.t1, w.start_s, w.end_s);
        all += c;
        if (!seg.loaded) empty += c;
      }
      return all === 0 ? { absent: ABSENT.noDrivingSeconds } : { value: empty / all };
    }
    case "exposure.congested_empty_s":
      return { value: congested(ctx, s, false) };
    case "exposure.congested_loaded_s":
      return { value: congested(ctx, s, true) };
    case "fleet.available_fraction": {
      let seconds = 0;
      for (const iv of ctx.available) {
        if (s.area === undefined || iv.area === s.area) seconds += overlap(iv.t0, iv.t1, w.start_s, w.end_s);
      }
      const denominator = result.cars.length * (w.end_s - w.start_s);
      return { value: denominator === 0 ? 0 : seconds / denominator };
    }
    case "depot.bay_wait_p90_s": {
      const waits = visitsIn(result, s).filter((v) => v.first_task_s !== null).map((v) => v.first_task_s - v.intake_end_s);
      return waits.length === 0 ? { absent: ABSENT.noVisitStarted } : { value: percentileFleetLab(waits, 0.9) };
    }
    case "depot.turnaround_p50_s":
      return turnaround(result, s, 0.5);
    case "depot.turnaround_p90_s":
      return turnaround(result, s, 0.9);
    case "depot.turnaround_completed_p90_s": {
      const done = visitsIn(result, s).filter((v) => !v.censored).map((v) => v.ready_s - v.arrival_s);
      return done.length === 0 ? { absent: ABSENT.noCompletedVisit } : { value: percentileFleetLab(done, 0.9) };
    }
    case "depot.censored_visits":
      return { value: visitsIn(result, s).filter((v) => v.censored).length };
    case "depot.parking_peak_fraction": {
      const d = ctx.depots.get(s.depot);
      let peak = 0;
      for (let i = 0; i < d.series.length; i += 1) {
        const t0 = d.series[i][0];
        const t1 = i + 1 < d.series.length ? d.series[i + 1][0] : Infinity;
        if (t0 < w.end_s && t1 > w.start_s && d.series[i][1] > peak) peak = d.series[i][1];
      }
      return { value: peak / d.parking };
    }
    case "depot.diversions": {
      let n = 0;
      for (const d of result.depots) {
        if (s.depot === undefined || d.id === s.depot) n += d.diversions_s.filter((t) => inSpan(t, w)).length;
      }
      return { value: n };
    }
    case "depot.blocked_s": {
      let total = 0;
      for (const iv of ctx.blocked) if (s.depot === undefined || iv.depot === s.depot) total += overlap(iv.t0, iv.t1, w.start_s, w.end_s);
      return { value: total };
    }
    case "fleet.placement_gap": {
      const at = ctx.scenario.placement_snapshot_s;
      const now = {};
      const then = {};
      for (const area of ctx.scenario.areas) {
        now[area.id] = 0;
        then[area.id] = 0;
      }
      for (const [carId, list] of Object.entries(result.intervals)) {
        let iv = list.find((x) => x.t0 <= at && at < x.t1);
        if (iv === undefined) iv = list[list.length - 1];
        const area = ctx.placeArea(iv.location ?? iv.to);
        now[area] += 1;
        then[ctx.starts[carId]] += 1;
      }
      let sum = 0;
      for (const id of Object.keys(now)) sum += Math.abs(now[id] - then[id]);
      return { value: sum / 2 };
    }
    default:
      throw new RangeError(`unknown metric: ${metric}`);
  }
}

/** One metric of an engine result: `{value}` or `{absent: reason}` (units per the registry row). Throws on an invalid ref. */
export function computeMetric(result, ref) {
  const check = validateMetricRef(ref, result.scenario);
  if (!check.ok) throw new RangeError(check.errors[0]);
  const scope = ref.scope ?? {};
  return computeResolved(result, ref.metric, { ...scope, window: scope.window ?? defaultSpan(result.scenario) });
}

/** The references computeAll uses when none are given: every metric unscoped, and the parking peak per depot. */
export function defaultRefs(scenario) {
  const refs = [];
  for (const m of METRICS) {
    if (m.requires.includes("depot")) for (const d of scenario.depots) refs.push({ metric: m.name, scope: { depot: d.id } });
    else refs.push({ metric: m.name, scope: {} });
  }
  return refs;
}

/** Every reference in `refs` (default `defaultRefs`) as a map from `metricKey(ref)` to `{value}` or `{absent}`. */
export function computeAll(result, refs = defaultRefs(result.scenario)) {
  const out = {};
  for (const ref of refs) out[metricKey(ref)] = computeMetric(result, ref);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Series for the charts of design 7.5.

/** Chart ids computeSeries returns (design 7.5, contract 6.5). */
export const SERIES_IDS = Object.freeze([
  "fleet_state", "wait_p90_by_hour", "available_by_area", "bay_wait_by_depot", "turnaround_by_arrival_hour",
  "congested_empty_by_hour", "demand_by_hour", "traffic_by_hour",
]);

/** State families of the fleet-state stack in stack order (design 8.2), each with its states. */
export const STATE_FAMILIES = Object.freeze({
  riderWork: Object.freeze(["ENROUTE_PICKUP", "ON_TRIP"]),
  emptyDrive: Object.freeze(["TO_DEPOT", "REPOSITIONING"]),
  available: Object.freeze(["IDLE"]),
  atDepot: Object.freeze(["INTAKE", "QUEUED_SERVICE", "GATE_WAIT", "IN_SERVICE", "READY_AT_DEPOT"]),
});
const ALL_STATES = Object.values(STATE_FAMILIES).flat();

/**
 * Hourly (reporting-bucket) values for every chart of design 7.5, keyed by chart id. Each chart holds `starts_s`
 * (bucket starts in seconds) and arrays aligned with it whose entries are numbers or `{absent: reason}`:
 * fleet_state (vehicle-seconds by family and by state; each bucket sums to cars times bucket seconds), wait_p90_by_hour
 * (s, all and per area), available_by_area (fraction per area), bay_wait_by_depot (s, all and per depot),
 * turnaround_by_arrival_hour (s, all and per depot), congested_empty_by_hour (s, all, per area and per class, access
 * and in-area as LOCAL), demand_by_hour (per area, declared requests per hour and this replay's requests created) and
 * traffic_by_hour (declared per-mille multiplier per class and direction, and the in-area row).
 */
export function computeSeries(result, scenario = result.scenario) {
  const { start_s, end_s } = scenario.window;
  const bucket = scenario.bucket_s;
  const starts_s = [];
  for (let t = start_s; t < end_s; t += bucket) starts_s.push(t);
  const bucketEnd = (t) => Math.min(t + bucket, end_s);
  const areas = scenario.areas.map((a) => a.id);
  const depots = scenario.depots.map((d) => d.id);

  // A metric scoped to one bucket, measured on the bucket's part after the warm-up.
  const byBucket = (metric, extra = {}) =>
    starts_s.map((t) => {
      const lo = Math.max(t, scenario.warmup_end_s);
      const hi = bucketEnd(t);
      if (lo >= hi) return { absent: ABSENT.warmUp };
      return computeResolved(result, metric, { ...extra, window: { start_s: lo, end_s: hi } });
    });
  const perKey = (keys, metric, key) => Object.fromEntries(keys.map((k) => [k, byBucket(metric, { [key]: k })]));

  const families = Object.fromEntries(Object.keys(STATE_FAMILIES).map((f) => [f, starts_s.map(() => 0)]));
  const states = Object.fromEntries(ALL_STATES.map((st) => [st, starts_s.map(() => 0)]));
  const familyOf = {};
  for (const [f, list] of Object.entries(STATE_FAMILIES)) for (const st of list) familyOf[st] = f;
  for (const list of Object.values(result.intervals)) {
    for (const iv of list) {
      if (iv.t1 <= start_s || iv.t0 >= end_s || iv.t1 === iv.t0) continue;
      const first = Math.max(0, Math.floor((iv.t0 - start_s) / bucket));
      for (let i = first; i < starts_s.length && starts_s[i] < iv.t1; i += 1) {
        const c = overlap(iv.t0, iv.t1, starts_s[i], bucketEnd(starts_s[i]));
        states[iv.state][i] += c;
        families[familyOf[iv.state]][i] += c;
      }
    }
  }

  const ctx = contextOf(result);
  const congestedByClass = (cls) =>
    starts_s.map((t) => {
      const lo = Math.max(t, scenario.warmup_end_s);
      const hi = bucketEnd(t);
      if (lo >= hi) return { absent: ABSENT.warmUp };
      return congested(ctx, { window: { start_s: lo, end_s: hi } }, false, cls);
    });

  const profile = lambdaProfilePermille(scenario);
  const demand = {};
  for (const id of areas) {
    const accepted = starts_s.map(() => 0);
    for (const r of result.requests) {
      if (r.origin === id && r.time_s >= start_s && r.time_s < end_s) accepted[Math.floor((r.time_s - start_s) / bucket)] += 1;
    }
    demand[id] = { declared_per_h: starts_s.map((t) => profile[id][Math.min(Math.floor(t / 3600), 47)] / 1000), accepted };
  }

  const hourRow = (table) => starts_s.map((t) => table[Math.min(Math.floor(t / 3600), 47)]);
  const traffic = { IN_AREA: hourRow(scenario.congestion.IN_AREA) };
  for (const cls of ["HIGHWAY", "LOCAL"]) {
    traffic[cls] = Object.fromEntries(Object.entries(scenario.congestion[cls]).map(([dir, table]) => [dir, hourRow(table)]));
  }

  const unwrap = (list) => list.map((x) => ("absent" in x ? x : x.value));
  const unwrapAll = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, unwrap(v)]));
  return {
    fleet_state: { starts_s, fleet: result.cars.length, families, states },
    wait_p90_by_hour: { starts_s, all: unwrap(byBucket("wait.p90_s")), areas: unwrapAll(perKey(areas, "wait.p90_s", "area")) },
    available_by_area: { starts_s, areas: unwrapAll(perKey(areas, "fleet.available_fraction", "area")) },
    bay_wait_by_depot: { starts_s, all: unwrap(byBucket("depot.bay_wait_p90_s")), depots: unwrapAll(perKey(depots, "depot.bay_wait_p90_s", "depot")) },
    turnaround_by_arrival_hour: {
      starts_s, all: unwrap(byBucket("depot.turnaround_p90_s")), depots: unwrapAll(perKey(depots, "depot.turnaround_p90_s", "depot")),
    },
    congested_empty_by_hour: {
      starts_s,
      all: unwrap(byBucket("exposure.congested_empty_s")),
      areas: unwrapAll(perKey(areas, "exposure.congested_empty_s", "area")),
      classes: { HIGHWAY: congestedByClass("HIGHWAY"), LOCAL: congestedByClass("LOCAL") },
    },
    demand_by_hour: { starts_s, areas: demand },
    traffic_by_hour: { starts_s, ...traffic },
  };
}
