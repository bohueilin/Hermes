// Learn mode (design §4.1, §7.1, H-9): the three guided cases L1, L2 and L3. Each case has its question, its preset (L2
// has two preregistered presets), three to five named moments at the preset's clocks, two-sentence captions from
// labels.js, and "Test it properly", which opens Experiment with the preset's axis filled in. Learn never shows a
// verdict and never hides a knob it changed: the differences from the Bay teaching map are always listed.
//
// Decisions this module makes where the design is silent (reported with the build):
// - Every moment pins one car per case: SF-005 in L3, SF-001 in L1 (the largest area's first car) and SJ-001 in L2 (the
//   question is about San Jose). L3 pins the car the fork's replay shows due a visit in San Jose (D1 17:13, seed 1001);
//   SF-017 of design §3.5 is the single-car fixture's car and never finishes a San Jose trip in the full replay.
// - L2's first moment opens the exploratory two-zone probe panel (design §4.2 walkthrough) with its depot queue row kept
//   visible in the preview, because the moment's caption reads that row beside the primary.
// - The L3 fork also draws SJ-1's lot held and queue in lanes A and B (design UC-07 "19:30, SJ-1's lot in B").
// - "Test it properly" fills the Experiment draft from the preset's experiment, including its declared scenario (the
//   Experiment travel variation of design §2.5), so the setup sheet lists that difference from the Learn preset.

import { DEFAULT_PRESET_ID, presetById } from "../model/presets.js";
import { cloneScenario, describeDifferences } from "../model/schema.js";
import { el } from "./dom.js";
import { differenceText, presetDraft, renderReferencePanel } from "./experiment.js";
import * as format from "./format.js";
import * as labels from "./labels.js";

/** The presets of each Learn case, in order; the first is the one Learn plays. */
export const LEARN_PRESETS = Object.freeze({ L1: Object.freeze(["L1"]), L2: Object.freeze(["L2a", "L2b"]), L3: Object.freeze(["L3"]) });

/** The car each Learn case pins at every moment. */
export const LEARN_PINNED_CARS = Object.freeze({ L1: "SF-001", L2: "SJ-001", L3: "SF-005" });

/** The reference panel a moment opens, by moment key. */
export const MOMENT_REFERENCES = Object.freeze({ "learn.L2.m1": "probe" });

/** Descriptive rows of that panel a moment's caption reads, kept visible in the panel's preview, by moment key. */
export const MOMENT_REFERENCE_ROWS = Object.freeze({ "learn.L2.m1": Object.freeze(["depot.queue_p90_s"]) });

/** Depots whose lot held and queue the fork draws in both lanes for a Learn case, by case id. */
export const LEARN_FORK_DEPOTS = Object.freeze({ L3: Object.freeze(["SJ-1"]) });

/**
 * A Learn case joined with its presets: `{id, title, question, concept, note, presetIds, presetId, car, moments}` where
 * each moment is `{key, index, title, clock_s, car, reference, caption}` (clock in seconds from day 1 00:00). Throws when
 * labels.js and the preset disagree on the moments.
 */
export function learnCase(caseId) {
  const entry = labels.LEARN_CASES.find((c) => c.id === caseId);
  const presetIds = LEARN_PRESETS[caseId];
  if (entry === undefined || presetIds === undefined) throw new RangeError(`unknown Learn case ${String(caseId)}`);
  const preset = presetById(presetIds[0]);
  if (preset === null || preset.learnCase !== caseId) throw new Error(`preset ${presetIds[0]} is not Learn case ${caseId}`);
  if (preset.moments.length !== entry.moments.length) {
    throw new Error(`Learn case ${caseId}: labels.js names ${String(entry.moments.length)} moments, the preset has ${String(preset.moments.length)}`);
  }
  const car = LEARN_PINNED_CARS[caseId];
  const moments = entry.moments.map((m, index) => {
    const pm = preset.moments[index];
    if (pm.captionKey !== m.key) throw new Error(`Learn case ${caseId}: moment ${String(index + 1)} is ${pm.captionKey} in the preset and ${m.key} in labels.js`);
    return { key: m.key, index, title: m.title, clock_s: pm.clock_s, car, reference: MOMENT_REFERENCES[m.key] ?? null, caption: labels.learnCaption(m.key) };
  });
  return { id: entry.id, useCase: entry.useCase, title: entry.title, question: entry.question, concept: entry.concept, note: entry.note ?? null, presetIds: [...presetIds], presetId: presetIds[0], car, moments };
}

/** Open a Learn case: its preset's scenario, the first moment's clock and the pinned car. */
export function openLearnCase(dispatch, caseId) {
  const c = learnCase(caseId);
  const preset = presetById(c.presetId);
  dispatch({ type: "preset/select", presetId: preset.id, scenario: cloneScenario(preset.scenario) });
  dispatch({ type: "learn/case", caseId, clock_s: c.moments[0].clock_s });
  goToMoment(dispatch, caseId, 0);
  return c;
}

/** Go to moment `index` of a case: set the clock, pin and select its car, and open its reference panel if it has one. */
export function goToMoment(dispatch, caseId, index) {
  const c = learnCase(caseId);
  const moment = c.moments[index];
  if (moment === undefined) throw new RangeError(`Learn case ${caseId} has no moment ${String(index)}`);
  dispatch({ type: "learn/moment", index, clock_s: moment.clock_s });
  dispatch({ type: "fork/pin", car: moment.car });
  dispatch({ type: "selection/set", selection: { car: moment.car } });
  if (moment.reference !== null) dispatch({ type: "reference/open", id: moment.reference });
  return moment;
}

