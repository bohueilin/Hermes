// Scenario schema of the teaching model: knobs, defaults, validation, the axis grammar and differences
// (contract section 6.2; design sections 2, 5.3, 5.6 P19 and 7.6).
// Every scenario number is an integer in engine units: seconds (`*_s`), per-mille (`*_permille`) or a count.

export const SCENARIO_FORMAT = "playground-scenario";
export const SCENARIO_VERSION = "0.1";
export const AREA_IDS = Object.freeze(["SF", "PEN", "SJ", "EB"]);
export const AREA_LABELS = Object.freeze({ SF: "San Francisco", PEN: "Peninsula", SJ: "San Jose", EB: "East Bay" });
export const DAY_S = 86400;
export const HOURS = 48;
export const DEPOT_ACCESS_S = 300;
export const DEMAND_SHAPES = Object.freeze(["flat", "peaked"]);
export const DEPOT_ASSIGNMENTS = Object.freeze(["home_depot", "nearest_depot", "nearest_depot_with_capacity"]);
export const RD3_CLASSES = Object.freeze({ highway: "HIGHWAY", local: "LOCAL", in_area: "IN_AREA" });
export const RD3_PERIOD_HOURS = Object.freeze({
  morning: Object.freeze([7, 8]),
  evening: Object.freeze([16, 17, 18]),
  late: Object.freeze([19]),
});

const MAX_WEIGHT_TOTAL = 1048576; // 2^20, design 5.2.2 step 3
const MIN_WINDOW_S = 4 * 3600;
const MAX_WINDOW_S = 36 * 3600;
const PERIODS = ["morning", "evening", "other"];
const PERIOD_LABELS = { morning: "morning peak", evening: "evening peak", other: "other hours" };

// Design 2.9: area pair, highway minutes, local minutes; ids H<i>, L<i> in this order.
const PAIR_MINUTES = [
  ["SF", "PEN", 25, 55],
  ["SF", "SJ", 55, 110],
  ["SF", "EB", 20, 45],
  ["PEN", "SJ", 30, 70],
  ["PEN", "EB", 40, 80],
  ["SJ", "EB", 50, 95],
];

/** Freeze a plain data value and everything inside it; returns the value. */
export function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

/** The fixed routes of design 2.9 in the order H1, L1, H2, L2, ...; `free_flow_s` in seconds. */
export const ROUTES = deepFreeze(
  PAIR_MINUTES.flatMap(([a, b, highway, local], i) => [
    { id: `H${i + 1}`, a, b, cls: "HIGHWAY", free_flow_s: highway * 60 },
    { id: `L${i + 1}`, a, b, cls: "LOCAL", free_flow_s: local * 60 },
  ]),
);

/** Every ordered area pair as `"<from>><to>"`, both directions of each pair in design 2.9 order. */
export const DIRECTION_KEYS = Object.freeze(PAIR_MINUTES.flatMap(([a, b]) => [`${a}>${b}`, `${b}>${a}`]));

const ALL_DEPOT_IDS = AREA_IDS.flatMap((area) => [`${area}-1`, `${area}-2`]);

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isInt = Number.isSafeInteger;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Default congestion in per-mille for a class, direction and hour of day (contract 6.2, design RD-3). */
function defaultCongestionPermille(cls, from, to, hourOfDay) {
  const morning = hourOfDay === 7 || hourOfDay === 8;
  const evening = hourOfDay >= 16 && hourOfDay <= 18;
  if (cls !== "HIGHWAY") return morning || evening ? 1300 : 1000;
  if (hourOfDay === 19) return 1300;
  if (!morning && !evening) return 1000;
  if (from !== "SF" && to !== "SF") return 1200;
  if (morning) return to === "SF" ? 1600 : 1200;
  return from === "SF" ? 1600 : 1200;
}

function defaultDestWeights() {
  const weights = { morning: {}, evening: {}, other: {} };
  for (const origin of AREA_IDS) {
    weights.morning[origin] = {};
    weights.evening[origin] = {};
    weights.other[origin] = {};
    for (const dest of AREA_IDS) {
      const own = dest === origin;
      weights.morning[origin][dest] = origin === "SF" ? (own ? 70 : 10) : dest === "SF" ? 55 : own ? 25 : 10;
      weights.evening[origin][dest] = origin === "SF" ? (own ? 16 : 28) : own ? 60 : dest === "SF" ? 10 : 15;
      weights.other[origin][dest] = own ? 55 : 15;
    }
  }
  return weights;
}

/** A fresh Bay teaching map scenario (contract 6.2), every value in engine units. */
export function defaultScenario() {
  const row = (cls, from, to) => Array.from({ length: HOURS }, (_, h) => defaultCongestionPermille(cls, from, to, h % 24));
  const HIGHWAY = {};
  const LOCAL = {};
  for (const key of DIRECTION_KEYS) {
    const [from, to] = key.split(">");
    HIGHWAY[key] = row("HIGHWAY", from, to);
    LOCAL[key] = row("LOCAL", from, to);
  }
  return {
    format: SCENARIO_FORMAT,
    version: SCENARIO_VERSION,
    name: "bay_teaching_map",
    window: { start_s: 18000, end_s: 122400 },
    warmup_end_s: 21600,
    bucket_s: 3600,
    placement_snapshot_s: 108000,
    areas: [
      { id: "SF", cars: 30, in_area_s: 360, peak_per_h: 60, offpeak_per_h: 15 },
      { id: "PEN", cars: 18, in_area_s: 480, peak_per_h: 20, offpeak_per_h: 8 },
      { id: "SJ", cars: 24, in_area_s: 480, peak_per_h: 35, offpeak_per_h: 10 },
      { id: "EB", cars: 18, in_area_s: 420, peak_per_h: 30, offpeak_per_h: 8 },
    ],
    routes: ROUTES.map((route) => ({ ...route })),
    peaks: [
      { start_h: 7, end_h: 9 },
      { start_h: 16, end_h: 19 },
    ],
    demand_shape: "peaked",
    dest_weights: defaultDestWeights(),
    congestion: { HIGHWAY, LOCAL, IN_AREA: row("IN_AREA", null, null) },
    congestion_threshold_permille: 1300,
    sigma_permille: 0,
    depots: [
      { id: "SF-1", area: "SF", parking: 60, cleaning_bays: 4, service_bays: 2 },
      { id: "SF-2", area: "SF", parking: 30, cleaning_bays: 2, service_bays: 1 },
      { id: "SJ-1", area: "SJ", parking: 30, cleaning_bays: 3, service_bays: 1 },
      { id: "EB-1", area: "EB", parking: 30, cleaning_bays: 2, service_bays: 1 },
    ],
    depot_access_s: DEPOT_ACCESS_S,
    intake_s: 180,
    pull_out_s: 120,
    clean_s: 1200,
    service_s: 2700,
    trips_between_visits: 10,
    service_every_visits: 3,
    policies: {
      dispatch: "nearest_idle",
      depot_assignment: "home_depot",
      recall_s: 88200,
      release_s: 107100,
      queue_order: "fifo",
    },
    patience_s: 600,
  };
}

