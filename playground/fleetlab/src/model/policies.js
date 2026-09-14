// Policies of the teaching model (design 5.5, contract 6.4).
//
// Each policy is a pure function of a view the engine builds: the current second, the locations of dispatchable cars,
// depot occupancy views and a planned-arrival accessor over the declared route table. A view never holds realized
// times, traffic or ride factors, random draws, the other arm, a metric or a clock. The engine validates every result.

import { locationArea } from "./routes.js";

/** Free-flow seconds from an area centre to a depot including depot access (every multiplier 1000). */
function freeFlowToDepot(scenario, areaId, depot) {
  if (depot.area === areaId) return scenario.depot_access_s;
  let best = Infinity;
  for (const route of scenario.routes) {
    const joins = (route.a === areaId && route.b === depot.area) || (route.b === areaId && route.a === depot.area);
    if (joins && route.free_flow_s < best) best = route.free_flow_s;
  }
  return best + scenario.depot_access_s;
}

/** Per area id, the depot ids (sorted) that minimize free-flow seconds from the area centre, access included (SUP-2). */
export function homeDepotSets(scenario) {
  const sets = {};
  for (const area of scenario.areas) {
    let best = Infinity;
    let ids = [];
    for (const depot of scenario.depots) {
      const s = freeFlowToDepot(scenario, area.id, depot);
      if (s < best) {
        best = s;
        ids = [depot.id];
      } else if (s === best) {
        ids.push(depot.id);
      }
    }
    sets[area.id] = ids.sort();
  }
  return sets;
}

/** Home depot of the car with index `i` (from 0, ascending vehicle number) among its home area's cars (SUP-2). */
export function homeDepotFor(sets, areaId, i) {
  const ids = sets[areaId];
  return ids[i % ids.length];
}

/** True when visit number `n` (from 1) includes the service stage (DEP-8). */
export function visitIncludesService(scenario, n) {
  return scenario.service_every_visits > 0 && n % scenario.service_every_visits === 0;
}

/** True when a depot view can serve a visit: a service visit needs a service bay (design 5.3). */
export function depotCanServe(depot, serviceDue) {
  return !serviceDue || depot.service_bays > 0;
}

/**
 * POL-1 nearest_idle over bucketed locations. `view` = `{t, riderArea, locations: [{location, firstCar}], plan}` where
 * each location holds dispatchable cars and `firstCar` is its smallest vehicle id; `plan(from, to, t, purpose)` returns
 * the planned arrival second. Every car of one location shares its planned arrival, so the best car overall is the
 * minimum of (arrival, first car) over locations. Returns `{car, location, arrive_s}` or null.
 */
export function nearestIdle(view) {
  let best = null;
  const to = { area: view.riderArea };
  for (const entry of view.locations) {
    const arrive_s = view.plan(entry.location, to, view.t, "PICKUP");
    if (best === null || arrive_s < best.arrive_s || (arrive_s === best.arrive_s && entry.firstCar < best.car)) {
      best = { car: entry.firstCar, location: entry.location, arrive_s };
    }
  }
  return best;
}

/** The nearest depot view among `depots` by planned arrival from `from` at `t`, then depot id; null when none. */
function nearestOf(depots, from, t, plan, purpose) {
  let best = null;
  for (const depot of depots) {
    const arrive_s = plan(from, { depot: depot.id }, t, purpose);
    if (best === null || arrive_s < best.arrive_s || (arrive_s === best.arrive_s && depot.id < best.depot)) {
      best = { depot: depot.id, arrive_s };
    }
  }
  return best;
}

/**
 * POL-2 depot assignment when a car leaves for a visit. `view` = `{t, from, homeDepot, serviceDue, depots: [{id, area,
 * parking, stalls_held, inbound, service_bays}], plan}` and `policy` one of home_depot, nearest_depot,
 * nearest_depot_with_capacity. Returns `{depot, cause}`; the cause names the rule or its fallback, and ends in
 * `_service_bays_only` when skipping depots without a service bay changed the depot the rule picks (design 5.3).
 */
export function assignDepot(view, policy) {
  const eligible = view.depots.filter((d) => depotCanServe(d, view.serviceDue));
  if (eligible.length === 0) return { depot: null, cause: "no_depot_can_serve" };
  const nearest = (list) => nearestOf(list, view.from, view.t, view.plan, "TO_DEPOT").depot;
  if (policy === "home_depot") {
    if (eligible.some((d) => d.id === view.homeDepot)) return { depot: view.homeDepot, cause: "home_depot" };
    return { depot: nearest(eligible), cause: "home_depot_without_service_bay_nearest_depot" };
  }
  let rule;
  if (policy === "nearest_depot") {
    rule = (list) => ({ depot: nearest(list), cause: "nearest_depot" });
  } else if (policy === "nearest_depot_with_capacity") {
    rule = (list) => {
      const roomy = list.filter((d) => d.parking - d.stalls_held - d.inbound >= 1);
      if (roomy.length > 0) return { depot: nearest(roomy), cause: "nearest_depot_with_capacity" };
      return { depot: nearest(list), cause: "no_depot_with_capacity_nearest_depot" };
    };
  } else {
    return { depot: null, cause: `unknown_policy_${String(policy)}` };
  }
  const choice = rule(eligible);
  if (eligible.length < view.depots.length && rule(view.depots).depot !== choice.depot) choice.cause += "_service_bays_only";
  return choice;
}

/**
 * Diversion target when a car finds its target lot full (design 3.2, 5.3): the nearest depot, from the full depot at
 * `t`, that can serve the visit and has a free stall. `view` = `{t, from: {depot}, serviceDue, depots, plan}`.
 * Returns `{depot, cause}` with cause `nearest_free_stall`, ending in `_service_bays_only` when skipping depots without a
 * service bay changed the target; null when none qualifies (the car waits at the gate).
 */
export function divertDepot(view) {
  const open = view.depots.filter((d) => d.id !== view.from.depot && d.stalls_held < d.parking);
  const nearest = (list) => nearestOf(list, view.from, view.t, view.plan, "DIVERSION");
  const best = nearest(open.filter((d) => depotCanServe(d, view.serviceDue)));
  if (best === null) return null;
  const skipped = nearest(open).depot !== best.depot;
  return { depot: best.depot, cause: skipped ? "nearest_free_stall_service_bays_only" : "nearest_free_stall" };
}

/** POL-4 morning release: true when a car ready at `depotId` stands outside its home area (P20). */
export function releasesHome(depotId, homeArea) {
  return locationArea({ depot: depotId }) !== homeArea;
}
