// Knob panel (design §7.6) on the fake DOM with the real default preset.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { installFakeDom } from "./helpers/fake-dom.mjs";
import { presetScenario, windowPayload } from "./helpers/model-payloads.mjs";
import { DEFAULT_PRESET_ID } from "../src/model/presets.js";
import { KNOBS, validateScenario } from "../src/model/schema.js";
import { mountControls } from "../src/ui/controls.js";
import * as labels from "../src/ui/labels.js";
import { createInitialState, createStore } from "../src/ui/store.js";

const { KNOB_PANEL } = labels;
const DESKTOP = { "(min-width: 1280px)": true, "(min-width: 768px)": true };
const BANNED = /\b(predict|forecast|live|real-time|monitoring|wins?|winners?|beats|scores?|gauges?|grades?|leaderboards?|revenue|costs?)\b|expected traffic|better option|best configuration|[\u2013\u2014]/i;

let ctx = null;

function setup({ media = DESKTOP } = {}) {
  const uninstall = installFakeDom(globalThis, { media });
  const { document } = uninstall.dom;
  const region = document.createElement("aside");
  region.setAttribute("id", "fleetlab-region-knobs");
  document.body.appendChild(region);
  const store = createStore(createInitialState({ presetId: DEFAULT_PRESET_ID, scenario: presetScenario() }));
  const runs = [];
  const controls = mountControls({ store, region, onRunWindow: () => runs.push(store.getState().scenario) });
  document.body.appendChild(controls.toggle);
  ctx = { uninstall, dom: uninstall.dom, document, region, store, controls, runs };
  return ctx;
}

afterEach(() => {
  ctx?.controls.destroy();
  ctx?.uninstall();
  ctx = null;
});

const field = (key) => ctx.region.querySelector(`[data-field="${key}"]`);
const control = (key) => field(key).querySelector("input, select");
const note = (key) => field(key).querySelector(".fl-field__note");
const stepper = (key, direction) => field(key).querySelector(`[data-step="${direction}"]`);
const runButton = () => ctx.region.querySelector(".fl-knobs__run button");
const staleText = () => ctx.region.querySelector(".fl-knobs__run p");
const classes = (node) => (node.getAttribute("class") ?? "").split(" ");
const scenario = () => ctx.store.getState().scenario;
const knob = (id) => KNOBS.find((k) => k.id === id);

