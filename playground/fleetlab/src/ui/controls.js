// Knob panel (design §7.6): the six knob groups from KNOBS with units beside every field, visible range enforcement, the
// changes list with a reset per change, the out-of-date label, invalid combinations in four slots and Run window. On a
// phone or tablet the panel is a sheet, inert while it is off screen.
//
// Knob names, help and units come from the model's KNOBS table and four-slot texts from validateScenario, which the
// contract (section 6.2) makes the authors of that copy; every other string comes from labels.js.

import { currentLayout, rememberFocus, syncSheetInert, watchLayout } from "./a11y.js";
import { el, keyedList } from "./dom.js";
import { clock, minutes, multiplier } from "./format.js";
import * as labels from "./labels.js";
import { presetById } from "../model/presets.js";
import { AREA_IDS, HOURS, KNOBS, RD3_CLASSES, RD3_PERIOD_HOURS, validateScenario } from "../model/schema.js";

const { KNOB_PANEL } = labels;

/** Panel groups in design order: labels.js key and the KNOBS group name. */
const GROUPS = Object.entries({ fleet: "Fleet", depots: "Depots", demand: "Demand", routes: "Routes and traffic", rules: "Rules", riders: "Riders and clock" });
const PANEL_KNOBS = KNOBS.filter((knob) => knob.firstBuild);

const AREA_FIELDS = { "SUP-1": "cars", "RD-2": "in_area_s", "DEM-1": "peak_per_h", "DEM-2": "offpeak_per_h" };
const DEPOT_FIELDS = { "DEP-2": "parking", "DEP-3": "cleaning_bays", "DEP-5": "service_bays" };
const SINGLE_PATHS = {
  "DEP-4": ["clean_s"], "DEP-6": ["service_s"], "DEP-7": ["trips_between_visits"], "DEP-8": ["service_every_visits"],
  "DEM-5": ["demand_shape"], "RD-4": ["congestion_threshold_permille"], "RD-5": ["sigma_permille"], "RID-1": ["patience_s"],
  "POL-1": ["policies", "dispatch"], "POL-2": ["policies", "depot_assignment"], "POL-3": ["policies", "recall_s"],
  "POL-4": ["policies", "release_s"], "POL-5": ["policies", "queue_order"],
  "CLK-2": ["warmup_end_s"], "CLK-3": ["bucket_s"], "CLK-4": ["placement_snapshot_s"],
};
const POLICY_AXES = { "POL-1": "policy:dispatch", "POL-2": "policy:depot_assignment", "POL-5": "policy:queue_order" };
// A depot added from the panel: the lot and bays of SJ-1-sized depots with the smallest bay set of the Bay teaching map.
const NEW_DEPOT = { parking: 30, cleaning_bays: 2, service_bays: 1 };
const CLOCK_STEP_S = 900;

const getIn = (object, path) => path.reduce((node, key) => node[key], object);
const shown = (field, value) => String(value / field.scale);
const nameOf = (field) => (field.part === null ? field.knob.label : labels.knobPart({ knobName: field.knob.label, part: field.part }));
const groupKeyOf = (knob) => GROUPS.find(([, name]) => name === knob.group)[0];

/** Every value of a congestion table (a direction map or the in-area row) in one period's hours on both days. */
function periodValues(table, period) {
  const rows = Array.isArray(table) ? [table] : Object.values(table);
  return rows.flatMap((row) => RD3_PERIOD_HOURS[period].flatMap((h) => [row[h], row[h + 24]]));
}

/** A congestion table with every direction set to `value` in one period's hours on both days (as the RD-3 axis does). */
function setPeriod(table, period, value) {
  const setRow = (row) => row.map((v, h) => (RD3_PERIOD_HOURS[period].includes(h % 24) ? value : v));
  return Array.isArray(table) ? setRow(table) : Object.fromEntries(Object.entries(table).map(([dir, row]) => [dir, setRow(row)]));
}

/** The depot list with `count` depots in `area`, keeping existing ones and listing depots in area then number order. */
function withDepotCount(depots, area, count) {
  const own = depots.filter((d) => d.area === area).slice(0, count);
  for (const n of [1, 2]) {
    if (own.length < count && !own.some((d) => d.id === `${area}-${n}`)) own.push({ id: `${area}-${n}`, area, ...NEW_DEPOT });
  }
  const rank = (d) => AREA_IDS.indexOf(d.area) * 10 + Number(d.id.split("-")[1]);
  return [...depots.filter((d) => d.area !== area), ...own].sort((a, b) => rank(a) - rank(b));
}