const D = defaultScenario();
const perArea = (field) => Object.fromEntries(D.areas.map((a) => [a.id, a[field]]));
const perDepot = (field) => Object.fromEntries(D.depots.map((d) => [d.id, d[field]]));
const later = (id, group, label, help) => ({
  id, group, label, help, unit: null, engineUnit: null, scale: null, type: "later", range: null, default: null, firstBuild: false,
});

/**
 * Every knob of design 2.2 to 2.7 in design order. `range` and `default` are in engine units; the interface divides by
 * `scale` to show `unit` (seconds shown as minutes use scale 60, per-mille shown as a multiplier uses scale 1000).
 */
export const KNOBS = deepFreeze([
  {
    id: "SUP-1", group: "Fleet", label: "Cars per area at start",
    help: "How many cars each area has when the day opens. A car's home area is the area it starts in.",
    unit: "cars", engineUnit: "cars", scale: 1, type: "per_area_int",
    range: { min: 0, max: 200, total_min: 1, total_max: 500 }, default: perArea("cars"), firstBuild: true,
  },
  {
    id: "SUP-2", group: "Fleet", label: "Home area and home depot",
    help: "Shown, not edited. A car's home depot is the depot nearest its home area by free-flow time, including depot access. Cars share tied depots in turn.",
    unit: "area and depot", engineUnit: "ids", scale: 1, type: "derived", range: null, default: null, firstBuild: true,
  },
  later("SUP-3", "Fleet", "Operating window, staggered launch, out-of-service rate, special vehicles", "Fleet availability refinements. Not in this build."),
  {
    id: "DEP-1", group: "Depots", label: "Depots per area",
    help: "Where cars go to be cleaned and serviced. An area may have none, and its cars use the nearest depot. The map needs at least one depot.",
    unit: "depots", engineUnit: "depot ids", scale: 1, type: "depots_per_area",
    range: { min: 0, max: 2, total_min: 1 },
    default: Object.fromEntries(AREA_IDS.map((area) => [area, D.depots.filter((d) => d.area === area).map((d) => d.id)])),
    firstBuild: true,
  },
  {
    id: "DEP-2", group: "Depots", label: "Parking per depot",
    help: "Cars a depot can hold while they check in, wait for a bay or wait ready.",
    unit: "stalls", engineUnit: "stalls", scale: 1, type: "per_depot_int", range: { min: 5, max: 150 },
    default: perDepot("parking"), firstBuild: true,
  },
  {
    id: "DEP-3", group: "Depots", label: "Cleaning bays per depot",
    help: "How many cars a depot can clean at the same time.",
    unit: "bays", engineUnit: "bays", scale: 1, type: "per_depot_int", range: { min: 1, max: 12 },
    default: perDepot("cleaning_bays"), firstBuild: true,
  },
  {
    id: "DEP-4", group: "Depots", label: "Clean time",
    help: "Minutes a car spends in a cleaning bay. Every visit cleans.",
    unit: "min", engineUnit: "s", scale: 60, type: "int", range: { min: 300, max: 3600 }, default: D.clean_s, firstBuild: true,
  },
  {
    id: "DEP-5", group: "Depots", label: "Service bays per depot",
    help: "How many cars a depot can service at the same time. A depot with none never takes a visit that includes service.",
    unit: "bays", engineUnit: "bays", scale: 1, type: "per_depot_int", range: { min: 0, max: 6 },
    default: perDepot("service_bays"), firstBuild: true,
  },
  {
    id: "DEP-6", group: "Depots", label: "Service time",
    help: "Minutes a car spends in a service bay.",
    unit: "min", engineUnit: "s", scale: 60, type: "int", range: { min: 600, max: 14400 }, default: D.service_s, firstBuild: true,
  },
  {
    id: "DEP-7", group: "Depots", label: "Trips between depot visits",
    help: "After this many trips a car heads to a depot.",
    unit: "trips", engineUnit: "trips", scale: 1, type: "int", range: { min: 1, max: 100 }, default: D.trips_between_visits, firstBuild: true,
  },
  {
    id: "DEP-8", group: "Depots", label: "Service every N visits",
    help: "Which visits also include service: 3 means every third visit, and 0 means never.",
    unit: "visits", engineUnit: "visits", scale: 1, type: "int", range: { min: 0, max: 10 }, default: D.service_every_visits, firstBuild: true,
  },
  {
    id: "DEP-9", group: "Depots", label: "Intake and pull-out time",
    help: "Minutes to check a car in when it arrives, and minutes to leave the yard.",
    unit: "min", engineUnit: "s", scale: 60, type: "int_pair", range: { min: 60, max: 600 },
    default: { intake_s: D.intake_s, pull_out_s: D.pull_out_s }, firstBuild: true,
  },
  later("DEP-10", "Depots", "Operating hours", "When intake runs. Depots in this build are open 24 hours."),
  later("DEP-11", "Depots", "Staff and shifts by skill", "Staff not modelled: a free bay always has someone to work it."),
  later("DEP-12", "Depots", "Guest cap, inspection, quality check, launch limit, deep clean, maintenance", "Depot pipeline refinements. Not in this build."),
  later("DEP-13", "Depots", "Chargers per depot", "Battery not modelled: cars never run low."),
  {
    id: "DEM-1", group: "Demand", label: "Peak requests per area",
    help: "Ride requests per hour inside the peak windows. At least the off-peak value.",
    unit: "requests per hour", engineUnit: "requests per hour", scale: 1, type: "per_area_int", range: { min: 1, max: 120 },
    default: perArea("peak_per_h"), firstBuild: true,
  },
  {
    id: "DEM-2", group: "Demand", label: "Off-peak requests per area",
    help: "Ride requests per hour outside the peak windows. 0 is allowed and is outside FleetLab's range.",
    unit: "requests per hour", engineUnit: "requests per hour", scale: 1, type: "per_area_int", range: { min: 0, max: 120 },
    default: perArea("offpeak_per_h"), firstBuild: true,
  },
  {
    id: "DEM-3", group: "Demand", label: "Peak windows",
    help: "A morning peak and an evening peak, applied on both simulated days. The morning peak ends before the evening peak starts.",
    unit: "clock", engineUnit: "hour of day", scale: 1, type: "peaks", range: { min: 0, max: 24 }, default: D.peaks, firstBuild: true,
  },
  {
    id: "DEM-4", group: "Demand", label: "Destination mix",
    help: "Where riders from each area go in the morning peak, the evening peak and other hours, as whole-number weights. Trips inside the same area count too.",
    unit: "weights", engineUnit: "integer weights", scale: 1, type: "weights", range: { min: 0, max: MAX_WEIGHT_TOTAL },
    default: D.dest_weights, firstBuild: true,
  },
  {
    id: "DEM-5", group: "Demand", label: "Demand shape",
    help: "Peaked uses the peak windows as set. Flat spreads the same total evenly over the window.",
    unit: "shape", engineUnit: "enum", scale: 1, type: "enum", range: { values: DEMAND_SHAPES }, default: D.demand_shape, firstBuild: true,
  },
  later("DEM-6", "Demand", "Demand that varies by replication", "Each seed would get its own demand draw. In this build every seed shares one fixed trace."),
  later("DEM-7", "Demand", "Airport node, event surge, planning profile", "Demand refinements. Not in this build."),
  {
    id: "RD-1", group: "Routes and traffic", label: "Routes per area pair",
    help: "Each pair of areas has a highway route and a local route, each with free-flow minutes. A car takes whichever is faster when it leaves.",
    unit: "min", engineUnit: "s", scale: 60, type: "per_route_int", range: { min: 300, max: 14400 },
    default: Object.fromEntries(ROUTES.map((r) => [r.id, r.free_flow_s])), firstBuild: true,
  },
  {
    id: "RD-2", group: "Routes and traffic", label: "In-area trip and pickup time",
    help: "Minutes for a trip or a pickup inside one area.",
    unit: "min", engineUnit: "s", scale: 60, type: "per_area_int", range: { min: 60, max: 1800 },
    default: perArea("in_area_s"), firstBuild: true,
  },
  {
    id: "RD-3", group: "Routes and traffic", label: "Congestion by hour, class and direction",
    help: "The slowdown you set for each road class, direction and hour of both days, as a profile you set. 1.0 means free flow.",
    unit: "× travel time", engineUnit: "per-mille", scale: 1000, type: "congestion", range: { min: 1000, max: 3000 },
    default: D.congestion, firstBuild: true,
  },
  {
    id: "RD-4", group: "Routes and traffic", label: "Congestion threshold",
    help: "A driving minute counts as congested when the slowdown you set is at least this multiplier.",
    unit: "×", engineUnit: "per-mille", scale: 1000, type: "int", range: { min: 1100, max: 2000 },
    default: D.congestion_threshold_permille, firstBuild: true,
  },
  {
    id: "RD-5", group: "Routes and traffic", label: "Travel variation",
    help: "Random spread in travel times, shared per route and quarter hour plus a spread per ride. 0 in Learn cases, 0.15 in Experiment presets.",
    unit: "σ", engineUnit: "per-mille", scale: 1000, type: "int", range: { min: 0, max: 500, step: 50 },
    default: D.sigma_permille, firstBuild: true,
  },
  later("RD-6", "Routes and traffic", "Route choice policy, per-class variation, incidents, offsets inside an area", "Routing refinements. Not in this build."),
  {
    id: "POL-1", group: "Rules", label: "Dispatch",
    help: "Which car serves a waiting rider: the idle car or ready depot car with the earliest planned arrival.",
    unit: "rule", engineUnit: "enum", scale: 1, type: "enum", range: { values: ["nearest_idle"] }, default: D.policies.dispatch, firstBuild: true,
  },
  {
    id: "POL-2", group: "Rules", label: "Depot assignment",
    help: "Which depot a car heads to when a visit is due: its home depot, the nearest depot, or the nearest depot with a free stall.",
    unit: "rule", engineUnit: "enum", scale: 1, type: "enum", range: { values: DEPOT_ASSIGNMENTS },
    default: D.policies.depot_assignment, firstBuild: true,
  },
  {
    id: "POL-3", group: "Rules", label: "End-of-service recall",
    help: "At this time every idle car heads to a depot, and a car with a rider follows when it finishes.",
    unit: "clock", engineUnit: "s", scale: 1, type: "clock", range: { within: "window" }, default: D.policies.recall_s, firstBuild: true,
  },
  {
    id: "POL-4", group: "Rules", label: "Morning release to home area",
    help: "At this time every ready car at a depot outside its home area drives home. Later than the recall, or off.",
    unit: "clock", engineUnit: "s", scale: 1, type: "clock_or_off", range: { within: "window", after: "POL-3" },
    default: D.policies.release_s, firstBuild: true,
  },
  {
    id: "POL-5", group: "Rules", label: "Depot queue order",
    help: "Cars waiting for a bay are served first in, first out.",
    unit: "rule", engineUnit: "enum", scale: 1, type: "enum", range: { values: ["fifo"] }, default: D.policies.queue_order, firstBuild: true,
  },
  later("POL-6", "Rules", "Repositioning, scarcity-aware dispatch, maximum pickup time, release on ready", "Policy refinements. Not in this build."),
  {
    id: "RID-1", group: "Riders and clock", label: "Rider patience",
    help: "A rider still waiting for a car to be assigned gives up after this long. Once a car is on its way, the rider waits.",
    unit: "min", engineUnit: "s", scale: 60, type: "int", range: { min: 60, max: 3600 }, default: D.patience_s, firstBuild: true,
  },
  later("RID-2", "Riders and clock", "Cancellation after assignment, suppressed demand", "Rider refinements. Not in this build."),
  {
    id: "CLK-1", group: "Riders and clock", label: "Simulated window",
    help: "When the simulated window starts and ends. It crosses into the next morning so next-morning effects show.",
    unit: "clock", engineUnit: "s", scale: 1, type: "window",
    range: { start_min: 0, end_max: HOURS * 3600, length_min: MIN_WINDOW_S, length_max: MAX_WINDOW_S },
    default: D.window, firstBuild: true,
  },
  {
    id: "CLK-2", group: "Riders and clock", label: "Warm-up",
    help: "The first part of the window, left out of windowed results because every car starts in place.",
    unit: "clock", engineUnit: "s", scale: 1, type: "clock", range: { within: "window" }, default: D.warmup_end_s, firstBuild: true,
  },
  {
    id: "CLK-3", group: "Riders and clock", label: "Reporting bucket",
    help: "The grain of the by-hour charts.",
    unit: "min", engineUnit: "s", scale: 60, type: "enum_int", range: { values: [900, 1800, 3600] }, default: D.bucket_s, firstBuild: true,
  },
  {
    id: "CLK-4", group: "Riders and clock", label: "Placement snapshot",
    help: "When the placement gap compares where cars are with where the day started.",
    unit: "clock", engineUnit: "s", scale: 1, type: "clock", range: { within: "window" }, default: D.placement_snapshot_s, firstBuild: true,
  },
]);

