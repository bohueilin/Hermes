// Every interface string of FleetLab Playground (design §1.3, §4.1, §5.8, §6 P-8, §7, §8), grouped by region.
// Plain strings are frozen constants; templates are functions that take already formatted pieces (see format.js)
// and return one string. This module imports nothing, so format.js can take its unit words from here.
// Copy rules (design H-3, H-5, H-6): no em or en dash, none of the words H-3 bans, absence reads
// "not available: <reason>", and trade-offs read as "lower X, higher Y".

/** Frozen deep copy helper for grouped string tables. */
function frozen(table) {
  for (const value of Object.values(table)) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) frozen(value);
  }
  return Object.freeze(table);
}

/** "1 knob" or "3 knobs": a count with its noun in the right number (count is an integer). */
export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Honesty boundary: the exact copy of design §1.3.

/** The fixed strings of the design §1.3 exact copy table. */
export const HONESTY = frozen({
  strip: "Teaching model: a sketch of Bay Area place names with invented numbers. Not evidence about any real fleet.",
  stripPhone: "Teaching model",
  stripPhoneHint: "Open the teaching model note",
  popover:
    "This is a teaching model. The map is a simplified sketch that uses Bay Area place names, and every number (demand, traffic, depot times) is invented to show how fleets and depots behave. It is not calibrated to any real operation, it says nothing about what will happen, and nothing here can approve a change to a real fleet.",
  verdictChip: "Teaching run, not a decision record",
  verdictFooter: "The rules match FleetLab's instrument; the world does not.",
  axisFleetLabCannotRun: "Teaching-model axis: FleetLab cannot run this",
  fleet005Panel: "Measured in FleetLab: FLEET-005, a committed decision record. Quoted here, not run here.",
  twoZoneProbePanel:
    "Exploratory FleetLab run, not a committed decision record. Its spec is in the design document, Appendix A.9.",
  forkCaption: "Two full runs on the same world. Every other car also differs between A and B.",
  teachingModelGrammar: "Teaching-model grammar",
  outsideFleetLabRange: "outside FleetLab's range",
  illustrative: "Every number here is illustrative.",
});

/** Route shield, `H2 · 55 min`: a fictional route id and its free-flow minutes (freeFlow already formatted). */
export function routeShield({ routeId, freeFlow }) {
  return `${routeId} · ${freeFlow}`;
}

const SLOWDOWN_PERIODS = frozen({ morning: "Morning", evening: "Evening", late: "Late evening" });
const ROAD_CLASSES = frozen({ highway: "highways", local: "local routes", in_area: "trips inside an area" });

/** One direction of a traffic label: `{toward: "SF"}`, `{awayFrom: "SF"}` or `{}` for both directions. */
function directionWords(part) {
  if (typeof part.toward === "string") return `toward ${part.toward} `;
  if (typeof part.awayFrom === "string") return `away from ${part.awayFrom} `;
  return "";
}

/**
 * Traffic label: `Evening slowdown you set: highways away from SF ×1.6, toward SF ×1.2, 16:00 to 19:00`.
 * `period` is morning, evening or late; `roadClass` highway, local or in_area; each part's factor is formatted
 * (`×1.6`); `start` and `end` are hour-of-day clocks. Name each direction whenever the profile differs by direction.
 */
export function trafficLabel({ period, roadClass, parts, start, end }) {
  const periodWord = SLOWDOWN_PERIODS[period];
  const classWord = ROAD_CLASSES[roadClass];
  if (periodWord === undefined) throw new TypeError(`unknown slowdown period ${String(period)}`);
  if (classWord === undefined) throw new TypeError(`unknown road class ${String(roadClass)}`);
  if (!Array.isArray(parts) || parts.length === 0) throw new TypeError("a traffic label needs at least one part");
  const factors = parts.map((part, i) => `${i === 0 ? `${classWord} ` : ""}${directionWords(part)}${part.factor}`);
  return `${periodWord} slowdown you set: ${factors.join(", ")}, ${start} to ${end}`;
}

/**
 * Route tooltip: `Leaving now, D1 18:30: 77 min (55 min free-flow, slowed by your traffic profile)`.
 * `clock`, `planned` and `freeFlow` are formatted; `slowed` is false when the planned time equals free flow.
 */
export function routeTooltip({ clock, planned, freeFlow, slowed = true }) {
  const why = slowed ? "slowed by your traffic profile" : "no slowdown in your traffic profile at this time";
  return `Leaving now, ${clock}: ${planned} (${freeFlow} free-flow, ${why})`;
}

// ---------------------------------------------------------------------------------------------------------------
// Absence (design H-5, §8.3).

/** The prefix every absent value starts with. */
export const ABSENT_PREFIX = "not available: ";

/** An absent value: `not available: <reason>`; the reason must be a non-empty string. */
export function absentValue(reason) {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new TypeError("an absent value needs a reason");
  }
  return `${ABSENT_PREFIX}${reason}`;
}

/** Reasons a value can be absent (design §1.3, §5.7, §6 P-8). */
export const ABSENT_REASONS = frozen({
  noPickupThisHour: "no rider was picked up in this hour",
  noCompletedRequest: "no completed request in scope",
  noDrivingSeconds: "no driving seconds in scope",
  noVisitStarted: "no visit started a task",
  noVisitInScope: "no visit in scope",
  noCompletedVisit: "no completed visit in scope",
  metricAbsentInSomeReplication: "metric absent in some replication",
  notComputed: "this value was not computed for this run",
});

