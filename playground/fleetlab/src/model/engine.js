// The teaching engine (contract 6.4; design 3.2, 5.3, 5.4, 5.5, 5.7, 5.9).
//
// A discrete-event run over one frozen world. Heap events are ordered by (time_s, class, seq); decision events are
// logged by the handler that causes them. Every state change goes through `transition`, which checks the design 5.3
// table through the invariant hook and appends to the car's interval log. Every quantity is an integer.
//
// Decisions this file makes where the contract is silent (reported with the build):
// - A visit record is created when the car reaches a depot and claims a stall or waits at its gate; the car's visit
//   counter (and so the service cadence) advances when the depot leg starts. A diversion keeps the visit number.
// - Depot assignment logs a decision event DEPOT_ASSIGNED {car, depot, detail: {purpose, cause}}.
// - The recall and the release act on the cars in the stated state when their clock event pops; a car that reaches
//   that state as a consequence at the same second is not moved by that event. The recall acts once: it sends IDLE
//   cars and marks cars on a pickup or a trip, and a marked car goes to a depot when that trip completes, if the
//   completion falls before the release (or the window end when the release is off); the mark clears at completion.
//   This replaces the pending recall of design 5.3 (the Recall paragraph, POL-3, the ON_TRIP rows and the POL-3
//   policy row), where a car dispatched from a depot during the recall also returned; that text awaits amendment.
// - Access and in-area segments carry cls "IN_AREA" (the congestion row they read); PULL_OUT carries nulls.
// - With keepLogs false the event list and snapshots are empty; intervals, visits, requests and depot series stay,
//   because the metrics read them.
// - The fixture hook of test/engine-fixtures.test.mjs (`options.fixture`) is implemented as documented there; each
//   result depot lists its fixture holds as `holds: [{resource, until_s}]` (empty without a fixture), so the whole-run
//   checks can rebuild stall and bay occupancy from the interval log.
// - Hand-off (design 3.3 and 5.3 are silent; without it a depot can lock for good): when every stall is held, every bay
//   of a task holds a car, one of them is blocked and a car is queued for that task, the queued car gives up its stall
//   and starts the task while the blocked car takes the stall, at the same second (STALL_CLAIMED, then SERVICE_STARTED).
// - DEPOT_DIVERTED logs `detail: {to, cause}`, the cause `nearest_free_stall`, with `_service_bays_only` when skipping
//   depots without a service bay changed the target.
// - Heap times run to MAX_EVENT_TIME_S (2^23 - 1), a bound derived from the schema maxima (see the constant).

import { specDigest } from "../core/canon.js";
import { checkAssignment, checkBayStart, checkLegStart, checkPopOrder, checkStallClaim, checkTransition, stateLabel } from "./invariants.js";
import { assignDepot, depotCanServe, divertDepot, homeDepotFor, homeDepotSets, nearestIdle, releasesHome, visitIncludesService } from "./policies.js";
import { chooseRoute, pathSegments, planPath, plannedLegSeconds } from "./routes.js";
import { acceptedRequests, realizedSeconds, worldDigest } from "./world.js";

/** Seconds between playback snapshots. */
export const SNAPSHOT_STEP_S = 300;

/** Defects a test may seed; each must be caught by its own named invariant (design 9.5). */
export const DEFECTS = Object.freeze(["double_assign", "bay_overfill", "lot_overfill", "teleport", "illegal_transition"]);

const KINDS = [
  "PICKUP_COMPLETED", "TRIP_COMPLETED", "DEPOT_ARRIVED", "INTAKE_COMPLETED", "SERVICE_COMPLETED", "REPOSITION_COMPLETED",
  "FIXTURE_HOLD_ENDED", "REQUEST_CREATED", "WAIT_DEADLINE", "RECALL_ORDERED", "MORNING_RELEASE", "WINDOW_END",
];
const K = Object.fromEntries(KINDS.map((name, i) => [name, i]));
const CLASS_OF = [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 4];
const SEQ_SPAN = 134217728; // 2^27 pushes
/**
 * The latest second an event may be scheduled at: 2^23 - 1, so (time x 8 + class) x 2^27 + seq stays below 2^53.
 * Derived bound (test/engine.test.mjs recomputes it from the schema maxima and the σ 500 table): a push happens at an
 * event second t <= T_d and adds at most one leg, intake, clean or service; T_d is at most the last drop-off, which is
 * at most (end_s - 1 + patience_s) + a pickup leg + a trip leg, each realized at the top multiplier for both factors.
 * With end_s 172,800, patience 3,600, pull-out 600, routes 14,400 s at congestion 3000 and depot access 300 at 3000,
 * that is under 7.2 million seconds.
 */
export const MAX_EVENT_TIME_S = 8388607;
const PPM = 1000000;
const DRIVING = new Set(["ENROUTE_PICKUP", "ON_TRIP", "TO_DEPOT", "REPOSITIONING"]);

/** A binary min-heap on typed arrays; the key packs (time_s, class, seq) into one exact double. */
function createHeap() {
  let keys = new Float64Array(4096);
  let data = new Int32Array(4096);
  let size = 0;
  const swap = (i, j) => {
    const k = keys[i];
    keys[i] = keys[j];
    keys[j] = k;
    const d = data[i];
    data[i] = data[j];
    data[j] = d;
  };
  return {
    get size() {
      return size;
    },
    push(key, payload) {
      if (size === keys.length) {
        const nk = new Float64Array(size * 2);
        nk.set(keys);
        keys = nk;
        const nd = new Int32Array(size * 2);
        nd.set(data);
        data = nd;
      }
      let i = size++;
      keys[i] = key;
      data[i] = payload;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (keys[parent] <= keys[i]) break;
        swap(i, parent);
        i = parent;
      }
    },
    topKey() {
      return keys[0];
    },
    pop() {
      const key = keys[0];
      const payload = data[0];
      size -= 1;
      if (size > 0) {
        keys[0] = keys[size];
        data[0] = data[size];
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < size && keys[l] < keys[m]) m = l;
          if (r < size && keys[r] < keys[m]) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return [key, payload];
    },
  };
}

