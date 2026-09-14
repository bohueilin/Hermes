// Invariant checks of the teaching model (design 5.6, contract 6.5).
//
// The engine calls the per-change hooks below as it runs (2, 5, 9, 11 on heap pops, P13, P14); each returns an array
// of strings "<id>: detail" and an empty array when the check holds. `checkRun(result)` runs the whole-run checks after
// a run: 1, 2, 3, 5, 8, 9, 10, 11, Conservation, P13 to P17, P19 (cars), P20 and P21. Check 12 is `checkReplay`, P18
// is `checkWorld` and `checkArms`, and P19 at load is `checkScenario`. A violation voids the run.
//
// Decisions where the design is silent (reported with the build):
// - Check 1 compares the tracked cars (the result's car list, every interval log and every snapshot) with the
//   configured fleet: SUP-1 by default, or `options.configuredCars` (the ids a fixture declares).
// - Checks that read the event log (3's event part, 8's pickup event, 10's event references, 11's ordinals and part of
//   P20) run only when the run kept its logs; the record-based parts always run.
// - P16 compares the depot series (the engine's running record of queue, gate, blocked and ready counts) with the
//   same counts integrated from the interval log over [window.start_s, drain_end_s), and requires the stalls held and
//   bays busy columns to equal the counts rebuilt from car states at every change, never below zero.
// - P13 and 5 hold on both the engine's counters (the series) and the occupancy rebuilt from car states and the result's
//   fixture holds (`depots[i].holds`), so a counter that drifts from the cars cannot hide an overfilled lot or bay.

import { sha256Hex } from "../core/sha256.js";
import { computeMetric, METRICS } from "./metrics.js";
import { validateScenario } from "./schema.js";
import { lambdaProfilePermille, worldDigest } from "./world.js";

/** Every allowed state change of design 5.3 as [from, to, event]; IN_SERVICE labels carry the task and a blocked mark. */
export const TRANSITIONS = Object.freeze([
  ["IDLE", "ENROUTE_PICKUP", "REQUEST_ASSIGNED"],
  ["READY_AT_DEPOT", "ENROUTE_PICKUP", "REQUEST_ASSIGNED"],
  ["ENROUTE_PICKUP", "ON_TRIP", "PICKUP_COMPLETED"],
  ["ON_TRIP", "IDLE", "TRIP_COMPLETED"],
  ["ON_TRIP", "TO_DEPOT", "TRIP_COMPLETED"],
  ["IDLE", "TO_DEPOT", "RECALL_ORDERED"],
  ["TO_DEPOT", "TO_DEPOT", "DEPOT_DIVERTED"],
  ["TO_DEPOT", "GATE_WAIT", "DEPOT_ARRIVED"],
  ["TO_DEPOT", "INTAKE", "DEPOT_ARRIVED"],
  ["GATE_WAIT", "INTAKE", "STALL_CLAIMED"],
  ["INTAKE", "QUEUED_SERVICE", "INTAKE_COMPLETED"],
  ["QUEUED_SERVICE", "IN_SERVICE:CLEAN", "SERVICE_STARTED"],
  ["QUEUED_SERVICE", "IN_SERVICE:SERVICE", "SERVICE_STARTED"],
  ["IN_SERVICE:CLEAN", "IN_SERVICE:SERVICE", "SERVICE_STARTED"],
  ["IN_SERVICE:CLEAN", "QUEUED_SERVICE", "SERVICE_COMPLETED"],
  ["IN_SERVICE:CLEAN", "READY_AT_DEPOT", "SERVICE_COMPLETED"],
  ["IN_SERVICE:SERVICE", "READY_AT_DEPOT", "SERVICE_COMPLETED"],
  ["IN_SERVICE:CLEAN", "IN_SERVICE:CLEAN:blocked", "SERVICE_COMPLETED"],
  ["IN_SERVICE:SERVICE", "IN_SERVICE:SERVICE:blocked", "SERVICE_COMPLETED"],
  ["IN_SERVICE:CLEAN:blocked", "IN_SERVICE:SERVICE", "SERVICE_STARTED"],
  ["IN_SERVICE:CLEAN:blocked", "QUEUED_SERVICE", "STALL_CLAIMED"],
  ["IN_SERVICE:CLEAN:blocked", "READY_AT_DEPOT", "STALL_CLAIMED"],
  ["IN_SERVICE:SERVICE:blocked", "READY_AT_DEPOT", "STALL_CLAIMED"],
  ["READY_AT_DEPOT", "REPOSITIONING", "MORNING_RELEASE"],
  ["REPOSITIONING", "IDLE", "REPOSITION_COMPLETED"],
]);