// ---------------------------------------------------------------------------------------------------------------
// Validation

const TOP_KEYS = {
  format: null, version: null, name: null,
  window: "CLK-1", warmup_end_s: "CLK-2", bucket_s: "CLK-3", placement_snapshot_s: "CLK-4",
  areas: "SUP-1", routes: "RD-1", peaks: "DEM-3", demand_shape: "DEM-5", dest_weights: "DEM-4", congestion: "RD-3",
  congestion_threshold_permille: "RD-4", sigma_permille: "RD-5", depots: "DEP-1", depot_access_s: "DEP-1",
  intake_s: "DEP-9", pull_out_s: "DEP-9", clean_s: "DEP-4", service_s: "DEP-6", trips_between_visits: "DEP-7",
  service_every_visits: "DEP-8", policies: null, patience_s: "RID-1",
};
const POLICY_KEYS = { dispatch: "POL-1", depot_assignment: "POL-2", recall_s: "POL-3", release_s: "POL-4", queue_order: "POL-5" };
const AREA_KEYS = ["id", "cars", "in_area_s", "peak_per_h", "offpeak_per_h"];
const ROUTE_KEYS = ["id", "a", "b", "cls", "free_flow_s"];
const DEPOT_KEYS = ["id", "area", "parking", "cleaning_bays", "service_bays"];