/** Absent reason for censored visits: `2 visits unfinished at drain end` (count is an integer). */
export function visitsUnfinished(count) {
  return `${plural(count, "visit")} unfinished at drain end`;
}

/** Suppressed row of a quoted reference panel (design §7.2). */
export const REFERENCE = frozen({
  suppressedRow: "not shown here: see the differences panel",
  fleet005Title: "FLEET-005 depot turnaround",
  twoZoneProbeTitle: "Two-zone probe",
  differencesPanel: "Differences from FleetLab",
  open: "Open reference panel",
  close: "Close reference panel",
});

// ---------------------------------------------------------------------------------------------------------------
// Units (format.js reads these).

/** Unit words and symbols shown beside numbers. */
export const UNITS = frozen({
  minutes: "min",
  hours: "h",
  seconds: "s",
  percent: "%",
  times: "×",
  requestsPerHour: "requests per hour",
  cars: "cars",
  stalls: "stalls",
  bays: "bays",
  trips: "trips",
  visits: "visits",
});

// ---------------------------------------------------------------------------------------------------------------
// Top bar and modes (design §7.1).

/** Product name and top bar strings. */
export const TOP_BAR = frozen({
  product: "FleetLab Playground",
  modesName: "Modes",
});

/** Top bar status: `D1 18:30 · replay 1 of 5 · seed 1001` (clock formatted; replay, replays and seed integers). */
export function topBarStatus({ clock, replay, replays, seed }) {
  return `${clock} · replay ${String(replay)} of ${String(replays)} · seed ${String(seed)}`;
}

