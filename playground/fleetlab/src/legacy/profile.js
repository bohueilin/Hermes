// The legacy profile: a line-by-line port of FleetLab's `run_fleet` and `run_metrics` (src/hermes/fleet/engine.py)
// and `check_invariants` (src/hermes/fleet/invariants.py), design section 5.10, contract section 5. Control flow, push
// order, container order and float arithmetic follow the Python; comments cite the Python they mirror.
//
// Python semantics reproduced here:
// - dicts keep insertion order and assigning an existing key keeps its place: JavaScript `Map` does the same;
// - `min(iterable, key=...)` returns the first minimal element in iteration order: a strict `<` scan;
// - vehicle and request ids compare as strings. Python compares code points and JavaScript `<` compares UTF-16 code
//   units; they agree unless a string holds characters above U+FFFF next to ones in U+E000..U+FFFF. FleetLab's vehicle
//   ids are `v-<n>`, so the orders are identical;
// - every time is an integer below 2^53 and every multiplication or division below is one IEEE double operation, as
//   in Python (`int * float` converts the int exactly).

import { sha256Hex } from "../core/sha256.js";
import { percentileFleetLab, roundHalfEven } from "../core/stats.js";

const IDLE = "IDLE";
const ENROUTE_PICKUP = "ENROUTE_PICKUP";
const ON_TRIP = "ON_TRIP";
const QUEUED_SERVICE = "QUEUED_SERVICE";
const IN_SERVICE = "IN_SERVICE";
const VEHICLE_STATUSES = new Set([IDLE, ENROUTE_PICKUP, ON_TRIP, QUEUED_SERVICE, IN_SERVICE]);

const WAITING = "WAITING";
const ASSIGNED = "ASSIGNED";
const COMPLETED = "COMPLETED";
const UNSERVED = "UNSERVED";

/** An Error whose `name` is the Python exception type FleetLab would raise. */
function pythonError(name, message) {
  return Object.assign(new Error(message), { name });
}

/** Python `mapping[key]` on a Map or a plain object: the value, or a thrown KeyError. */
function getItem(mapping, key) {
  if (mapping instanceof Map) {
    if (!mapping.has(key)) throw pythonError("KeyError", `'${key}'`);
    return mapping.get(key);
  }
  if (!Object.hasOwn(mapping, key)) throw pythonError("KeyError", `'${key}'`);
  return mapping[key];
}

/** Heap order of `heapq` on `(time_s, sequence, kind, entity_id)`: sequence is unique, so kind is never compared. */
function heapLess(a, b) {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

function heapPush(heap, entry) {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!heapLess(heap[i], heap[parent])) break;
    [heap[i], heap[parent]] = [heap[parent], heap[i]];
    i = parent;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < heap.length && heapLess(heap[left], heap[smallest])) smallest = left;
      if (right < heap.length && heapLess(heap[right], heap[smallest])) smallest = right;
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
  }
  return top;
}

/** `_travel_s`: `max(1, int(round(base * multiplier)))` in integer seconds; base is `in_zone_pickup_s` within a zone. */
export function travelSeconds(scenario, origin, dest, multiplier) {
  const base = origin === dest ? scenario.in_zone_pickup_s : getItem(scenario.travel_time_s, `${origin}->${dest}`);
  return Math.max(1, roundHalfEven(base * multiplier));
}

/**
 * `run_fleet`: one deterministic episode over one tape (times in integer seconds). Returns the RunLog
 * `{scenario, events, requests, vehicles, service_queue_waits_s, max_bays_in_use}`; `requests` and `vehicles` are Maps
 * in Python insertion order. Throws `ValueError` where FleetLab's `waiting.remove` raises (design FL-11).
 */