/**
 * The fields of one knob on scenario `s`. A field holds its engine value, bounds and step, the path it writes, the
 * `changeKey` the store tracks the change under, the Experiment axis, and `write` when one edit rewrites a larger value.
 */
function knobFields(knob, s) {
  const range = knob.range ?? {};
  const id = knob.id;
  const field = (key, part, path, extra = {}) => ({
    key, changeKey: key, knob, part, path, kind: "number", scale: knob.scale, unit: knob.unit, min: range.min, max: range.max,
    step: range.step ?? (knob.scale === 1000 ? 100 : knob.scale), grid: range.step ?? 1, axis: `parameter:${key}`,
    value: getIn(s, path), ...extra,
  });
  const clockField = (key, part, path, extra = {}) =>
    field(key, part, path, { kind: "clock", min: s.window.start_s, max: s.window.end_s, step: CLOCK_STEP_S, ...extra });
  switch (knob.type) {
    case "per_area_int":
      return s.areas.map((a, i) => field(`${id}.${a.id}`, a.id, ["areas", i, AREA_FIELDS[id]]));
    case "per_depot_int":
      return s.depots.map((d, i) => field(`${id}.${d.id}`, d.id, ["depots", i, DEPOT_FIELDS[id]]));
    case "per_route_int":
      return s.routes.map((r, i) => field(`${id}.${r.id}`, r.id, ["routes", i, "free_flow_s"]));
    case "int":
      return [field(id, null, SINGLE_PATHS[id])];
    case "int_pair":
      return [["intake", "intake_s"], ["pull_out", "pull_out_s"]].map(([part, key]) => field(`${id}.${part}`, KNOB_PANEL.dep9Parts[part], [key]));
    case "enum":
      return [field(id, null, SINGLE_PATHS[id], { kind: "select", axis: POLICY_AXES[id] ?? `parameter:${id}`, options: range.values.map((v) => ({ value: v, text: v })) })];
    case "enum_int":
      return [field(id, null, SINGLE_PATHS[id], { kind: "select", options: range.values.map((v) => ({ value: v, text: minutes(v) })) })];
    case "clock":
      return [clockField(id, null, SINGLE_PATHS[id])];
    case "clock_or_off":
      return [clockField(id, null, SINGLE_PATHS[id], { allowsOff: true })];
    case "window":
      return ["start", "end"].map((part) => clockField(`${id}.${part}`, KNOB_PANEL.windowParts[part], ["window", `${part}_s`], { min: 0, max: HOURS * 3600 }));
    case "peaks":
      return ["morning", "evening"].flatMap((period, i) =>
        ["start", "end"].map((part) => field(`${id}.${period}.${part}`, KNOB_PANEL.peakParts[period][part], ["peaks", i, `${part}_h`], { unit: KNOB_PANEL.hourOfDay })));
    case "weights":
      return Object.entries(KNOB_PANEL.weightPeriods).flatMap(([period, periodName]) => AREA_IDS.flatMap((origin) => AREA_IDS.map((dest) =>
        field(`${id}.${period}.${origin}.${dest}`, labels.weightPart({ period: periodName, origin, dest }), ["dest_weights", period, origin, dest]))));
    case "congestion":
      return Object.entries(RD3_CLASSES).flatMap(([cls, table]) => Object.keys(RD3_PERIOD_HOURS).map((period) => {
        const values = periodValues(s.congestion[table], period);
        return field(`${id}.${cls}.${period}`, labels.knobPart({ knobName: KNOB_PANEL.rd3Classes[cls], part: KNOB_PANEL.rd3Periods[period] }), ["congestion", table], {
          changeKey: `${id}.${cls}`, axis: `parameter:${id}.${cls}.${period}`, value: Math.max(...values), mixed: values.some((v) => v !== values[0]),
          write: (scenario, value) => setPeriod(scenario.congestion[table], period, value),
        });
      }));
    case "depots_per_area":
      return AREA_IDS.map((area) => field(`${id}.${area}`, area, ["depots"], {
        kind: "select", changeKey: id, value: s.depots.filter((d) => d.area === area).length,
        options: Array.from({ length: range.max - range.min + 1 }, (_, i) => ({ value: range.min + i, text: String(range.min + i) })),
        write: (scenario, count) => withDepotCount(scenario.depots, area, count),
      }));
    case "derived":
      return [{ key: id, changeKey: id, knob, part: null, kind: "derived" }];
    default:
      return [];
  }
}