const pad2 = (n) => String(n).padStart(2, "0");
/** Clock text `D1 18:30` for integer seconds from day 1 00:00. */
export function clockText(t_s) {
  const day = Math.floor(t_s / DAY_S);
  const rest = t_s - day * DAY_S;
  return `D${day + 1} ${pad2(Math.floor(rest / 3600))}:${pad2(Math.floor((rest % 3600) / 60))}`;
}
const plain = (v) => String(v);
const minutes = (v) => `${v / 60} min`;
const multiplier = (v) => `×${v / 1000}`;
const hourText = (h) => `${pad2(h)}:00`;

function describeValue(value) {
  if (value === undefined) return "missing";
  if (value === null) return "off";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return "a list";
  return `a value of type ${typeof value}`;
}

function problem(what, why, fix, knob) {
  return { what, why, fix, knob };
}

/** Validate a scenario (design P19 and 7.6); returns `{ok, errors, warnings}`, each entry `{what, why, fix, knob}`. */
export function validateScenario(s) {
  const errors = [];
  const warnings = [];
  const fail = (what, why, fix, knob) => errors.push(problem(what, why, fix, knob));
  const done = () => ({ ok: errors.length === 0, errors, warnings });

  const checkInt = (value, min, max, subject, knob, fmt = plain) => {
    if (isInt(value) && value >= min && value <= max) return true;
    const shown = isInt(value) ? fmt(value) : describeValue(value);
    fail(`${subject}: ${shown}`, `${subject} takes a whole number from ${fmt(min)} to ${fmt(max)}.`, `Set a value from ${fmt(min)} to ${fmt(max)}.`, knob);
    return false;
  };
  const intField = (obj, key, min, max, subject, knob, fmt) => has(obj, key) && checkInt(obj[key], min, max, subject, knob, fmt);
  const enumField = (obj, key, values, subject, knob) => {
    if (!has(obj, key) || values.includes(obj[key])) return;
    fail(`${subject}: ${describeValue(obj[key])}`, `${subject} is one of: ${values.join(", ")}.`, `Choose ${values.length === 1 ? values[0] : "one of those values"}.`, knob);
  };
  const checkFields = (obj, keys, where, knobOf) => {
    const knob = (key) => (typeof knobOf === "function" ? knobOf(key) : knobOf);
    for (const key of Object.keys(obj)) {
      if (!keys.includes(key)) {
        fail(`Unknown field in ${where}: ${key}`, `Scenario format ${SCENARIO_VERSION} has no field named ${key}.`, `Remove ${key}.`, knob(key));
      }
    }
    for (const key of keys) {
      if (!has(obj, key)) {
        fail(`Missing field in ${where}: ${key}`, "Every field of the scenario format is required.", `Add ${key}, or start again from a preset.`, knob(key));
      }
    }
  };
  const notObject = (subject, value, why, knob) =>
    fail(`${subject}: ${describeValue(value)}`, why, "Start again from a preset.", knob);

  if (!isPlainObject(s)) {
    notObject("Scenario", s, "A scenario is an object that holds every knob.", null);
    return done();
  }
  checkFields(s, Object.keys(TOP_KEYS), "the scenario", (key) => (has(TOP_KEYS, key) ? TOP_KEYS[key] : null));

  if (has(s, "format") && s.format !== SCENARIO_FORMAT) {
    fail(`Scenario format: ${describeValue(s.format)}`, `This page reads ${SCENARIO_FORMAT} scenarios.`, "Start again from a preset.", null);
  }
  if (has(s, "version") && s.version !== SCENARIO_VERSION) {
    fail(`Scenario version: ${describeValue(s.version)}`, `This page reads scenario version ${SCENARIO_VERSION}.`, "Start again from a preset.", null);
  }
  if (has(s, "name") && (typeof s.name !== "string" || !/^[a-z0-9_]{1,64}$/.test(s.name))) {
    fail(`Scenario name: ${describeValue(s.name)}`, "A scenario name uses 1 to 64 lowercase letters, digits or underscores.", "Rename the scenario, for example bay_teaching_map.", null);
  }

  // CLK-1 to CLK-4
  let win = null;
  if (has(s, "window")) {
    const w = s.window;
    if (!isPlainObject(w)) {
      notObject("Simulated window", w, "The window holds a start and an end time.", "CLK-1");
    } else {
      checkFields(w, ["start_s", "end_s"], "the simulated window", "CLK-1");
      const startOk = intField(w, "start_s", 0, HOURS * 3600 - MIN_WINDOW_S, "Window start", "CLK-1", clockText);
      const endOk = intField(w, "end_s", MIN_WINDOW_S, HOURS * 3600, "Window end", "CLK-1", clockText);
      if (startOk && endOk) {
        const length = w.end_s - w.start_s;
        if (length < MIN_WINDOW_S || length > MAX_WINDOW_S) {
          fail(`Window length: ${length / 3600} h`, "The simulated window lasts 4 to 36 hours.", "Move the window end so the window lasts 4 to 36 hours.", "CLK-1");
        } else {
          win = w;
        }
      }
    }
  }
  const lo = win ? win.start_s : 0;
  const hi = win ? win.end_s : HOURS * 3600;
  intField(s, "warmup_end_s", lo, hi - 1, "Warm-up end", "CLK-2", clockText);
  if (has(s, "bucket_s") && ![900, 1800, 3600].includes(s.bucket_s)) {
    fail(`Reporting bucket: ${describeValue(s.bucket_s)}`, "The reporting bucket is 15, 30 or 60 minutes.", "Choose 15, 30 or 60 minutes.", "CLK-3");
  }
  intField(s, "placement_snapshot_s", lo, hi, "Placement snapshot", "CLK-4", clockText);

  // SUP-1, RD-2, DEM-1, DEM-2
  let areasOk = false;
  if (has(s, "areas")) {
    const areas = s.areas;
    if (!Array.isArray(areas) || areas.length !== AREA_IDS.length) {
      fail(`Areas: ${Array.isArray(areas) ? areas.length : describeValue(areas)}`, "The map has exactly four areas: San Francisco, Peninsula, San Jose and East Bay.", "Start again from a preset.", "SUP-1");
    } else {
      areasOk = true;
      let total = 0;
      let carsWhole = true;
      areas.forEach((area, i) => {
        const id = AREA_IDS[i];
        const name = AREA_LABELS[id];
        if (!isPlainObject(area)) {
          notObject(`Area ${i + 1}`, area, "Each area holds its cars, in-area time and demand.", "SUP-1");
          areasOk = false;
          carsWhole = false;
          return;
        }
        checkFields(area, AREA_KEYS, `area ${id}`, "SUP-1");
        if (area.id !== id) {
          fail(`Area ${i + 1}: ${describeValue(area.id)}`, "Areas are listed in the order SF, PEN, SJ, EB.", `Set this area's id to ${id}.`, "SUP-1");
          areasOk = false;
        }
        if (intField(area, "cars", 0, 200, `Cars in ${name}`, "SUP-1")) total += area.cars;
        else carsWhole = false;
        if (!intField(area, "in_area_s", 60, 1800, `In-area trip time in ${name}`, "RD-2", minutes)) areasOk = false;
        const peakOk = intField(area, "peak_per_h", 1, 120, `Peak requests per hour in ${name}`, "DEM-1");
        const offOk = intField(area, "offpeak_per_h", 0, 120, `Off-peak requests per hour in ${name}`, "DEM-2");
        if (peakOk && offOk && area.peak_per_h < area.offpeak_per_h) {
          fail(`Peak requests per hour in ${name}: ${area.peak_per_h}, off-peak ${area.offpeak_per_h}`, "Peak demand must be at least off-peak demand.", `Raise peak requests to ${area.offpeak_per_h} or more, or lower off-peak requests.`, "DEM-1");
        }
      });
      if (carsWhole && (total < 1 || total > 500)) {
        fail(`Total cars: ${total}`, total < 1 ? "The fleet needs at least one car." : "The fleet holds at most 500 cars.", total < 1 ? "Add a car in any area." : "Remove cars until the total is 500 or fewer.", "SUP-1");
      }
    }
  }

  // RD-1
  if (has(s, "routes")) {
    const routes = s.routes;
    if (!Array.isArray(routes) || routes.length !== ROUTES.length) {
      fail(`Routes: ${Array.isArray(routes) ? routes.length : describeValue(routes)}`, "Every pair of areas has one highway route and one local route, 12 in all.", "Start again from a preset.", "RD-1");
    } else {
      routes.forEach((route, i) => {
        const expected = ROUTES[i];
        if (!isPlainObject(route)) {
          notObject(`Route ${expected.id}`, route, "Each route holds its areas, class and free-flow time.", "RD-1");
          return;
        }
        checkFields(route, ROUTE_KEYS, `route ${expected.id}`, "RD-1");
        for (const key of ["id", "a", "b", "cls"]) {
          if (has(route, key) && route[key] !== expected[key]) {
            fail(`Route ${i + 1} ${key}: ${describeValue(route[key])}`, "The map's routes are fixed; only their free-flow times change.", `Set it back to ${expected[key]}.`, "RD-1");
          }
        }
        intField(route, "free_flow_s", 300, 14400, `Free-flow time on ${expected.id}`, "RD-1", minutes);
      });
    }
  }

  // DEM-3
  if (has(s, "peaks")) {
    const peaks = s.peaks;
    if (!Array.isArray(peaks) || peaks.length !== 2) {
      fail(`Peak windows: ${Array.isArray(peaks) ? peaks.length : describeValue(peaks)}`, "There are exactly two peak windows: a morning peak and an evening peak.", "Set one morning window and one evening window.", "DEM-3");
    } else {
      let whole = true;
      peaks.forEach((peak, i) => {
        const label = i === 0 ? "Morning peak" : "Evening peak";
        if (!isPlainObject(peak)) {
          notObject(label, peak, "A peak window holds a start hour and an end hour.", "DEM-3");
          whole = false;
          return;
        }
        checkFields(peak, ["start_h", "end_h"], `the ${label.toLowerCase()}`, "DEM-3");
        const startOk = intField(peak, "start_h", 0, 23, `${label} start`, "DEM-3", hourText);
        const endOk = intField(peak, "end_h", 1, 24, `${label} end`, "DEM-3", hourText);
        if (!(startOk && endOk)) {
          whole = false;
        } else if (peak.start_h >= peak.end_h) {
          fail(`${label}: ${hourText(peak.start_h)} to ${hourText(peak.end_h)}`, "A peak window ends after it starts.", "Move the end later than the start.", "DEM-3");
          whole = false;
        }
      });
      if (whole && peaks[0].end_h > peaks[1].start_h) {
        fail(`Peak windows: ${hourText(peaks[0].start_h)} to ${hourText(peaks[0].end_h)} and ${hourText(peaks[1].start_h)} to ${hourText(peaks[1].end_h)}`, "The morning peak must end no later than the evening peak starts.", "End the morning peak earlier or start the evening peak later.", "DEM-3");
      }
    }
  }

  enumField(s, "demand_shape", DEMAND_SHAPES, "Demand shape", "DEM-5");

  // DEM-4
  if (has(s, "dest_weights")) {
    const mix = s.dest_weights;
    if (!isPlainObject(mix)) {
      notObject("Destination mix", mix, "The destination mix holds weights for the morning peak, the evening peak and other hours.", "DEM-4");
    } else {
      checkFields(mix, PERIODS, "the destination mix", "DEM-4");
      for (const period of PERIODS.filter((p) => has(mix, p))) {
        const label = PERIOD_LABELS[period];
        const byOrigin = mix[period];
        if (!isPlainObject(byOrigin)) {
          notObject(`Destination mix, ${label}`, byOrigin, "Each period holds weights from every area.", "DEM-4");
          continue;
        }
        checkFields(byOrigin, AREA_IDS, `the destination mix for ${label}`, "DEM-4");
        for (const origin of AREA_IDS.filter((o) => has(byOrigin, o))) {
          const weights = byOrigin[origin];
          if (!isPlainObject(weights)) {
            notObject(`Destination mix from ${origin}, ${label}`, weights, "Each area holds a weight for every destination area.", "DEM-4");
            continue;
          }
          checkFields(weights, AREA_IDS, `the destination mix from ${origin} for ${label}`, "DEM-4");
          let total = 0;
          let whole = true;
          for (const dest of AREA_IDS) {
            if (intField(weights, dest, 0, MAX_WEIGHT_TOTAL, `Weight from ${origin} to ${dest} for ${label}`, "DEM-4")) total += weights[dest];
            else whole = false;
          }
          if (whole && (total < 1 || total > MAX_WEIGHT_TOTAL)) {
            fail(`Destination weights from ${origin} for ${label}: total ${total}`, `Weights from one area need a total from 1 to ${MAX_WEIGHT_TOTAL}.`, "Give at least one destination a weight above 0.", "DEM-4");
          }
        }
      }
    }
  }

  // RD-3, RD-4, RD-5
  const checkRow = (row, label) => {
    if (!Array.isArray(row) || row.length !== HOURS) {
      fail(`Congestion for ${label}: ${Array.isArray(row) ? `${row.length} hours` : describeValue(row)}`, "A congestion profile lists all 48 hours of both days.", "Fill every hour; ×1.0 means no slowdown.", "RD-3");
      return;
    }
    for (let h = 0; h < HOURS; h++) {
      if (!(isInt(row[h]) && row[h] >= 1000 && row[h] <= 3000)) {
        fail(`Congestion for ${label} at ${clockText(h * 3600)}: ${isInt(row[h]) ? multiplier(row[h]) : describeValue(row[h])}`, "Each hour's multiplier is ×1.0 to ×3.0, stored in thousandths from 1000 to 3000.", "Set that hour from 1000 to 3000.", "RD-3");
        return;
      }
    }
  };
  if (has(s, "congestion")) {
    const congestion = s.congestion;
    if (!isPlainObject(congestion)) {
      notObject("Congestion", congestion, "Congestion holds a highway table, a local table and an in-area row.", "RD-3");
    } else {
      checkFields(congestion, ["HIGHWAY", "LOCAL", "IN_AREA"], "congestion", "RD-3");
      for (const cls of ["HIGHWAY", "LOCAL"].filter((c) => has(congestion, c))) {
        const table = congestion[cls];
        if (!isPlainObject(table)) {
          notObject(`Congestion, ${cls.toLowerCase()} routes`, table, "Each road class holds a row for every direction of every area pair.", "RD-3");
          continue;
        }
        checkFields(table, DIRECTION_KEYS, `${cls.toLowerCase()} congestion`, "RD-3");
        for (const key of DIRECTION_KEYS.filter((k) => has(table, k))) checkRow(table[key], `${cls.toLowerCase()} routes ${key}`);
      }
      if (has(congestion, "IN_AREA")) checkRow(congestion.IN_AREA, "in-area driving");
    }
  }
  intField(s, "congestion_threshold_permille", 1100, 2000, "Congestion threshold", "RD-4", multiplier);
  if (has(s, "sigma_permille") && !(isInt(s.sigma_permille) && s.sigma_permille >= 0 && s.sigma_permille <= 500 && s.sigma_permille % 50 === 0)) {
    fail(`Travel variation: ${describeValue(s.sigma_permille)}`, "Travel variation σ sits on a grid from 0 to 0.50 in steps of 0.05, stored as 0 to 500 in steps of 50.", "Choose 0, 50, 100, and so on up to 500.", "RD-5");
  }

  // DEP-1, DEP-2, DEP-3, DEP-5
  let depotBays = null;
  if (has(s, "depots")) {
    const depots = s.depots;
    if (!Array.isArray(depots)) {
      notObject("Depots", depots, "Depots are a list.", "DEP-1");
    } else if (depots.length === 0) {
      fail("Depots on the map: 0", "Cars need at least one depot to be cleaned.", "Add a depot in any area.", "DEP-1");
    } else {
      const seen = new Set();
      let previousRank = -1;
      depotBays = [];
      depots.forEach((depot, i) => {
        if (!isPlainObject(depot)) {
          notObject(`Depot ${i + 1}`, depot, "Each depot holds its area, parking and bays.", "DEP-1");
          depotBays = null;
          return;
        }
        checkFields(depot, DEPOT_KEYS, `depot ${i + 1}`, "DEP-1");
        const label = typeof depot.id === "string" ? depot.id : `depot ${i + 1}`;
        if (!AREA_IDS.includes(depot.area)) {
          fail(`Area of ${label}: ${describeValue(depot.area)}`, "A depot sits in one of the four areas.", "Set its area to SF, PEN, SJ or EB.", "DEP-1");
        } else if (typeof depot.id !== "string" || !new RegExp(`^${depot.area}-[12]$`).test(depot.id)) {
          fail(`Depot id: ${describeValue(depot.id)}`, "Depots are named by their area and a number, and an area holds at most two depots.", `Name it ${depot.area}-1 or ${depot.area}-2.`, "DEP-1");
        } else if (seen.has(depot.id)) {
          fail(`Depot id: ${depot.id} appears twice`, "Each depot id is used once.", `Remove the second ${depot.id}.`, "DEP-1");
        } else {
          seen.add(depot.id);
          const rank = ALL_DEPOT_IDS.indexOf(depot.id);
          if (rank < previousRank) {
            fail(`Depot order: ${depot.id} after ${ALL_DEPOT_IDS[previousRank]}`, "Depots are listed in area order SF, PEN, SJ, EB, then by number.", "List the depots in that order.", "DEP-1");
          }
          previousRank = Math.max(previousRank, rank);
        }
        intField(depot, "parking", 5, 150, `Parking at ${label}`, "DEP-2");
        intField(depot, "cleaning_bays", 1, 12, `Cleaning bays at ${label}`, "DEP-3");
        if (depotBays && intField(depot, "service_bays", 0, 6, `Service bays at ${label}`, "DEP-5")) depotBays.push(depot.service_bays);
        else depotBays = null;
      });
    }
  }
  if (has(s, "depot_access_s") && s.depot_access_s !== DEPOT_ACCESS_S) {
    fail(`Depot access time: ${describeValue(s.depot_access_s)}`, "Every depot sits 5 minutes of local driving from its area's centre; the map's geography is fixed.", `Set it back to ${DEPOT_ACCESS_S} seconds.`, "DEP-1");
  }

  // DEP-4, DEP-6 to DEP-9
  intField(s, "intake_s", 60, 600, "Intake time", "DEP-9", minutes);
  intField(s, "pull_out_s", 60, 600, "Pull-out time", "DEP-9", minutes);
  intField(s, "clean_s", 300, 3600, "Clean time", "DEP-4", minutes);
  intField(s, "service_s", 600, 14400, "Service time", "DEP-6", minutes);
  intField(s, "trips_between_visits", 1, 100, "Trips between depot visits", "DEP-7");
  const everyOk = intField(s, "service_every_visits", 0, 10, "Service every N visits", "DEP-8");
  if (everyOk && s.service_every_visits > 0 && depotBays && depotBays.every((bays) => bays === 0)) {
    fail("Service bays on the map: 0", `Service every N visits is ${s.service_every_visits}, so some visits need a service bay.`, "Add a service bay at any depot, or set Service every N visits to 0.", "DEP-5");
  }

  // POL-1 to POL-5
  if (has(s, "policies")) {
    const p = s.policies;
    if (!isPlainObject(p)) {
      notObject("Rules", p, "The rules hold dispatch, depot assignment, recall, release and queue order.", null);
    } else {
      checkFields(p, Object.keys(POLICY_KEYS), "the rules", (key) => (has(POLICY_KEYS, key) ? POLICY_KEYS[key] : null));
      enumField(p, "dispatch", ["nearest_idle"], "Dispatch", "POL-1");
      enumField(p, "depot_assignment", DEPOT_ASSIGNMENTS, "Depot assignment", "POL-2");
      enumField(p, "queue_order", ["fifo"], "Depot queue order", "POL-5");
      const recallOk = intField(p, "recall_s", lo, hi - 1, "End-of-service recall", "POL-3", clockText);
      if (has(p, "release_s") && p.release_s !== null) {
        const release = p.release_s;
        if (!isInt(release)) {
          fail(`Morning release: ${describeValue(release)}`, "The morning release is a clock time or off.", "Set a clock time after the recall, or turn the release off.", "POL-4");
        } else if (release < lo || release >= hi) {
          fail(`Morning release: ${clockText(release)}`, "The morning release falls inside the simulated window.", `Set a time from ${clockText(lo)} to before ${clockText(hi)}, or turn the release off.`, "POL-4");
        } else if (recallOk && release <= p.recall_s) {
          fail(`Morning release: ${clockText(release)}, recall ${clockText(p.recall_s)}`, "The morning release must come after the end-of-service recall.", `Set the release later than ${clockText(p.recall_s)}, or turn it off.`, "POL-4");
        }
      }
    }
  }

  // RID-1, and the warning of design 7.6
  if (intField(s, "patience_s", 60, 3600, "Rider patience", "RID-1", minutes) && areasOk) {
    for (const area of s.areas) {
      if (s.patience_s < area.in_area_s) {
        warnings.push(problem(
          `Rider patience ${minutes(s.patience_s)} is shorter than the pickup time in ${AREA_LABELS[area.id]}, ${minutes(area.in_area_s)}`,
          "Most riders there will give up before a car is assigned in time to reach them.",
          "Raise rider patience or shorten the in-area trip time.",
          "RID-1",
        ));
      }
    }
  }

  return done();
}