export function runLegacyFleet(scenario, tape, { dispatchMode = "nearest" } = {}) {
  const log = {
    scenario,
    requests: new Map(),
    vehicles: new Map(),
    events: [],
    service_queue_waits_s: [],
    max_bays_in_use: 0,
  };
  for (let index = 0; index < scenario.vehicle_count; index++) {
    const zone = scenario.zones[index % scenario.zones.length];
    const vehicle_id = `v-${index}`;
    log.vehicles.set(vehicle_id, {
      vehicle_id,
      zone,
      status: IDLE,
      trips_since_service: 0,
      completed_trips: 0,
      busy_since_s: 0,
      busy_total_s: 0,
      current_request_id: null,
    });
  }

  // heap of [time_s, sequence, kind, entity_id]; sequence breaks ties deterministically.
  const heap = [];
  let sequence = 0;
  const push = (time_s, kind, entity_id) => {
    heapPush(heap, [time_s, sequence, kind, entity_id]);
    sequence += 1;
  };

  for (const event of tape.demand) {
    log.requests.set(event.request_id, {
      request_id: event.request_id,
      time_s: event.time_s,
      origin: event.origin,
      destination: event.destination,
      state: WAITING,
      assigned_vehicle_id: null,
      pickup_time_s: null,
    });
    push(event.time_s, "REQUEST_CREATED", event.request_id);
    push(event.time_s + scenario.max_wait_s, "WAIT_DEADLINE", event.request_id);
  }

  const waiting = []; // request ids in arrival order
  let bays_in_use = 0;
  const service_wait_since = new Map();
  let defect_armed = dispatchMode === "defect_double_assign";

  const tryDispatch = (now_s) => {
    while (waiting.length > 0) {
      const request = getItem(log.requests, waiting[0]);
      const idle = [];
      for (const v of log.vehicles.values()) if (v.status === IDLE) idle.push(v);
      let chosen = null;
      if (defect_armed) {
        // The seeded defect: grab any busy vehicle if one exists, exactly once.
        const busy = [];
        for (const v of log.vehicles.values()) if (v.status === ENROUTE_PICKUP || v.status === ON_TRIP) busy.push(v);
        if (busy.length > 0) {
          // min(busy, key=lambda v: v.vehicle_id)
          chosen = busy[0];
          for (const v of busy) if (v.vehicle_id < chosen.vehicle_id) chosen = v;
          defect_armed = false;
        }
      }
      if (chosen === null) {
        if (idle.length === 0) return;
        // min(idle, key=lambda v: (_travel_s(...), v.vehicle_id)); the key is evaluated once per element.
        const multiplierForKey = getItem(tape.travel_multiplier, request.request_id);
        let bestTravel = 0;
        for (const v of idle) {
          const travel = travelSeconds(scenario, v.zone, request.origin, multiplierForKey);
          if (chosen === null || travel < bestTravel || (travel === bestTravel && v.vehicle_id < chosen.vehicle_id)) {
            chosen = v;
            bestTravel = travel;
          }
        }
      }
      waiting.shift();
      request.state = ASSIGNED;
      request.assigned_vehicle_id = chosen.vehicle_id;
      const multiplier = getItem(tape.travel_multiplier, request.request_id);
      const pickup_at = now_s + travelSeconds(scenario, chosen.zone, request.origin, multiplier);
      const dropoff_at = pickup_at + travelSeconds(scenario, request.origin, request.destination, multiplier);
      request.pickup_time_s = pickup_at;
      chosen.status = ENROUTE_PICKUP;
      chosen.current_request_id = request.request_id;
      chosen.busy_since_s = now_s;
      log.events.push([now_s, "REQUEST_ASSIGNED", request.request_id]);
      push(pickup_at, "PICKUP_COMPLETED", request.request_id);
      push(dropoff_at, "TRIP_COMPLETED", request.request_id);
    }
  };

  while (heap.length > 0) {
    const [now_s, , kind, entity_id] = heapPop(heap);
    if (now_s > scenario.horizon_s && kind === "REQUEST_CREATED") continue;
    if (kind === "REQUEST_CREATED") {
      log.events.push([now_s, kind, entity_id]);
      waiting.push(entity_id);
      tryDispatch(now_s);
    } else if (kind === "WAIT_DEADLINE") {
      const request = getItem(log.requests, entity_id);
      if (request.state === WAITING) {
        request.state = UNSERVED;
        // waiting.remove(entity_id): removes the first occurrence or raises (design FL-11).
        const at = waiting.indexOf(entity_id);
        if (at === -1) throw pythonError("ValueError", "list.remove(x): x not in list");
        waiting.splice(at, 1);
        log.events.push([now_s, "REQUEST_UNSERVED", entity_id]);
      }
    } else if (kind === "PICKUP_COMPLETED") {
      const request = getItem(log.requests, entity_id);
      const vehicle = getItem(log.vehicles, request.assigned_vehicle_id || "");
      vehicle.status = ON_TRIP;
      vehicle.zone = request.origin;
      log.events.push([now_s, kind, entity_id]);
    } else if (kind === "TRIP_COMPLETED") {
      const request = getItem(log.requests, entity_id);
      const vehicle = getItem(log.vehicles, request.assigned_vehicle_id || "");
      request.state = COMPLETED;
      vehicle.zone = request.destination;
      vehicle.current_request_id = null;
      vehicle.completed_trips += 1;
      vehicle.trips_since_service += 1;
      vehicle.busy_total_s += now_s - vehicle.busy_since_s;
      log.events.push([now_s, kind, entity_id]);
      if (vehicle.trips_since_service >= scenario.trips_between_service) {
        vehicle.status = QUEUED_SERVICE;
        service_wait_since.set(vehicle.vehicle_id, now_s);
        log.events.push([now_s, "SERVICE_QUEUE_ENTERED", vehicle.vehicle_id]);
        push(now_s, "SERVICE_TRY_START", vehicle.vehicle_id);
      } else {
        vehicle.status = IDLE;
        tryDispatch(now_s);
      }
    } else if (kind === "SERVICE_TRY_START") {
      const vehicle = getItem(log.vehicles, entity_id);
      if (vehicle.status !== QUEUED_SERVICE) continue;
      if (bays_in_use < scenario.service_bays) {
        bays_in_use += 1;
        log.max_bays_in_use = Math.max(log.max_bays_in_use, bays_in_use);
        vehicle.status = IN_SERVICE;
        // service_wait_since.pop(entity_id)
        const since = getItem(service_wait_since, entity_id);
        service_wait_since.delete(entity_id);
        log.service_queue_waits_s.push(now_s - since);
        log.events.push([now_s, "SERVICE_STARTED", entity_id]);
        push(now_s + scenario.service_duration_s, "SERVICE_COMPLETED", entity_id);
      }
      // else: stay queued; a completing service re-triggers every queued vehicle.
    } else if (kind === "SERVICE_COMPLETED") {
      const vehicle = getItem(log.vehicles, entity_id);
      bays_in_use -= 1;
      vehicle.status = IDLE;
      vehicle.trips_since_service = 0;
      log.events.push([now_s, kind, entity_id]);
      const queued = [];
      for (const v of log.vehicles.values()) if (v.status === QUEUED_SERVICE) queued.push(v.vehicle_id);
      queued.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      for (const id of queued) push(now_s, "SERVICE_TRY_START", id);
      tryDispatch(now_s);
    }
  }
  return log;
}