const TABLE = new Set(TRANSITIONS.map((row) => row.join("|")));
const PAIRS = new Set(TRANSITIONS.map(([from, to]) => `${from}|${to}`));

/** Ids of every check this module can report, in report order. */
export const CHECK_IDS = Object.freeze([
  "1", "2", "3", "5", "8", "9", "10", "11", "12", "Conservation", "P13", "P14", "P15", "P16", "P17", "P18", "P19", "P20", "P21",
]);

/** The transition-table label of a car state: the state, plus `:CLEAN` or `:SERVICE` and `:blocked` in a bay (unitless). */
export function stateLabel(state, task, blocked) {
  if (state !== "IN_SERVICE") return state;
  return blocked ? `IN_SERVICE:${task}:blocked` : `IN_SERVICE:${task}`;
}

/** The id of a violation string "<id>: detail". */
export function violationId(text) {
  return text.slice(0, text.indexOf(":"));
}

// ---------------------------------------------------------------------------------------------------------------
// Per-change hooks the engine calls.

/** Check 9 at every state change: `{car, from, to, event, t}` with table labels; t in seconds. */
export function checkTransition({ car, from, to, event, t }) {
  if (TABLE.has(`${from}|${to}|${event}`)) return [];
  return [`9: ${car} changed from ${from} to ${to} on ${event} at ${t}, which the transition table does not allow`];
}

const sameLocation = (a, b) =>
  a !== null && b !== null && a !== undefined && b !== undefined && typeof a === "object" && typeof b === "object" &&
  a.area === b.area && a.depot === b.depot;

/** Check P14 at every leg start: the leg must start where the car stands (`{car, at, from, t}`, locations {area} or {depot}). */
export function checkLegStart({ car, at, from, t }) {
  if (sameLocation(at, from)) return [];
  return [`P14: ${car} starts a leg at ${JSON.stringify(from)} at ${t} while it stands at ${JSON.stringify(at)}`];
}

/** Check 2 at every assignment: a car never holds two requests (`{car, held, request, t}`, held is a request id or null). */
export function checkAssignment({ car, held, request, t }) {
  if (held === null || held === undefined) return [];
  return [`2: ${car} is assigned ${request} at ${t} while it still holds ${held}`];
}

/** Check P13 at every stall claim: stalls held at a depot never exceed its parking (`{depot, held, parking, t}`). */
export function checkStallClaim({ depot, held, parking, t }) {
  if (held <= parking) return [];
  return [`P13: ${depot} holds ${held} stalls at ${t}, above its parking of ${parking}`];
}

/** Check 5 at every task start: bays in use never exceed the depot's bays of that task (`{depot, task, busy, bays, t}`). */
export function checkBayStart({ depot, task, busy, bays, t }) {
  if (busy <= bays) return [];
  const what = task === "CLEAN" ? "cleaning" : "service";
  return [`5: ${depot} has ${busy} ${what} bays in use at ${t}, above its ${bays}`];
}

/** Check 11 at every heap pop: `(time_s, class, seq)` strictly increases; each argument is `[time_s, class, seq]` or null. */
export function checkPopOrder(previous, next) {
  if (previous === null) return [];
  const [t0, c0, s0] = previous;
  const [t1, c1, s1] = next;
  const increases = t1 > t0 || (t1 === t0 && (c1 > c0 || (c1 === c0 && s1 > s0)));
  if (increases) return [];
  return [`11: heap popped (${t1}, ${c1}, ${s1}) after (${t0}, ${c0}, ${s0})`];
}

// ---------------------------------------------------------------------------------------------------------------
// Whole-run checks.