/** A deep copy of a scenario (plain data only). */
export function cloneScenario(scenario) {
  return cloneData(scenario);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value !== null && typeof value === "object") {
    const copy = {};
    for (const key of Object.keys(value)) copy[key] = cloneData(value[key]);
    return copy;
  }
  return value;
}

function sameData(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameData(item, b[i]));
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => has(b, key) && sameData(a[key], b[key]));
}

// ---------------------------------------------------------------------------------------------------------------
// Axis grammar (contract 6.2, design 2.8)

/** An axis the grammar or its value rejects; carries the four slots `what`, `why`, `fix`, `knob`. */
export class AxisError extends Error {
  constructor({ what, why, fix, knob }) {
    super(`${what}. ${why}`);
    this.name = "AxisError";
    this.what = what;
    this.why = why;
    this.fix = fix;
    this.knob = knob;
  }
}

const AREA_AXES = { "SUP-1": "cars", "RD-2": "in_area_s", "DEM-1": "peak_per_h", "DEM-2": "offpeak_per_h" };
const DEPOT_AXES = { "DEP-2": "parking", "DEP-3": "cleaning_bays", "DEP-5": "service_bays" };
const SCALAR_AXES = {
  "DEP-4": "clean_s", "DEP-6": "service_s", "DEP-7": "trips_between_visits", "DEP-8": "service_every_visits",
  "RD-4": "congestion_threshold_permille", "RID-1": "patience_s",
};
const POLICY_AXES = {
  dispatch: ["POL-1", ["nearest_idle"]],
  depot_assignment: ["POL-2", DEPOT_ASSIGNMENTS],
  queue_order: ["POL-5", ["fifo"]],
};
const DEP9_PARTS = { intake: "intake_s", pull_out: "pull_out_s" };
const NOT_AXES = {
  "SUP-2": ["Home areas and home depots are derived from other knobs, not set.", "Vary Cars per area or Depots per area instead."],
  "DEP-1": ["Adding or removing a depot changes the map, not one value.", "Vary a depot's parking or bays instead."],
  "DEM-3": ["Peak windows are two clock ranges, not one value.", "Vary peak or off-peak requests, or the demand shape, instead."],
  "DEM-4": ["The destination mix is a table of weights, not one value.", "Vary peak or off-peak requests instead."],
  "RD-5": ["Travel variation feeds the shared world of every seed, so an axis on it could not reach the runs.", "Set travel variation in the scenario and vary another knob."],
  "CLK-1": ["The simulated window feeds the shared world of every seed, so an axis on it could not reach the runs.", "Set the window in the scenario and vary another knob."],
  "CLK-2": ["The warm-up decides how runs are measured, not how the fleet behaves.", "Set the warm-up in the scenario and vary another knob."],
  "CLK-3": ["The reporting bucket only changes charts.", "Vary another knob."],
  "CLK-4": ["The placement snapshot decides how runs are measured, not how the fleet behaves.", "Set the snapshot in the scenario and vary another knob."],
  "POL-1": ["Policies are written as policy axes.", "Write policy:dispatch."],
  "POL-2": ["Policies are written as policy axes.", "Write policy:depot_assignment."],
  "POL-5": ["Policies are written as policy axes.", "Write policy:queue_order."],
};