/**
 * `run_metrics`: FleetLab's metric map for one run (seconds, counts and fractions as doubles). A metric whose population
 * is empty is absent, exactly when Python's is.
 */
export function legacyMetrics(log) {
  // The `percentile` closure of run_metrics is percentileFleetLab (contract section 3), which also throws when empty.
  const requests = [...log.requests.values()];
  const waits = [];
  for (const r of requests) if (r.state === COMPLETED && r.pickup_time_s !== null) waits.push(r.pickup_time_s - r.time_s);
  let served = 0;
  let unserved = 0;
  for (const r of requests) if (r.state === COMPLETED) served += 1;
  for (const r of requests) if (r.state === UNSERVED) unserved += 1;
  const horizon = log.scenario.horizon_s;
  let busyTotal = 0;
  for (const v of log.vehicles.values()) busyTotal += v.busy_total_s;
  const utilizationDenominator = horizon * log.vehicles.size;
  if (utilizationDenominator === 0) throw pythonError("ZeroDivisionError", "division by zero");
  const metrics = {
    "requests.total": requests.length,
    "requests.served": served,
    "requests.unserved": unserved,
    "unserved.fraction": requests.length > 0 ? unserved / requests.length : 0,
    "fleet.utilization_fraction": busyTotal / utilizationDenominator,
    "business_proxy.served_trips": served,
    "business_proxy.unserved_demand": unserved,
  };
  if (waits.length > 0) {
    metrics["wait.p50_s"] = percentileFleetLab(waits, 0.5);
    metrics["wait.p90_s"] = percentileFleetLab(waits, 0.9);
  }
  if (log.service_queue_waits_s.length > 0) {
    metrics["depot.queue_p90_s"] = percentileFleetLab(log.service_queue_waits_s, 0.9);
  }
  return metrics;
}

/** Python tuple order on `(assigned_at_s, completed_at_s, request_id)`. */
function compareSpans(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0;
}

