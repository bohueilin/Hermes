// The exogenous world of one seed (contract 6.3, design 5.2.2, 5.4, P-1, P18): the candidate request stream per area,
// built by thinning against a declared envelope, and the traffic and ride factor accessors.
//
// Both arms of a paired run read one frozen world built from the declared scenario. Each arm accepts candidates
// against its own demand profile, so a demand axis changes only acceptance; every other axis leaves the accepted
// requests identical. Every draw is keyed (never call order) and every quantity is an integer.

import { canonicalJson } from "../core/canon.js";
import { keyedU64Source, u16 } from "../core/keyed.js";
import { sha256Hex } from "../core/sha256.js";
import { roundHalfEvenDiv } from "../core/stats.js";
import { expTable, multiplierTable, TABLE_DIGESTS } from "../core/tables.js";
import { AREA_IDS } from "./schema.js";

const HOUR_S = 3600;
const QUARTER_HOUR_S = 900;
const HOURS = 48;
const TWO_32 = 4294967296;
const PPM = 1000000;
const PPM_SQUARED = 1000000000000n;
/** The largest envelope an area can declare: 120 requests per hour (the DEM-1 maximum) in thousandths. */
export const MAX_LAMBDA_PERMILLE = 120000;

const digestCache = new WeakMap();

function requireSafeInt(value, what, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) {
    throw new RangeError(`${what} must be a whole number from ${min} to ${max}, got ${String(value)}`);
  }
}

/** Hour indices [first, end) of the hours that overlap the scenario's window (hours, 0 to 48). */
function windowHourRange(scenario) {
  const { start_s, end_s } = scenario.window;
  return [Math.floor(start_s / HOUR_S), Math.ceil(end_s / HOUR_S)];
}

/** True when hour index `hour` (0 to 47) is inside either declared peak window by its hour of day. */
export function isPeakHour(scenario, hour) {
  const hod = hour % 24;
  return scenario.peaks.some((peak) => peak.start_h <= hod && hod < peak.end_h);
}

/** The destination period of a candidate created at t_s (seconds): "morning", "evening" or "other" (contract 6.2). */
export function destinationPeriod(scenario, t_s) {
  const hod = Math.floor(t_s / HOUR_S) % 24;
  const [morning, evening] = scenario.peaks;
  if (morning.start_h <= hod && hod < morning.end_h) return "morning";
  if (evening.start_h <= hod && hod < evening.end_h) return "evening";
  return "other";
}

/**
 * Request rate per area and hour in thousandths of requests per hour: `{SF: [48 values], ...}` (design 5.2.2).
 * `flat` gives every hour the half-even mean of the peaked rates over the window's whole hours.
 */
export function lambdaProfilePermille(scenario) {
  const profile = {};
  for (const area of scenario.areas) {
    const peaked = Array.from({ length: HOURS }, (_, h) => (isPeakHour(scenario, h) ? area.peak_per_h : area.offpeak_per_h) * 1000);
    if (scenario.demand_shape === "peaked") {
      profile[area.id] = peaked;
    } else if (scenario.demand_shape === "flat") {
      const first = Math.ceil(scenario.window.start_s / HOUR_S);
      const end = Math.floor(scenario.window.end_s / HOUR_S);
      if (end <= first) throw new RangeError("the window holds no whole hour, so the flat demand mean is undefined");
      let sum = 0;
      for (let h = first; h < end; h++) sum += peaked[h];
      const mean = Number(roundHalfEvenDiv(BigInt(sum), BigInt(end - first)));
      profile[area.id] = new Array(HOURS).fill(mean);
    } else {
      throw new RangeError(`unknown demand shape ${String(scenario.demand_shape)}`);
    }
  }
  return profile;
}

/** The scenario's own envelope: per area, the largest hourly rate over hours overlapping the window (thousandths). */
export function ownLambdaMaxPermille(scenario) {
  const profile = lambdaProfilePermille(scenario);
  const [first, end] = windowHourRange(scenario);
  const out = {};
  for (const id of Object.keys(profile)) {
    let max = 0;
    for (let h = first; h < end; h++) if (profile[id][h] > max) max = profile[id][h];
    out[id] = max;
  }
  return out;
}