const EVENT_KINDS = new Set([
  "REQUEST_CREATED", "WAIT_DEADLINE", "REQUEST_ASSIGNED", "REQUEST_UNSERVED", "PICKUP_COMPLETED", "TRIP_COMPLETED",
  "DEPOT_ASSIGNED", "DEPOT_ARRIVED", "DEPOT_DIVERTED", "STALL_CLAIMED", "INTAKE_COMPLETED", "SERVICE_STARTED",
  "SERVICE_COMPLETED", "REPOSITION_COMPLETED", "RECALL_ORDERED", "MORNING_RELEASE", "WINDOW_END", "VISIT_CENSORED",
  "LEG_CENSORED", "FIXTURE_HOLD_ENDED",
]);
const REQUEST_STATES = ["WAITING", "ASSIGNED", "COMPLETED", "UNSERVED"];
const DRIVING = new Set(["ENROUTE_PICKUP", "ON_TRIP", "TO_DEPOT", "REPOSITIONING"]);
const place = (loc) => (loc === undefined || loc === null ? "nowhere" : loc.depot !== undefined ? `depot ${loc.depot}` : `area ${loc.area}`);
const label = (iv) => stateLabel(iv.state, iv.task, iv.blocked === true);

function checkFleet(result, options, out) {
  const configured = options.configuredCars ?? null;
  const ids = result.cars.map((c) => c.id);
  if (configured !== null) {
    const want = [...configured].sort().join(",");
    if (ids.slice().sort().join(",") !== want) out.push(`1: the run tracks ${ids.length} cars, not the ${configured.length} configured`);
  } else {
    for (const area of result.scenario.areas) {
      const n = result.cars.filter((c) => c.home_area === area.id).length;
      if (n !== area.cars) out.push(`1: the run tracks ${n} cars with home area ${area.id}, not the ${area.cars} configured`);
    }
    const unexpected = result.cars.filter((c) => !result.scenario.areas.some((a) => a.id === c.home_area)).length;
    if (unexpected > 0) out.push(`1: the run tracks ${unexpected} cars outside every configured area`);
  }
  if (new Set(ids).size !== ids.length) out.push("1: a car id is tracked twice");
  const idText = ids.slice().sort().join(",");
  if (Object.keys(result.intervals).sort().join(",") !== idText) out.push("1: the interval logs do not cover exactly the tracked cars");
  for (const snap of result.snapshots) {
    if (snap.cars.map((c) => c.id).sort().join(",") !== idText) {
      out.push(`1: the snapshot at ${snap.t} holds ${snap.cars.length} cars, not the ${ids.length} tracked`);
      break;
    }
  }
}

function checkRequests(result, logs, out) {
  // 2: per car, assignment to drop-off spans never overlap.
  const byCar = new Map();
  for (const r of result.requests) {
    if (r.car === null || r.car === undefined) continue;
    if (!byCar.has(r.car)) byCar.set(r.car, []);
    byCar.get(r.car).push(r);
  }
  for (const [car, list] of byCar) {
    list.sort((a, b) => a.assigned_s - b.assigned_s);
    for (let i = 1; i < list.length; i += 1) {
      const end = list[i - 1].dropoff_s ?? result.drain_end_s;
      if (list[i].assigned_s < end) out.push(`2: ${car} holds ${list[i - 1].id} until ${end} and is assigned ${list[i].id} at ${list[i].assigned_s}`);
    }
  }
  // 3: at most one terminal state, and exactly one after the drain.
  const terminalEvents = new Map();
  if (logs) {
    for (const e of result.events) {
      if ((e.kind === "REQUEST_UNSERVED" || e.kind === "TRIP_COMPLETED") && e.req !== undefined) {
        terminalEvents.set(e.req, (terminalEvents.get(e.req) ?? 0) + 1);
      }
    }
  }
  for (const r of result.requests) {
    if (r.state !== "COMPLETED" && r.state !== "UNSERVED") out.push(`3: request ${r.id} ends the drain in state ${r.state}`);
    if (r.dropoff_s !== null && r.unserved_s !== null && r.dropoff_s !== undefined && r.unserved_s !== undefined) {
      out.push(`3: request ${r.id} reached both COMPLETED and UNSERVED`);
    }
    if ((terminalEvents.get(r.id) ?? 0) > 1) out.push(`3: request ${r.id} has ${terminalEvents.get(r.id)} terminal events`);
  }
  // 8: a completed request has a pickup, and drop-off >= pickup >= request time.
  const pickups = new Map();
  if (logs) for (const e of result.events) if (e.kind === "PICKUP_COMPLETED" && e.req !== undefined && !pickups.has(e.req)) pickups.set(e.req, e.t);
  for (const r of result.requests) {
    if (r.state !== "COMPLETED") continue;
    const pickup = logs ? pickups.get(r.id) : r.pickup_s;
    if (pickup === undefined || pickup === null) {
      out.push(`8: completed request ${r.id} has no pickup event`);
    } else if (!(r.time_s <= pickup && pickup <= r.dropoff_s) || (logs && pickup !== r.pickup_s)) {
      out.push(`8: request ${r.id} created at ${r.time_s} is picked up at ${pickup} and dropped off at ${r.dropoff_s}`);
    }
  }
  // Conservation: request states partition the population.
  const counts = Object.fromEntries(REQUEST_STATES.map((s) => [s, 0]));
  let other = 0;
  for (const r of result.requests) {
    if (Object.prototype.hasOwnProperty.call(counts, r.state)) counts[r.state] += 1;
    else other += 1;
  }
  const sum = REQUEST_STATES.reduce((n, s) => n + counts[s], 0);
  if (other > 0 || sum !== result.requests.length) {
    out.push(`Conservation: ${REQUEST_STATES.map((s) => `${counts[s]} ${s}`).join(", ")} and ${other} in no request state, of ${result.requests.length} requests`);
  }
}