/** "Test it properly": open Experiment with a Learn preset's axis, primary, guardrails, seeds and declared scenario. */
export function testItProperly(dispatch, presetId) {
  const preset = presetById(presetId);
  if (preset === null || preset.kind !== "learn" || preset.experiment === null) throw new RangeError(`preset ${String(presetId)} is not a Learn preset`);
  // One action: the declared scenario arrives with the draft, so the store records it as the preset's own baseline.
  dispatch({ type: "learn/testItProperly", draft: presetDraft(presetId) });
  return structuredClone(preset.experiment);
}

// ---------------------------------------------------------------------------------------------------------------
// View.

function caseChooser(state, dispatch) {
  return el("div", { role: "group", "aria-label": labels.LEARN.casesName, "data-role": "cases" }, labels.LEARN_CASES.map((c) =>
    el("button", {
      type: "button",
      class: "fl-button",
      "data-case": c.id,
      "aria-pressed": state.learn.case === c.id ? "true" : "false",
      on: { click: () => openLearnCase(dispatch, c.id) },
    }, `${c.id} ${c.title}`),
  ));
}

function differencesList(presetId) {
  const base = presetById(DEFAULT_PRESET_ID);
  const differences = describeDifferences(base.scenario, presetById(presetId).scenario);
  return el("section", { "data-role": "learn-differences" }, [
    el("h3", { class: "fl-title" }, labels.LEARN.differences),
    differences.length === 0
      ? el("p", { class: "fl-muted" }, labels.LEARN.noDifferences)
      : el("ul", {}, differences.map((d) => el("li", { "data-knob": d.knob }, differenceText(d)))),
  ]);
}

/** The Learn view of `state` as one node; `dispatch` receives the store actions of moments and Test it properly. */
export function renderLearn(state, { dispatch, ui = { open: new Set() }, rerender = () => {} } = {}) {
  const children = [el("h2", { class: "fl-title" }, labels.LEARN.heading), caseChooser(state, dispatch)];
  if (state.learn.case === null) {
    children.push(el("p", { class: "fl-learn-text fl-muted" }, labels.LEARN.chooseCase));
    return el("section", { class: "fl-panel", "data-role": "learn", "aria-label": labels.LEARN.heading }, children);
  }
  const c = learnCase(state.learn.case);
  const current = c.moments[Math.min(state.learn.moment, c.moments.length - 1)];
  children.push(
    el("h3", { class: "fl-title" }, `${c.id} ${c.title}`),
    el("p", { class: "fl-learn-text" }, [el("span", { class: "fl-small-label" }, `${labels.LEARN.question} `), el("span", { "data-role": "question" }, c.question)]),
    el("p", { class: "fl-learn-text" }, [el("span", { class: "fl-small-label" }, `${labels.LEARN.concept} `), el("span", {}, c.concept)]),
    c.note === null ? null : el("p", { class: "fl-muted", "data-role": "note" }, c.note),
    el("p", { class: "fl-mono", "data-role": "pinned-car" }, labels.learnPinnedCar(c.car)),
    el("ol", { "aria-label": labels.LEARN.momentsName, "data-role": "moments" }, c.moments.map((m) =>
      el("li", {}, el("button", {
        type: "button",
        class: "fl-button",
        "data-moment": String(m.index),
        "aria-current": m.index === current.index ? "step" : null,
        on: { click: () => goToMoment(dispatch, c.id, m.index) },
      }, labels.momentLine({ clock: format.clock(m.clock_s), title: m.title }))),
    )),
    el("section", { "data-role": "caption", "aria-live": "polite" }, [
      el("p", { class: "fl-small-label" }, labels.momentPosition(current.index + 1, c.moments.length)),
      el("p", { class: "fl-learn-text", "data-key": current.key }, current.caption),
    ]),
    el("div", { role: "group" }, [
      el("button", { type: "button", class: "fl-button", "data-role": "previous", disabled: current.index === 0, on: { click: () => goToMoment(dispatch, c.id, current.index - 1) } }, labels.LEARN.previousMoment),
      el("button", { type: "button", class: "fl-button", "data-role": "next", disabled: current.index === c.moments.length - 1, on: { click: () => goToMoment(dispatch, c.id, current.index + 1) } }, labels.LEARN.nextMoment),
    ]),
    differencesList(c.presetId),
    el("div", { role: "group", "data-role": "test-it-properly" }, c.presetIds.map((presetId) =>
      el("button", {
        type: "button",
        class: "fl-button fl-button--primary",
        "data-preset": presetId,
        on: { click: () => testItProperly(dispatch, presetId) },
      }, c.presetIds.length === 1 ? labels.EXPERIMENT_SETUP.testItProperly : labels.testItProperlyFor(presetById(presetId).title)),
    )),
  );
  if (state.reference !== null) {
    const showRows = current.reference === state.reference ? [...(MOMENT_REFERENCE_ROWS[current.key] ?? [])] : [];
    children.push(renderReferencePanel(state.reference, { onClose: () => dispatch({ type: "reference/close" }), ui, rerender, showRows }));
  }
  return el("section", { class: "fl-panel", "data-role": "learn", "aria-label": labels.LEARN.heading }, children);
}

/** Mounts Learn in `container` over `store`; re-renders on every state change. Returns `{render, destroy}`. */
export function mountLearn(container, { store } = {}) {
  if (!store || typeof store.dispatch !== "function") throw new TypeError("mountLearn needs a store");
  const ui = { open: new Set() };
  const dispatch = (action) => store.dispatch(action);
  const render = () => container.replaceChildren(renderLearn(store.getState(), { dispatch, ui, rerender: render }));
  const unsubscribe = store.subscribe(() => render());
  render();
  return { render, destroy: () => unsubscribe() };
}