/** The shared envelope over several arm scenarios: per area, the largest own maximum (thousandths of requests per hour). */
export function sharedLambdaMaxPermille(scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new RangeError("the shared envelope needs at least one scenario");
  const out = {};
  for (const scenario of scenarios) {
    const own = ownLambdaMaxPermille(scenario);
    for (const id of Object.keys(own)) out[id] = Math.max(out[id] ?? 0, own[id]);
  }
  return out;
}

/** Candidate gap in seconds: round_half_even(expThousandths x 3600 / lambdaMaxPermille), in exact integers (design 5.2.2). */
export function gapSeconds(expThousandths, lambdaMaxPermille) {
  requireSafeInt(expThousandths, "an exponential table entry", 0);
  requireSafeInt(lambdaMaxPermille, "lambdaMaxPermille", 1);
  return Number(roundHalfEvenDiv(BigInt(expThousandths) * 3600n, BigInt(lambdaMaxPermille)));
}

/** Thinning test: accept when thin x lambdaMax < lambda x 2^32 (both products stay below 2^53, so doubles are exact). */
export function acceptsCandidate(thin, lambdaMaxPermille, lambdaPermille) {
  return thin * lambdaMaxPermille < lambdaPermille * TWO_32;
}

/** Destination area for a u32 draw over integer weights `{SF, PEN, SJ, EB}` (total at most 2^20), in area order. */
export function pickDestination(dest, weights) {
  let total = 0;
  for (const id of AREA_IDS) total += weights[id];
  if (!Number.isSafeInteger(total) || total < 1 || total > 1048576) throw new RangeError(`destination weights total ${total} is outside 1 to 2^20`);
  const index = Math.floor((dest * total) / TWO_32);
  let cumulative = 0;
  for (const id of AREA_IDS) {
    cumulative += weights[id];
    if (index < cumulative) return id;
  }
  throw new RangeError(`destination draw ${dest} is outside 0 to 2^32 - 1`);
}

/** The quarter-hour index of a departure second (quarter hours from day 1 00:00). */
export function quarterHour(t_s) {
  return Math.floor(t_s / QUARTER_HOUR_S);
}

/**
 * Factor key of a segment (contract 6.3): `{key, dir}` with key the route id, `IN-<area>` or `ACC-<depot>` and dir
 * `"<from>><to>"`, `-` or `IN`/`OUT`; null for PULL_OUT, which takes no factor.
 */
export function segmentFactorKey(segment) {
  switch (segment?.kind) {
    case "ROUTE":
      return { key: segment.route_id, dir: `${segment.from}>${segment.to}` };
    case "IN_AREA":
      return { key: `IN-${segment.area}`, dir: "-" };
    case "ACCESS":
      return { key: `ACC-${segment.depot}`, dir: segment.dir };
    case "PULL_OUT":
      return null;
    default:
      throw new RangeError(`unknown segment kind ${String(segment?.kind)}`);
  }
}

/** Traffic factor in parts per million: MULT_TABLE_sigma[u16(seed, "traffic", segmentKey, dir, quarterHour)]. */
export function trafficPpm(seed, segmentKey, dir, quarterHourIndex, sigmaPermille) {
  const table = multiplierTable(sigmaPermille);
  if (typeof segmentKey !== "string" || typeof dir !== "string") throw new TypeError("a traffic key and direction are strings");
  requireSafeInt(quarterHourIndex, "quarterHour", 0);
  requireSafeInt(seed, "seed");
  if (sigmaPermille === 0) return PPM;
  return table[u16(seed, "traffic", segmentKey, dir, quarterHourIndex)];
}

/** Ride factor in parts per million: MULT_TABLE_sigma[u16(seed, "ride", requestId)]. */
export function ridePpm(seed, requestId, sigmaPermille) {
  const table = multiplierTable(sigmaPermille);
  if (typeof requestId !== "string") throw new TypeError("a request id is a string");
  requireSafeInt(seed, "seed");
  if (sigmaPermille === 0) return PPM;
  return table[u16(seed, "ride", requestId)];
}