const fieldCache = new WeakMap();

/** Every panel field of a scenario, keyed by field key, in KNOBS order (cached per scenario object). */
function fieldsOf(scenario) {
  if (!fieldCache.has(scenario)) {
    fieldCache.set(scenario, new Map(PANEL_KNOBS.flatMap((knob) => knobFields(knob, scenario)).map((f) => [f.key, f])));
  }
  return fieldCache.get(scenario);
}

/** Reads typed text as an engine value: `{value}`, or `{problem}` with the note the field shows. Never clamps. */
function parse(field, text) {
  const typed = text.trim();
  if (field.kind === "select") return { value: field.options.find((o) => String(o.value) === typed).value };
  if (field.kind === "clock") {
    if (field.allowsOff && typed === KNOB_PANEL.off) return { value: null };
    const m = /^D([12]) ([01]\d|2[0-3]):([0-5]\d)$/.exec(typed);
    if (m === null) return { problem: labels.notReadable({ value: typed, example: clock(field.min) }) };
    const value = (Number(m[1]) - 1) * 86400 + Number(m[2]) * 3600 + Number(m[3]) * 60;
    if (value < field.min || value > field.max) return { problem: labels.outOfClockRange({ value: typed, min: clock(field.min), max: clock(field.max) }) };
    return { value };
  }
  const engine = Number(typed) * field.scale;
  if (typed === "" || !Number.isSafeInteger(Math.round(engine)) || Math.abs(engine - Math.round(engine)) > 1e-6) {
    return { problem: labels.notReadable({ value: typed, example: shown(field, field.value) }) };
  }
  const value = Math.round(engine);
  if (value < field.min || value > field.max) {
    return { problem: labels.outOfRange({ value: typed, min: shown(field, field.min), max: shown(field, field.max), unit: field.unit }) };
  }
  if (value % field.grid !== 0) return { problem: labels.notAStep({ value: typed, step: shown(field, field.grid), unit: field.unit }) };
  return { value };
}

/** The value a stepper moves to, stopping at the bound; null when the value already sits on that bound. */
function stepTarget(field, direction) {
  const from = field.value ?? field.min;
  const bound = direction < 0 ? field.min : field.max;
  if (from === bound) return null;
  const next = from + direction * field.step;
  return direction < 0 ? Math.max(bound, next) : Math.min(bound, next);
}

/** A field's value as the input shows it. */
function display(field) {
  if (field.kind === "clock") return field.value === null ? KNOB_PANEL.off : clock(field.value);
  return shown(field, field.value);
}

/** A stored value of a change, formatted for the changes list. */
function valueText(field, value) {
  if (field.knob.type === "congestion") {
    return Object.entries(KNOB_PANEL.rd3Periods)
      .map(([period, name]) => labels.valueWithUnit({ value: name, unit: multiplier(Math.max(...periodValues(value, period))) }))
      .join(KNOB_PANEL.listSeparator);
  }
  if (field.knob.type === "depots_per_area") return value.length === 0 ? KNOB_PANEL.noDepots : value.map((d) => d.id).join(KNOB_PANEL.listSeparator);
  if (field.kind === "select") return field.options.find((o) => o.value === value).text;
  if (field.kind === "clock") return value === null ? KNOB_PANEL.off : clock(value);
  return labels.valueWithUnit({ value: shown(field, value), unit: field.unit });
}

/** The name a change reads under: a congestion class, the depot layout, or the field's own name. */
function changeName(field) {
  if (field.knob.type === "congestion") return labels.knobPart({ knobName: field.knob.label, part: KNOB_PANEL.rd3Classes[field.changeKey.split(".")[1]] });
  return field.knob.type === "depots_per_area" ? field.knob.label : nameOf(field);
}

const fieldOfChange = (fields, changeKey) => [...fields.values()].find((f) => f.changeKey === changeKey);