/** Mode names, jobs, what each produces and what it never does (design §7.1). */
export const MODES = frozen({
  learn: {
    name: "Learn",
    job: "Walks one operational question through a fixed preset and three to five annotated moments on the timeline.",
    produces: "Understanding, then Test it properly opens Experiment.",
    never: "Shows a verdict or hides a knob it changed.",
  },
  sandbox: {
    name: "Sandbox",
    job: "Free play on one simulated window: change knobs, run it, watch and scrub.",
    produces: "One animated replay, plus a light band across a few replications.",
    never: "Claims a difference between two settings.",
  },
  experiment: {
    name: "Experiment",
    job: "A preregistered paired A/B on one axis with the verdict rules.",
    produces: "A verdict card in FleetLab's words, marked as a teaching run.",
    never: "Produces a decision record, a winner or a score.",
  },
  inspect: {
    name: "Inspect",
    job: "The day of one car or one depot, as a drawer opened from any mode.",
    produces: "A timeline and a ledger for that entity.",
    never: "Changes the scenario.",
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Freeze rule and session log (design §7.1, §6 seed sets, §9.4 engine path).

/**
 * Freeze notice: `Spec frozen at 14:02. Sandbox has changed since (3 knobs). This verdict is about the frozen spec.`
 * `frozenAt` is the session clock passed by the caller; `changedKnobs` an integer. With no change, one sentence less.
 */
export function freezeNotice({ frozenAt, changedKnobs }) {
  if (changedKnobs === 0) return `Spec frozen at ${frozenAt}. This verdict is about the frozen spec.`;
  return `Spec frozen at ${frozenAt}. Sandbox has changed since (${plural(changedKnobs, "knob")}). This verdict is about the frozen spec.`;
}

/** Freeze rule strings. */
export const FREEZE = frozen({
  verdictStale: "Out of date: the setup changed after this verdict. Freeze and run again to test the new setup.",
  nothingRerunsSilently: "Nothing runs again until you choose Freeze and run.",
  specFrozen: "spec frozen",
});

/** Session log strings. */
export const SESSION_LOG = frozen({
  heading: "Session log",
  empty: "No experiment has run in this session.",
  useAnotherSeedSet: "Use another seed set",
  noOutcome: "no outcome",
});

/** Engine path as the session log records it: `engine: worker` or `engine: main thread`. */
export function enginePath(path) {
  if (path !== "worker" && path !== "main thread") throw new TypeError(`unknown engine path ${String(path)}`);
  return `engine: ${path}`;
}

/** Seed set description: `seed set 1 (seeds 1001 to 1020)` (integers). */
export function seedSetText({ seedSet, firstSeed, lastSeed }) {
  return `seed set ${String(seedSet)} (seeds ${String(firstSeed)} to ${String(lastSeed)})`;
}

/**
 * One session log entry: seed set, spec label, validity, outcome, recommendation and engine path, joined by ` · `.
 * `outcome` is null for an invalid experiment.
 */
export function sessionLogEntry({ seedSet, firstSeed, lastSeed, label, validity, outcome, recommendation, engine }) {
  return [
    seedSetText({ seedSet, firstSeed, lastSeed }),
    label,
    validity,
    outcome === null ? SESSION_LOG.noOutcome : outcome,
    recommendation,
    enginePath(engine),
  ].join(" · ");
}

// ---------------------------------------------------------------------------------------------------------------
// Time, playback and the two registers (design §7.4, H-10).

/** Register chips and playback strings. */
export const REGISTERS = frozen({
  thisReplay: "THIS REPLAY",
  thisReplaySentence: "This replay",
  nowThisReplay: "NOW · THIS REPLAY",
  warmUp: "warm-up, not counted",
});

/** Dark chip of the replay being watched: `THIS REPLAY · seed 1001` (seed integer). */
export function thisReplayChip(seed) {
  return `${REGISTERS.thisReplay} · seed ${String(seed)}`;
}

/** Outlined chip: `ACROSS 5 REPLICATIONS` (count integer). */
export function acrossReplicationsChip(count) {
  return `ACROSS ${String(count)} REPLICATIONS`;
}

/** Sentence register for summaries: `Across 5 replications` (count integer). */
export function acrossReplications(count) {
  return `Across ${String(count)} replications`;
}

/** Chart legend of the two registers: `band: 5 replications · line: the replay you are watching`. */
export function replicationBandLegend(count) {
  return `band: ${String(count)} replications · line: the replay you are watching`;
}

/** Transport controls, jumps and their accessible names. */
export const PLAYBACK = frozen({
  play: "Play",
  pause: "Pause",
  back5: "Back 5 minutes",
  forward5: "Forward 5 minutes",
  backHour: "Back 1 hour",
  forwardHour: "Forward 1 hour",
  speed: "Playback speed",
  scrubber: "Simulated time",
  jumps: { am_peak: "AM peak", pm_peak: "PM peak", d2_first_wave: "D2 first wave" },
  jumpsName: "Jump to a moment",
  transportName: "Playback",
  shortcuts: "Keyboard shortcuts",
  shortcutList: [
    "Space: play or pause",
    ", and .: step 5 minutes back or forward",
    "Shift with , or .: step 1 hour",
    "[ and ]: slower or faster",
    "Arrow keys on the map: move between areas; Enter: into an area; Escape: out",
    "I: open Inspect",
    "?: list these shortcuts",
  ],
  shortcutsScope: "Shortcuts work only while the map, transport or timeline has focus.",
});

/** Speed button text: `900×` (speed integer). */
export function speedText(speed) {
  return `${String(speed)}${UNITS.times}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Seed watching and the verdict (design §7.2 verdict, §6 P-7 to P-9).

/** Seed watching strings. */
export const SEED_WATCH = frozen({
  watchMedian: "Watch a typical seed (median delta)",
  watchLargest: "Watch the largest delta",
  backToSetup: "Back to setup",
  largestWarning: "You picked the largest delta. It is not typical.",
  voidEvidence: "Void evidence has no outcome. It says nothing about the candidate.",
});

/** `Now watching seed 1007 (7 of 20). The verdict came from all 20.` (integers). */
export function nowWatching({ seed, index, total }) {
  return `Now watching seed ${String(seed)} (${String(index)} of ${String(total)}). The verdict came from all ${String(total)}.`;
}

/** Verdict card strings. */
export const VERDICT = frozen({
  heading: "VERDICT",
  gates: "GATES",
  validity: "Validity",
  guardrails: "Guardrails",
  primaryOutcome: "Primary outcome",
  recommendation: "Recommendation",
  decides: "decides",
  shownNotNeeded: "shown, not needed",
  primary: "PRIMARY",
  perSeedDelta: "candidate minus baseline per seed",
  leftIsBetter: "left is better",
  interval95: "95% interval",
  seeds: "seeds",
  guardrailsHeading: "GUARDRAILS",
  meanHarm: "mean harm",
  maxHarm: "max harm",
  status: "status",
  descriptive: "DESCRIPTIVE (no claim)",
  allRows: "all rows",
  limitations: "LIMITATIONS",
  allLimitations: "all",
  limitationItems: ["synthetic inputs", "one regime", "the interval measures simulation variation only"],
  textVersion: "Verdict as text",
  invalidReasonHeading: "Why this experiment is void",
  noStrip: "No interval is drawn for void evidence.",
  mixedNote: "MIXED is defined but cannot occur in a single-regime experiment; FleetLab's code resolves that case to IMPROVED with HOLD.",
});

/** Verdict header: `Teaching run, not a decision record · spec frozen · 10 paired seeds` (count integer). */
export function verdictHeader(pairedSeeds) {
  return `${HONESTY.verdictChip} · ${FREEZE.specFrozen} · ${plural(pairedSeeds, "paired seed")}`;
}

/** Margin band legend: `band ±30 s` (margin formatted with its unit). */
export function marginBand(margin) {
  return `band ±${margin}`;
}

/** The sentence under the primary strip, for each outcome word (normalized so left is better, design P-7). */
export const OUTCOME_SENTENCES = frozen({
  IMPROVED: "The whole interval lies left of the band: IMPROVED.",
  REGRESSED: "The whole interval lies right of the band: REGRESSED.",
  UNCHANGED: "The whole interval lies inside the band: UNCHANGED.",
  INCONCLUSIVE: "The interval reaches past an edge of the band: INCONCLUSIVE.",
  MIXED: "MIXED cannot occur in a single-regime experiment.",
});

/** The quoted reason under each recommendation (design §7.2 verdict gate chain). */
export const RECOMMENDATION_REASONS = frozen({
  guardrailHarmed: "a guardrail was harmed; hold",
  primaryRegressed: "the primary regressed; hold",
  improved: "the primary improved and no guardrail was harmed; test it next",
  inconclusive: "the interval is too wide to call; run more experiments",
  unchanged: "no difference beyond the margin; nothing to recommend",
  invalid: "void evidence; nothing to recommend",
});

/** Count of regressed guardrails in the gate chain: `1 REGRESSED` (integer). */
export function guardrailsRegressedCount(count) {
  return `${String(count)} REGRESSED`;
}

/** Guardrail NOT EVALUABLE text beside the recommendation (design §6 P-8). */
export const NOT_EVALUABLE_TEXT = "NOT EVALUABLE: metric absent in some replication";

/** Plain meaning of each invalidity reason (the enum word itself is shown verbatim beside it). */
export const INVALIDITY_TEXT = frozen({
  INVARIANT_VIOLATION: "A run broke a model rule, so every number from this experiment is void.",
  REPLICATION_MISMATCH: "The same seed gave different metrics when run twice, so the runs cannot be trusted.",
  NOT_COMPARABLE: "The primary metric was absent in some replication, so the arms cannot be compared.",
});

/**
 * Status words with glyph and status name (design §8.1 tokens, §8.3): the literal word, a glyph that never relies on
 * colour, and the token family (`pass`, `cond`, `hold`, `invalid`, `neutral`).
 */
export const STATUS_WORDS = frozen({
  validity: {
    VALID: { word: "VALID", glyph: "✓", status: "pass" },
    INVALID_EXPERIMENT: { word: "INVALID_EXPERIMENT", glyph: "⊘", status: "invalid" },
  },
  outcome: {
    IMPROVED: { word: "IMPROVED", glyph: "✓", status: "pass" },
    REGRESSED: { word: "REGRESSED", glyph: "✕", status: "hold" },
    UNCHANGED: { word: "UNCHANGED", glyph: "=", status: "neutral" },
    INCONCLUSIVE: { word: "INCONCLUSIVE", glyph: "?", status: "cond" },
    MIXED: { word: "MIXED", glyph: "◐", status: "cond" },
  },
  recommendation: {
    ADVANCE_TO_NEXT_TEST: { word: "ADVANCE_TO_NEXT_TEST", glyph: "✓", status: "pass" },
    HOLD: { word: "HOLD", glyph: "✕", status: "hold" },
    RUN_MORE_EXPERIMENTS: { word: "RUN_MORE_EXPERIMENTS", glyph: "?", status: "cond" },
    NO_RECOMMENDATION: { word: "NO_RECOMMENDATION", glyph: "○", status: "neutral" },
  },
  guardrail: {
    REGRESSED: { word: "REGRESSED", glyph: "✕", status: "hold" },
    WITHIN: { word: "within max harm", glyph: "○", status: "neutral" },
    NOT_EVALUABLE: { word: "NOT EVALUABLE", glyph: "?", status: "cond" },
  },
  invalidityReason: {
    INVARIANT_VIOLATION: { word: "INVARIANT_VIOLATION", glyph: "⊘", status: "invalid" },
    REPLICATION_MISMATCH: { word: "REPLICATION_MISMATCH", glyph: "⊘", status: "invalid" },
    NOT_COMPARABLE: { word: "NOT_COMPARABLE", glyph: "⊘", status: "invalid" },
  },
  unserved: { word: "unserved", glyph: "✕", status: "hold" },
});

/** Trade-off wording (design H-6): `lower out-of-service time, higher morning drive`. */
export function tradeOff({ lower, higher }) {
  return `lower ${lower}, higher ${higher}`;
}

/** Direction words for a metric. */
export const DIRECTIONS = frozen({
  lower_is_better: "lower is better",
  higher_is_better: "higher is better",
  neutral: "no direction",
});

// ---------------------------------------------------------------------------------------------------------------
// Experiment setup sheet (design §7.2, §2.8).

/** Experiment setup strings. */
export const EXPERIMENT_SETUP = frozen({
  heading: "EXPERIMENT · setup",
  blocks: {
    question: "1 QUESTION",
    scenario: "2 SCENARIO",
    oneChange: "3 ONE CHANGE",
    primary: "4 PRIMARY",
    guardrails: "5 GUARDRAILS",
    seeds: "6 SEEDS",
  },
  axis: "axis",
  baseline: "baseline",
  candidate: "candidate",
  scope: "scope",
  marginLabel: "equivalence margin",
  marginHint: "differences smaller than this count as no change",
  maxHarm: "max harm",
  alwaysAvailable: "always available",
  sometimesAbsent: "can be absent; shown as NOT EVALUABLE when it is",
  pairedReplications: "paired replications",
  resamples: "resamples",
  frozenWhenYouRun: "frozen when you run",
  viewDifferences: "View differences",
  addGuardrail: "Add guardrail",
  removeGuardrail: "Remove guardrail",
  checksHeading: "CHECKS",
  checks: {
    oneAxis: "one axis",
    marginAboveZero: "margin above 0",
    metricsRegistered: "metrics registered",
    rangesValid: "ranges valid",
    scopesValid: "scopes valid",
  },
  freezeAndRun: "Freeze and run",
  freezeDisabled: "Freeze and run stays off until every check passes.",
  nullCheck: "Null check: both arms use the same value on purpose.",
  testItProperly: "Test it properly",
});

/** Scenario line: `Baseline = "Evening depot visit in San Jose" + 0 changes` (changes integer). */
export function baselineLine({ presetName, changes }) {
  return `Baseline = "${presetName}" + ${plural(changes, "change")}`;
}

/** Run estimate: `about 6 s` (duration formatted). */
export function aboutDuration(duration) {
  return `about ${duration}`;
}

/** Invalid scope message (design §5.7): `invalid scope: depot.parking_peak_fraction does not accept area`. */
export function invalidScope({ metric, key }) {
  return `invalid scope: ${metric} does not accept ${key}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Knob panel (design §7.6).

/** Knob groups, greyed groups and panel strings. */
export const KNOB_PANEL = frozen({
  heading: "KNOBS",
  groups: {
    fleet: "Fleet",
    depots: "Depots",
    demand: "Demand",
    routes: "Routes and traffic",
    rules: "Rules",
    riders: "Riders and clock",
  },
  greyed: {
    charging: "Charging: not modelled (cars never run low)",
    staff: "Staff: not modelled",
  },
  reset: "Reset",
  resetAll: "Reset every knob to the preset",
  runWindow: "Run window",
  stale: "Out of date: Run window",
  noChanges: "No changes from the preset",
  knobPathSeparator: " › ",
  goToKnob: "Go to knob",
});

/** Changes header: `3 changes` (integer). */
export function changesCount(count) {
  return plural(count, "change");
}

/** Tablet drawer handle: `Knobs · 3 changes` (integer). */
export function knobsDrawer(count) {
  return `Knobs · ${changesCount(count)}`;
}

/** Preset line: `Preset: Bay teaching map`. */
export function presetLine(presetName) {
  return `Preset: ${presetName}`;
}

/** Accessible name of one change's reset: `Reset Cleaning bays per depot, SJ-1`. */
export function resetKnob(knobName) {
  return `Reset ${knobName}`;
}

/** A change in the changes list: `Cleaning bays per depot, SJ-1: 3 to 1` (values formatted with units). */
export function changeItem({ knobName, from, to }) {
  return `${knobName}: ${from} to ${to}`;
}

/** Out-of-range explanation; the typed value stays in the field (values formatted, unit shown once). */
export function outOfRange({ value, min, max, unit }) {
  return `${value} is outside the range ${min} to ${max} ${unit}. The value stays as typed; change it to run.`;
}

/** Knob location in a four-slot message: `Depots › Depots per area`. */
export function knobPath(group, knob) {
  return `${group}${KNOB_PANEL.knobPathSeparator}${knob}`;
}

/** Slot names of an invalid combination (design §7.6), as FleetLab's authoring errors show them. */
export const INVALID_COMBINATION = frozen({
  heading: "Can't run this window",
  warningHeading: "Check this window",
  what: "WHAT FAILED",
  why: "WHY",
  fix: "HOW TO FIX",
  knob: "WHICH KNOB",
});

/** The four slots as plain text for Copy details and screen readers, one slot per line. */
export function invalidCombinationText({ what, why, fix, knob }, { warning = false } = {}) {
  return [
    warning ? INVALID_COMBINATION.warningHeading : INVALID_COMBINATION.heading,
    `${INVALID_COMBINATION.what}: ${what}`,
    `${INVALID_COMBINATION.why}: ${why}`,
    `${INVALID_COMBINATION.fix}: ${fix}`,
    `${INVALID_COMBINATION.knob}: ${knob}`,
  ].join("\n");
}

/** Four-slot contents of every scenario check of design §7.6 and P19; each returns `{what, why, fix, knob}`. */
export const CHECKS = frozen({
  noDepot: () => ({
    what: "Depots on the map: 0",
    why: "Cars need at least one depot to be cleaned.",
    fix: "Add a depot in any area.",
    knob: knobPath("Depots", "Depots per area"),
  }),
  tooManyCars: ({ total }) => ({
    what: `Total cars: ${String(total)}`,
    why: "A window runs at most 500 cars.",
    fix: "Remove cars from one or more areas.",
    knob: knobPath("Fleet", "Cars per area at start"),
  }),
  noCars: () => ({
    what: "Total cars: 0",
    why: "A window needs at least one car.",
    fix: "Add a car in any area.",
    knob: knobPath("Fleet", "Cars per area at start"),
  }),
  peakBelowOffPeak: ({ area, peak, offPeak }) => ({
    what: `Peak requests in ${area}: ${peak}, off-peak ${offPeak}`,
    why: "Peak demand must be at least off-peak demand.",
    fix: `Raise the peak value or lower the off-peak value for ${area}.`,
    knob: knobPath("Demand", "Peak requests per area"),
  }),
  overlappingPeaks: ({ morning, evening }) => ({
    what: `Peak windows: ${morning} and ${evening}`,
    why: "The morning peak must end no later than the evening peak starts.",
    fix: "Move one window so they no longer overlap.",
    knob: knobPath("Demand", "Peak windows"),
  }),
  congestionMissingHour: ({ roadClass, direction, clock }) => ({
    what: `Traffic profile for ${roadClass} ${direction}: no value at ${clock}`,
    why: "Every hour of both days needs a slowdown you set, even ×1.0.",
    fix: "Set a multiplier for that hour.",
    knob: knobPath("Routes and traffic", "Congestion by hour, class and direction"),
  }),
  noServiceBay: () => ({
    what: "Service bays on the map: 0",
    why: "Service every N visits is above 0, so some visits need a service bay.",
    fix: "Add a service bay at one depot, or set Service every N visits to 0.",
    knob: knobPath("Depots", "Service bays per depot"),
  }),
  releaseBeforeRecall: ({ recall, release }) => ({
    what: `Morning release ${release} is not later than the recall ${recall}`,
    why: "Cars are recalled to depots first and released home afterwards.",
    fix: "Move the release later than the recall, or turn the release off.",
    knob: knobPath("Rules", "Morning release to home area"),
  }),
  patienceBelowPickup: ({ area, patience, pickup }) => ({
    what: `Rider patience ${patience}; a pickup inside ${area} takes ${pickup}`,
    why: "Most riders will give up before a car reaches them.",
    fix: "Raise rider patience or shorten the in-area trip and pickup time.",
    knob: knobPath("Riders and clock", "Rider patience"),
  }),
});

// ---------------------------------------------------------------------------------------------------------------
// States (design §7.7).

/** Fixed state texts. */
export const STATES = frozen({
  nothingRun: "Set the window, then Run window. Nothing moves until you do.",
  cancel: "Cancel",
  queued: "Waiting to start",
  cancelled: "Cancelled. The previous result is kept.",
  copyDetails: "Copy details",
  engineStopped: "The simulator stopped. Your knobs are kept.",
  retry: "Retry",
  simplifiedDrawing: "Simplified drawing for this device",
  useFullDrawing: "Use full drawing",
  reducedMotion: "Reduced motion",
  reducedMotionSystem: "Follow system setting",
  reducedMotionOn: "On",
  reducedMotionOff: "Off",
});

/** Sandbox progress: `Replication 3 of 5` (integers). */
export function replicationProgress(done, total) {
  return `Replication ${String(done)} of ${String(total)}`;
}

/** Experiment progress: `Seed 7 of 20, both arms` (integers). */
export function seedProgress(done, total) {
  return `Seed ${String(done)} of ${String(total)}, both arms`;
}

/** Plain description of each first-build invariant (design §5.6), for the invariant failure state. */
export const INVARIANT_RULES = frozen({
  1: "the cars tracked differ from the cars configured",
  2: "a car was assigned two riders at once",
  3: "a request ended in more than one final state",
  5: "a depot used more bays than it has",
  8: "a ride finished without a pickup in the right order",
  9: "a car changed state in a way the model does not allow",
  10: "an event named a car, depot or request that does not exist",
  11: "events ran out of order",
  12: "the same seed replayed to a different event log",
  Conservation: "request states did not add up to all requests",
  P13: "a depot held more cars in its stalls than it has stalls",
  P14: "a car was in two places at once",
  P15: "a car's time in each state did not add up to the window",
  P16: "a running total differed from its recomputation",
  P17: "a depot visit was lost",
  P18: "the two arms did not share one world",
  P19: "the scenario broke a loading rule",
  P20: "a car was moved outside the dispatch or release rules",
  P21: "per-area or per-depot values did not add up to the whole",
});

/**
 * Invariant failure: `This run broke a model rule: a car was assigned two riders at once (invariant 2). The result
 * is void and nothing is shown. This is a bug in the teaching model, not a consequence of your settings.`
 */
export function invariantFailure({ rule, id }) {
  return `This run broke a model rule: ${rule} (invariant ${String(id)}). The result is void and nothing is shown. This is a bug in the teaching model, not a consequence of your settings.`;
}

/** Long experiment advice: fewer seeds finish sooner and widen the interval by about sqrt(seeds / fewerSeeds). */
export function slowExperimentAdvice({ estimate, seeds, fewerSeeds, widening }) {
  return `This experiment could take ${estimate}. With ${String(fewerSeeds)} seeds instead of ${String(seeds)} it finishes sooner, and the interval grows about ${widening} as wide.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Model limits chips (design §5.8, H-7).

/** Chip heading and every simplification chip. */
export const MODEL_LIMITS = frozen({
  heading: "Model limits",
  areasArePoints: "Areas are points: pickups inside an area take a fixed time.",
  hourlyTraffic: "Traffic changes on the hour, as you set it.",
  fixedTaskTimes: "Every clean takes exactly the time you set.",
  arrivals: "Requests arrive at random, rounded to the second; no crowds leave at once.",
  waitCountsCompleted: "Wait counts completed rides only; riders who gave up are not in it.",
  assignedRiderWaits: "Once a car is on its way, the rider waits.",
  warmUp: "The first hour is warm-up and is not counted.",
  noRetasking: "A car on its way home cannot be sent to a rider.",
  dispatchBaseline: "Dispatch is a simple baseline, not a best practice.",
  noBattery: "Battery not modelled: cars never run low.",
  noStaff: "Staff not modelled: a free bay always has someone to work it.",
  oneSeedAnimated: "One replay is animated; results across replications carry their own chip.",
  intervalIsSimulationOnly: "The interval says nothing about whether the model is right.",
});

/** Wait population beside every wait value: `from 412 completed rides` (count formatted). */
export function waitPopulation(count) {
  return `from ${count} completed rides`;
}

// ---------------------------------------------------------------------------------------------------------------
// Map (design §7.3, §8.2, §8.3).

/** Map strings. */
export const MAP = frozen({
  name: "Schematic map of the four areas",
  cornerStamp: "Teaching model",
  unitBarLegend: "1 block = 5 cars",
  familyLegend: "rider work · empty drive · available · at a depot",
  tableTwin: "Map as a table",
  pinnedCar: "pinned car",
  localRoute: "local route",
  highwayRoute: "highway",
  noDepot: "no depot in this area",
  areas: { SF: "San Francisco", PEN: "Peninsula", SJ: "San Jose", EB: "East Bay" },
  families: {
    riderWork: "rider work",
    emptyDrive: "empty drive",
    available: "available",
    atDepot: "at a depot",
  },
  carStates: {
    IDLE: "idle",
    ENROUTE_PICKUP: "driving to a rider",
    ON_TRIP: "on a trip",
    TO_DEPOT: "driving to a depot",
    INTAKE: "checking in at a depot",
    QUEUED_SERVICE: "queued for a bay",
    GATE_WAIT: "waiting at the depot gate",
    IN_SERVICE: "in a bay",
    READY_AT_DEPOT: "ready at a depot",
    REPOSITIONING: "driving home for the morning",
  },
  tasks: { CLEAN: "clean", SERVICE: "service" },
  blocked: "finished, no stall free",
  tableHeads: {
    area: "Area",
    carsByFamily: "Cars by state family",
    waitingRiders: "Waiting riders",
    unservedLastHour: "Unserved in the last hour",
    depot: "Depot",
    stallsHeld: "Stalls held",
    queue: "Queue",
    inBays: "In bays",
    ready: "Ready",
    route: "Route and direction",
    plannedNow: "Planned time leaving now",
    chevrons: "Slowdown level",
  },
});

/** Unserved marker text: `4 unserved` (count integer). */
export function unservedCount(count) {
  return `${String(count)} unserved`;
}

/** Depot tile name: `SJ-1 · San Jose`. */
export function depotName({ depotId, areaName }) {
  return `${depotId} · ${areaName}`;
}

/** Lot fill: `22/30` (integers). */
export function lotFill(held, stalls) {
  return `${String(held)}/${String(stalls)}`;
}

/** Map announcement on pause, on step and at most once per simulated hour (clock formatted, counts integers). */
export function mapAnnouncement({ clock, waiting, unservedLastHour }) {
  return `${clock}, this replay: ${plural(waiting, "rider")} waiting, ${String(unservedLastHour)} unserved in the last hour.`;
}

/** Chevron level words for the table twin (0 to 3, design §7.3). */
export const CHEVRON_LEVELS = frozen([
  "no slowdown",
  "some slowdown",
  "congested",
  "heavily congested",
]);

// ---------------------------------------------------------------------------------------------------------------
// Inspector (design §7.2).

/** Inspector strings. */
export const INSPECTOR = frozen({
  depotHeading: "DEPOT",
  carHeading: "CAR",
  close: "Close",
  now: "NOW",
  board: "BOARD",
  ledger: "LEDGER (this replay)",
  value: "value",
  openQueuedCars: "Open cars in the queue",
  completedVisitsOnly: "completed visits only",
  lotHeld: "lot held",
  queue: "queue",
  stages: { arriving: "Arriving", intake: "Intake", queue: "Queue", ready: "Ready" },
  pinCar: "Pin this car",
  openFork: "Open the fork",
  forkArms: { A: "A: baseline", B: "B: candidate" },
});

/** Inspector ledger column: `across 5 replications` (integer). */
export function ledgerAcross(count) {
  return `across ${String(count)} replications`;
}

// ---------------------------------------------------------------------------------------------------------------
// Charts (design §7.5).

/** Chart titles and shared chart strings. */
export const CHARTS = frozen({
  titles: {
    fleet_state: "Fleet state",
    wait_p90_by_hour: "Wait p90 by hour",
    congested_empty_by_hour: "Congested empty driving by hour",
    turnaround_by_arrival_hour: "Time to ready by arrival hour",
    bay_wait_by_depot: "Depot bay wait",
    demand_by_hour: "Demand",
    traffic_by_hour: "Traffic",
    arm_comparison: "Arm comparison",
    available_by_area: "Available cars by area",
    car_timeline: "Car timeline",
    depot_board: "Depot board",
    verdict: "Verdict",
  },
  table: "Table",
  chart: "Chart",
  hatchedGap: "hatched: not available in this hour",
  baseline: "baseline",
  candidate: "candidate",
  whisker: "10th to 90th percentile across replications",
  phoneSegments: { now: "Now", charts: "Charts", all: "All replications" },
});

/** Fleet state summary: this replay's busiest depot moment (register sentence, counts integers, clock formatted). */
export function fleetStateSummary({ register, atDepot, fleet, clock }) {
  return `${register}: the most cars at depots was ${String(atDepot)} of ${String(fleet)}, at ${clock}.`;
}

/**
 * Metric by hour summary: the highest hour and how many hours had no value (values formatted). When no hour has a
 * value, `highest` is `{absent: reason}` and the sentence names no hour and no value (design H-5); `clock` is unused.
 * Anything but a formatted value or `{absent: reason}` throws, so absence never reads as a highest value.
 */
export function metricByHourSummary({ register, metric, highest, clock, absentHours }) {
  if (highest !== null && typeof highest === "object" && typeof highest.absent === "string") {
    return `${register}: ${metric} had no value in any hour; ${absentValue(highest.absent)}.`;
  }
  if (typeof highest !== "string" || highest.trim().length === 0 || highest.startsWith(ABSENT_PREFIX)) {
    throw new TypeError("highest must be a formatted value or {absent: reason}");
  }
  const tail = absentHours === 0 ? "" : `; ${plural(absentHours, "hour")} had no value`;
  return `${register}: ${metric} was highest in the hour from ${clock}, at ${highest}${tail}.`;
}

/** Demand strip summary: the profile you set and this replay's accepted requests. */
export function demandSummary({ area, peakRate, accepted }) {
  return `Profile you set for ${area}: up to ${peakRate} requests per hour; this replay accepted ${accepted} requests.`;
}

/** Traffic strip summary: the largest multiplier in the profile you set for one class and direction. */
export function trafficSummary({ roadClass, direction, factor, start, end }) {
  return `Profile you set for ${roadClass} ${direction}: the largest slowdown is ${factor}, from ${start} to ${end}.`;
}

/** Arm comparison summary across replications (values formatted, count integer). */
export function armComparisonSummary({ count, metric, baseline, candidate }) {
  return `${acrossReplications(count)}: ${metric} averaged ${baseline} in the baseline and ${candidate} in the candidate.`;
}

/** Available cars by area summary: the area's lowest hour (share formatted). */
export function availableSummary({ register, area, lowest, clock }) {
  return `${register}: ${area} had its lowest share of available cars, ${lowest}, in the hour from ${clock}.`;
}

/** Car timeline summary for one replay (durations formatted). */
export function carTimelineSummary({ car, atDepots, congestedEmpty }) {
  return `This replay: ${car} spent ${atDepots} at depots and ${congestedEmpty} driving empty in declared congestion.`;
}

/** Depot board summary for one replay (counts integers, wait formatted). */
export function depotBoardSummary({ depot, held, stalls, bayWait }) {
  return `This replay: ${depot} held at most ${String(held)} of ${String(stalls)} stalls, and its bay wait p90 was ${bayWait}.`;
}

/** Verdict strip summary across paired seeds (bounds formatted with units). */
export function verdictStripSummary({ count, metric, low, high, outcome }) {
  return `Across ${plural(count, "paired seed")}: the ${metric} interval runs from ${low} to ${high}, so the outcome is ${outcome}.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Learn cases (design §4.1, §4.2, H-9).

/** Caption shown until a fixture test asserts a direction (design H-9). */
export const RUN_IT_AND_SEE = "Run it and see.";

/** The three Learn cases: question, concept and named moments with caption keys. */
export const LEARN_CASES = frozen([
  {
    id: "L1",
    useCase: "UC-04",
    title: "Peak and off-peak",
    concept: "Time windows; averages hide peaks.",
    question: "With the same fleet and the same total requests, does evening wait change when demand comes in peaks?",
    moments: [
      { key: "L1.evening_peak_starts", title: "The evening peak starts" },
      { key: "L1.tenth_trip", title: "Cars reach their tenth trip and head to depots" },
      { key: "L1.after_the_peak", title: "After the evening peak" },
    ],
  },
  {
    id: "L2",
    useCase: "UC-09",
    title: "Bays are not always the bottleneck",
    concept: "Which constraint binds; preregistration decides what counts.",
    question: "If SJ-1 drops from three cleaning bays to one while San Jose is short of cars, does San Jose's evening wait change?",
    note: "Shaped like an exploratory FleetLab run; these numbers are the teaching model's own.",
    moments: [
      { key: "L2.reference_panel", title: "The exploratory FleetLab panel" },
      { key: "L2.bay_queue", title: "The SJ-1 bay queue in the evening" },
      { key: "L2.two_specs", title: "Two preregistered specs, frozen before either runs" },
    ],
  },
  {
    id: "L3",
    useCase: "UC-07",
    title: "Home depot or nearest depot",
    concept: "Congestion, depot capacity, the morning release and the next peak together.",
    question: "When a car's depot visit comes due in San Jose, should it drive to its home depot or to the nearest one?",
    moments: [
      { key: "L3.trip_ends_in_sj", title: "SF-017 finishes a trip in San Jose" },
      { key: "L3.sj1_lot", title: "SJ-1's lot in B" },
      { key: "L3.morning_release", title: "The morning release" },
      { key: "L3.first_wave", title: "SF available cars in the first wave" },
      { key: "L3.depot_boards", title: "Both depot boards on one clock" },
    ],
  },
]);

/** Caption text per moment key; every entry reads "Run it and see." until a fixture asserts its direction. */
export const LEARN_CAPTIONS = frozen(
  Object.fromEntries(LEARN_CASES.flatMap((c) => c.moments.map((m) => [m.key, RUN_IT_AND_SEE]))),
);

/** Learn navigation strings. */
export const LEARN = frozen({
  heading: "Learn",
  nextMoment: "Next moment",
  previousMoment: "Previous moment",
  question: "Question",
  concept: "What it teaches",
});

/** Moment position: `Moment 2 of 5` (integers). */
export function momentPosition(index, total) {
  return `Moment ${String(index)} of ${String(total)}`;
}