/** Realized seconds: round_half_even(planned_s x trafficPpm x ridePpm / 10^12) in BigInt; ridePpm is 10^6 for a leg no rider causes. */
export function realizedSeconds(planned_s, trafficFactorPpm, rideFactorPpm = PPM) {
  requireSafeInt(planned_s, "planned_s", 0);
  requireSafeInt(trafficFactorPpm, "trafficPpm", 1);
  requireSafeInt(rideFactorPpm, "ridePpm", 1);
  return Number(roundHalfEvenDiv(BigInt(planned_s) * BigInt(trafficFactorPpm) * BigInt(rideFactorPpm), PPM_SQUARED));
}

/** The envelope a world uses: given values where passed, the scenario's own maximum otherwise (thousandths). */
function resolveEnvelope(scenario, given) {
  const own = ownLambdaMaxPermille(scenario);
  if (given !== undefined && (given === null || typeof given !== "object" || Array.isArray(given))) {
    throw new TypeError("lambdaMaxPermille is an object of area id to thousandths of requests per hour");
  }
  for (const key of Object.keys(given ?? {})) {
    if (!Object.prototype.hasOwnProperty.call(own, key)) throw new RangeError(`lambdaMaxPermille names unknown area ${key}`);
  }
  const envelope = {};
  for (const id of Object.keys(own)) {
    const value = given !== undefined && Object.prototype.hasOwnProperty.call(given, id) ? given[id] : own[id];
    requireSafeInt(value, `lambdaMaxPermille.${id}`, 0, MAX_LAMBDA_PERMILLE);
    if (value < own[id]) {
      throw new RangeError(`lambdaMaxPermille.${id} is ${value}, below the scenario's own hourly maximum ${own[id]} (P18)`);
    }
    envelope[id] = value;
  }
  return envelope;
}

/**
 * Builds and verifies the Exp(1) table and the multiplier table for `sigmaPermille` ahead of a run, so the first run
 * does not pay for them (both are memoized). Returns `{sigma_permille}`; an off-grid sigma throws as buildWorld does.
 */
export function warmTables(sigmaPermille) {
  expTable();
  multiplierTable(sigmaPermille);
  return { sigma_permille: sigmaPermille };
}

/**
 * Builds the frozen world of one seed from the declared scenario (contract 6.3): candidates per area as
 * `{t_s, thin, dest}` arrays (seconds, u32 draws), the envelope in thousandths, and bound factor accessors
 * `trafficPpm(segmentKey, dir, quarterHour)` and `ridePpm(requestId)` in parts per million.
 */
export function buildWorld(scenario, { seed, lambdaMaxPermille } = {}) {
  requireSafeInt(seed, "seed");
  if (typeof scenario?.name !== "string" || scenario.name.length === 0) throw new TypeError("the scenario name is the demand key and must be text");
  const { start_s, end_s } = scenario.window;
  requireSafeInt(start_s, "window.start_s", 0);
  requireSafeInt(end_s, "window.end_s", start_s + 1, HOURS * HOUR_S);
  const sigma = scenario.sigma_permille;
  multiplierTable(sigma); // rejects an off-grid sigma and verifies the table's pinned digest before any run reads it
  const envelope = resolveEnvelope(scenario, lambdaMaxPermille);
  const exp = expTable();
  const draw = keyedU64Source(scenario.name);

  const candidates = {};
  for (const id of Object.keys(envelope)) {
    const t_s = [];
    const thin = [];
    const dest = [];
    const lambdaMax = envelope[id];
    if (lambdaMax > 0) {
      let t = start_s;
      for (let k = 0; ; k++) {
        t += gapSeconds(exp[Number(draw("gap", id, k) >> 48n)], lambdaMax);
        if (t >= end_s) break;
        t_s.push(t);
        thin.push(Number(draw("thin", id, k) >> 32n));
        dest.push(Number(draw("dest", id, k) >> 32n));
      }
    }
    candidates[id] = Object.freeze({ t_s: Object.freeze(t_s), thin: Object.freeze(thin), dest: Object.freeze(dest) });
  }

  const trafficCache = new Map();
  const world = {
    name: scenario.name,
    seed,
    sigma_permille: sigma,
    window: Object.freeze({ start_s, end_s }),
    lambdaMaxPermille: Object.freeze(envelope),
    candidates: Object.freeze(candidates),
    table_digests: Object.freeze({ exp: TABLE_DIGESTS.exp, [`mult_${sigma}`]: TABLE_DIGESTS[`mult_${sigma}`] }),
    /** Traffic factor in parts per million for a segment key, direction and quarter-hour index, cached per key. */
    trafficPpm(segmentKey, dir, quarterHourIndex) {
      const cacheKey = `${segmentKey}|${dir}|${quarterHourIndex}`;
      let value = trafficCache.get(cacheKey);
      if (value === undefined) {
        value = trafficPpm(seed, segmentKey, dir, quarterHourIndex, sigma);
        trafficCache.set(cacheKey, value);
      }
      return value;
    },
    /** Ride factor in parts per million for a request id. */
    ridePpm(requestId) {
      return ridePpm(seed, requestId, sigma);
    },
  };
  return Object.freeze(world);
}