function checkReferences(result, logs, out) {
  const cars = new Set(result.cars.map((c) => c.id));
  const reqs = new Set(result.requests.map((r) => r.id));
  const depots = new Set(result.depots.map((d) => d.id));
  const areas = new Set(result.scenario.areas.map((a) => a.id));
  const bad = (what) => out.push(`10: ${what}`);
  const locOk = (loc) => loc !== null && typeof loc === "object" && (loc.depot !== undefined ? depots.has(loc.depot) : areas.has(loc.area));
  if (logs) {
    for (const e of result.events) {
      if (!EVENT_KINDS.has(e.kind)) bad(`event ${e.ord} has unknown kind ${e.kind}`);
      if (e.car !== undefined && !cars.has(e.car)) bad(`event ${e.ord} ${e.kind} names unknown car ${e.car}`);
      if (e.req !== undefined && !reqs.has(e.req)) bad(`event ${e.ord} ${e.kind} names unknown request ${e.req}`);
      if (e.depot !== undefined && !depots.has(e.depot)) bad(`event ${e.ord} ${e.kind} names unknown depot ${e.depot}`);
      if (e.detail?.to !== undefined && !depots.has(e.detail.to)) bad(`event ${e.ord} ${e.kind} diverts to unknown depot ${e.detail.to}`);
    }
  }
  for (const [car, list] of Object.entries(result.intervals)) {
    for (const iv of list) {
      if (iv.request !== undefined && !reqs.has(iv.request)) bad(`${car} interval at ${iv.t0} names unknown request ${iv.request}`);
      if (iv.depot !== undefined && !depots.has(iv.depot)) bad(`${car} interval at ${iv.t0} names unknown depot ${iv.depot}`);
      for (const loc of [iv.location, iv.from, iv.to]) if (loc !== undefined && !locOk(loc)) bad(`${car} interval at ${iv.t0} names unknown place ${JSON.stringify(loc)}`);
    }
  }
  for (const v of result.visits) {
    if (!cars.has(v.car) || !depots.has(v.depot)) bad(`visit at ${v.arrival_s} names car ${v.car} and depot ${v.depot}`);
  }
  for (const r of result.requests) {
    if (!areas.has(r.origin) || !areas.has(r.dest)) bad(`request ${r.id} names areas ${r.origin} and ${r.dest}`);
    if (r.car !== null && r.car !== undefined && !cars.has(r.car)) bad(`request ${r.id} names unknown car ${r.car}`);
  }
}