/** Parse an axis id into `{id, knob, part, valueType, values?}`; throws AxisError when the grammar rejects it. */
export function parseAxis(axisId) {
  const reject = (why, fix, knob = null) => new AxisError({ what: `Variation axis: ${describeValue(axisId)}`, why, fix, knob });
  if (typeof axisId !== "string") {
    throw reject("An axis is written parameter:<knob id> or policy:<policy id>.", "Choose an axis from the list.");
  }
  if (axisId.startsWith("policy:")) {
    const name = axisId.slice("policy:".length);
    if (!has(POLICY_AXES, name)) {
      throw reject("The policy axes are policy:dispatch, policy:depot_assignment and policy:queue_order.", "Choose one of those policy axes.");
    }
    const [knob, values] = POLICY_AXES[name];
    return { id: axisId, knob, part: name, valueType: "enum", values };
  }
  if (!axisId.startsWith("parameter:")) {
    throw reject("An axis is written parameter:<knob id> or policy:<policy id>.", "Choose an axis from the list.");
  }
  const [knob, ...parts] = axisId.slice("parameter:".length).split(".");
  const known = KNOBS.find((k) => k.id === knob);
  if (!known) throw reject(`There is no knob named ${describeValue(knob)}.`, "Use a knob id from the knob panel, such as SUP-1 or DEP-4.");
  if (!known.firstBuild) throw reject(`${knob} is not in this build.`, "Vary a knob from the knob panel.", knob);
  if (has(NOT_AXES, knob)) throw reject(NOT_AXES[knob][0], NOT_AXES[knob][1], knob);
  const axis = (part, valueType, values) => ({ id: axisId, knob, part, valueType, ...(values ? { values } : {}) });

  if (has(AREA_AXES, knob)) {
    if (parts.length !== 1 || !AREA_IDS.includes(parts[0])) {
      throw reject(`${knob} holds one value per area, so its axis names one area.`, `Write parameter:${knob}.SF, .PEN, .SJ or .EB.`, knob);
    }
    return axis(parts[0], "int");
  }
  if (has(DEPOT_AXES, knob)) {
    if (parts.length === 0) return axis(null, "layout");
    if (parts.length !== 1 || !ALL_DEPOT_IDS.includes(parts[0])) {
      throw reject(`${knob} holds one value per depot, so its axis names one depot or takes a layout of every depot.`, `Write parameter:${knob}.SF-1, for example, or parameter:${knob} with a layout.`, knob);
    }
    return axis(parts[0], "int");
  }
  if (knob === "RD-1") {
    if (parts.length !== 1 || !ROUTES.some((r) => r.id === parts[0])) {
      throw reject("RD-1 holds one free-flow time per route, so its axis names one route.", "Write parameter:RD-1.H2, for example.", knob);
    }
    return axis(parts[0], "int");
  }
  if (knob === "RD-3") {
    if (parts.length !== 2 || !has(RD3_CLASSES, parts[0]) || !has(RD3_PERIOD_HOURS, parts[1])) {
      throw reject("RD-3 axes name a class (highway, local or in_area) and a period (morning, evening or late).", "Write parameter:RD-3.highway.evening, for example.", knob);
    }
    return axis(`${parts[0]}.${parts[1]}`, "int");
  }
  if (knob === "DEP-9") {
    if (parts.length !== 1 || !has(DEP9_PARTS, parts[0])) {
      throw reject("DEP-9 holds two times, so its axis names intake or pull_out.", "Write parameter:DEP-9.intake or parameter:DEP-9.pull_out.", knob);
    }
    return axis(parts[0], "int");
  }
  if (parts.length !== 0) throw reject(`${knob} holds one value, so its axis takes no qualifier.`, `Write parameter:${knob}.`, knob);
  if (knob === "DEM-5") return axis(null, "enum", DEMAND_SHAPES);
  if (knob === "POL-4") return axis(null, "clock_or_off");
  return axis(null, "int"); // POL-3 and SCALAR_AXES
}