const keyTime = (key) => Math.floor(key / SEQ_SPAN / 8);
const decodeKey = (key) => {
  const seq = key % SEQ_SPAN;
  const rest = (key - seq) / SEQ_SPAN;
  const cls = rest % 8;
  return [(rest - cls) / 8, cls, seq];
};

const locKey = (loc) => (loc.depot !== undefined ? `D${loc.depot}` : `A${loc.area}`);
const byIdx = (a, b) => a.idx - b.idx;

/** Inserts `item` into `list` kept sorted by `(item[field], item.car.idx)`. */
function insertSorted(list, item, field) {
  let i = list.length;
  while (i > 0 && (list[i - 1][field] > item[field] || (list[i - 1][field] === item[field] && list[i - 1].car.idx > item.car.idx))) i -= 1;
  list.splice(i, 0, item);
}

function removeCar(list, car) {
  const i = list.findIndex((entry) => entry.car === car);
  if (i >= 0) list.splice(i, 1);
}

function fleetFromScenario(scenario) {
  const sets = homeDepotSets(scenario);
  const specs = [];
  for (const area of scenario.areas) {
    for (let n = 1; n <= area.cars; n++) {
      specs.push({
        id: `${area.id}-${String(n).padStart(3, "0")}`,
        home_area: area.id,
        home_depot: homeDepotFor(sets, area.id, n - 1),
        state: "IDLE",
        location: { area: area.id },
        trips_since_visit: 0,
        visits: 0,
      });
    }
  }
  return specs;
}

function checkFixture(scenario, fixture) {
  const areas = new Set(scenario.areas.map((a) => a.id));
  const depots = new Set(scenario.depots.map((d) => d.id));
  const seen = new Set();
  for (const c of fixture.cars ?? []) {
    const ok =
      typeof c.id === "string" && !seen.has(c.id) && areas.has(c.home_area) && c.id.startsWith(`${c.home_area}-`) &&
      depots.has(c.home_depot) && Number.isSafeInteger(c.trips_since_visit) && c.trips_since_visit >= 0 &&
      Number.isSafeInteger(c.visits) && c.visits >= 0 &&
      ((c.state === "IDLE" && areas.has(c.location?.area)) || (c.state === "READY_AT_DEPOT" && depots.has(c.location?.depot)));
    if (!ok) throw new RangeError(`fixture car ${JSON.stringify(c)} is not a valid fixture car`);
    seen.add(c.id);
  }
  for (const r of fixture.requests ?? []) {
    const ok = typeof r.id === "string" && Number.isSafeInteger(r.time_s) && r.time_s >= scenario.window.start_s &&
      r.time_s < scenario.window.end_s && areas.has(r.origin) && areas.has(r.dest);
    if (!ok) throw new RangeError(`fixture request ${JSON.stringify(r)} is not a valid fixture request`);
  }
  for (const [id, occ] of Object.entries(fixture.depotOccupancy ?? {})) {
    if (!depots.has(id)) throw new RangeError(`fixture occupancy names unknown depot ${id}`);
    for (const list of [occ.stalls, occ.cleaning, occ.service]) {
      for (const until of list ?? []) {
        if (!Number.isSafeInteger(until) || until <= scenario.window.start_s) throw new RangeError(`fixture hold at ${id} ends at ${until}`);
      }
    }
  }
}

const scenarioDigestCache = new WeakMap();
function scenarioDigestOf(scenario) {
  let digest = scenarioDigestCache.get(scenario);
  if (digest === undefined) {
    digest = specDigest(scenario);
    scenarioDigestCache.set(scenario, digest);
  }
  return digest;
}

/**
 * Creates a resumable run of `scenario` on the frozen `world` (contract 6.4). Options: `seed` (must equal the world's),
 * `defect` (one of DEFECTS or null), `keepLogs` (event list and snapshots), `fixture` (test hook). Returns
 * `{step(maxEvents): boolean, result(), runToEnd(), finished}`; step returns true once the drain end is reached.
 */