/**
 * Requests an arm accepts from the shared world (contract 6.3): `[{id, time_s, origin, dest}]` sorted by (time_s, id).
 * The arm scenario must share the world's name, window and sigma, and its profile must stay inside the envelope (P18).
 */
export function acceptedRequests(world, scenario) {
  if (scenario.name !== world.name) throw new RangeError(`the scenario name ${scenario.name} differs from the world's ${world.name}`);
  if (scenario.window.start_s !== world.window.start_s || scenario.window.end_s !== world.window.end_s) {
    throw new RangeError("the scenario window differs from the world's window, so the shared candidates do not fit it");
  }
  if (scenario.sigma_permille !== world.sigma_permille) {
    throw new RangeError("the scenario's travel variation differs from the world's, whose factors both arms share");
  }
  const profile = lambdaProfilePermille(scenario);
  const [first, end] = windowHourRange(scenario);
  const requests = [];
  for (const id of AREA_IDS) {
    if (!Object.prototype.hasOwnProperty.call(profile, id)) continue;
    const lambdaMax = world.lambdaMaxPermille[id];
    for (let h = first; h < end; h++) {
      if (profile[id][h] > lambdaMax) {
        throw new RangeError(`area ${id} asks for ${profile[id][h]} thousandths of requests in hour ${h}, above the envelope ${lambdaMax} (P18)`);
      }
    }
    const { t_s, thin, dest } = world.candidates[id];
    for (let k = 0; k < t_s.length; k++) {
      const t = t_s[k];
      if (!acceptsCandidate(thin[k], lambdaMax, profile[id][Math.floor(t / HOUR_S)])) continue;
      const weights = scenario.dest_weights[destinationPeriod(scenario, t)][id];
      requests.push({ id: `r-${id}-${k}`, time_s: t, origin: id, dest: pickDestination(dest[k], weights) });
    }
  }
  requests.sort((a, b) => a.time_s - b.time_s || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return requests;
}

/**
 * Lowercase hex SHA-256 of canonical JSON `{name, window, lambdaMax, candidates, seed, sigma_permille, table_digests}`
 * (contract 6.3, P18); candidates are per area `[[t_s, thin, dest], ...]`. Memoized per world.
 */
export function worldDigest(world) {
  let digest = digestCache.get(world);
  if (digest === undefined) {
    const candidates = {};
    for (const id of Object.keys(world.candidates)) {
      const { t_s, thin, dest } = world.candidates[id];
      candidates[id] = t_s.map((t, k) => [t, thin[k], dest[k]]);
    }
    digest = sha256Hex(
      canonicalJson({
        name: world.name,
        window: { start_s: world.window.start_s, end_s: world.window.end_s },
        lambdaMax: { ...world.lambdaMaxPermille },
        candidates,
        seed: world.seed,
        sigma_permille: world.sigma_permille,
        table_digests: { ...world.table_digests },
      }),
    );
    digestCache.set(world, digest);
  }
  return digest;
}