/** `check_invariants`: every violated invariant as FleetLab's `I<n>: detail` strings, in FleetLab's order. */
export function legacyInvariants(log) {
  const violations = [];
  const scenario = log.scenario;

  // I1: fleet-state counts always equal configured fleet size.
  if (log.vehicles.size !== scenario.vehicle_count) {
    violations.push(`I1: ${log.vehicles.size} vehicles tracked, ${scenario.vehicle_count} configured`);
  }

  // I2: a vehicle cannot serve two requests simultaneously. FleetLab's `open_by_vehicle` dict is built and never read,
  // so it is not ported. `next(...)` over the events takes the first matching entry; the maps below hold exactly that.
  const firstAssigned = new Map();
  const firstCompleted = new Map();
  for (const [t, kind, rid] of log.events) {
    if (kind === "REQUEST_ASSIGNED" && !firstAssigned.has(rid)) firstAssigned.set(rid, t);
    if (kind === "TRIP_COMPLETED" && !firstCompleted.has(rid)) firstCompleted.set(rid, t);
  }
  const intervals = new Map();
  for (const request of log.requests.values()) {
    if (request.assigned_vehicle_id && request.pickup_time_s !== null) {
      const assigned_at = firstAssigned.has(request.request_id) ? firstAssigned.get(request.request_id) : request.time_s;
      const completed_at = firstCompleted.has(request.request_id) ? firstCompleted.get(request.request_id) : null;
      if (completed_at !== null) {
        if (!intervals.has(request.assigned_vehicle_id)) intervals.set(request.assigned_vehicle_id, []);
        intervals.get(request.assigned_vehicle_id).push([assigned_at, completed_at, request.request_id]);
      }
    }
  }
  for (const [vehicle_id, spans] of intervals) {
    const ordered = [...spans].sort(compareSpans);
    for (let i = 0; i + 1 < ordered.length; i++) {
      const [, e1, r1] = ordered[i];
      const [s2, , r2] = ordered[i + 1];
      if (s2 < e1) violations.push(`I2: vehicle ${vehicle_id} overlaps ${r1} and ${r2} (${s2} < ${e1})`);
    }
  }

  // I3: a request has at most one terminal state (structural here, asserted for drift).
  for (const request of log.requests.values()) {
    if (request.state === COMPLETED && request.pickup_time_s === null) {
      violations.push(`I3/I8: ${request.request_id} completed without a pickup`);
    }
  }

  // I4/I5: bay occupancy never exceeds capacity.
  if (log.max_bays_in_use > scenario.service_bays) {
    violations.push(`I5: ${log.max_bays_in_use} bays in use, ${scenario.service_bays} configured`);
  }

  // I9: vehicles end in a legal state.
  for (const vehicle of log.vehicles.values()) {
    if (!VEHICLE_STATUSES.has(vehicle.status)) violations.push(`I9: vehicle ${vehicle.vehicle_id} in ${vehicle.status}`);
  }

  // I10: every event references an existing entity.
  for (const [, kind, entity_id] of log.events) {
    if (kind.startsWith("REQUEST") && !log.requests.has(entity_id)) {
      violations.push(`I10: ${kind} references unknown request ${entity_id}`);
    }
    if (kind.startsWith("SERVICE") && !log.vehicles.has(entity_id)) {
      violations.push(`I10: ${kind} references unknown vehicle ${entity_id}`);
    }
  }

  // I11: the simulation clock never moves backward.
  for (let i = 0; i + 1 < log.events.length; i++) {
    if (log.events[i + 1][0] < log.events[i][0]) {
      violations.push("I11: event log time decreased");
      break;
    }
  }

  // Conservation (analytical fixture backbone): served + unserved + still-open = total.
  let terminal = 0;
  let open_states = 0;
  for (const r of log.requests.values()) if (r.state === COMPLETED || r.state === UNSERVED) terminal += 1;
  for (const r of log.requests.values()) if (r.state === WAITING || r.state === ASSIGNED) open_states += 1;
  if (terminal + open_states !== log.requests.size) {
    violations.push("I-conservation: request states do not partition the population");
  }

  return violations;
}

/** The canonical event log `[[time_s, kind, entity_id], ...]` in emission order (a copy). */
export function canonicalEvents(log) {
  return log.events.map(([t, kind, id]) => [t, kind, id]);
}

/** Lowercase hexadecimal SHA-256 of `JSON.stringify(events)`; the events hold only integers and strings. */
export function eventsDigest(events) {
  return sha256Hex(JSON.stringify(events));
}