export function createRun(scenario, world, { seed, defect = null, keepLogs = true, fixture = null } = {}) {
  if (seed !== world.seed) throw new RangeError(`the run seed ${String(seed)} differs from the world seed ${world.seed}`);
  if (defect !== null && !DEFECTS.includes(defect)) throw new RangeError(`unknown defect ${String(defect)}`);
  if (fixture !== null) checkFixture(scenario, fixture);

  const start_s = scenario.window.start_s;
  const end_s = scenario.window.end_s;
  const sigmaZero = scenario.sigma_permille === 0;
  const policies = scenario.policies;
  const releaseOrEnd = policies.release_s ?? end_s;
  const routeCls = Object.fromEntries(scenario.routes.map((r) => [r.id, r.cls]));
  const defectUsed = new Set();
  const useDefect = (name) => {
    if (defect !== name || defectUsed.has(name)) return false;
    defectUsed.add(name);
    return true;
  };

  const counters = {
    heap_pushes: 0, heap_pops: 0, log_entries: 0, transitions: 0, legs: 0, segments: 0,
    dispatch_calls: 0, dispatch_location_scans: 0, plan_calls: 0, plan_cache_hits: 0, snapshots: 0,
  };
  const violations = [];
  const flag = (list) => {
    for (const v of list) violations.push(v);
  };

  // Depots, sorted by id.
  const depots = scenario.depots
    .map((d) => ({
      id: d.id, area: d.area, parking: d.parking, cleaning_bays: d.cleaning_bays, service_bays: d.service_bays,
      held: 0, cleanBusy: 0, serviceBusy: 0, inbound: 0, ready: 0, queue: [], gate: [], blocked: [],
      diversions_s: [], series: [], dirty: true,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const depotById = new Map(depots.map((d) => [d.id, d]));

  // Cars, sorted by id; the index order is the id order.
  const specs = (fixture !== null && fixture.cars ? fixture.cars : fleetFromScenario(scenario))
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cars = specs.map((s, idx) => ({
    id: s.id, idx, home_area: s.home_area, home_depot: s.home_depot, state: s.state, task: null, blocked: false,
    loc: s.state === "IDLE" ? { area: s.location.area } : { depot: s.location.depot },
    trips: s.trips_since_visit, visits: s.visits, request: -1, extra: [], target: null, serviceDue: false, recalled: false,
    cleanDone: false, visit: null, legEnd: 0, iv: null, intervals: [], bucket: null,
  }));
  const carById = new Map(cars.map((c) => [c.id, c]));

  // Requests, sorted by (time_s, id).
  const sourceRequests = fixture !== null && fixture.requests
    ? fixture.requests.slice().sort((a, b) => a.time_s - b.time_s || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    : acceptedRequests(world, scenario);
  const requests = sourceRequests.map((r) => ({
    id: r.id, time_s: r.time_s, origin: r.origin, dest: r.dest, state: null, car: null,
    assigned_s: null, pickup_s: null, dropoff_s: null, unserved_s: null,
  }));
  const ridePpmOf = new Array(requests.length).fill(0);
  let nonterminal = requests.length;
  const waiting = [];

  // Heap and log.
  const heap = createHeap();
  let seq = 0;
  const push = (t, kind, entity) => {
    if (!Number.isSafeInteger(t) || t < 0 || t > MAX_EVENT_TIME_S) throw new RangeError(`event time ${t} is outside the heap's range`);
    if (seq >= SEQ_SPAN) throw new RangeError("too many heap pushes");
    heap.push((t * 8 + CLASS_OF[kind]) * SEQ_SPAN + seq, (entity + 1) * 16 + kind);
    seq += 1;
    counters.heap_pushes += 1;
  };
  const events = [];
  let ord = 0;
  let lastLogT = 0;
  const log = (t, kind, fields) => {
    if (t < lastLogT) violations.push(`11: log entry ${ord} at ${t} follows an entry at ${lastLogT}`);
    lastLogT = t;
    if (keepLogs) {
      const entry = { ord, t, kind };
      if (fields !== undefined) Object.assign(entry, fields);
      events.push(entry);
    }
    ord += 1;
    counters.log_entries += 1;
  };

  // Planned arrivals for policies, cached per departure second and cleared each quarter hour (design 5.9).
  let planCache = new Map();
  let planQuarter = -1;
  const plan = (from, to, t, purpose) => {
    counters.plan_calls += 1;
    const quarter = Math.floor(t / 900);
    if (quarter !== planQuarter) {
      planCache = new Map();
      planQuarter = quarter;
    }
    const key = `${locKey(from)}>${locKey(to)}|${t}|${purpose}`;
    let arrive = planCache.get(key);
    if (arrive === undefined) {
      arrive = planPath(scenario, from, to, t, purpose).arrive_s;
      planCache.set(key, arrive);
    } else {
      counters.plan_cache_hits += 1;
    }
    return arrive;
  };

  // Dispatchable cars bucketed by location (design 5.9).
  const buckets = new Map();
  const bucketAdd = (car) => {
    const key = locKey(car.loc);
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = { location: car.loc.depot !== undefined ? { depot: car.loc.depot } : { area: car.loc.area }, cars: [] };
      buckets.set(key, bucket);
    }
    let i = bucket.cars.length;
    while (i > 0 && bucket.cars[i - 1].idx > car.idx) i -= 1;
    bucket.cars.splice(i, 0, car);
    car.bucket = bucket;
  };
  const bucketRemove = (car) => {
    if (car.bucket === null) return;
    const list = car.bucket.cars;
    list.splice(list.indexOf(car), 1);
    car.bucket = null;
  };

  // State changes and legs.
  let carFreed = false;
  const transition = (car, to, event, t, fields = {}, task = null, blocked = false) => {
    const from = stateLabel(car.state, car.task, car.blocked);
    car.state = to;
    car.task = to === "IN_SERVICE" ? task : null;
    car.blocked = to === "IN_SERVICE" && blocked;
    flag(checkTransition({ car: car.id, from, to: stateLabel(to, car.task, car.blocked), event, t }));
    car.iv.t1 = t;
    const iv = { state: to, t0: t, t1: null };
    if (car.task !== null) iv.task = car.task;
    if (car.blocked) iv.blocked = true;
    Object.assign(iv, fields);
    car.intervals.push(iv);
    car.iv = iv;
    counters.transitions += 1;
    if (to === "IDLE" || to === "READY_AT_DEPOT") carFreed = true;
  };

  /** Realizes a leg's segments in a chain from `t` (contract 6.4 Legs); returns `{from, to, segments, t1}`. */
  const startLeg = (car, from, to, t, purpose, rideIndex, loaded) => {
    flag(checkLegStart({ car: car.id, at: car.loc, from, t }));
    const kinds = pathSegments(from, to, purpose);
    const segments = [];
    let cur = t;
    for (const s of kinds) {
      let dur;
      let key = null;
      let dir = null;
      let cls = null;
      if (s.kind === "PULL_OUT") {
        dur = scenario.pull_out_s;
      } else {
        let planned;
        if (s.kind === "ROUTE") {
          const choice = chooseRoute(scenario, s.from, s.to, cur);
          planned = choice.planned_s;
          key = choice.route_id;
          dir = `${s.from}>${s.to}`;
          cls = routeCls[key];
        } else {
          planned = plannedLegSeconds(scenario, s, cur);
          key = s.kind === "IN_AREA" ? `IN-${s.area}` : `ACC-${s.depot}`;
          dir = s.kind === "IN_AREA" ? "-" : s.dir;
          cls = "IN_AREA";
        }
        if (sigmaZero) {
          dur = planned;
        } else {
          const tf = world.trafficPpm(key, dir, Math.floor(cur / 900));
          let rf = PPM;
          if (rideIndex >= 0) {
            if (ridePpmOf[rideIndex] === 0) ridePpmOf[rideIndex] = world.ridePpm(requests[rideIndex].id);
            rf = ridePpmOf[rideIndex];
          }
          dur = realizedSeconds(planned, tf, rf);
        }
      }
      segments.push({ kind: s.kind, key, dir, cls, t0: cur, t1: cur + dur, loaded });
      cur += dur;
    }
    counters.legs += 1;
    counters.segments += segments.length;
    car.legEnd = cur;
    car.loc = null;
    return { from, to, segments, t1: cur };
  };

  // Depot resources.
  const touch = (d) => {
    d.dirty = true;
  };
  const claimStall = (d, t) => {
    d.held += 1;
    touch(d);
    flag(checkStallClaim({ depot: d.id, held: d.held, parking: d.parking, t }));
  };
  const releaseStall = (d) => {
    d.held -= 1;
    touch(d);
  };
  const newVisit = (car, d, t) => {
    const visit = {
      car: car.id, depot: d.id, arrival_s: t, intake_end_s: null, first_task_s: null, clean_start_s: null, clean_end_s: null,
      service_start_s: null, service_end_s: null, ready_s: null, censored: false,
    };
    visits.push(visit);
    car.visit = visit;
    return visit;
  };
  const visits = [];

  const makeReady = (car, d, t, event) => {
    car.visit.ready_s = t;
    car.visit = null;
    car.trips = 0;
    transition(car, "READY_AT_DEPOT", event, t, { location: { depot: d.id } });
    car.loc = { depot: d.id };
    d.ready += 1;
    touch(d);
    bucketAdd(car);
  };

  const beginTask = (car, d, t, task, event) => {
    if (task === "CLEAN") {
      d.cleanBusy += 1;
      flag(checkBayStart({ depot: d.id, task, busy: d.cleanBusy, bays: d.cleaning_bays, t }));
      car.visit.clean_start_s = t;
    } else {
      d.serviceBusy += 1;
      flag(checkBayStart({ depot: d.id, task, busy: d.serviceBusy, bays: d.service_bays, t }));
      car.visit.service_start_s = t;
    }
    if (car.visit.first_task_s === null) car.visit.first_task_s = t;
    touch(d);
    log(t, "SERVICE_STARTED", { car: car.id, depot: d.id, detail: { task } });
    transition(car, "IN_SERVICE", event, t, { location: { depot: d.id } }, task, false);
    push(t + (task === "CLEAN" ? scenario.clean_s : scenario.service_s), K.SERVICE_COMPLETED, car.idx);
  };

  /** A car blocked in a bay at `d` takes a stall: QUEUED_SERVICE when service is still due after its clean, else ready. */
  const blockedTakesStall = (car, d, t) => {
    log(t, "STALL_CLAIMED", { car: car.id, depot: d.id });
    claimStall(d, t);
    if (car.task === "CLEAN") d.cleanBusy -= 1;
    else d.serviceBusy -= 1;
    if (car.task === "CLEAN" && car.serviceDue) {
      transition(car, "QUEUED_SERVICE", "STALL_CLAIMED", t, { location: { depot: d.id } });
      insertSorted(d.queue, { car, fifo: car.visit.intake_end_s }, "fifo");
    } else {
      makeReady(car, d, t, "STALL_CLAIMED");
    }
  };

  /** Fills free bays and free stalls at a depot by the rules of design 5.3 and contract 6.4, until nothing changes. */
  const settleDepot = (d, t) => {
    let changed = true;
    while (changed) {
      changed = false;
      while (d.serviceBusy < d.service_bays) {
        const blockedEntry = d.blocked.find((e) => e.car.task === "CLEAN" && e.car.serviceDue);
        if (blockedEntry !== undefined) {
          const car = blockedEntry.car;
          removeCar(d.blocked, car);
          d.cleanBusy -= 1;
          beginTask(car, d, t, "SERVICE", "SERVICE_STARTED");
        } else {
          const queued = d.queue.find((e) => e.car.cleanDone && e.car.serviceDue);
          if (queued === undefined) break;
          removeCar(d.queue, queued.car);
          releaseStall(d);
          beginTask(queued.car, d, t, "SERVICE", "SERVICE_STARTED");
        }
        changed = true;
      }
      for (;;) {
        let capacity = d.cleaning_bays;
        const queued = d.queue.find((e) => !e.car.cleanDone);
        if (queued === undefined) break;
        if (d.cleanBusy >= capacity && useDefect("bay_overfill")) capacity += 1;
        if (d.cleanBusy >= capacity) break;
        removeCar(d.queue, queued.car);
        releaseStall(d);
        beginTask(queued.car, d, t, "CLEAN", "SERVICE_STARTED");
        changed = true;
      }
      // Hand-off: every stall is held and every bay of a task holds a car, with a car blocked in one of those bays and a
      // car queued for that task. No stall or bay can free, so both move at this second: the queued car gives up its
      // stall and takes the bay, and the blocked car (earliest finished, then vehicle id) takes the stall.
      for (const task of ["CLEAN", "SERVICE"]) {
        for (;;) {
          const busy = task === "CLEAN" ? d.cleanBusy >= d.cleaning_bays : d.serviceBusy >= d.service_bays;
          if (d.held < d.parking || !busy) break;
          const blockedEntry = d.blocked.find((e) => e.car.task === task);
          const queued = d.queue.find((e) => (task === "CLEAN" ? !e.car.cleanDone : e.car.cleanDone && e.car.serviceDue));
          if (blockedEntry === undefined || queued === undefined) break;
          removeCar(d.queue, queued.car);
          releaseStall(d);
          removeCar(d.blocked, blockedEntry.car);
          blockedTakesStall(blockedEntry.car, d, t);
          beginTask(queued.car, d, t, task, "SERVICE_STARTED");
          changed = true;
        }
      }
      while (d.held < d.parking && (d.blocked.length > 0 || d.gate.length > 0)) {
        if (d.blocked.length > 0) {
          blockedTakesStall(d.blocked.shift().car, d, t);
        } else {
          const car = d.gate.shift().car;
          log(t, "STALL_CLAIMED", { car: car.id, depot: d.id });
          claimStall(d, t);
          transition(car, "INTAKE", "STALL_CLAIMED", t, { location: { depot: d.id } });
          push(t + scenario.intake_s, K.INTAKE_COMPLETED, car.idx);
        }
        changed = true;
      }
    }
  };

  const depotViews = () =>
    depots.map((d) => ({ id: d.id, area: d.area, parking: d.parking, stalls_held: d.held, inbound: d.inbound, service_bays: d.service_bays }));

  const goDepot = (car, t, purpose, event) => {
    car.visits += 1;
    car.serviceDue = visitIncludesService(scenario, car.visits);
    car.cleanDone = false;
    const from = car.loc;
    const choice = assignDepot({ t, from, homeDepot: car.home_depot, serviceDue: car.serviceDue, depots: depotViews(), plan }, policies.depot_assignment);
    let d = choice.depot === null ? undefined : depotById.get(choice.depot);
    if (d === undefined || !depotCanServe(d, car.serviceDue)) {
      violations.push(`POLICY_ERROR: depot assignment chose ${String(choice.depot)} for ${car.id} at ${t} (${choice.cause})`);
      d = depots.find((x) => depotCanServe(x, car.serviceDue)) ?? depots[0];
    }
    log(t, "DEPOT_ASSIGNED", { car: car.id, depot: d.id, detail: { purpose, cause: choice.cause } });
    d.inbound += 1;
    car.target = d;
    const leg = startLeg(car, from, { depot: d.id }, t, "TO_DEPOT", -1, false);
    transition(car, "TO_DEPOT", event, t, { from: leg.from, to: leg.to, segments: leg.segments, purpose, depot: d.id, cause: choice.cause });
    car.iv.purpose = purpose;
    push(leg.t1, K.DEPOT_ARRIVED, car.idx);
  };

  // The recall acts once, which replaces the pending recall that design 5.3 still states (see the header): RECALL_ORDERED marks the cars on a pickup or a trip at that second, and only a
  // marked car goes to a depot when its trip completes, while the completion falls before the release (or the window
  // end with the release off). A car dispatched after the recall is never marked.
  const recallApplies = (car, t) => car.recalled && t < releaseOrEnd && t < end_s;

  const assign = (car, r, rIndex, t, planned_s) => {
    flag(checkAssignment({ car: car.id, held: car.request >= 0 ? requests[car.request].id : null, request: r.id, t }));
    log(t, "REQUEST_ASSIGNED", { car: car.id, req: r.id, detail: { planned_arrive_s: planned_s } });
    r.state = "ASSIGNED";
    r.car = car.id;
    r.assigned_s = t;
    const readyDepot = car.state === "READY_AT_DEPOT" ? depotById.get(car.loc.depot) : null;
    bucketRemove(car);
    let from = car.loc;
    if (useDefect("teleport")) from = { area: scenario.areas.find((a) => a.id !== (car.loc.area ?? depotById.get(car.loc.depot).area)).id };
    const leg = startLeg(car, from, { area: r.origin }, t, "PICKUP", rIndex, false);
    car.request = rIndex;
    transition(car, "ENROUTE_PICKUP", "REQUEST_ASSIGNED", t, { from: leg.from, to: leg.to, segments: leg.segments, request: r.id });
    push(leg.t1, K.PICKUP_COMPLETED, car.idx);
    if (readyDepot !== null) {
      readyDepot.ready -= 1;
      releaseStall(readyDepot);
      settleDepot(readyDepot, t);
    }
  };

  const dispatch = (t) => {
    counters.dispatch_calls += 1;
    if (defect === "double_assign" && !defectUsed.has("double_assign") && waiting.length > 0) {
      const busy = cars.find((c) => c.state === "ENROUTE_PICKUP" || c.state === "ON_TRIP");
      if (busy !== undefined) {
        useDefect("double_assign");
        const rIndex = waiting.shift();
        const r = requests[rIndex];
        flag(checkAssignment({ car: busy.id, held: requests[busy.request].id, request: r.id, t }));
        log(t, "REQUEST_ASSIGNED", { car: busy.id, req: r.id });
        // The extra rider boards at once, with its own pickup event, so only check 2 sees this defect (design 9.5).
        log(t, "PICKUP_COMPLETED", { car: busy.id, req: r.id });
        Object.assign(r, { state: "ASSIGNED", car: busy.id, assigned_s: t, pickup_s: t });
        busy.extra.push(rIndex);
      }
    }
    while (waiting.length > 0) {
      const locations = [];
      for (const bucket of buckets.values()) {
        if (bucket.cars.length > 0) locations.push({ location: bucket.location, firstCar: bucket.cars[0].id });
      }
      if (locations.length === 0) return;
      counters.dispatch_location_scans += locations.length;
      const rIndex = waiting[0];
      const r = requests[rIndex];
      const choice = nearestIdle({ t, riderArea: r.origin, locations, plan });
      const car = choice === null ? undefined : carById.get(choice.car);
      if (car === undefined || car.bucket === null) {
        violations.push(`POLICY_ERROR: dispatch chose ${String(choice?.car)} for ${r.id} at ${t}, which is not dispatchable`);
        return;
      }
      waiting.shift();
      assign(car, r, rIndex, t, choice.arrive_s);
    }
  };

  // Handlers, one per heap event kind.
  const handlers = new Array(KINDS.length);
  handlers[K.REQUEST_CREATED] = (t, i) => {
    const r = requests[i];
    log(t, "REQUEST_CREATED", { req: r.id });
    r.state = "WAITING";
    waiting.push(i);
    dispatch(t);
  };
  handlers[K.WAIT_DEADLINE] = (t, i) => {
    const r = requests[i];
    log(t, "WAIT_DEADLINE", { req: r.id });
    if (r.state !== "WAITING") return;
    waiting.splice(waiting.indexOf(i), 1);
    r.state = "UNSERVED";
    r.unserved_s = t;
    nonterminal -= 1;
    log(t, "REQUEST_UNSERVED", { req: r.id });
  };
  handlers[K.PICKUP_COMPLETED] = (t, i) => {
    const car = cars[i];
    const r = requests[car.request];
    log(t, "PICKUP_COMPLETED", { car: car.id, req: r.id });
    r.pickup_s = t;
    car.loc = { area: r.origin };
    const leg = startLeg(car, car.loc, { area: r.dest }, t, "TRIP", car.request, true);
    transition(car, "ON_TRIP", "PICKUP_COMPLETED", t, { from: leg.from, to: leg.to, segments: leg.segments, request: r.id });
    push(leg.t1, K.TRIP_COMPLETED, car.idx);
  };
  handlers[K.TRIP_COMPLETED] = (t, i) => {
    const car = cars[i];
    const r = requests[car.request];
    log(t, "TRIP_COMPLETED", { car: car.id, req: r.id });
    for (const rIndex of [car.request, ...car.extra]) {
      const done = requests[rIndex];
      done.state = "COMPLETED";
      done.dropoff_s = t;
      nonterminal -= 1;
    }
    car.request = -1;
    car.extra = [];
    car.loc = { area: r.dest };
    car.trips += 1;
    const recalled = recallApplies(car, t);
    car.recalled = false;
    if (car.trips >= scenario.trips_between_visits) {
      goDepot(car, t, "SERVICE_DUE", "TRIP_COMPLETED");
    } else if (recalled) {
      goDepot(car, t, "RECALL", "TRIP_COMPLETED");
    } else {
      const event = useDefect("illegal_transition") ? "PICKUP_COMPLETED" : "TRIP_COMPLETED";
      transition(car, "IDLE", event, t, { location: { area: r.dest } });
      car.loc = { area: r.dest };
      bucketAdd(car);
    }
  };
  handlers[K.DEPOT_ARRIVED] = (t, i) => {
    const car = cars[i];
    const d = car.target;
    d.inbound -= 1;
    log(t, "DEPOT_ARRIVED", { car: car.id, depot: d.id });
    car.loc = { depot: d.id };
    if (d.held < d.parking || useDefect("lot_overfill")) {
      claimStall(d, t);
      newVisit(car, d, t);
      transition(car, "INTAKE", "DEPOT_ARRIVED", t, { location: { depot: d.id } });
      push(t + scenario.intake_s, K.INTAKE_COMPLETED, car.idx);
      return;
    }
    const diversion = divertDepot({ t, from: { depot: d.id }, serviceDue: car.serviceDue, depots: depotViews(), plan });
    if (diversion !== null) {
      const e = depotById.get(diversion.depot);
      log(t, "DEPOT_DIVERTED", { car: car.id, depot: d.id, detail: { to: e.id, cause: diversion.cause } });
      d.diversions_s.push(t);
      e.inbound += 1;
      car.target = e;
      const leg = startLeg(car, car.loc, { depot: e.id }, t, "DIVERSION", -1, false);
      transition(car, "TO_DEPOT", "DEPOT_DIVERTED", t, {
        from: leg.from, to: leg.to, segments: leg.segments, purpose: car.iv.purpose, depot: e.id, cause: "diversion",
      });
      push(leg.t1, K.DEPOT_ARRIVED, car.idx);
      return;
    }
    newVisit(car, d, t);
    transition(car, "GATE_WAIT", "DEPOT_ARRIVED", t, { location: { depot: d.id } });
    insertSorted(d.gate, { car, arrival: t }, "arrival");
    touch(d);
  };
  handlers[K.INTAKE_COMPLETED] = (t, i) => {
    const car = cars[i];
    const d = depotById.get(car.loc.depot);
    log(t, "INTAKE_COMPLETED", { car: car.id, depot: d.id });
    car.visit.intake_end_s = t;
    transition(car, "QUEUED_SERVICE", "INTAKE_COMPLETED", t, { location: { depot: d.id } });
    insertSorted(d.queue, { car, fifo: t }, "fifo");
    touch(d);
    settleDepot(d, t);
  };
  handlers[K.SERVICE_COMPLETED] = (t, i) => {
    const car = cars[i];
    const d = depotById.get(car.loc.depot);
    const task = car.task;
    log(t, "SERVICE_COMPLETED", { car: car.id, depot: d.id, detail: { task } });
    const freeBay = () => {
      if (task === "CLEAN") d.cleanBusy -= 1;
      else d.serviceBusy -= 1;
      touch(d);
    };
    const block = () => {
      transition(car, "IN_SERVICE", "SERVICE_COMPLETED", t, { location: { depot: d.id } }, task, true);
      insertSorted(d.blocked, { car, finished: t }, "finished");
      touch(d);
    };
    if (task === "CLEAN") {
      car.visit.clean_end_s = t;
      car.cleanDone = true;
    } else {
      car.visit.service_end_s = t;
    }
    const serviceNext = task === "CLEAN" && car.serviceDue;
    if (serviceNext && d.serviceBusy < d.service_bays) {
      freeBay();
      beginTask(car, d, t, "SERVICE", "SERVICE_STARTED");
    } else if (d.held < d.parking) {
      freeBay();
      claimStall(d, t);
      if (serviceNext) {
        transition(car, "QUEUED_SERVICE", "SERVICE_COMPLETED", t, { location: { depot: d.id } });
        insertSorted(d.queue, { car, fifo: car.visit.intake_end_s }, "fifo");
      } else {
        makeReady(car, d, t, "SERVICE_COMPLETED");
      }
    } else {
      block();
    }
    settleDepot(d, t);
  };
  handlers[K.REPOSITION_COMPLETED] = (t, i) => {
    const car = cars[i];
    log(t, "REPOSITION_COMPLETED", { car: car.id });
    transition(car, "IDLE", "REPOSITION_COMPLETED", t, { location: { area: car.home_area } });
    car.loc = { area: car.home_area };
    bucketAdd(car);
  };
  const holds = [];
  handlers[K.FIXTURE_HOLD_ENDED] = (t, i) => {
    const hold = holds[i];
    const d = hold.depot;
    log(t, "FIXTURE_HOLD_ENDED", { depot: d.id, detail: { resource: hold.resource } });
    if (hold.resource === "STALL") d.held -= 1;
    else if (hold.resource === "CLEANING") d.cleanBusy -= 1;
    else d.serviceBusy -= 1;
    touch(d);
    settleDepot(d, t);
  };
  handlers[K.RECALL_ORDERED] = (t) => {
    if (t > end_s) return;
    log(t, "RECALL_ORDERED");
    for (const car of cars) if (car.state === "ENROUTE_PICKUP" || car.state === "ON_TRIP") car.recalled = true;
    const idle = cars.filter((c) => c.state === "IDLE");
    for (const car of idle) {
      bucketRemove(car);
      goDepot(car, t, "RECALL", "RECALL_ORDERED");
    }
  };
  handlers[K.MORNING_RELEASE] = (t) => {
    if (t > end_s) return;
    log(t, "MORNING_RELEASE");
    const leaving = cars.filter((c) => c.state === "READY_AT_DEPOT" && releasesHome(c.loc.depot, c.home_area));
    for (const car of leaving) {
      const d = depotById.get(car.loc.depot);
      bucketRemove(car);
      const leg = startLeg(car, { depot: d.id }, { area: car.home_area }, t, "RELEASE", -1, false);
      transition(car, "REPOSITIONING", "MORNING_RELEASE", t, { from: leg.from, to: leg.to, segments: leg.segments });
      push(leg.t1, K.REPOSITION_COMPLETED, car.idx);
      d.ready -= 1;
      releaseStall(d);
      settleDepot(d, t);
    }
  };
  let draining = false;
  handlers[K.WINDOW_END] = (t) => {
    log(t, "WINDOW_END");
    draining = true;
  };

  // Initial state: fixture holds (pushed first), cars, requests, clock events.
  if (fixture !== null && fixture.depotOccupancy) {
    for (const d of depots) {
      const occ = fixture.depotOccupancy[d.id];
      if (occ === undefined) continue;
      for (const [resource, list] of [["STALL", occ.stalls ?? []], ["CLEANING", occ.cleaning ?? []], ["SERVICE", occ.service ?? []]]) {
        for (const until_s of list) {
          if (resource === "STALL") claimStall(d, start_s);
          else if (resource === "CLEANING") d.cleanBusy += 1;
          else d.serviceBusy += 1;
          holds.push({ depot: d, resource, until_s });
          push(until_s, K.FIXTURE_HOLD_ENDED, holds.length - 1);
        }
      }
      flag(checkBayStart({ depot: d.id, task: "CLEAN", busy: d.cleanBusy, bays: d.cleaning_bays, t: start_s }));
      flag(checkBayStart({ depot: d.id, task: "SERVICE", busy: d.serviceBusy, bays: d.service_bays, t: start_s }));
    }
  }
  for (const car of cars) {
    car.iv = { state: car.state, t0: start_s, t1: null, location: { ...car.loc } };
    car.intervals.push(car.iv);
    if (car.state === "READY_AT_DEPOT") {
      const d = depotById.get(car.loc.depot);
      claimStall(d, start_s);
      d.ready += 1;
    }
    bucketAdd(car);
  }
  requests.forEach((r, i) => {
    push(r.time_s, K.REQUEST_CREATED, i);
    push(r.time_s + scenario.patience_s, K.WAIT_DEADLINE, i);
  });
  push(policies.recall_s, K.RECALL_ORDERED, -1);
  if (policies.release_s !== null) push(policies.release_s, K.MORNING_RELEASE, -1);
  push(end_s, K.WINDOW_END, -1);

  const snapshots = [];
  let nextSnapshot = start_s;
  const recordDepots = (t) => {
    for (const d of depots) {
      if (!d.dirty) continue;
      d.dirty = false;
      const row = [t, d.held, d.queue.length, d.gate.length, d.cleanBusy, d.serviceBusy, d.blocked.length, d.ready];
      const last = d.series[d.series.length - 1];
      if (last !== undefined && last[0] === t) d.series[d.series.length - 1] = row;
      else d.series.push(row);
    }
  };
  recordDepots(start_s);

  const snapshotAt = (s) => {
    counters.snapshots += 1;
    if (!keepLogs) return;
    const carViews = cars.map((car) => {
      const view = { id: car.id, state: car.state };
      if (car.task !== null) view.task = car.task;
      if (car.blocked) view.blocked = true;
      if (DRIVING.has(car.state)) {
        const t0 = car.iv.t0;
        const t1 = car.legEnd;
        view.leg = { from: car.iv.from, to: car.iv.to, t0, t1, done_permille: t1 > t0 ? Math.floor(((s - t0) * 1000) / (t1 - t0)) : 1000 };
      } else {
        view.location = car.loc;
      }
      return view;
    });
    const depotViewsNow = depots.map((d) => ({
      id: d.id, stalls_held: d.held, queue: d.queue.length, gate: d.gate.length, clean_busy: d.cleanBusy,
      service_busy: d.serviceBusy, blocked: d.blocked.length, ready: d.ready,
    }));
    snapshots.push({ t: s, cars: carViews, depots: depotViewsNow });
  };

  let finished = false;
  let drainEnd = null;
  let lastTime = start_s;
  let previousKey = -1;

  const finish = (tEnd) => {
    drainEnd = tEnd;
    while (nextSnapshot <= tEnd) {
      snapshotAt(nextSnapshot);
      nextSnapshot += SNAPSHOT_STEP_S;
    }
    for (const car of cars) {
      if (DRIVING.has(car.state)) {
        log(tEnd, "LEG_CENSORED", { car: car.id });
        car.iv.censored = true;
        car.iv.segments = car.iv.segments.filter((s) => s.t0 < tEnd).map((s) => ({ ...s, t1: Math.min(s.t1, tEnd) }));
      } else if (car.visit !== null) {
        log(tEnd, "VISIT_CENSORED", { car: car.id, depot: car.visit.depot });
        car.visit.censored = true;
      }
      car.iv.t1 = tEnd;
    }
    finished = true;
  };

  /** Processes up to `maxEvents` heap events; returns true once the run has reached its drain end. */
  const step = (maxEvents) => {
    if (finished) return true;
    let n = 0;
    while (n < maxEvents) {
      if (drainEnd === null && draining && nonterminal === 0) drainEnd = lastTime;
      if (heap.size === 0) {
        finish(drainEnd ?? lastTime);
        return true;
      }
      const top = heap.topKey();
      const t = keyTime(top);
      if (drainEnd !== null && t > drainEnd) {
        finish(drainEnd);
        return true;
      }
      while (nextSnapshot < t) {
        snapshotAt(nextSnapshot);
        nextSnapshot += SNAPSHOT_STEP_S;
      }
      const [key, payload] = heap.pop();
      counters.heap_pops += 1;
      if (key <= previousKey) flag(checkPopOrder(decodeKey(previousKey), decodeKey(key)));
      previousKey = key;
      const kind = payload & 15;
      const entity = (payload >> 4) - 1;
      lastTime = t;
      handlers[kind](t, entity);
      if (carFreed) {
        carFreed = false;
        if (waiting.length > 0) dispatch(t);
      }
      recordDepots(t);
      n += 1;
      if (draining && drainEnd === null && nonterminal === 0) drainEnd = t;
    }
    return false;
  };

  let built = null;
  /** The run's result (contract 6.4); throws before the run has finished. */
  const result = () => {
    if (!finished) throw new Error("the run has not finished; call step until it returns true");
    if (built !== null) return built;
    const intervals = {};
    for (const car of cars) intervals[car.id] = car.intervals;
    built = {
      scenario_digest: scenarioDigestOf(scenario),
      world_digest: worldDigest(world),
      seed,
      scenario,
      window: { start_s, end_s },
      events,
      intervals,
      visits,
      requests,
      cars: cars.map((c) => ({ id: c.id, home_area: c.home_area, home_depot: c.home_depot, state: c.state, trips_since_visit: c.trips, visits: c.visits })),
      depots: depots.map((d) => ({
        id: d.id, area: d.area, parking: d.parking, cleaning_bays: d.cleaning_bays, service_bays: d.service_bays,
        diversions_s: d.diversions_s,
        holds: holds.filter((h) => h.depot === d).map((h) => ({ resource: h.resource, until_s: h.until_s })),
        series_fields: ["t", "stalls_held", "queue", "gate", "clean_busy", "service_busy", "blocked", "ready"],
        series: d.series,
      })),
      drain_end_s: drainEnd,
      snapshots,
      invariant_violations: violations,
      counters,
    };
    return built;
  };

  const run = {
    step,
    result,
    /** Steps to the drain end and returns result(). */
    runToEnd() {
      while (!step(1000000));
      return result();
    },
    get finished() {
      return finished;
    },
  };
  return run;
}

/** Runs `scenario` on `world` to its drain end and returns the result (contract 6.4); options as createRun. */
export function runToEnd(scenario, world, options) {
  return createRun(scenario, world, options).runToEnd();
}