function checkLog(result, out) {
  for (let i = 1; i < result.events.length; i += 1) {
    const a = result.events[i - 1];
    const b = result.events[i];
    if (!(b.ord > a.ord) || b.t < a.t) {
      out.push(`11: log entry ${b.ord} at ${b.t} follows entry ${a.ord} at ${a.t}`);
      return;
    }
  }
}

function checkDepotSeries(result, out) {
  for (const d of result.depots) {
    for (const row of d.series) {
      if (row[4] > d.cleaning_bays) out.push(`5: ${d.id} has ${row[4]} cleaning bays in use at ${row[0]}, above its ${d.cleaning_bays}`);
      if (row[5] > d.service_bays) out.push(`5: ${d.id} has ${row[5]} service bays in use at ${row[0]}, above its ${d.service_bays}`);
      if (row[1] > d.parking) out.push(`P13: ${d.id} holds ${row[1]} stalls at ${row[0]}, above its parking of ${d.parking}`);
      if (row.slice(1).some((n) => n < 0)) out.push(`P16: ${d.id} has a count below zero in its series row at ${row[0]}`);
    }
  }
}

const STALL_STATES = new Set(["INTAKE", "QUEUED_SERVICE", "READY_AT_DEPOT"]);
const HOLD_COLUMN = { STALL: 0, CLEANING: 1, SERVICE: 2 };
const OCCUPANCY = [["stalls_held", 1], ["clean_busy", 4], ["service_busy", 5]];

/**
 * P13 and 5 on occupancy rebuilt from car states, not from the engine's counters: cars holding a stall (INTAKE,
 * QUEUED_SERVICE, READY_AT_DEPOT) and cars in a bay by task (blocked included) at each depot, plus the result's fixture
 * holds. Counts are taken at the end of each second (a zero-length interval never counts; a car's last interval lasts
 * past the drain end). P16: series columns stalls_held, clean_busy and service_busy equal the rebuilt counts at every
 * second either one changes.
 */
function checkOccupancy(result, out) {
  const changes = new Map(result.depots.map((d) => [d.id, new Map()]));
  const add = (depot, t, column, delta) => {
    const byTime = changes.get(depot);
    if (!byTime.has(t)) byTime.set(t, [0, 0, 0]);
    byTime.get(t)[column] += delta;
  };
  for (const list of Object.values(result.intervals)) {
    list.forEach((iv, i) => {
      const depot = iv.location?.depot;
      if (depot === undefined || !changes.has(depot)) return;
      const column = STALL_STATES.has(iv.state) ? 0 : iv.state !== "IN_SERVICE" ? -1 : iv.task === "CLEAN" ? 1 : 2;
      const t1 = i === list.length - 1 ? Infinity : iv.t1;
      if (column < 0 || !(t1 > iv.t0)) return;
      add(depot, iv.t0, column, 1);
      if (t1 !== Infinity) add(depot, t1, column, -1);
    });
  }
  for (const d of result.depots) {
    for (const hold of d.holds ?? []) {
      add(d.id, result.window.start_s, HOLD_COLUMN[hold.resource], 1);
      if (hold.until_s <= result.drain_end_s) add(d.id, hold.until_s, HOLD_COLUMN[hold.resource], -1);
    }
  }
  for (const d of result.depots) {
    const byTime = changes.get(d.id);
    const times = [...new Set([...byTime.keys(), ...d.series.map((row) => row[0])])].sort((a, b) => a - b);
    const limits = [["P13", d.parking, "cars holding stalls", "parking"], ["5", d.cleaning_bays, "cars in cleaning bays", "cleaning bays"], ["5", d.service_bays, "cars in service bays", "service bays"]];
    const counts = [0, 0, 0];
    const reported = new Set();
    const once = (key, text) => {
      if (reported.has(key)) return;
      reported.add(key);
      out.push(text);
    };
    let row = -1;
    for (const t of times) {
      const delta = byTime.get(t);
      if (delta !== undefined) for (let c = 0; c < 3; c += 1) counts[c] += delta[c];
      while (row + 1 < d.series.length && d.series[row + 1][0] <= t) row += 1;
      limits.forEach(([id, limit, what, of], c) => {
        if (counts[c] > limit) once(`limit${c}`, `${id}: ${d.id} has ${counts[c]} ${what} at ${t} by the interval log, above its ${of} of ${limit}`);
      });
      if (row < 0) continue;
      OCCUPANCY.forEach(([name, col], c) => {
        if (d.series[row][col] !== counts[c]) once(`series${c}`, `P16: ${d.id} ${name} reads ${d.series[row][col]} at ${t}, the interval log gives ${counts[c]}`);
      });
    }
  }
}