/** A copy of `scenario` with the axis set to `value` (engine units); throws AxisError for a bad axis, value or scenario. */
export function applyAxis(scenario, axisId, value) {
  const axis = parseAxis(axisId);
  const base = validateScenario(scenario);
  if (!base.ok) throw new AxisError(base.errors[0]);
  const bad = (why, fix) => new AxisError({ what: `Value for ${axisId}: ${describeValue(value)}`, why, fix, knob: axis.knob });
  const next = cloneScenario(scenario);

  if (axis.valueType === "int" && !isInt(value)) {
    throw bad("This axis takes a whole number in engine units.", "Enter a whole number.");
  }
  if (axis.valueType === "enum" && !axis.values.includes(value)) {
    throw bad(`This axis takes one of: ${axis.values.join(", ")}.`, "Choose one of those values.");
  }
  if (axis.valueType === "clock_or_off" && !(isInt(value) || value === "off" || value === null)) {
    throw bad("This axis takes a clock time in seconds or off.", "Enter a clock time or off.");
  }

  const depotIds = next.depots.map((d) => d.id);
  if (axis.valueType === "layout") {
    const keys = isPlainObject(value) ? Object.keys(value) : null;
    if (!keys || keys.length !== depotIds.length || !depotIds.every((id) => has(value, id))) {
      throw bad(`A layout lists every depot on the map exactly once: ${depotIds.join(", ")}.`, "Give a value for each of those depots and no other.");
    }
    if (!keys.every((id) => isInt(value[id]))) throw bad("Each depot in a layout takes a whole number.", "Enter a whole number for each depot.");
    for (const depot of next.depots) depot[DEPOT_AXES[axis.knob]] = value[depot.id];
  } else if (has(AREA_AXES, axis.knob)) {
    next.areas.find((a) => a.id === axis.part)[AREA_AXES[axis.knob]] = value;
  } else if (has(DEPOT_AXES, axis.knob)) {
    const depot = next.depots.find((d) => d.id === axis.part);
    if (!depot) {
      throw new AxisError({ what: `Variation axis: ${axisId}`, why: `There is no depot named ${axis.part} on this map.`, fix: `Name one of: ${depotIds.join(", ")}.`, knob: axis.knob });
    }
    depot[DEPOT_AXES[axis.knob]] = value;
  } else if (axis.knob === "RD-1") {
    next.routes.find((r) => r.id === axis.part).free_flow_s = value;
  } else if (axis.knob === "RD-3") {
    const [cls, period] = axis.part.split(".");
    const table = next.congestion[RD3_CLASSES[cls]];
    const rows = Array.isArray(table) ? [table] : Object.values(table);
    for (const row of rows) {
      for (const hour of RD3_PERIOD_HOURS[period]) {
        row[hour] = value;
        row[hour + 24] = value;
      }
    }
  } else if (axis.knob === "DEP-9") {
    next[DEP9_PARTS[axis.part]] = value;
  } else if (axis.knob === "DEM-5") {
    next.demand_shape = value;
  } else if (axis.knob === "POL-3") {
    next.policies.recall_s = value;
  } else if (axis.knob === "POL-4") {
    next.policies.release_s = value === "off" ? null : value;
  } else if (axisId.startsWith("policy:")) {
    next.policies[axis.part] = value;
  } else {
    next[SCALAR_AXES[axis.knob]] = value;
  }

  const after = validateScenario(next);
  if (!after.ok) throw new AxisError(after.errors[0]);
  return next;
}