/**
 * Adding or removing a depot rewrites the depot list, and per-depot knobs write into it by position, so the two kinds of
 * change stay exclusive: whichever stands first locks the other until it is reset.
 */
function lockNote(field, changes, fields) {
  let blocking;
  if (field.knob.type === "depots_per_area") blocking = changes.find((c) => /^DEP-[235]\./.test(c.knob));
  else if (field.knob.type === "per_depot_int") blocking = changes.find((c) => c.knob === "DEP-1");
  return blocking === undefined ? null : labels.lockedUntilReset(changeName(fieldOfChange(fields, blocking.knob)));
}

/**
 * Renders the knob panel into `region` (the shell's knobs aside) from `store` and dispatches every change to it.
 * `onRunWindow()` runs when Run window is pressed on a valid window. Returns `{toggle, goToKnob(knobId), destroy}`;
 * the caller places `toggle`, the phone and tablet handle, outside the sheet.
 */
export function mountControls({ store, region, onRunWindow = () => {} }) {
  const typed = new Map(); // field key -> {problem}: text kept as typed and never dispatched (design §7.6)
  const expanded = new Set();
  let layout = currentLayout();
  let open = false;
  let restoreFocus = null;
  let rendered = null;

  const toggle = el("button", { type: "button", class: "fl-button fl-knobs-toggle", "aria-controls": region.id, "aria-expanded": "false", on: { click: () => setOpen(!open) } });
  const closeButton = el("button", { type: "button", class: "fl-button fl-knobs-toggle", on: { click: () => setOpen(false) } }, KNOB_PANEL.closeKnobs);
  const presetText = el("p", { class: "fl-muted" });
  const countText = el("p", { class: "fl-title" });
  const resetAll = el("button", { type: "button", class: "fl-button", "aria-label": KNOB_PANEL.resetAll, on: { click: () => act({ type: "knob/resetAll" }, () => typed.clear()) } }, KNOB_PANEL.reset);
  const changeList = el("ul", {});
  const groups = GROUPS.map(([key, groupName]) => buildGroup(key, groupName));
  const problems = el("div", {});
  const staleText = el("p", { class: "fl-small-label" }, KNOB_PANEL.stale);
  const runButton = el("button", {
    type: "button", class: "fl-button fl-button--primary",
    on: { click: () => { if (runButton.getAttribute("aria-disabled") !== "true") onRunWindow(); } },
  }, KNOB_PANEL.runWindow);

  function act(action, before = () => {}) {
    before();
    store.dispatch(action);
    render(store.getState(), true);
  }

  function buildGroup(key, groupName) {
    const body = el("div", { id: `fleetlab-knob-group-${key}` });
    body.hidden = true;
    const holders = new Map();
    for (const knob of PANEL_KNOBS.filter((k) => k.group === groupName)) {
      const holder = el("div", {});
      holders.set(knob, holder);
      body.appendChild(el("div", { "data-knob": knob.id }, [el("p", { class: "fl-title" }, knob.label), el("p", { class: "fl-small-label" }, knob.help), holder]));
    }
    const button = el("button", {
      type: "button", class: "fl-button", "aria-expanded": "false", "aria-controls": body.id,
      on: { click: () => showGroup(key, !expanded.has(key)) },
    }, KNOB_PANEL.groups[key]);
    return { key, button, body, holders };
  }

  function showGroup(key, show) {
    if (show) expanded.add(key);
    else expanded.delete(key);
    const group = groups.find((g) => g.key === key);
    group.button.setAttribute("aria-expanded", String(show));
    group.body.hidden = !show;
  }

  function setOpen(next) {
    if (next === open) return;
    open = next;
    region.setAttribute("data-open", String(open));
    toggle.setAttribute("aria-expanded", String(open));
    syncSheetInert(region, layout, open);
    if (open) {
      restoreFocus = rememberFocus();
      closeButton.focus();
    } else {
      restoreFocus?.();
      restoreFocus = null;
    }
  }

  function goToKnob(knobId) {
    const knob = KNOBS.find((k) => k.id === knobId);
    if (layout !== "desktop") setOpen(true);
    showGroup(groupKeyOf(knob), true);
    region.querySelector(`[data-knob="${knobId}"] input, [data-knob="${knobId}"] select`)?.focus();
  }

  function setValue(field, engineValue) {
    const scenario = store.getState().scenario;
    const value = field.write ? field.write(scenario, engineValue) : engineValue;
    if (JSON.stringify(value) === JSON.stringify(getIn(scenario, field.path))) return;
    store.dispatch({ type: "knob/set", knob: field.changeKey, path: field.path, value, axis: field.axis });
  }

  function commit(key, text) {
    const field = fieldsOf(store.getState().scenario).get(key);
    const result = parse(field, text);
    if (result.problem === undefined) {
      typed.delete(key);
      setValue(field, result.value);
    } else {
      typed.set(key, { problem: result.problem });
    }
    render(store.getState(), true);
  }

  function stepField(key, direction) {
    const field = fieldsOf(store.getState().scenario).get(key);
    const target = stepTarget(field, direction);
    if (target === null) return;
    typed.delete(key);
    setValue(field, target);
    render(store.getState(), true);
  }

  function buildField(field) {
    if (field.kind === "derived") return el("p", { class: "fl-muted" }, KNOB_PANEL.derived);
    const id = `fleetlab-knob-${field.key.replace(/[^A-Za-z0-9-]/g, "-")}`;
    const control = field.kind === "select"
      ? el("select", { id, on: { change: () => commit(field.key, control.value) } }, field.options.map((o) => el("option", { value: String(o.value) }, o.text)))
      : el("input", { id, type: "text", inputmode: field.kind === "clock" ? "text" : "decimal", autocomplete: "off", class: "fl-mono", on: { input: () => commit(field.key, control.value) } });
    const stepper = (direction) =>
      el("button", { type: "button", class: "fl-button", "data-step": String(direction), on: { click: () => stepField(field.key, direction) } }, direction < 0 ? KNOB_PANEL.minusGlyph : KNOB_PANEL.plusGlyph);
    const input = field.kind === "select"
      ? control
      : el("div", {}, [stepper(-1), control, field.kind === "number" ? el("span", { class: "fl-small-label" }, field.unit) : null, stepper(1)]);
    return el("div", { class: "fl-field", "data-field": field.key, "data-kind": field.kind }, [
      el("label", { for: id }, field.part ?? field.knob.label),
      input,
      el("p", { class: "fl-field__note", id: `${id}-note` }),
    ]);
  }

  function updateField(node, field, state, fields) {
    if (field.kind === "derived") return node;
    const control = node.querySelector("input, select");
    const note = node.querySelector(".fl-field__note");
    const entry = typed.get(field.key);
    const locked = lockNote(field, state.changes, fields);
    const noteText = entry?.problem ?? locked ?? (field.mixed ? KNOB_PANEL.mixedDirections : "");
    const changed = state.changes.some((c) => c.knob === field.changeKey);
    const name = nameOf(field);
    node.setAttribute("class", ["fl-field", changed ? "fl-field--changed" : null, entry ? "fl-field--invalid" : null].filter(Boolean).join(" "));
    control.setAttribute("aria-label", name);
    control.disabled = locked !== null;
    if (field.kind === "select") control.value = String(field.value);
    // Leave a typed text alone while it is invalid, or while it is focused and already reads the stored value ("20.").
    else if (entry === undefined && !(control === document.activeElement && parse(field, control.value).value === field.value)) control.value = display(field);
    if (entry) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
    note.textContent = noteText;
    note.hidden = noteText === "";
    if (noteText === "") control.removeAttribute("aria-describedby");
    else control.setAttribute("aria-describedby", note.id);
    for (const button of node.querySelectorAll("[data-step]")) {
      const direction = Number(button.getAttribute("data-step"));
      button.setAttribute("aria-label", direction < 0 ? labels.stepDown(name) : labels.stepUp(name));
      button.disabled = locked !== null || stepTarget(field, direction) === null;
    }
    return node;
  }

  function buildChange(changeKey) {
    const reset = el("button", {
      type: "button", class: "fl-button",
      on: {
        click: () => act({ type: "knob/reset", knob: changeKey }, () => {
          for (const [key, f] of fieldsOf(store.getState().scenario)) if (f.changeKey === changeKey) typed.delete(key);
        }),
      },
    }, KNOB_PANEL.reset);
    return el("li", {}, [el("span", {}), reset]);
  }

  function updateChange(node, change, fields) {
    const field = fieldOfChange(fields, change.knob);
    const name = changeName(field);
    const [text, reset] = node.children;
    text.textContent = labels.changeItem({ knobName: name, from: valueText(field, change.from), to: valueText(field, change.to) });
    reset.setAttribute("aria-label", labels.resetKnob(name));
    return node;
  }

  function buildProblem(problem) {
    const knob = KNOBS.find((k) => k.id === problem.knob);
    const heading = problem.warning ? labels.INVALID_COMBINATION.warningHeading : labels.INVALID_COMBINATION.heading;
    const slot = (name, value) => [el("p", { class: "fl-error__slot" }, name), el("p", {}, value)];
    return el("div", { class: "fl-error", role: "group", "aria-label": heading }, [
      el("p", { class: "fl-title" }, heading),
      slot(labels.INVALID_COMBINATION.what, problem.what),
      slot(labels.INVALID_COMBINATION.why, problem.why),
      slot(labels.INVALID_COMBINATION.fix, problem.fix),
      knob === undefined ? null : [
        slot(labels.INVALID_COMBINATION.knob, labels.knobPath(KNOB_PANEL.groups[groupKeyOf(knob)], knob.label)),
        el("button", { type: "button", class: "fl-button", on: { click: () => goToKnob(knob.id) } }, KNOB_PANEL.goToKnob),
      ],
    ]);
  }

  /** Renders when the scenario, its changes, the preset or staleness moved; `force` after typing or stepping. */
  function render(state, force = false) {
    const last = rendered;
    const same = last !== null && last.scenario === state.scenario && last.changes === state.changes && last.presetId === state.presetId &&
      last.run.stale === state.run.stale && last.fork.stale === state.fork.stale;
    if (same && !force) return;
    rendered = state;
    const fields = fieldsOf(state.scenario);
    for (const key of typed.keys()) if (!fields.has(key)) typed.delete(key);
    const count = state.changes.length;
    presetText.textContent = labels.presetLine(presetById(state.presetId)?.title ?? state.presetId);
    countText.textContent = count === 0 ? KNOB_PANEL.noChanges : labels.changesCount(count);
    toggle.textContent = labels.knobsDrawer(count);
    resetAll.hidden = count === 0;
    keyedList(changeList, state.changes, {
      key: (c) => c.knob,
      create: (c) => updateChange(buildChange(c.knob), c, fields),
      update: (node, c) => updateChange(node, c, fields),
    });
    const all = [...fields.values()];
    for (const group of groups) {
      for (const [knob, holder] of group.holders) {
        keyedList(holder, all.filter((f) => f.knob === knob), {
          key: (f) => f.key,
          create: (f) => updateField(buildField(f), f, state, fields),
          update: (node, f) => updateField(node, f, state, fields),
        });
      }
    }
    const check = validateScenario(state.scenario);
    problems.replaceChildren(...[...check.errors, ...check.warnings.map((w) => ({ ...w, warning: true }))].map(buildProblem));
    staleText.hidden = !(state.run.stale || state.fork.stale);
    runButton.setAttribute("aria-disabled", String(typed.size > 0 || !check.ok));
  }

  region.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || layout === "desktop" || !open) return;
    event.preventDefault();
    setOpen(false);
  });
  region.replaceChildren(
    el("div", {}, [el("h2", { class: "fl-title" }, KNOB_PANEL.heading), closeButton, presetText, countText, resetAll, changeList]),
    ...groups.flatMap((g) => [g.button, g.body]),
    el("p", { class: "fl-muted" }, KNOB_PANEL.greyed.charging),
    el("p", { class: "fl-muted" }, KNOB_PANEL.greyed.staff),
    problems,
    el("div", { class: "fl-knobs__run" }, [staleText, runButton]),
  );
  region.setAttribute("data-open", "false");
  syncSheetInert(region, layout, open);
  const unsubscribe = store.subscribe((state) => render(state));
  const stopLayout = watchLayout((next) => {
    layout = next;
    syncSheetInert(region, layout, open);
  });
  render(store.getState(), true);
  return {
    toggle,
    goToKnob,
    destroy() {
      unsubscribe();
      stopLayout();
    },
  };
}