function checkIntervals(result, out) {
  const lo = result.window.start_s;
  const hi = result.window.end_s;
  const releaseAt = result.scenario.policies.release_s;
  const homeOf = new Map(result.cars.map((c) => [c.id, c.home_area]));
  const areaOfDepot = new Map(result.scenario.depots.map((d) => [d.id, d.area]));
  const areaOf = (loc) => (loc.depot !== undefined ? areaOfDepot.get(loc.depot) : loc.area);
  let arrivals = 0;
  for (const [car, list] of Object.entries(result.intervals)) {
    // P15: contiguous from the window start to the drain end; clipped seconds equal the window length.
    let total = 0;
    for (let i = 0; i < list.length; i += 1) {
      const iv = list[i];
      total += Math.max(0, Math.min(iv.t1, hi) - Math.max(iv.t0, lo));
      if (iv.t1 < iv.t0) out.push(`P15: ${car} has an interval from ${iv.t0} to ${iv.t1}`);
      if (i > 0 && iv.t0 !== list[i - 1].t1) out.push(`P15: ${car} has a gap or overlap at ${iv.t0} after ${list[i - 1].t1}`);
    }
    if (list.length > 0 && (list[0].t0 !== lo || list[list.length - 1].t1 !== result.drain_end_s)) {
      out.push(`P15: ${car} is logged from ${list[0].t0} to ${list[list.length - 1].t1}, not from ${lo} to ${result.drain_end_s}`);
    }
    if (total !== hi - lo) out.push(`P15: ${car} has ${total} clipped state seconds, not the window's ${hi - lo}`);

    // 9 on consecutive states; P14 on places; P17 on depot legs; P20 on releases and dispatch from a depot.
    if (list.length > 0 && list[0].state !== "IDLE" && list[0].state !== "READY_AT_DEPOT") {
      out.push(`9: ${car} starts the run in state ${label(list[0])}`);
    }
    let at = list.length > 0 ? list[0].location : undefined;
    for (let i = 0; i < list.length; i += 1) {
      const iv = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      if (prev !== null && !PAIRS.has(`${label(prev)}|${label(iv)}`)) {
        out.push(`9: ${car} changed from ${label(prev)} to ${label(iv)} at ${iv.t0}, which the transition table does not allow`);
      }
      if (DRIVING.has(iv.state)) {
        if (!sameLocation(iv.from, at)) out.push(`P14: ${car} starts a leg at ${place(iv.from)} at ${iv.t0} while it stands at ${place(at)}`);
        at = iv.to;
      } else if (!sameLocation(iv.location, at)) {
        out.push(`P14: ${car} is at ${place(iv.location)} at ${iv.t0} while its last place was ${place(at)}`);
        at = iv.location;
      }
      if (iv.state === "TO_DEPOT") {
        const next = i + 1 < list.length ? list[i + 1] : null;
        if (next === null) {
          if (iv.censored !== true || iv.t1 !== result.drain_end_s) out.push(`P17: ${car}'s depot leg from ${iv.t0} ends without an arrival, a diversion or censoring`);
        } else if (next.state === "INTAKE" || next.state === "GATE_WAIT") {
          arrivals += 1;
        } else if (next.state !== "TO_DEPOT") {
          out.push(`P17: ${car}'s depot leg from ${iv.t0} ends in ${label(next)}`);
        }
      }
      if (iv.state === "REPOSITIONING") {
        const fromArea = iv.from ? areaOf(iv.from) : null;
        if (iv.t0 !== releaseAt || fromArea === homeOf.get(car) || prev?.state !== "READY_AT_DEPOT") {
          out.push(`P20: ${car} repositions at ${iv.t0} from ${place(iv.from)} with home area ${homeOf.get(car)}`);
        }
      }
      if (iv.state === "ENROUTE_PICKUP" && prev?.state === "READY_AT_DEPOT" && iv.request === undefined) {
        out.push(`P20: ${car} leaves a depot for a pickup at ${iv.t0} without a request`);
      }
    }
  }
  // P17: visits started equal completed plus censored.
  let completed = 0;
  let censored = 0;
  for (const v of result.visits) {
    const done = v.ready_s !== null && v.ready_s !== undefined;
    if (done === (v.censored === true)) out.push(`P17: visit of ${v.car} at ${v.arrival_s} is ${done ? "both completed and censored" : "neither completed nor censored"}`);
    else if (done) completed += 1;
    else censored += 1;
  }
  if (arrivals !== result.visits.length || completed + censored !== result.visits.length) {
    out.push(`P17: ${arrivals} depot arrivals started visits, but ${result.visits.length} visits are logged (${completed} completed, ${censored} censored)`);
  }
}