// ---------------------------------------------------------------------------------------------------------------
// Differences

const areaParts = (knob, field) => (s) => AREA_IDS.map((id) => [`${knob}.${id}`, s.areas.find((a) => a.id === id)?.[field] ?? null]);
const depotParts = (knob, field) => (s) => ALL_DEPOT_IDS.map((id) => [`${knob}.${id}`, s.depots.find((d) => d.id === id)?.[field] ?? null]);
const single = (knob, read) => (s) => [[knob, read(s) ?? null]];

const DIFF_PARTS = {
  "SUP-1": areaParts("SUP-1", "cars"),
  "DEP-1": (s) => AREA_IDS.map((area) => [`DEP-1.${area}`, s.depots.filter((d) => d.area === area).map((d) => d.id)]),
  "DEP-2": depotParts("DEP-2", "parking"),
  "DEP-3": depotParts("DEP-3", "cleaning_bays"),
  "DEP-4": single("DEP-4", (s) => s.clean_s),
  "DEP-5": depotParts("DEP-5", "service_bays"),
  "DEP-6": single("DEP-6", (s) => s.service_s),
  "DEP-7": single("DEP-7", (s) => s.trips_between_visits),
  "DEP-8": single("DEP-8", (s) => s.service_every_visits),
  "DEP-9": (s) => [["DEP-9.intake", s.intake_s], ["DEP-9.pull_out", s.pull_out_s]],
  "DEM-1": areaParts("DEM-1", "peak_per_h"),
  "DEM-2": areaParts("DEM-2", "offpeak_per_h"),
  "DEM-3": single("DEM-3", (s) => s.peaks),
  "DEM-4": (s) => PERIODS.flatMap((period) => AREA_IDS.map((origin) => [`DEM-4.${period}.${origin}`, s.dest_weights[period][origin]])),
  "DEM-5": single("DEM-5", (s) => s.demand_shape),
  "RD-1": (s) => ROUTES.map((r) => [`RD-1.${r.id}`, s.routes.find((x) => x.id === r.id)?.free_flow_s ?? null]),
  "RD-2": areaParts("RD-2", "in_area_s"),
  "RD-3": (s) => [
    ...DIRECTION_KEYS.map((key) => [`RD-3.highway.${key}`, s.congestion.HIGHWAY[key]]),
    ...DIRECTION_KEYS.map((key) => [`RD-3.local.${key}`, s.congestion.LOCAL[key]]),
    ["RD-3.in_area", s.congestion.IN_AREA],
  ],
  "RD-4": single("RD-4", (s) => s.congestion_threshold_permille),
  "RD-5": single("RD-5", (s) => s.sigma_permille),
  "POL-1": single("POL-1", (s) => s.policies.dispatch),
  "POL-2": single("POL-2", (s) => s.policies.depot_assignment),
  "POL-3": single("POL-3", (s) => s.policies.recall_s),
  "POL-4": single("POL-4", (s) => s.policies.release_s),
  "POL-5": single("POL-5", (s) => s.policies.queue_order),
  "RID-1": single("RID-1", (s) => s.patience_s),
  "CLK-1": single("CLK-1", (s) => s.window),
  "CLK-2": single("CLK-2", (s) => s.warmup_end_s),
  "CLK-3": single("CLK-3", (s) => s.bucket_s),
  "CLK-4": single("CLK-4", (s) => s.placement_snapshot_s),
};

/**
 * Knob-level differences between two valid scenarios as `[{knob, from, to}]` in KNOBS order, values in engine units.
 * `knob` carries the axis-style qualifier where a knob holds several values (`SUP-1.SJ`, `RD-3.highway.SJ>SF`).
 * The scenario name, format and version are not knobs and are not compared.
 */
export function describeDifferences(a, b) {
  const out = [];
  for (const knob of KNOBS) {
    if (!has(DIFF_PARTS, knob.id)) continue;
    const fromParts = DIFF_PARTS[knob.id](a);
    const toParts = DIFF_PARTS[knob.id](b);
    fromParts.forEach(([name, from], i) => {
      const to = toParts[i][1];
      if (!sameData(from, to)) out.push({ knob: name, from: cloneData(from), to: cloneData(to) });
    });
  }
  return out;
}
