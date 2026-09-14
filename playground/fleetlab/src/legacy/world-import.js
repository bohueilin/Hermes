// Loader for legacy worlds exported from Python (contract section 5.1, design section 5.10). FleetLab builds its tape
// with float transcendental calls a browser does not reproduce bit for bit, so the legacy profile consumes the tape
// FleetLab materialized instead of generating one.

const SCENARIO_INTEGER_FIELDS = [
  "horizon_s",
  "vehicle_count",
  "max_wait_s",
  "trips_between_service",
  "service_bays",
  "service_duration_s",
  "in_zone_pickup_s",
];

const EXPECTED_KEYS = ["error", "events", "events_digest", "event_counts", "metrics", "invariant_violations"];

/** Throw a TypeError naming the fixture path that failed validation. */
function fail(path, why) {
  throw new TypeError(`legacy world fixture: ${path} ${why}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(value, path) {
  if (typeof value !== "string") fail(path, "must be a string");
  return value;
}

function requireInteger(value, path) {
  if (!Number.isSafeInteger(value)) fail(path, "must be a safe integer");
  return value;
}

function requireFiniteNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "must be a finite number");
  return value;
}

/** Validate the scenario fields `run_fleet` reads (integer seconds, counts, zone names and the travel matrix). */
function validateScenario(scenario, path) {
  if (!isPlainObject(scenario)) fail(path, "must be an object");
  requireString(scenario.name, `${path}.name`);
  for (const field of SCENARIO_INTEGER_FIELDS) requireInteger(scenario[field], `${path}.${field}`);
  if (scenario.vehicle_count < 1) fail(`${path}.vehicle_count`, "must be at least 1");
  if (!Array.isArray(scenario.zones) || scenario.zones.length < 2) fail(`${path}.zones`, "must list at least two zones");
  scenario.zones.forEach((zone, i) => requireString(zone, `${path}.zones[${i}]`));
  if (!isPlainObject(scenario.travel_time_s)) fail(`${path}.travel_time_s`, "must be an object");
  for (const a of scenario.zones) {
    for (const b of scenario.zones) {
      if (a === b) continue;
      const key = `${a}->${b}`;
      if (!Object.hasOwn(scenario.travel_time_s, key)) fail(`${path}.travel_time_s`, `is missing ${key}`);
      requireInteger(scenario.travel_time_s[key], `${path}.travel_time_s["${key}"]`);
    }
  }
  requireFiniteNumber(scenario.travel_sigma, `${path}.travel_sigma`);
  return scenario;
}

/** Validate a tape `{seed, demand: [[id, time_s, origin, destination]], travel_multiplier: {id: double}}`. */
function importTape(tape, path) {
  if (!isPlainObject(tape)) fail(path, "must be an object");
  const seed = requireInteger(tape.seed, `${path}.seed`);
  if (!Array.isArray(tape.demand)) fail(`${path}.demand`, "must be an array");
  const demand = tape.demand.map((row, i) => {
    const at = `${path}.demand[${i}]`;
    if (!Array.isArray(row) || row.length !== 4) fail(at, "must be [request_id, time_s, origin, destination]");
    return {
      request_id: requireString(row[0], `${at}[0]`),
      time_s: requireInteger(row[1], `${at}[1]`),
      origin: requireString(row[2], `${at}[2]`),
      destination: requireString(row[3], `${at}[3]`),
    };
  });
  if (!isPlainObject(tape.travel_multiplier)) fail(`${path}.travel_multiplier`, "must be an object");
  const travel_multiplier = new Map();
  for (const [id, value] of Object.entries(tape.travel_multiplier)) {
    travel_multiplier.set(id, requireFiniteNumber(value, `${path}.travel_multiplier["${id}"]`));
  }
  return { seed, demand, travel_multiplier };
}

/** Validate the expected block: either an error type name with every other field null, or a full normal run. */
function validateExpected(expected, path) {
  if (!isPlainObject(expected)) fail(path, "must be an object");
  const keys = Object.keys(expected).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...EXPECTED_KEYS].sort())) fail(path, `must have exactly the keys ${EXPECTED_KEYS.join(", ")}`);
  if (expected.error !== null) {
    requireString(expected.error, `${path}.error`);
    for (const key of EXPECTED_KEYS.slice(1)) if (expected[key] !== null) fail(`${path}.${key}`, "must be null for an error world");
    return expected;
  }
  if (!Array.isArray(expected.events)) fail(`${path}.events`, "must be an array");
  expected.events.forEach((entry, i) => {
    const at = `${path}.events[${i}]`;
    if (!Array.isArray(entry) || entry.length !== 3) fail(at, "must be [time_s, kind, entity_id]");
    requireInteger(entry[0], `${at}[0]`);
    requireString(entry[1], `${at}[1]`);
    requireString(entry[2], `${at}[2]`);
  });
  if (typeof expected.events_digest !== "string" || !/^[0-9a-f]{64}$/.test(expected.events_digest)) {
    fail(`${path}.events_digest`, "must be 64 lowercase hexadecimal characters");
  }
  if (!isPlainObject(expected.event_counts)) fail(`${path}.event_counts`, "must be an object");
  for (const [kind, count] of Object.entries(expected.event_counts)) requireInteger(count, `${path}.event_counts.${kind}`);
  if (!isPlainObject(expected.metrics)) fail(`${path}.metrics`, "must be an object");
  for (const [name, value] of Object.entries(expected.metrics)) requireFiniteNumber(value, `${path}.metrics["${name}"]`);
  if (!Array.isArray(expected.invariant_violations)) fail(`${path}.invariant_violations`, "must be an array");
  expected.invariant_violations.forEach((text, i) => requireString(text, `${path}.invariant_violations[${i}]`));
  return expected;
}

/**
 * Validate a parsed legacy fixture file and return a Map from world name to
 * `{name, scenario, tape, dispatchMode, expected}`; `tape.demand` keeps the file's order and `tape.travel_multiplier`
 * is a Map from request id to multiplier (unitless).
 */
export function importLegacyWorlds(json) {
  if (!isPlainObject(json)) fail("root", "must be an object");
  if (json.format !== "fleet-playground-legacy-worlds") fail("format", "must be fleet-playground-legacy-worlds");
  if (json.format_version !== 1) fail("format_version", "must be 1");
  if (!isPlainObject(json.worlds) || Object.keys(json.worlds).length === 0) fail("worlds", "must be a non-empty object");
  const worlds = new Map();
  for (const [key, world] of Object.entries(json.worlds)) {
    const path = `worlds.${key}`;
    if (!isPlainObject(world)) fail(path, "must be an object");
    requireString(world.origin, `${path}.origin`);
    const dispatchMode = requireString(world.dispatch_mode, `${path}.dispatch_mode`);
    if (dispatchMode !== "nearest" && dispatchMode !== "defect_double_assign") {
      fail(`${path}.dispatch_mode`, "must be nearest or defect_double_assign");
    }
    worlds.set(key, {
      name: requireString(world.name, `${path}.name`),
      scenario: validateScenario(world.scenario, `${path}.scenario`),
      tape: importTape(world.tape, `${path}.tape`),
      dispatchMode,
      expected: validateExpected(world.expected, `${path}.expected`),
    });
  }
  return worlds;
}