function checkReleaseDispatch(result, out) {
  const assigned = new Set();
  for (const e of result.events) if (e.kind === "REQUEST_ASSIGNED") assigned.add(`${e.car}|${e.t}`);
  for (const [car, list] of Object.entries(result.intervals)) {
    for (let i = 1; i < list.length; i += 1) {
      if (list[i].state === "ENROUTE_PICKUP" && list[i - 1].state === "READY_AT_DEPOT" && !assigned.has(`${car}|${list[i].t0}`)) {
        out.push(`P20: ${car} leaves a depot for a pickup at ${list[i].t0} with no dispatch decision`);
      }
    }
  }
}

function checkSeriesIntegrals(result, out) {
  const end = result.drain_end_s;
  const columns = [["queue", 2], ["gate", 3], ["blocked", 6], ["ready", 7]];
  const fromIntervals = new Map(result.depots.map((d) => [d.id, { queue: 0, gate: 0, blocked: 0, ready: 0 }]));
  for (const list of Object.values(result.intervals)) {
    for (const iv of list) {
      const depot = iv.location?.depot;
      if (depot === undefined || !fromIntervals.has(depot)) continue;
      const s = Math.max(0, Math.min(iv.t1, end) - iv.t0);
      const acc = fromIntervals.get(depot);
      if (iv.state === "QUEUED_SERVICE") acc.queue += s;
      else if (iv.state === "GATE_WAIT") acc.gate += s;
      else if (iv.state === "IN_SERVICE" && iv.blocked) acc.blocked += s;
      else if (iv.state === "READY_AT_DEPOT") acc.ready += s;
    }
  }
  for (const d of result.depots) {
    const running = { queue: 0, gate: 0, blocked: 0, ready: 0 };
    for (let i = 0; i < d.series.length; i += 1) {
      const t0 = d.series[i][0];
      const t1 = i + 1 < d.series.length ? d.series[i + 1][0] : end;
      for (const [name, col] of columns) running[name] += d.series[i][col] * Math.max(0, Math.min(t1, end) - t0);
    }
    const acc = fromIntervals.get(d.id);
    for (const [name] of columns) {
      if (running[name] !== acc[name]) out.push(`P16: ${d.id} ${name} car-seconds from the interval log are ${acc[name]}, the running total is ${running[name]}`);
    }
  }
}

function checkPartition(result, out) {
  for (const text of partitionViolations(result)) out.push(text);
}

/**
 * Check P21: for every count or seconds metric that accepts `area` or `depot`, the values over every area, or every
 * depot, sum to the unscoped value over the measurement span. `compute` defaults to computeMetric (tests pass a faulty one).
 */
export function partitionViolations(result, compute = computeMetric) {
  const out = [];
  const scenario = result.scenario;
  for (const m of METRICS) {
    if (!m.partition) continue;
    const key = m.scopes.includes("area") ? "area" : "depot";
    const parts = key === "area" ? scenario.areas.map((a) => a.id) : scenario.depots.map((d) => d.id);
    const whole = compute(result, { metric: m.name, scope: {} }).value;
    let sum = 0;
    for (const id of parts) sum += compute(result, { metric: m.name, scope: { [key]: id } }).value;
    if (sum !== whole) out.push(`P21: ${m.name} sums to ${sum} over every ${key}, but reads ${whole} unscoped`);
  }
  return out;
}

