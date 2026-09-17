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

/**
 * One direction of a traffic label: `{toward: "SF"}`, `{awayFrom: "SF"}`, `{from: "SJ", to: "SF"}` for one route direction
 * (used when the routes of one direction do not share a profile), or `{}` for both directions.
 */
function directionWords(part) {
  if (typeof part.toward === "string") return `toward ${part.toward} `;
  if (typeof part.awayFrom === "string") return `away from ${part.awayFrom} `;
  if (typeof part.from === "string" && typeof part.to === "string") return `from ${part.from} to ${part.to} `;
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
  notRunYet: "nothing has run yet",
  enginePathNotReported: "the engine path was not reported",
  noBaselineScenario: "no baseline scenario yet; open Experiment from Sandbox or a preset",
  noAxisValue: "no value set",
  onlyThisReplay: "computed only for the replay you are watching",
  voidRun: "the last run broke a model rule, so it is void",
  seedCountNotValid: "the seed count is not a whole number from 1 to 1000",
});

/** Absent reason for censored visits: `2 visits unfinished at drain end` (count is an integer). */
export function visitsUnfinished(count) {
  return `${plural(count, "visit")} unfinished at drain end`;
}

const SUPPRESSED_LEAD = "not shown here: ";
const SUPPRESSED_LINK = "see the differences panel";

/** Suppressed row of a quoted reference panel (design §7.2): the lead, then the link to the differences panel. */
export const REFERENCE = frozen({
  suppressedRow: `${SUPPRESSED_LEAD}${SUPPRESSED_LINK}`,
  suppressedRowLead: SUPPRESSED_LEAD,
  suppressedRowLink: SUPPRESSED_LINK,
  fleet005Title: "FLEET-005 depot turnaround",
  twoZoneProbeTitle: "Two-zone probe",
  differencesPanel: "Differences from FleetLab",
  open: "Open reference panel",
  close: "Close reference panel",
  heading: "FleetLab reference panels",
  question: "Question",
  axis: "Variation axis",
});

/** Button name of one reference panel: `Open reference panel: FLEET-005 depot turnaround`. */
export function openReferencePanel(title) {
  return `${REFERENCE.open}: ${title}`;
}

/** A suppressed row of a quoted panel: `fleet.utilization_fraction: not shown here: see the differences panel`. */
export function suppressedMetric(metric) {
  return `${metric}: ${REFERENCE.suppressedRow}`;
}

/**
 * The differences panel beside the quoted reference panels (design §1.2 "intentionally different, and stated on screen",
 * §7.2 suppressed values, D-05, §14 FL-2): what FleetLab and the teaching model share, what differs on purpose, and why
 * each suppressed value is withheld.
 */
export const REFERENCE_DIFFERENCES = frozen({
  shared: "Shared with FleetLab: the verdict rules, the metric declaration shape, the outcome and recommendation words, and the honesty stance.",
  differentHeading: "Intentionally different",
  different: [
    "The world: FleetLab places one shared fleet, services a car in place from one shared pool of bays, and uses flat demand and one travel time per zone pair. The teaching model has four areas, depots with parking, two routes per area pair, traffic by hour and direction, and peak demand.",
    "The grammar: policy axes, named values, per-area and per-depot values, and metrics scoped to an area, a depot or a time window are teaching-model grammar that FleetLab cannot run.",
    "The random draws: one seed number gives a different world here and in FleetLab.",
    "The record: a teaching run shows only a playground-spec label and is never a FleetLab decision record.",
    "Metric definitions: a metric defined differently from FleetLab's carries a different name here.",
  ],
  withheldHeading: "Values these panels do not show",
  withheld: {
    "fleet.utilization_fraction": "FleetLab does not clip it to the horizon (defect FL-2), so trips that finish after the horizon still count and the value can exceed 1.",
    "business_proxy.served_trips": "an alias FleetLab keeps for requests.served; the teaching model carries no business-proxy aliases, so that row is shown once, under its own name.",
    "business_proxy.unserved_demand": "an alias FleetLab keeps for requests.unserved; the teaching model carries no business-proxy aliases, so that row is shown once, under its own name.",
  },
});

/** Why a quoted panel withholds a metric: `fleet.utilization_fraction: FleetLab does not clip it ...`. */
export function withheldReason(metric) {
  const reason = REFERENCE_DIFFERENCES.withheld[metric];
  if (typeof reason !== "string") throw new RangeError(`no withheld reason for ${String(metric)}`);
  return `${metric}: ${reason}`;
}

/** Axis line of a quoted panel: `parameter:service_bays · baseline 4 · candidate 2` (values formatted). */
export function referenceAxisLine({ axis, baseline, candidate }) {
  return `${axis} · baseline ${baseline} · candidate ${candidate}`;
}

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

