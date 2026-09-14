// Planned travel on the Bay teaching map (contract 6.3, design 5.2.1).
//
// Planned seconds integrate a segment's free-flow seconds through the declared hourly multipliers of its row: inside
// hour h with multiplier m (per-mille) and S seconds to the end of that hour, the car covers floor(S x 10^9 / m)
// micro-units of free-flow time. Everything here is exact integer arithmetic on safe integers; policies rank cars and
// depots only with these planned times, never with realized ones (design 5.5).

const HOUR_S = 3600;
const LAST_HOUR = 47;
const MICRO = 1000000;
const SCALE = 1000000000; // micro-units of free flow times per-mille
const PURPOSES = Object.freeze(["PICKUP", "TRIP", "TO_DEPOT", "DIVERSION", "RELEASE"]);

/** Floor of a / b for non-negative safe integers a and positive safe integers b, corrected to be exact. */
function floorDiv(a, b) {
  let q = Math.floor(a / b);
  while (q * b > a) q -= 1;
  while ((q + 1) * b <= a) q += 1;
  return q;
}

/** a / b rounded half to even, for non-negative safe integers a and positive safe integers b. */
function halfEvenDiv(a, b) {
  const q = floorDiv(a, b);
  const twice = 2 * (a - q * b);
  if (twice > b) return q + 1;
  if (twice < b) return q;
  return q % 2 === 0 ? q : q + 1;
}