function checkHomes(result, out) {
  const areas = new Set(result.scenario.areas.map((a) => a.id));
  const depots = new Set(result.scenario.depots.map((d) => d.id));
  for (const c of result.cars) {
    if (!areas.has(c.home_area) || !depots.has(c.home_depot)) out.push(`P19: ${c.id} has home area ${c.home_area} and home depot ${c.home_depot}`);
  }
  const { recall_s, release_s } = result.scenario.policies;
  if (release_s !== null && !(release_s > recall_s)) out.push(`P19: the release at ${release_s} is not later than the recall at ${recall_s}`);
}

const ORDER = new Map(CHECK_IDS.map((id, i) => [id, i]));

/**
 * Whole-run checks on an engine result (contract 6.5); returns strings "<id>: detail" sorted by check id, stable inside
 * one id. `options.configuredCars` lists the configured car ids when the run's fleet is not built from SUP-1.
 */
export function checkRun(result, options = {}) {
  const out = [];
  const logs = result.events.length > 0;
  checkFleet(result, options, out);
  checkRequests(result, logs, out);
  checkReferences(result, logs, out);
  if (logs) checkLog(result, out);
  checkDepotSeries(result, out);
  checkOccupancy(result, out);
  checkIntervals(result, out);
  if (logs) checkReleaseDispatch(result, out);
  checkSeriesIntegrals(result, out);
  checkHomes(result, out);
  checkPartition(result, out);
  return out
    .map((text, i) => [ORDER.get(violationId(text)) ?? CHECK_IDS.length, i, text])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map((entry) => entry[2]);
}

/** Every violation of a run: the engine's per-change ones, then checkRun's (strings "<id>: detail"). */
export function runViolations(result, options = {}) {
  return [...result.invariant_violations, ...checkRun(result, options)];
}

/** Lowercase hex SHA-256 of a run's event log, intervals, visits, requests and drain end (check 12). */
export function runDigest(result) {
  return sha256Hex(JSON.stringify([result.events, result.intervals, result.visits, result.requests, result.drain_end_s]));
}

/** Check 12: two runs of the same world, policy and seed replay to one digest. */
export function checkReplay(first, second) {
  const a = runDigest(first);
  const b = runDigest(second);
  if (a === b) return [];
  return [`12: seed ${first.seed} replayed to digest ${b.slice(0, 12)}, not ${a.slice(0, 12)}`];
}

/**
 * Check P18 on a frozen world and the arm scenarios that read it: the digest is recomputed from the candidate stream,
 * each arm shares the world's name, window and sigma, and `lambda_a(h) <= lambda_max_a` in every window hour.
 */
export function checkWorld(world, scenarios) {
  const out = [];
  const { start_s, end_s } = world.window;
  for (const scenario of scenarios) {
    if (scenario.name !== world.name || scenario.window.start_s !== start_s || scenario.window.end_s !== end_s || scenario.sigma_permille !== world.sigma_permille) {
      out.push(`P18: scenario ${scenario.name} does not match the world's name, window or travel variation`);
      continue;
    }
    const profile = lambdaProfilePermille(scenario);
    for (const id of Object.keys(profile)) {
      for (let h = Math.floor(start_s / 3600); h < Math.ceil(end_s / 3600); h += 1) {
        if (profile[id][h] > world.lambdaMaxPermille[id]) {
          out.push(`P18: area ${id} asks for ${profile[id][h]} thousandths in hour ${h}, above the envelope ${world.lambdaMaxPermille[id]}`);
          break;
        }
      }
    }
  }
  return out;
}

/** Check P18 across arms: every run result of one seed carries the same world digest (and `world` when given). */
export function checkArms(results, world = null) {
  const want = world === null ? results[0]?.world_digest : worldDigest(world);
  return results
    .filter((r) => r.world_digest !== want)
    .map((r) => `P18: a run of seed ${r.seed} reads world ${String(r.world_digest).slice(0, 12)}, not ${String(want).slice(0, 12)}`);
}

/** Check P19 when a scenario loads: every validateScenario error as "P19: what: why". */
export function checkScenario(scenario) {
  const verdict = validateScenario(scenario);
  return verdict.errors.map((e) => `P19: ${e.what}: ${e.why}`);
}