function type(key, text) {
  const input = control(key);
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function choose(key, value) {
  const select = control(key);
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function accessibleName(node) {
  const aria = node.getAttribute("aria-label");
  if (aria) return aria;
  const id = node.getAttribute("id");
  const label = id ? ctx.document.querySelector(`label[for="${id}"]`) : null;
  return (label ?? node).textContent.trim();
}

describe("knob panel", () => {
  beforeEach(() => setup());

  test("groups follow design 7.6, later knobs are not shown, and greyed groups say what is not modelled", () => {
    const groupButtons = ctx.region.querySelectorAll("button[aria-controls]");
    assert.deepEqual(groupButtons.map((b) => b.textContent), Object.values(KNOB_PANEL.groups));
    const shown = ctx.region.querySelectorAll("[data-knob]").map((n) => n.getAttribute("data-knob"));
    assert.deepEqual(shown, KNOBS.filter((k) => k.firstBuild).map((k) => k.id));
    for (const later of KNOBS.filter((k) => !k.firstBuild)) assert.ok(!shown.includes(later.id), later.id);
    const text = ctx.region.textContent;
    assert.ok(text.includes(KNOB_PANEL.greyed.charging) && text.includes(KNOB_PANEL.greyed.staff));
    assert.ok(text.includes(labels.presetLine("Bay teaching map")));
    assert.ok(text.includes(KNOB_PANEL.noChanges));
  });

  test("every control has an accessible name from labels.js, and no rendered text breaks the copy rules", () => {
    const controls = ctx.region.querySelectorAll("button, input, select");
    assert.ok(controls.length > 200);
    for (const node of controls) {
      const name = accessibleName(node);
      assert.ok(name.length > 0, `a ${node.localName} without a name`);
      assert.doesNotMatch(name, BANNED);
    }
    assert.doesNotMatch(ctx.region.textContent, BANNED);
    const sjCars = labels.knobPart({ knobName: knob("SUP-1").label, part: "SJ" });
    assert.equal(accessibleName(control("SUP-1.SJ")), sjCars);
    assert.equal(accessibleName(stepper("SUP-1.SJ", -1)), labels.stepDown(sjCars));
    assert.equal(accessibleName(stepper("SUP-1.SJ", 1)), labels.stepUp(sjCars));
    assert.equal(accessibleName(control("DEP-4")), knob("DEP-4").label);
    assert.equal(
      accessibleName(control("RD-3.highway.evening")),
      labels.knobPart({ knobName: knob("RD-3").label, part: labels.knobPart({ knobName: KNOB_PANEL.rd3Classes.highway, part: KNOB_PANEL.rd3Periods.evening }) }),
    );
    assert.equal(
      accessibleName(control("DEM-4.morning.SF.PEN")),
      labels.knobPart({ knobName: knob("DEM-4").label, part: labels.weightPart({ period: KNOB_PANEL.weightPeriods.morning, origin: "SF", dest: "PEN" }) }),
    );
    assert.equal(accessibleName(runButton()), KNOB_PANEL.runWindow);
    assert.equal(accessibleName(ctx.controls.toggle), labels.knobsDrawer(0));
  });

  test("units sit beside every number field and seconds show as minutes", () => {
    const numberFields = ctx.region.querySelectorAll('[data-kind="number"]');
    assert.ok(numberFields.length > 100);
    for (const node of numberFields) {
      const unit = node.querySelector(".fl-small-label");
      assert.ok(unit && unit.textContent.length > 0, node.getAttribute("data-field"));
    }
    assert.equal(control("DEP-4").value, "20"); // clean_s 1200 s is 20 min
    assert.equal(field("DEP-4").querySelector(".fl-small-label").textContent, "min");
    assert.equal(field("DEM-3.morning.start").querySelector(".fl-small-label").textContent, KNOB_PANEL.hourOfDay);
    assert.equal(control("POL-3").value, "D2 00:30");
  });

  test("a typed out-of-range value stays in the field, marked and explained, and is never clamped", () => {
    type("DEM-1.SF", "130");
    assert.equal(control("DEM-1.SF").value, "130");
    assert.ok(classes(field("DEM-1.SF")).includes("fl-field--invalid"));
    assert.equal(note("DEM-1.SF").hidden, false);
    assert.equal(note("DEM-1.SF").textContent, labels.outOfRange({ value: "130", min: "1", max: "120", unit: "requests per hour" }));
    assert.equal(control("DEM-1.SF").getAttribute("aria-invalid"), "true");
    assert.equal(control("DEM-1.SF").getAttribute("aria-describedby"), note("DEM-1.SF").getAttribute("id"));
    assert.equal(scenario().areas[0].peak_per_h, 60, "the store keeps the preset value");
    assert.equal(ctx.store.getState().changes.length, 0);
    assert.equal(runButton().getAttribute("aria-disabled"), "true");
    runButton().click();
    assert.equal(ctx.runs.length, 0);

    type("RD-5", "0.07");
    assert.equal(note("RD-5").textContent, labels.notAStep({ value: "0.07", step: "0.05", unit: "σ" }));
    type("POL-4", "D2 11:00");
    assert.equal(note("POL-4").textContent, labels.outOfClockRange({ value: "D2 11:00", min: "D1 05:00", max: "D2 10:00" }));

    type("DEM-1.SF", "70");
    type("RD-5", "0.05");
    type("POL-4", KNOB_PANEL.off);
    assert.equal(scenario().areas[0].peak_per_h, 70);
    assert.equal(scenario().sigma_permille, 50);
    assert.equal(scenario().policies.release_s, null);
    assert.ok(!classes(field("DEM-1.SF")).includes("fl-field--invalid"));
    assert.equal(note("DEM-1.SF").hidden, true);
    assert.equal(runButton().getAttribute("aria-disabled"), "false");
  });

  test("steppers stop at a bound", () => {
    type("DEP-8", "9");
    assert.equal(stepper("DEP-8", 1).disabled, false);
    stepper("DEP-8", 1).click();
    assert.equal(scenario().service_every_visits, 10);
    assert.equal(control("DEP-8").value, "10");
    assert.equal(stepper("DEP-8", 1).disabled, true, "the stepper stops at the maximum");
    stepper("DEP-8", 1).click();
    assert.equal(scenario().service_every_visits, 10);
    stepper("DEP-8", -1).click();
    assert.equal(scenario().service_every_visits, 9);
    // Clean time steps a minute at a time: 20 min is 1200 s.
    stepper("DEP-4", -1).click();
    assert.equal(scenario().clean_s, 1140);
  });

  test("the changes header lists each change with its own reset, and a changed knob gets the ink rule", () => {
    type("DEP-7", "12");
    type("DEP-4", "15");
    const state = ctx.store.getState();
    assert.equal(state.changes.length, 2);
    assert.ok(ctx.region.textContent.includes(labels.changesCount(2)));
    assert.equal(ctx.controls.toggle.textContent, labels.knobsDrawer(2));
    const items = ctx.region.querySelectorAll("ul > li");
    assert.deepEqual(items.map((li) => li.children[0].textContent), [
      labels.changeItem({ knobName: knob("DEP-7").label, from: "10 trips", to: "12 trips" }),
      labels.changeItem({ knobName: knob("DEP-4").label, from: "20 min", to: "15 min" }),
    ]);
    assert.ok(classes(field("DEP-7")).includes("fl-field--changed"));
    assert.ok(!classes(field("DEP-6")).includes("fl-field--changed"));

    const reset = items[0].children[1];
    assert.equal(reset.getAttribute("aria-label"), labels.resetKnob(knob("DEP-7").label));
    reset.click();
    assert.deepEqual(ctx.store.getState().changes.map((c) => c.knob), ["DEP-4"]);
    assert.equal(control("DEP-7").value, "10");
    assert.equal(scenario().trips_between_visits, 10);
    assert.ok(!classes(field("DEP-7")).includes("fl-field--changed"));
    assert.ok(classes(field("DEP-4")).includes("fl-field--changed"));
    assert.equal(ctx.region.querySelectorAll("ul > li").length, 1);
  });

  test("per-area, per-depot, policy, congestion and depot-count knobs write the store with their axes", () => {
    const original = presetScenario();
    type("SUP-1.SJ", "16");
    type("DEP-3.SJ-1", "1");
    choose("POL-2", "nearest_depot");
    assert.equal(scenario().areas[2].cars, 16);
    assert.equal(scenario().depots.find((d) => d.id === "SJ-1").cleaning_bays, 1);
    assert.equal(scenario().policies.depot_assignment, "nearest_depot");
    assert.deepEqual(ctx.store.getState().changes.map((c) => [c.knob, c.axis]), [
      ["SUP-1.SJ", "parameter:SUP-1.SJ"],
      ["DEP-3.SJ-1", "parameter:DEP-3.SJ-1"],
      ["POL-2", "policy:depot_assignment"],
    ]);

    // Highway evening differs by direction in the preset (1.6 away from SF, 1.2 toward); one value sets both.
    assert.equal(control("RD-3.highway.evening").value, "1.6");
    assert.equal(note("RD-3.highway.evening").textContent, KNOB_PANEL.mixedDirections);
    type("RD-3.highway.evening", "2");
    for (const row of Object.values(scenario().congestion.HIGHWAY)) {
      for (const h of [16, 17, 18, 40, 41, 42]) assert.equal(row[h], 2000);
    }
    assert.deepEqual(scenario().congestion.HIGHWAY["SF>PEN"].slice(0, 9), original.congestion.HIGHWAY["SF>PEN"].slice(0, 9));
    assert.deepEqual(scenario().congestion.LOCAL, original.congestion.LOCAL);
    const change = ctx.store.getState().changes.at(-1);
    assert.deepEqual([change.knob, change.axis], ["RD-3.highway", "parameter:RD-3.highway.evening"]);
    const highwaysName = labels.knobPart({ knobName: knob("RD-3").label, part: KNOB_PANEL.rd3Classes.highway });
    ctx.region.querySelectorAll("ul > li button").find((b) => b.getAttribute("aria-label") === labels.resetKnob(highwaysName)).click();
    assert.deepEqual(scenario().congestion, original.congestion);

    // Adding a depot is locked while a per-depot change stands, and the other way round.
    assert.equal(control("DEP-1.PEN").disabled, true);
    assert.equal(note("DEP-1.PEN").textContent, labels.lockedUntilReset(labels.knobPart({ knobName: knob("DEP-3").label, part: "SJ-1" })));
    ctx.region.querySelector(`button[aria-label="${KNOB_PANEL.resetAll}"]`).click();
    assert.deepEqual(scenario(), original);
    choose("DEP-1.PEN", "1");
    assert.deepEqual(scenario().depots.map((d) => d.id), ["SF-1", "SF-2", "PEN-1", "SJ-1", "EB-1"]);
    assert.equal(control("DEP-2.SJ-1").disabled, true);
    assert.equal(note("DEP-2.SJ-1").textContent, labels.lockedUntilReset(knob("DEP-1").label));
    assert.equal(ctx.region.querySelectorAll("ul > li")[0].children[0].textContent, labels.changeItem({
      knobName: knob("DEP-1").label, from: "SF-1, SF-2, SJ-1, EB-1", to: "SF-1, SF-2, PEN-1, SJ-1, EB-1",
    }));
  });

  test("invalid combinations fill the four slots, block Run window, and Go to knob focuses the knob", () => {
    for (const area of ["SF", "PEN", "SJ", "EB"]) type(`SUP-1.${area}`, "0");
    const expected = validateScenario(scenario()).errors.find((e) => e.what === "Total cars: 0");
    assert.ok(expected, "the model reports the empty fleet");
    const block = ctx.region.querySelectorAll(".fl-error").find((node) => node.textContent.includes(expected.what));
    assert.ok(block, "a four-slot block is shown");
    const INVALID = labels.INVALID_COMBINATION;
    assert.deepEqual(block.children.filter((n) => n.localName === "p").map((n) => n.textContent), [
      INVALID.heading, INVALID.what, expected.what, INVALID.why, expected.why, INVALID.fix, expected.fix,
      INVALID.knob, labels.knobPath(KNOB_PANEL.groups.fleet, knob("SUP-1").label),
    ]);
    assert.equal(runButton().getAttribute("aria-disabled"), "true");
    const fleetBody = ctx.document.getElementById("fleetlab-knob-group-fleet");
    assert.equal(fleetBody.hidden, true);
    block.querySelector("button").click();
    assert.equal(fleetBody.hidden, false);
    assert.equal(ctx.document.activeElement, control("SUP-1.SF"));
  });

  test("results from before a change read Out of date: Run window, and Run window runs a valid window", async () => {
    const payload = await windowPayload();
    assert.equal(staleText().hidden, true);
    ctx.store.dispatch({ type: "run/queued", id: "w1", total: 2 });
    ctx.store.dispatch({ type: "run/done", id: "w1", payload });
    assert.equal(staleText().hidden, true);
    type("DEP-7", "12");
    assert.equal(staleText().hidden, false);
    assert.equal(staleText().textContent, KNOB_PANEL.stale);
    runButton().click();
    assert.equal(ctx.runs.length, 1);
    assert.equal(ctx.runs[0].trips_between_visits, 12);
  });
});

describe("knob sheet on a phone and tablet", () => {
  test("the sheet is inert only while it is off screen; Escape closes it and focus returns to the handle", () => {
    setup({ media: {} });
    const { region, controls, document, dom } = ctx;
    assert.equal(region.hasAttribute("inert"), true);
    controls.toggle.focus();
    controls.toggle.click();
    assert.equal(region.hasAttribute("inert"), false);
    assert.equal(region.getAttribute("data-open"), "true");
    assert.equal(controls.toggle.getAttribute("aria-expanded"), "true");
    assert.equal(document.activeElement.textContent, KNOB_PANEL.closeKnobs);
    document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.equal(region.hasAttribute("inert"), true);
    assert.equal(region.getAttribute("data-open"), "false");
    assert.equal(document.activeElement, controls.toggle);
    dom.media.set("(min-width: 768px)", true);
    assert.equal(region.hasAttribute("inert"), true, "a closed tablet drawer is off screen");
    dom.media.set("(min-width: 1280px)", true);
    assert.equal(region.hasAttribute("inert"), false, "the desktop column is always on screen");
  });
});