function requireSeconds(value, what) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a non-negative whole number of seconds, got ${String(value)}`);
  }
}

/** The area id of a depot id `<AREA>-<n>` (unitless). */
export function depotArea(depotId) {
  if (typeof depotId !== "string") throw new TypeError("a depot id is a string such as SF-1");
  const cut = depotId.lastIndexOf("-");
  if (cut <= 0) throw new RangeError(`unknown depot id ${depotId}`);
  return depotId.slice(0, cut);
}

/** The area a location `{area}` or `{depot}` stands in (unitless). */
export function locationArea(location) {
  if (location !== null && typeof location === "object") {
    if (typeof location.area === "string") return location.area;
    if (typeof location.depot === "string") return depotArea(location.depot);
  }
  throw new TypeError("a location is {area} or {depot}");
}

function findArea(scenario, areaId) {
  for (const area of scenario.areas) if (area.id === areaId) return area;
  throw new RangeError(`the scenario has no area ${String(areaId)}`);
}

function findDepot(scenario, depotId) {
  for (const depot of scenario.depots) if (depot.id === depotId) return depot;
  throw new RangeError(`the scenario has no depot ${String(depotId)}`);
}

function findRoute(scenario, routeId) {
  for (const route of scenario.routes) if (route.id === routeId) return route;
  throw new RangeError(`the scenario has no route ${String(routeId)}`);
}

/** The two routes joining areas `from` and `to` as `{HIGHWAY, LOCAL}` route objects. */
function routesBetween(scenario, from, to) {
  const found = { HIGHWAY: null, LOCAL: null };
  for (const route of scenario.routes) {
    if ((route.a === from && route.b === to) || (route.a === to && route.b === from)) found[route.cls] = route;
  }
  if (found.HIGHWAY === null || found.LOCAL === null) {
    throw new RangeError(`the scenario has no highway and local route pair between ${String(from)} and ${String(to)}`);
  }
  return found;
}

/** Free-flow seconds and the 48-hour per-mille congestion row of one segment. */
function segmentProfile(scenario, segment) {
  switch (segment?.kind) {
    case "ROUTE": {
      const route = findRoute(scenario, segment.route_id);
      const joins = (route.a === segment.from && route.b === segment.to) || (route.a === segment.to && route.b === segment.from);
      if (!joins) throw new RangeError(`route ${route.id} does not join ${String(segment.from)} and ${String(segment.to)}`);
      return { free_flow_s: route.free_flow_s, row: scenario.congestion[route.cls][`${segment.from}>${segment.to}`] };
    }
    case "IN_AREA":
      return { free_flow_s: findArea(scenario, segment.area).in_area_s, row: scenario.congestion.IN_AREA };
    case "ACCESS":
      if (segment.dir !== "IN" && segment.dir !== "OUT") throw new RangeError("an ACCESS segment has dir IN or OUT");
      findDepot(scenario, segment.depot);
      return { free_flow_s: scenario.depot_access_s, row: scenario.congestion.IN_AREA };
    default:
      throw new RangeError(`unknown segment kind ${String(segment?.kind)}`);
  }
}

/** Planned seconds of one segment departing at depart_s, integrated through the hourly multipliers (design 5.2.1). */
export function plannedLegSeconds(scenario, segment, depart_s) {
  requireSeconds(depart_s, "depart_s");
  if (segment?.kind === "PULL_OUT") return scenario.pull_out_s;
  const { free_flow_s, row } = segmentProfile(scenario, segment);
  let remaining = free_flow_s * MICRO;
  let t = depart_s;
  let elapsed = 0;
  for (;;) {
    const hour = Math.floor(t / HOUR_S);
    const m = row[hour > LAST_HOUR ? LAST_HOUR : hour];
    const toHourEnd = (hour + 1) * HOUR_S - t;
    const covered = floorDiv(toHourEnd * SCALE, m);
    if (remaining <= covered) {
      const product = remaining * m;
      if (!Number.isSafeInteger(product)) throw new RangeError("planned-time product exceeds 2^53");
      return elapsed + halfEvenDiv(product, SCALE);
    }
    remaining -= covered;
    elapsed += toHourEnd;
    t += toHourEnd;
  }
}

/** The faster of the pair's highway and local routes leaving at depart_s: `{route_id, planned_s}`; a tie takes the highway. */
export function chooseRoute(scenario, from, to, depart_s) {
  if (from === to) throw new RangeError(`no route is needed inside one area (${String(from)})`);
  const pair = routesBetween(scenario, from, to);
  const highway = plannedLegSeconds(scenario, { kind: "ROUTE", route_id: pair.HIGHWAY.id, from, to }, depart_s);
  const local = plannedLegSeconds(scenario, { kind: "ROUTE", route_id: pair.LOCAL.id, from, to }, depart_s);
  return local < highway ? { route_id: pair.LOCAL.id, planned_s: local } : { route_id: pair.HIGHWAY.id, planned_s: highway };
}

/**
 * The segment kinds of a path between two locations (`{area}` or `{depot}`), without times (contract 6.3).
 * A car leaves a depot yard with PULL_OUT unless the purpose is DIVERSION (a car turned away at the gate never entered).
 * A ROUTE segment carries `from` and `to`; its route is chosen when the segment departs.
 */
export function pathSegments(fromLocation, toLocation, purpose) {
  if (!PURPOSES.includes(purpose)) throw new RangeError(`unknown path purpose ${String(purpose)}`);
  const fromArea = locationArea(fromLocation);
  const toArea = locationArea(toLocation);
  const segments = [];
  const fromDepot = typeof fromLocation.depot === "string" ? fromLocation.depot : null;
  const toDepot = typeof toLocation.depot === "string" ? toLocation.depot : null;
  if (fromDepot !== null) {
    if (fromDepot === toDepot) throw new RangeError(`a path from depot ${fromDepot} to itself has no segments`);
    if (purpose !== "DIVERSION") segments.push({ kind: "PULL_OUT" });
    segments.push({ kind: "ACCESS", depot: fromDepot, dir: "OUT" });
  }
  if (fromArea !== toArea) segments.push({ kind: "ROUTE", from: fromArea, to: toArea });
  else if (toDepot === null) segments.push({ kind: "IN_AREA", area: toArea });
  if (toDepot !== null) segments.push({ kind: "ACCESS", depot: toDepot, dir: "IN" });
  return segments;
}

/**
 * Chains planned seconds along pathSegments from depart_s: `{depart_s, arrive_s, segments}`, each segment with
 * `depart_s` and `planned_s` (seconds), a ROUTE segment choosing its `route_id` at its own planned departure.
 * `purpose` defaults to DIVERSION between two depots and to TRIP otherwise (it only decides the pull-out).
 */
export function planPath(scenario, fromLocation, toLocation, depart_s, purpose) {
  requireSeconds(depart_s, "depart_s");
  const chosenPurpose = purpose ?? (fromLocation?.depot !== undefined && toLocation?.depot !== undefined ? "DIVERSION" : "TRIP");
  const segments = pathSegments(fromLocation, toLocation, chosenPurpose);
  let t = depart_s;
  for (const segment of segments) {
    segment.depart_s = t;
    if (segment.kind === "ROUTE") {
      const choice = chooseRoute(scenario, segment.from, segment.to, t);
      segment.route_id = choice.route_id;
      segment.planned_s = choice.planned_s;
    } else {
      segment.planned_s = plannedLegSeconds(scenario, segment, t);
    }
    t += segment.planned_s;
  }
  return { depart_s, arrive_s: t, segments };
}