/** Words inside displayed values: a clock or morning release that is off, and the word between two ends of a range. */
export const VALUE_WORDS = frozen({
  off: "off",
  to: "to",
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

/**
 * Top bar status while the fork shows a verdict seed: `D1 18:30 · seed 1005 · 5 of 20` (clock formatted; seed, index and
 * total integers). It names the seed the fork replays and its place in the frozen spec, never a Sandbox replay.
 */
export function verdictSeedStatus({ clock, seed, index, total }) {
  return `${clock} · seed ${String(seed)} · ${String(index)} of ${String(total)}`;
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
  // The freeze time is this visitor's own wall clock, not the simulated one and not a time this page shipped, so it
  // says whose clock it is (demo plan 4.7).
  const at = `Spec frozen at ${yourClock(frozenAt)}.`;
  if (changedKnobs === 0) return `${at} This verdict is about the frozen spec.`;
  return `${at} Sandbox has changed since (${plural(changedKnobs, "knob")}). This verdict is about the frozen spec.`;
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
  anotherSeedSetOff: "Use another seed set runs the frozen spec on new seeds, so it is off while the setup is out of date.",
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
 * `outcome` is null for an invalid experiment; `engine` is null when the host never reported its path.
 */
export function sessionLogEntry({ seedSet, firstSeed, lastSeed, label, validity, outcome, recommendation, engine }) {
  return [
    seedSetText({ seedSet, firstSeed, lastSeed }),
    label,
    validity,
    outcome === null ? SESSION_LOG.noOutcome : outcome,
    recommendation,
    engine === null ? `engine: ${absentValue(ABSENT_REASONS.enginePathNotReported)}` : enginePath(engine),
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
  clock: "Simulated clock",
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

/** Accessibility strings that belong to no single region. */
export const A11Y = frozen({
  closeShortcuts: "Close keyboard shortcuts",
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
  gateChain: "Gate chain",
  baselineMean: "baseline mean",
  candidateMean: "candidate mean",
  meanDelta: "mean delta",
  medianDelta: "median delta",
  metric: "metric",
  fewerRows: "fewer rows",
  noGuardrails: "no guardrail declared",
  noDescriptives: "No descriptive row was available in every replication.",
  copySummary: "Copy result summary",
  copied: "Result summary copied. It carries NOT_EVIDENCE and no decision authority.",
  copyFailed: "The result summary could not be copied.",
  running: "Running the frozen spec",
  specLabel: "Spec",
  actions: "Verdict actions",
});

/**
 * What the primary strip plots (design P-7): `candidate minus baseline per seed · left is better` for a lower-is-better
 * primary, and the normalized `baseline minus candidate per seed, so left is better` for a higher-is-better one. The verdict
 * card's heading and the strip both read it, so they always agree.
 */
export function primaryDeltaCaption(direction) {
  return direction === "higher_is_better" ? CHART_TEXT.normalizedDelta : `${VERDICT.perSeedDelta} · ${VERDICT.leftIsBetter}`;
}

/** A raw delta term of the verdict card: `mean delta, candidate minus baseline` (the term is a VERDICT string). */
export function candidateMinusBaseline(term) {
  return `${term}, candidate minus baseline`;
}

/** Interval text: `+735.9 to +919.2 s` (bounds already formatted; the unit is part of the high bound). */
export function intervalText({ low, high }) {
  return `${low} to ${high}`;
}

/** Count of NOT EVALUABLE guardrails in the gate chain: `1 NOT EVALUABLE` (integer). */
export function guardrailsNotEvaluableCount(count) {
  return `${String(count)} NOT EVALUABLE`;
}

/** Experiment progress by runs: `7 of 23 runs finished` (integers). */
export function experimentRunProgress(done, total) {
  return `${String(done)} of ${String(total)} runs finished`;
}

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

/**
 * The two words a trade-off may use for where a metric went (design H-6: never a winner, only a direction).
 * Each is chosen from the metric's own declared direction, never from which side of the sentence it stands on.
 */
export const TRADE_WORDS = frozen({ lower: "lower", higher: "higher" });

/**
 * Trade-off wording (design H-6): `lower out-of-service time, higher morning drive`. Both words come from
 * `TRADE_WORDS`, chosen by the caller from each metric's declared direction: a primary that improved went down when
 * lower is better and up when higher is better, and a harmed guardrail the other way round.
 */
export function tradeOff({ primaryWord, primary, guardrailWord, guardrail }) {
  return `${primaryWord} ${primary}, ${guardrailWord} ${guardrail}`;
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
    situation: "SITUATION",
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
  otherChecks: {
    question: "question written",
    scenario: "scenario valid",
    seeds: "seeds valid",
    resamples: "resamples valid",
    format: "setup format valid",
  },
  checkPasses: "passes",
  checkFails: "fails",
  checkGlyphs: { passes: "✓", fails: "✕" },
  axisId: "axis id",
  metric: "metric",
  chooseMetric: "Choose a metric",
  area: "area",
  allAreas: "every area",
  depot: "depot",
  allDepots: "every depot",
  windowStart: "window starts",
  windowEnd: "window ends",
  wholeSpan: "whole measured span",
  engineUnit: "engine unit",
  layoutValue: "layout, set by the preset",
  hideDifferences: "Hide differences",
  noDifferences: "No differences from the preset.",
  guardrailsNone: "No guardrails. Add one so a harmed metric can hold the change.",
  progress: "Progress",
  startFromPreset: "Start from a preset",
  choosePreset: "Choose a preset",
});

/** One preset in the Experiment preset chooser: `UC-01 Null check`. */
export function presetOption({ id, title }) {
  return `${id} ${title}`;
}

/** Group headings of the Experiment preset chooser: the Experiment presets, the two L2 specs, and the casebook's prefix. */
export const PRESET_GROUPS = frozen({
  experiment: "Experiment presets",
  learn: "Learn case L2, two preregistered specs",
  casebook: "Operations casebook",
});

/** The operations casebook themes (design section 4.4), keyed by the theme ids of src/model/ops-cases.js. */
export const OPS_THEMES = frozen({
  sf: "San Francisco core operations",
  new_area: "Launching a new service area",
  rain: "Rain",
  crowds: "Busy areas with many people",
  police: "Police activity and emergency response",
});

/** A casebook group heading in the chooser: `Operations casebook: Rain` (a theme id of OPS_THEMES). */
export function casebookGroup(themeId) {
  const theme = OPS_THEMES[themeId];
  if (typeof theme !== "string") throw new RangeError(`no casebook theme ${String(themeId)}`);
  return `${PRESET_GROUPS.casebook}: ${theme}`;
}

/**
 * The SITUATION block of a casebook preset (design section 4.4, H-9): the lead, the small labels of a proxy's three parts,
 * and the headings. The situation, proxy, outside-model and watch texts are the preset's own copy.
 */
export const SITUATION = frozen({
  lead: "A situation from the operations casebook, played through the knobs as a proxy. Every number is invented, and the verdict is a teaching result.",
  proxyHeading: "What stands for what",
  standsFor: "stands for",
  setAs: "set as",
  misses: "misses",
  outsideHeading: "Outside this model",
  watchHeading: "Watch",
});

/** Under an edited setup: `Edited: this setup no longer matches OPS-01, so its proxy and watch lines are not shown.` */
export function situationEdited({ id }) {
  return `Edited: this setup no longer matches ${id}, so its proxy and watch lines are not shown.`;
}

/** How much wider an interval grows: `1.4 times` (factor formatted). */
export function timesAsWide(factor) {
  return `${factor} times`;
}

/** Direction and unit of a metric: `lower is better · s` (both already worded). */
export function directionUnit({ direction, unit }) {
  return `${direction} · ${unit}`;
}

/** Margin field prefix and unit: `±60 s` is written by the field; this names the unit after it: `± s`. */
export function marginUnit(unit) {
  return `± ${unit}`;
}

/** Name of one guardrail's remove button: `Remove guardrail 2` (integer). */
export function removeGuardrailNumber(n) {
  return `${EXPERIMENT_SETUP.removeGuardrail} ${String(n)}`;
}

/** A guardrail's heading in the setup sheet: `Guardrail 2` (integer). */
export function guardrailNumber(n) {
  return `Guardrail ${String(n)}`;
}

/** `Test it properly: Bays are not always the bottleneck` for a Learn case with more than one preregistered spec. */
export function testItProperlyFor(title) {
  return `${EXPERIMENT_SETUP.testItProperly}: ${title}`;
}

/** A knob difference on hourly values: `6 hours changed` (integer). */
export function hoursChanged(count) {
  return `${plural(count, "hour")} changed`;
}

/** One check with its state for screen readers: `margin above 0: fails`. */
export function checkState({ check, passes }) {
  return `${check}: ${passes ? EXPERIMENT_SETUP.checkPasses : EXPERIMENT_SETUP.checkFails}`;
}

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
  closeKnobs: "Close knobs",
  off: "off",
  derived: "Shown, not edited.",
  noDepots: "no depots",
  hourOfDay: "hour of day",
  listSeparator: ", ",
  minusGlyph: "−",
  plusGlyph: "+",
  mixedDirections: "Differs by direction; a value here sets both directions.",
  dep9Parts: { intake: "intake", pull_out: "pull-out" },
  windowParts: { start: "window start", end: "window end" },
  peakParts: {
    morning: { start: "morning peak start", end: "morning peak end" },
    evening: { start: "evening peak start", end: "evening peak end" },
  },
  rd3Classes: { highway: "highways", local: "local routes", in_area: "trips inside an area" },
  rd3Periods: { morning: "07:00 to 09:00", evening: "16:00 to 19:00", late: "19:00 to 20:00" },
  weightPeriods: { morning: "morning peak", evening: "evening peak", other: "other hours" },
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

/** A field of a knob that holds several values: `Cleaning bays per depot, SJ-1`. */
export function knobPart({ knobName, part }) {
  return `${knobName}, ${part}`;
}

/** Stepper name: `Decrease Clean time`. */
export function stepDown(fieldName) {
  return `Decrease ${fieldName}`;
}

/** Stepper name: `Increase Clean time`. */
export function stepUp(fieldName) {
  return `Increase ${fieldName}`;
}

/** A formatted value and what follows it: `20 min`, or a period and its factor, `16:00 to 19:00 ×1.6`. */
export function valueWithUnit({ value, unit }) {
  return `${value} ${unit}`;
}

/** Destination weight field part: `morning peak, from SF to PEN`. */
export function weightPart({ period, origin, dest }) {
  return `${period}, from ${origin} to ${dest}`;
}

/** Typed text a knob cannot read; it stays as typed (`example` is a formatted value the knob reads). */
export function notReadable({ value, example }) {
  return `${value} is not a value this knob reads, such as ${example}. The value stays as typed; change it to run.`;
}

/** A typed value between a knob's steps; it stays as typed (values formatted). */
export function notAStep({ value, step, unit }) {
  return `${value} is not on this knob's steps of ${step} ${unit}. The value stays as typed; change it to run.`;
}

/** A typed clock outside the simulated window; it stays as typed (clocks formatted). */
export function outOfClockRange({ value, min, max }) {
  return `${value} is outside the window ${min} to ${max}. The value stays as typed; change it to run.`;
}

/** Why a field is locked while another change stands: `Reset Depots per area first to change this.` */
export function lockedUntilReset(knobName) {
  return `Reset ${knobName} first to change this.`;
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
  unknownRule: "a check the teaching model runs on itself failed",
  preparing: "Preparing the simulator's lookup tables for the first run",
});

/**
 * Registered metrics in words, for chart titles and summaries (the verdict card and the setup sheet keep the metric
 * names). Keys are metric names from src/model/metrics.js.
 */
export const METRIC_WORDS = frozen({
  "requests.total": "requests",
  "requests.served": "served requests",
  "requests.unserved": "unserved requests",
  "unserved.fraction": "unserved share",
  "wait.p50_s": "wait p50",
  "wait.p90_s": "wait p90",
  "wait.population_n": "completed rides counted",
  "vehicle.empty_drive_fraction": "empty driving share",
  "exposure.congested_empty_s": "empty driving in congestion",
  "exposure.congested_loaded_s": "loaded driving in congestion",
  "fleet.available_fraction": "available share",
  "depot.bay_wait_p90_s": "bay wait p90",
  "depot.turnaround_p50_s": "time to ready p50",
  "depot.turnaround_p90_s": "time to ready p90",
  "depot.turnaround_completed_p90_s": "time to ready p90, completed visits only",
  "depot.censored_visits": "visits unfinished at drain end",
  "depot.parking_peak_fraction": "lot peak share",
  "depot.diversions": "diversions",
  "depot.blocked_s": "bay time held with no stall free",
  "fleet.placement_gap": "placement gap",
});

/**
 * A metric in words with its scope: `bay wait p90 at SF-2`, `wait p90 in San Francisco, D2 07:00 to 09:00` (words, a
 * depot id, an area name and a window already formatted; absent parts are null).
 */
export function metricInWords({ words, depot = null, area = null, window = null }) {
  let text = words;
  if (depot !== null) text += ` at ${depot}`;
  if (area !== null) text += ` in ${area}`;
  if (window !== null) text += `, ${window}`;
  return text;
}

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
  P20: "a car was moved outside the dispatch, recall or release rules",
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
  // Why five replications can agree to the digit: at travel variation 0 the seed changes nothing, so the band across
  // replications has no width and every replication repeats the first (demo plan 4.7; the audit read five identical
  // replications as a broken panel).
  noTravelVariation: "Travel variation is 0 in this preset, so every replication repeats the first.",
  // The isometric picture (design 7.3 as amended): a third dimension must not read as a place, a body as a vehicle
  // type, or a bay cell as a numbered bay the engine lacks.
  isoSketch: "An isometric sketch of invented geometry. Platforms are areas, not places; roads are ribbons, not streets.",
  bodyIsConvention: "A car's shape and height are drawing conventions, not vehicle types. A car's position between events is an interpolation.",
  baysNotNumbered: "Bays are not numbered in this model: cars fill them in the order their task started.",
  // The walkthrough (demo plan section 4.7): a beat that shows a mechanism names the rule that produced it, before a
  // reader can take the drawing for an operation. Each row is the chip of the beat that needs it.
  recallActsOnce: "The recall and the release each act once, at the second you set.",
  fixedPatience: "A rider waits exactly the patience you set, then goes unserved; once a car is on its way, the rider waits.",
  noRepositioning: "Nothing repositions an idle car; the release sends cars to a home area, not to demand.",
  stallsNotBays: "Depot assignment counts free stalls, never free bays.",
  seedsVaryTravel: "Seeds vary travel time; the request stream is the same in every seed of a scenario.",
  interpolation: "A car's position between events is an interpolation.",
});

/** Wait population beside every wait value: `from 412 completed rides` (count formatted). */
export function waitPopulation(count) {
  return `from ${count} completed rides`;
}

/**
 * A wait value with its population beside it: `8.2 to 9.1 min, from 1,350 to 1,420 completed rides`. `population` is a
 * waitPopulation text or an absent value; both parts are already formatted and carry the same register.
 */
export function withWaitPopulation({ value, population }) {
  return `${value}, ${population}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Map (design §7.3, §8.2, §8.3).

/** Map strings. */
export const MAP = frozen({
  name: "Schematic map of the four areas",
  cornerStamp: "Teaching model",
  unitBarLegend: "1 block = 5 cars",
  // The map draws two encodings of one quantity at once, so the legend carries both at once (design §7.3 as amended,
  // motion plan H-c).
  oneMarkOneCar: "One mark is one car on a route. Cars inside an area are drawn as blocks of 5.",
  tableTwin: "Map as a table",
  pinnedCar: "pinned car",
  localRoute: "local route",
  highwayRoute: "highway",
  noDepot: "no depot in this area",
  // The isometric picture (design 7.3 as amended, ARCHITECTURE decision 43): its name, its legend line (one body is
  // one car or carries a count; a cube is a tally, not a place), the two pictures a reader can switch between, why the
  // flat one may be all there is, and what a click on the canvas says back.
  isoName: "Isometric sketch of the four areas",
  oneBodyOneCar: "One body is one car on a route, or carries a count. One cube is 5 cars standing in an area. Where a cube stands on its platform means nothing. A car inside an area is a cube, not a body.",
  viewName: "Picture",
  viewIso: "Isometric",
  viewFlat: "Flat",
  isoFallback: "The isometric picture needs a 2D canvas this browser did not provide, so the flat picture is shown.",
  pickNothing: "No car within reach of that click.",
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
    // The count is the frame's own, so the head says which second it belongs to; the column beside it says its hour
    // (demo plan 4.7: the bridge between a whole-run wait and a count of riders standing right now).
    waitingRiders: "Waiting riders at this second",
    unservedLastHour: "Unserved in the last hour",
    depot: "Depot",
    stallsHeld: "Stalls held",
    queue: "Queue",
    inBays: "In bays",
    ready: "Ready",
    route: "Route and direction",
    plannedNow: "Planned time leaving now",
    chevrons: "Slowdown level",
    carsOnRoute: "Cars on the route",
  },
  tableToggle: "Show the map as a table",
  /**
   * Why one direction draws a band where the others draw marks: `H1 San Francisco to Peninsula is short on this
   * schematic, so the cars going that way are drawn as a band.` (route id, area names). The fallback decides per
   * direction, not per route, so the reason is written per direction: a corridor can band one way and draw marks the
   * other, and a reason written for the whole route would say something false about half of what is drawn. It names a
   * drawing limit, not a model fact (motion plan H-d).
   */
  crowdedRoute: ({ routeId, from, to }) =>
    `${routeDirection({ routeId, from, to })} is short on this schematic, so the cars going that way are drawn as a band.`,
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

/** Waiting riders in a yard: `3 riders waiting` (count integer). */
export function waitingRiders(count) {
  return `${plural(count, "rider")} waiting`;
}

/** One direction of a route: `H2 San Jose to San Francisco` (route id, area names). */
export function routeDirection({ routeId, from, to }) {
  return `${routeId} ${from} to ${to}`;
}

/** Accessible name of the pinned car: `pinned car SF-017, on a trip` (car id, state words from MAP.carStates). */
export function pinnedCarName({ car, state }) {
  return `${MAP.pinnedCar} ${car}, ${state}`;
}

/** Map announcement on pause, on step and at most once per simulated hour (clock formatted, counts integers). */
export function mapAnnouncement({ clock, waiting, unservedLastHour }) {
  return `${clock}, this replay: ${plural(waiting, "rider")} waiting, ${String(unservedLastHour)} unserved in the last hour.`;
}

/**
 * The world line under the replay chip: `Bay teaching map · 0 changes` or `OPS-01 Evening crunch: more cars in San
 * Francisco · 1 change` (the preset's name, the changed-knob count an integer). A chip that names a seed but not a
 * world lets a preset switch pass unnoticed; this line names the world on every replay surface.
 */
export function worldLine({ name, changes }) {
  return `${name} · ${changesCount(changes)}`;
}

/** The isometric canvas's accessible name: `Isometric sketch of the four areas · D2 02:00` (clock formatted). */
export function isoLabel({ clock }) {
  return `${MAP.isoName} · ${clock}`;
}

/** A coincidence plate over one body that stands for several cars: `×19` (count integer, 2 or more). */
export function countPlate(count) {
  return `${UNITS.times}${String(count)}`;
}

/** The car a click on the canvas picked: `SF-017, on a trip` (car id, state words from MAP.carStates). */
export function pickedCar({ car, state }) {
  return `${car}, ${state}`;
}

/** What the output says when a click on the canvas landed on an overlay label instead: `That was the SF-2 label.` */
export function pickedLabel(text) {
  return `That was the ${text} label.`;
}

/** The pinned car's stack, beside its id: `with 18 others` (count integer, 1 or more). */
export function withOthers(count) {
  return `with ${plural(count, "other")}`;
}

/**
 * The lines under a depot block, one fact each: `queue 21`, `bays 2/3`, `ready 4`, `stalls 25/30`, and `1 blocked`
 * while a finished car has no stall free (integers). One fact a line keeps the tag 12 characters wide, so it stands
 * under its block on a phone stage too.
 */
export function numbersLines({ queue, inBays, bays, ready, held, stalls, blocked = 0 }) {
  const lines = [`queue ${String(queue)}`, `bays ${String(inBays)}/${String(bays)}`, `ready ${String(ready)}`, `stalls ${lotFill(held, stalls)}`];
  if (blocked > 0) lines.push(`${String(blocked)} blocked`);
  return lines;
}

/**
 * The numbers under a block in full words, for their accessible name: `Queue 21 · In bays 2 of 3 · Ready 4 · Stalls held 25 of
 * 30`, plus ` · 1 blocked, finished, no stall free` while a car is blocked (integers).
 */
export function numbersWords({ queue, inBays, bays, ready, held, stalls, blocked = 0 }) {
  const heads = MAP.tableHeads;
  const parts = [
    `${heads.queue} ${String(queue)}`,
    `${heads.inBays} ${String(inBays)} of ${String(bays)}`,
    `${heads.ready} ${String(ready)}`,
    `${heads.stallsHeld} ${String(held)} of ${String(stalls)}`,
  ];
  if (blocked > 0) parts.push(`${String(blocked)} blocked, ${MAP.blocked}`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------------------------------------------
// NOW panel, the panel across replications, and the fork section (design §7.2 Sandbox wireframe, §7.4, D-10).

/**
 * Row names of the NOW panel (this replay) and the panel across replications. The wait row carries its own scope: a
 * whole-run wait p90 beside a count of riders waiting at this second reads as a contradiction until each says what it
 * covers, and the wait counts completed rides only (demo plan 4.7).
 */
export const NOW_PANEL = frozen({
  carsOnHighways: "cars on highways",
  waitP90: "wait p90, whole run, completed rides",
  unservedShare: "unserved share",
});

/** NOW panel row of a depot's lot: `SJ-1 lot` (depot id). */
export function nowLot(depotId) {
  return `${depotId} lot`;
}

/** The fork section (design D-10): two full runs on the same world for the pinned car. */
export const FORK = frozen({
  heading: "Fork",
  running: "Running both arms on the same world",
  close: "Close the fork",
  needsChange: "Change one knob first: lane A runs the value before the change and lane B the value after it.",
  verdictSeedNote:
    "The map, the NOW panel, the panel across replications and the strips under the scrubber replay the Sandbox world, so they are hidden while the fork shows a verdict seed. Close the fork to see them again.",
});

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
  whyHeading: "WHY IT WENT WHERE",
  visitsHeading: "VISITS",
  timelineHeading: "TIMELINE",
  noVisit: "No depot visit for this car in this replay.",
  noDecision: "No depot decision for this car in this replay.",
  carsHereNone: "No car is at this depot at this moment.",
  ledgerRows: {
    bayWait: "bay wait p90",
    timeToReady: "time to ready p90",
    timeToReadyCompleted: "time to ready p90, completed visits only",
    diversions: "diversions",
    lotPeak: "lot peak share",
  },
  columns: { hour: "hour", state: "state", from: "from", to: "to", depot: "depot", arrival: "arrival", ready: "ready" },
});

/** Inspector ledger column: `across 5 replications` (integer). */
export function ledgerAcross(count) {
  return `across ${String(count)} replications`;
}

/** Drawer title: `DEPOT SJ-1 · San Jose` or `CAR SF-017`. */
export function inspectorTitle({ heading, name }) {
  return `${heading} ${name}`;
}

/** Drawer register stamp: `THIS REPLAY · seed 1001 · D1 19:30` (seed integer, clock formatted). */
export function inspectorStamp({ seed, clock }) {
  return `${thisReplayChip(seed)} · ${clock}`;
}

/** Depot status line: `Stalls 22/30 · in bays 3 · 3 clean + 1 service bays · 24 h` (integers). */
export function depotStatus({ held, stalls, inBays, cleanBays, serviceBays }) {
  return `Stalls ${lotFill(held, stalls)} · in bays ${String(inBays)} · ${String(cleanBays)} clean + ${String(serviceBays)} service bays · 24 h`;
}

/** A NOW flow stage: `Arriving 3` (count integer). */
export function flowStage({ stage, count }) {
  return `${stage} ${String(count)}`;
}

/** The queue stage: `Queue 2 (oldest 11 min)`, or `Queue 0` when `oldest` is null (oldest formatted). */
export function queueStage({ count, oldest }) {
  const stage = flowStage({ stage: INSPECTOR.stages.queue, count });
  return oldest === null ? stage : `${stage} (oldest ${oldest})`;
}

/** Bay id: `C1` for a cleaning bay, `S1` for a service bay (index integer from 1). */
export function bayId({ task, index }) {
  return `${task === "SERVICE" ? "S" : "C"}${String(index)}`;
}

/** A busy bay: `C1 SJ-022 clean 14/20` in minutes, with the blocked words when the task is done and no stall is free. */
export function bayBusy({ bay, car, task, done, total, blocked = false }) {
  const text = `${bay} ${car} ${MAP.tasks[task]} ${String(done)}/${String(total)}`;
  return blocked ? `${text} · ${MAP.blocked}` : text;
}

/** A free bay: `C3 free`. */
export function bayFree(bay) {
  return `${bay} free`;
}

/** A car's home: `home area SF · home depot SF-1`. */
export function carHome({ area, depot }) {
  return `home area ${area} · home depot ${depot}`;
}

/** A car state in words: `in a bay, clean, finished, no stall free`. */
export function carStateText({ state, task = null, blocked = false }) {
  return [MAP.carStates[state], task === null ? null : MAP.tasks[task], blocked ? MAP.blocked : null].filter(Boolean).join(", ");
}

/** A 10th to 90th percentile range across replications: `9 min to 14 min` (values formatted). */
export function acrossRange({ low, high }) {
  return `${low} to ${high}`;
}

/** A value every replication shows alike, in place of a range whose ends match: `0.0% in every replication` (formatted). */
export function acrossSame(value) {
  return `${value} in every replication`;
}

/** The depot inspector's list of cars at the depot now: `Cars at this depot now: 12` (integer). */
export function carsHereHeading(count) {
  return `Cars at this depot now: ${String(count)}`;
}

/** One car in that list: `SJ-022 · in a bay` (car id, state in words). */
export function carHere({ car, state }) {
  return `${car} · ${state}`;
}

/** The button that opens the car inspector for one car: `Inspect SJ-022`. */
export function inspectCar(car) {
  return `Inspect ${car}`;
}

/** The button that pins one car on the map: `Pin SJ-022`. */
export function pinCarNamed(car) {
  return `Pin ${car}`;
}

/** The polite announcement after Open the fork: `Fork opened for SF-017. Both arms run on the same world.` */
export function forkOpened(car) {
  return `Fork opened for ${car}. Both arms run on the same world.`;
}

/** One depot decision: `D1 18:30 · DEPOT_ASSIGNED · SJ-1 · SERVICE_DUE · nearest_depot` (engine words verbatim). */
export function decisionLine({ clock, kind, depot, target, cause }) {
  return [clock, kind, depot, target, cause].join(" · ");
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

/** Lot held and queue in one fork lane: `This replay, B: candidate: SJ-1 held at most 29 of 30 stalls, ...` (formatted). */
export function forkDepotSummary({ lane, depot, held, stalls, bayWait }) {
  return `This replay, ${lane}: ${depot} held at most ${String(held)} of ${String(stalls)} stalls, and its bay wait p90 was ${bayWait}.`;
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

/** Chart furniture: extra titles, legend items, table heads, axis words and road classes (design §7.5, §8.3). */
export const CHART_TEXT = frozen({
  titles: {
    bay_lanes: "Depot bays",
    lot_and_queue: "Lot held and queue",
    descriptive: "Descriptive deltas",
  },
  legend: {
    demandDeclared: "profile you set",
    demandAccepted: "requests accepted in this replay",
    stallsHeld: "stalls held",
    queue: "cars queued for a bay",
    seedDots: "one dot per paired seed",
    meanDelta: "mean delta",
    harmBar: "bar: mean harm",
    maxHarmTick: "tick: max harm",
  },
  heads: {
    hour: "Hour starting",
    panel: "Scope",
    thisReplay: "This replay",
    p10: "10th percentile across replications",
    p90: "90th percentile across replications",
    state: "State",
    from: "From",
    to: "To",
    duration: "Duration",
    lane: "Lane",
    car: "Car",
    task: "Task",
    time: "Time",
    seed: "Seed",
    seedMean: "Mean of seeds",
    delta: "Candidate minus baseline",
    metric: "Metric",
    baselineMean: "Baseline mean",
    candidateMean: "Candidate mean",
    meanDelta: "Mean delta",
    medianDelta: "Median delta",
    intervalLow: "Interval low",
    intervalHigh: "Interval high",
    margin: "Equivalence margin",
    declaredRate: "Profile you set, requests per hour",
    acceptedRequests: "Requests accepted in this replay",
    multiplier: "Multiplier you set",
    shareOfFleet: "Average cars in the hour",
  },
  axes: {
    shareOfFleetTime: "% of fleet time",
    availableCars: "cars available",
  },
  roadClasses: { HIGHWAY: "highways", LOCAL: "local routes", IN_AREA: "trips inside an area" },
  inEveryArea: "in every area",
  normalizedDelta: "baseline minus candidate per seed, so left is better",
  wholeFleet: "whole fleet",
});

/** The arrow between steps of an ordered flow (gate chain, depot stages), as the design §7.2 wireframes draw it. */
export const FLOW_ARROW = "→";

/** A scoped metric as charts and the verdict card name it: `wait.p90_s · SF · D2 07:00 to 09:00` (scopes worded). */
export function scopedMetric({ metric, scopes }) {
  return [metric, ...scopes].join(" · ");
}

/** A window scope on the simulated clock: `D2 07:00 to 09:00` (both ends already formatted). */
export function windowScope({ start, end }) {
  return `${start} to ${end}`;
}

/** A chart title with its subject: `Arm comparison · wait.p90_s` (both already worded). */
export function chartTitle({ title, subject }) {
  return `${title} · ${subject}`;
}

/** Bay lane name on the depot board: `C1` for a cleaning bay, `S1` for a service bay (index from 1). */
export function bayLane({ task, index }) {
  if (task !== "CLEAN" && task !== "SERVICE") throw new TypeError(`unknown bay task ${String(task)}`);
  return `${task === "CLEAN" ? "C" : "S"}${String(index)}`;
}

/** A strip title: `Available cars in San Francisco` (area name). */
export function availableCarsTitle(area) {
  return `Available cars in ${area}`;
}

/** One direction of a traffic profile row: `SF to PEN` (area ids). */
export function trafficDirection({ from, to }) {
  return `${from} to ${to}`;
}

/** Fleet state summary from the hourly stack: the hour with the most car time at depots (values formatted). */
export function fleetStateHourSummary({ register, clock, atDepot, fleet }) {
  return `${register}: the hour from ${clock} had the most cars at depots, ${atDepot} of ${String(fleet)} on average.`;
}

/** A chart summary when its data has no value at all: names the subject and the absence (design H-5). */
export function chartAbsentSummary({ register, subject, reason }) {
  return `${register}: ${subject} had no value; ${absentValue(reason)}.`;
}

/** Fork lanes summary for one car in both arms (durations formatted). */
export function forkTimelineSummary({ car, atDepotsA, atDepotsB }) {
  return `This replay: ${car} spent ${atDepotsA} at depots in A and ${atDepotsB} in B.`;
}

/** Fork strip summary: the fewest available cars of an area in each arm (values formatted, clocks formatted). */
export function forkAvailableSummary({ area, lowestA, clockA, lowestB, clockB }) {
  return `This replay: ${area} had the fewest available cars in A, ${lowestA}, in the hour from ${clockA}, and in B, ${lowestB}, in the hour from ${clockB}.`;
}

/** Bay lanes summary for one replay (integers). */
export function bayLanesSummary({ depot, bays, tasks }) {
  return `This replay: ${depot} worked ${plural(tasks, "task")} in ${plural(bays, "bay")} during the window.`;
}

/** Guardrail bullet row summary across paired seeds (harm values formatted, status word literal). */
export function guardrailRowSummary({ count, metric, harm, maxHarm, status }) {
  return `Across ${plural(count, "paired seed")}: ${metric} mean harm was ${harm} against a max harm of ${maxHarm}, so its status is ${status}.`;
}

/** Guardrail row summary when its metric was absent in some replication (design §6 P-8). */
export function notEvaluableSummary({ count, metric }) {
  return `Across ${plural(count, "paired seed")}: ${metric} is ${NOT_EVALUABLE_TEXT}.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Learn cases (design §4.1, §4.2, H-9).

/** Caption shown until a fixture test asserts a direction (design H-9). */
export const RUN_IT_AND_SEE = "Run it and see.";

/**
 * The three Learn cases: question, concept and named moments. A moment's `key` is the caption key of its preset moment
 * in src/model/presets.js (`learn.<case>.m<n>`), so moment n of a case is moment n of its preset, at the preset's clock.
 */
export const LEARN_CASES = frozen([
  {
    id: "L1",
    useCase: "UC-04",
    title: "Peak and off-peak",
    concept: "Time windows; averages hide peaks.",
    question: "With the same fleet and the same total requests, does evening wait change when demand comes in peaks?",
    moments: [
      { key: "learn.L1.m1", title: "The morning peak starts" },
      { key: "learn.L1.m2", title: "The evening peak starts" },
      { key: "learn.L1.m3", title: "After the evening peak" },
      { key: "learn.L1.m4", title: "Cars reach depots after the evening peak" },
    ],
  },
  {
    id: "L2",
    useCase: "UC-09",
    title: "Bays are not always the bottleneck",
    concept: "Which constraint binds; preregistration decides what counts.",
    question: "If SJ-1 drops from three cleaning bays to one while San Jose is short of cars and every car visits a depot after 5 trips, does San Jose's evening wait change?",
    note: "Shaped like an exploratory FleetLab run; these numbers are the teaching model's own.",
    moments: [
      { key: "learn.L2.m1", title: "The exploratory FleetLab panel" },
      { key: "learn.L2.m2", title: "The SJ-1 bay queue in the evening" },
      { key: "learn.L2.m3", title: "Two preregistered specs, frozen before either runs" },
    ],
  },
  {
    id: "L3",
    useCase: "UC-07",
    title: "Home depot or nearest depot",
    concept: "Congestion, depot capacity, the morning release and the next peak together.",
    question: "When a car's depot visit comes due in San Jose, should it drive to its home depot or to the nearest one?",
    moments: [
      { key: "learn.L3.m1", title: "SF-005 finishes a trip in San Jose" },
      { key: "learn.L3.m2", title: "SJ-1's lot in B" },
      { key: "learn.L3.m3", title: "The morning release" },
      { key: "learn.L3.m4", title: "SF available cars in the first wave" },
    ],
  },
]);

/** Fallback second sentence per moment key (design H-9): every entry reads "Run it and see.". */
export const LEARN_CAPTIONS = frozen(
  Object.fromEntries(LEARN_CASES.flatMap((c) => c.moments.map((m) => [m.key, RUN_IT_AND_SEE]))),
);

/** First sentence of each moment's caption: what to look at, stating no direction. */
export const LEARN_LOOK = frozen({
  "learn.L1.m1": "At D1 07:00 the demand strip enters the morning peak window you set.",
  "learn.L1.m2": "At D1 16:00 the evening peak window you set opens, with the same fleet as the morning.",
  "learn.L1.m3": "At D1 19:30 the evening peak window has closed; read the waiting riders on the map.",
  "learn.L1.m4": "At D1 20:30 read the fleet-state stack and its At a depot band for this replay.",
  "learn.L2.m1": "The two-zone probe panel quotes an exploratory FleetLab run; read its primary row beside its depot queue row.",
  "learn.L2.m2": "At D1 18:30 open SJ-1 on the map and read its cleaning bays and bay queue while San Jose riders wait.",
  "learn.L2.m3": "Both L2 specs are frozen before either runs, and the second one adds a bay wait guardrail at SJ-1.",
  "learn.L3.m1": "At D1 17:14 SF-005 is due a depot visit in San Jose; open the fork to see both depot rules on one world.",
  "learn.L3.m2": "At D1 21:00 read SJ-1's lot in lane B, where each car drives to the nearest depot.",
  "learn.L3.m3": "At D2 05:45 every ready car at a depot outside its home area drives home.",
  "learn.L3.m4": "At D2 07:15 read San Francisco's available cars in each lane.",
});

/**
 * Second sentences that state a direction. Each one replaces the fallback of LEARN_CAPTIONS only because
 * test/captions.test.mjs runs the moment's preset and asserts that direction (design H-9).
 */
export const LEARN_FINDINGS = frozen({
  "learn.L1.m1": "In the profile you set, every area asks for more requests per hour from 07:00 than in the hour before.",
  "learn.L1.m2": "In the profile you set, every area asks for more requests per hour from 16:00 than in the hour before.",
  "learn.L1.m4": "In this replay the At a depot band holds more cars in the 20:00 hour than in the 17:00 hour, inside the peak.",
  "learn.L3.m1": "In the traffic profile you set, the highway from San Jose toward San Francisco is slower at 17:14 than at 15:30.",
});

/** A moment's two-sentence caption: its look sentence, then its asserted finding or the fallback. */
export function learnCaption(key) {
  const look = LEARN_LOOK[key];
  const second = LEARN_FINDINGS[key] ?? LEARN_CAPTIONS[key];
  if (typeof look !== "string" || typeof second !== "string") throw new RangeError(`no Learn caption for ${String(key)}`);
  return `${look} ${second}`;
}

/** Learn navigation strings. */
export const LEARN = frozen({
  heading: "Learn",
  nextMoment: "Next moment",
  previousMoment: "Previous moment",
  question: "Question",
  concept: "What it teaches",
  casesName: "Learn cases",
  momentsName: "Moments on the timeline",
  chooseCase: "Choose a Learn case to walk through one question.",
  differences: "Changed from the Bay teaching map",
  noDifferences: "No knob changed from the Bay teaching map.",
});

/** The moment line: `D1 18:30 · SF-017 finishes a trip in San Jose` (clock formatted). */
export function momentLine({ clock, title }) {
  return `${clock} · ${title}`;
}

/** The pinned car of a Learn case: `Pinned car: SF-017`. */
export function learnPinnedCar(car) {
  return `Pinned car: ${car}`;
}

/** Moment position: `Moment 2 of 5` (integers). */
export function momentPosition(index, total) {
  return `Moment ${String(index)} of ${String(total)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// The walkthrough (demo plan sections 1.1, 4.4 and 4.7; ARCHITECTURE decision 44). Four chapters of scripted beats over
// one replay of the casebook's OPS-01. Every narration line below is a template filled from the run: no sentence here
// states a direction the pins do not carry (H-9), which test/present.test.mjs scans for over every string in PRESENT.

/** Fixed strings of the walkthrough: its controls, its chapters and beats, the rule line of each beat, and its copy. */
export const PRESENT = frozen({
  open: "Present",
  leave: "Leave the walkthrough",
  name: "Walkthrough",
  ledgerName: "What this beat shows",
  prepare: "Prepare",
  prepareWhat: "Prepare runs the window once and the experiment once, here in your browser. Nothing is stored and nothing is shipped.",
  prepareWait: "Next stays off until both runs land.",
  preparing: "Preparing the walkthrough",
  next: "Next",
  back: "Back",
  play: "Play",
  pause: "Pause",
  chaptersName: "Chapters",
  ticker: "JUST HAPPENED · THIS REPLAY",
  chapters: {
    operations: "1 Operations",
    analytics: "2 Analytics",
    simulation: "3 Simulation",
    product: "4 Product sense",
  },
  beats: {
    peak: "The evening peak",
    unservedHour: "The 18:00 hour",
    recall: "The recall",
    depotNight: "SF-2 at 02:00",
    morning: "The morning after",
    registers: "Two registers",
    verdict: "The verdict",
    frame: "How a frame is made",
    arms: "One world, two arms",
    standsFor: "What this stands for",
    refusals: "Not on this page, and the next question",
    // The morning beat is the release; a scenario with the release turned off still has the beat, and it says so
    // instead of naming a second the scenario never set.
    morningNoRelease: "No release in this scenario",
  },
  /** The model rule each beat shows, under its figures: a mechanism, never a result. */
  rules: {
    peak: "Every car on a route is one body; cars standing in an area are cubes of five.",
    unservedHour: "A rider not assigned within the patience you set is counted unserved.",
    recall: "At the recall second every idle car leaves for its home depot.",
    depotNight: "A depot works its bays in the order tasks started; a car with no free stall waits. In the table: held is stalls taken of stalls, queue is cars that finished intake and have no bay, bays is bays busy of bays, ready is cars parked with their tasks done.",
    morning: "At the release second every ready car outside its home area drives home.",
    registers: "Two registers, never mixed: this replay, and across replications.",
    verdict: "The gates run in order: validity, then guardrails, then the primary.",
    frame: "Playback seeks a snapshot every 5 minutes and places each car along its leg.",
    arms: "Both arms run one world and one request stream; one knob differs.",
    standsFor: "Each change says what it stands for, how it is set and what it misses.",
    refusals: "The casebook holds twenty situations; this page ran one of them.",
  },
  /** Figure labels; a figure that names a depot or an hour wraps one of these with depotFigure or hourFigure. */
  figures: {
    ridersWaiting: "riders waiting",
    carsWithRiders: "cars with riders",
    unservedLastHour: "unserved in the last hour",
    waitP90: "wait p90",
    sentThisSecond: "sent at this second",
    drivingToDepot: "driving to a depot",
    queuedAcross: "queued across the four depots",
    stallsHeld: "stalls held",
    readyAtDepots: "ready at depots",
    drivingHome: "driving home",
    queueCleared: "queue cleared",
    carsOnLeg: "cars on a leg",
    eventsSoFar: "events so far",
  },
  /** Chapter 2's own content: the registry of what this page can compute, and the two charts by hour under it. */
  registry: {
    heading: "The metric registry",
    hourly: "By hour",
  },
  /** Chapter 3's own content: where the drawn frame came from, and what the model checks on itself. */
  simulation: {
    snapshot: "snapshot",
    drawnAt: "drawn at",
    interpolated: "interpolated",
    onSnapshot: "on the snapshot second",
    determinism: "determinism precheck",
    parity: "verdict rules parity-tested against the instrument's vectors",
  },
  /** Chapter 4's own content: what this page was not built to be, and the casebook question after this one. */
  refusalsHeading: "Not on this page, each for a reason",
  nextHeading: "The next question in the casebook",
  openInExperiment: "Open in Experiment",
  tradeOffHeading: "What it trades",
  noTradeOff: "No guardrail was harmed in this run, so it trades nothing.",
  /** Beat 3.2: the two arms of the watched seed, each at the depot the frozen spec's guardrail names. */
  armsHeading: "Both arms at this second",
  /** One line each of the ticker, for the events that carry a step of the day. */
  tickerRelease: "morning release",
  /** The card a reader meets before any run (demo plan section 1.2). */
  card: {
    lead: "A teaching model of a stylized Bay Area fleet. Every number is invented; the verdict rules are FleetLab's.",
    sandbox: "Set the knobs and Run window.",
    walk: "Walk through one day (about 6 minutes)",
    close: "Close this card",
  },
  /** What this page was not built to be, each with the reason (demo plan section 4.6, design 1.4). */
  refusals: [
    "A real basemap or street tiles: they would imply geography and routing the model does not have.",
    "A rendered city or vehicle models: fidelity the question does not need, and a picture that reads as a place.",
    "A language model in the loop: a sampled model is not a pure function of scenario and seed, so no verdict could be pinned.",
    "An imported traffic simulator: a second source of position that could disagree with the log every number reads.",
    "A single fleet-health dial: rider wait and riders left unserved are two numbers, never one.",
  ],
  shortcutList: [
    "Right arrow and left arrow: the next or the previous step",
    "Home and End: the first or the last step",
    "1 to 4: go to a chapter",
    "Space: play or pause",
    "Escape: leave the walkthrough",
  ],
  shortcutsScope: "These keys work only while the walkthrough row has focus.",
});

/** A beat that has somewhere to run to: `Press Play to watch to D2 00:45.` (clock formatted). */
export function playToWatch(clock) {
  return `Press Play to watch to ${clock}.`;
}

/** Where the walkthrough stands inside its chapter: `Step 4 of 5` (integers). */
export function stepOf(index, total) {
  return `Step ${String(index)} of ${String(total)}`;
}

/** A count against a whole: `113 of 120` cars, `4,210 of 10,376` events (integers, or counts already formatted). */
export function outOf({ count, total }) {
  return `${String(count)} of ${String(total)}`;
}

/** A value in seconds with its minutes beside it, never instead of them: `-1,565.6 s (-26.1 min)` (both formatted). */
export function withMinutes({ seconds, minutes }) {
  return `${seconds} (${minutes} ${UNITS.minutes})`;
}

/** A figure label scoped to one depot: `SF-2 stalls held` (a depot id and a PRESENT.figures label). */
export function depotFigure({ depot, label }) {
  return `${depot} ${label}`;
}

/** A figure label scoped to one hour: `wait p90, D1 18:00 hour` (a label and a formatted clock). */
export function hourFigure({ label, clock }) {
  return `${label}, ${clock} hour`;
}

/** A figure label scoped to one area and one hour: `wait p90, San Francisco, D1 18:00 hour` (area name, clock formatted). */
export function areaHourFigure({ label, area, clock }) {
  return `${label}, ${area}, ${clock} hour`;
}

/** A duration this visitor's own machine took, never a number this page shipped: `4.8 s (your clock)` (formatted). */
export function yourClock(duration) {
  return `${duration} (your clock)`;
}

/** What Prepare took: `window 1.2 s · experiment 4.8 s` (both formatted). */
export function prepareTimes({ window, experiment }) {
  return `window ${window} · experiment ${experiment}`;
}

/** A ticker line: a rider gave up waiting: `a rider in San Francisco went unserved after 10 min` (area name, formatted). */
export function tickerUnserved({ area, after }) {
  return `a rider in ${area} went unserved after ${after}`;
}

/** A ticker line: the recall acted: `recall ordered: 77 cars sent to a depot` (count integer). */
export function tickerRecall(count) {
  return `recall ordered: ${plural(count, "car")} sent to a depot`;
}

/** A ticker line: a car's first task began: `SF-040 took a bay after 250 min` (car id, wait formatted). */
export function tickerBay({ car, after }) {
  return `${car} took a bay after ${after}`;
}

/** A ticker line: a car finished intake with no bay free: `SF-040 queued at SF-2` (car and depot ids). */
export function tickerQueued({ car, depot }) {
  return `${car} queued at ${depot}`;
}

/** Beat 1.1, from the frame: `At D1 17:30 in this replay, 15 riders are waiting and 113 of 120 cars carry a rider.` */
export function narrationPeak({ clock, waiting, riders, fleet }) {
  return `At ${clock} in this replay, ${plural(waiting, "rider")} are waiting and ${outOf({ count: riders, total: fleet })} cars carry a rider.`;
}

/**
 * Beat 1.2, from the log and the hourly series (counts integers, wait already formatted or an absent value). The wait
 * names the area it counts, because it is the area the frozen spec's primary is scoped to and the hourly chart in the
 * next chapter plots that same population.
 */
export function narrationUnservedHour({ clock, unserved, area, wait }) {
  return `In the hour from ${clock}, ${plural(unserved, "rider")} went unserved; wait p90 in ${area} for rides completed in that hour is ${wait}.`;
}

/** Beat 1.3, from the events and the frame (counts integers, clock formatted). */
export function narrationRecall({ clock, sent, driving }) {
  return `At ${clock} the recall sent ${plural(sent, "car")} to a depot, and ${String(driving)} are driving to one.`;
}

/** Beat 1.4, from the frame's depot views (counts integers, clock formatted). */
export function narrationDepots({ clock, queued, depot, held, stalls }) {
  return `At ${clock}, ${plural(queued, "car")} wait for a bay across the four depots, and ${depot} holds ${lotFill(held, stalls)} stalls.`;
}

/** Beat 1.5, from the frame (counts integers, clock formatted). */
export function narrationRelease({ clock, home, ready }) {
  return `At ${clock}, ${plural(home, "car")} are driving home and ${String(ready)} stand ready at a depot.`;
}

/**
 * Beat 1.5's pinned car, from its visit: `SF-040 took a bay at D2 05:34 and is ready at D2 05:54, after the release at
 * D2 05:45.` (clocks formatted). `release` is null in a scenario that turns the release off, and then the sentence
 * compares nothing. The comparing words are chosen from the two clocks at render time and pinned in
 * test/captions.test.mjs on OPS-01 at seed 1001 (H-9).
 */
export function narrationPinnedBay({ car, took, ready, release = null, before = false }) {
  const base = `${car} took a bay at ${took} and is ready at ${ready}`;
  return release === null ? `${base}.` : `${base}, ${before ? "before" : "after"} the release at ${release}.`;
}

/**
 * Beat 1.5's depot: the second its bay queue was next empty, against the release second the knobs set (clocks
 * formatted). A pinned finding: the comparing word comes from the two clocks and is asserted on OPS-01 (H-9).
 */
export function narrationQueueCleared({ depot, cleared, release, before }) {
  return `${depot}'s bay queue is empty at ${cleared}, ${before ? "before" : "after"} the release at ${release}.`;
}

/** What FleetLab's registry says about a metric, by the registered status word. */
export const REGISTRY_STATUS = frozen({
  identical: "identical to FleetLab",
  playground_only: "this teaching model only",
});

/** Registry facts under a metric's name: `s · lower is better · identical to FleetLab` (each part already worded). */
export function registryFacts({ unit, direction, status }) {
  return `${unit} · ${direction} · ${status}`;
}

/**
 * Beat 3.1: where the drawn frame came from: `snapshot D2 00:45:00 · drawn at D2 00:46:40 · interpolated`, or
 * `· on the snapshot second` when the clock sits exactly on a snapshot. Both clocks are formatted with their seconds,
 * because the two are usually inside the same minute.
 */
export function frameLine({ snapshot, drawn, interpolated }) {
  const s = PRESENT.simulation;
  return `${s.snapshot} ${snapshot} · ${s.drawnAt} ${drawn} · ${interpolated ? s.interpolated : s.onSnapshot}`;
}

/**
 * Beat 3.1: what playback reads and what the two runs took on this visitor's own machine:
 * `369 snapshots, one every 5 min · engine: worker · 5 replications in 1.2 s (your clock)` (counts integers, the step,
 * the engine path and the duration already formatted).
 */
export function snapshotsLine({ snapshots, every, engine, replications, took = null }) {
  const parts = [`${plural(snapshots, "snapshot")}, one every ${every}`, engine];
  // The wall time is measured on this visitor's machine; before Prepare has measured one, the line says the rest.
  if (took !== null) parts.push(`${plural(replications, "replication")} in ${yourClock(took)}`);
  return parts.join(" · ");
}

/** Beat 3.1: what the model checks on itself, every run and in its tests (counts integers). */
export function validationLine({ invariants, cases }) {
  const s = PRESENT.simulation;
  return `${plural(invariants, "invariant")} checked every run · ${s.determinism} · ${s.parity} · ${plural(cases, "casebook verdict")} pinned in tests`;
}

/**
 * The frozen spec in words, for the beat that shows the verdict: `One change on parameter:SUP-1.SF, one primary with
 * an equivalence margin of 60 s, 2 guardrails each with a maximum harm, 20 paired seeds and 2,000 resamples, frozen
 * before the run.` (the axis id, the margin and the resample count already formatted).
 */
export function specSentence({ axis, margin, guardrails, seeds, resamples }) {
  return `One change on ${axis}, one primary with an equivalence margin of ${margin}, ${plural(guardrails, "guardrail")} each with a maximum harm, ${plural(seeds, "paired seed")} and ${resamples} resamples, frozen before the run.`;
}

/** Beat 2.1: the two registers named, with the replication count this page ran (integer). */
export function narrationRegisters(replications) {
  return `Two registers stand apart on this page: what this replay did, and what ${String(replications)} replications did.`;
}

/** Beat 2.2: what was frozen before the run (integers). */
export function narrationVerdict({ seeds, resamples }) {
  return `The spec was frozen before this run: ${plural(seeds, "paired seed")} and ${String(resamples)} resamples.`;
}

/** Beat 3.1: where the drawn frame came from (clocks formatted). */
export function narrationFrame({ snapshot, drawn }) {
  return `This frame comes from the snapshot at ${snapshot} and is drawn at ${drawn}, with each car placed along its leg.`;
}

/**
 * Beat 3.2: one arm at one depot at the second both arms stand at: `A: baseline · SF-2 holds 22 of 30 stalls, 16 cars
 * queued for a bay.` (the arm word, the depot id, the lot fill already formatted, the count an integer). The two lines
 * carry their numbers and say nothing about the difference: for one seed, that is a direction the verdict did not pin.
 */
export function armDepotLine({ arm, depot, held, queued }) {
  return `${arm} · ${depot} holds ${held} stalls, ${plural(queued, "car")} queued for a bay.`;
}

/** Beat 3.2: the seed being watched against the seeds the verdict counted (integers). */
export function narrationArms({ seed, index, total }) {
  return `Seed ${String(seed)} is paired seed ${String(index)} of ${String(total)}, and the verdict counted them all.`;
}

/** Beat 4.1: the casebook record's discipline, named by its id. */
export function narrationSituation(id) {
  return `${id} says what it stands for, how it is set and what it misses, before anything runs.`;
}

/** Beat 4.2: the next casebook question, by title alone (H-9: never a verdict for it). */
export function narrationNext(name) {
  return `The next question in the casebook is ${name}, by its title alone.`;
}
