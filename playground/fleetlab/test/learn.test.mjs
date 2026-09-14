// Learn mode interface (src/ui/learn.js, design §4.1): cases, moments that set the clock and pin a car, captions from
// labels.js, the differences from the Bay teaching map, and "Test it properly" opening Experiment with the axis.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { freezeSpec } from "../src/model/experiment.js";
import { DEFAULT_PRESET_ID, presetById } from "../src/model/presets.js";
import { REFERENCE_PANELS } from "../src/model/reference-panels.js";
import { describeDifferences } from "../src/model/schema.js";
import { differenceText, specDraftOf } from "../src/ui/experiment.js";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import * as learn from "../src/ui/learn.js";
import { createInitialState, createStore } from "../src/ui/store.js";
import { installFakeDom } from "./helpers/fake-dom.mjs";

const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const BANNED_WORDS = /\b(predict|forecast|live|real-time|realtime|real time|monitoring)\b|expected traffic/i;
const H6_WORDS = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const DASHES = /[\u2013\u2014]/; // en dash, em dash

function withDom(fn) {
  const uninstall = installFakeDom();
  try {
    return fn(uninstall.dom);
  } finally {
    uninstall();
  }
}

function mounted() {
  const base = presetById(DEFAULT_PRESET_ID);
  const store = createStore(createInitialState({ presetId: base.id, scenario: base.scenario }));
  const container = document.createElement("div");
  document.body.appendChild(container);
  learn.mountLearn(container, { store });
  return { store, container };
}

describe("Learn cases joined with their presets", () => {
  for (const id of ["L1", "L2", "L3"]) {
    test(`${id}: three to five moments at the preset's clocks, each pinning a car of the preset's fleet`, () => {
      const c = learn.learnCase(id);
      const preset = presetById(c.presetId);
      const entry = labels.LEARN_CASES.find((x) => x.id === id);
      assert.ok(c.moments.length >= 3 && c.moments.length <= 5);
      assert.equal(c.question, entry.question);
      assert.deepEqual(c.moments.map((m) => m.key), preset.moments.map((m) => m.captionKey));
      assert.deepEqual(c.moments.map((m) => m.clock_s), preset.moments.map((m) => m.clock_s));
      assert.deepEqual(c.moments.map((m) => m.title), entry.moments.map((m) => m.title));
      for (const m of c.moments) assert.equal(m.caption, labels.learnCaption(m.key));
      // A car id is its home area and its number in that area (design SUP-2): SF-017 is the 17th SF car.
      const [area, number] = c.car.split("-");
      const cars = preset.scenario.areas.find((a) => a.id === area).cars;
      assert.ok(Number(number) >= 1 && Number(number) <= cars, `${c.car} is one of ${String(cars)} ${area} cars`);
      for (const presetId of c.presetIds) assert.equal(presetById(presetId).learnCase, id);
    });
  }

  test("L3 pins SF-017, the worked example's car, and L2 plays both preregistered specs", () => {
    assert.equal(learn.learnCase("L3").car, "SF-017");
    assert.deepEqual(learn.learnCase("L2").presetIds, ["L2a", "L2b"]);
    assert.throws(() => learn.learnCase("L4"), RangeError);
  });
});

describe("Learn view", () => {
  test("choosing a case loads its preset, sets the first moment's clock and pins its car", () => {
    withDom(() => {
      const { store, container } = mounted();
      assert.equal(container.querySelector("p.fl-learn-text").textContent, labels.LEARN.chooseCase);
      container.querySelector('[data-case="L3"]').click();
      const s = store.getState();
      const c = learn.learnCase("L3");
      assert.equal(s.mode, "learn");
      assert.equal(s.presetId, "L3");
      assert.deepEqual(s.scenario, presetById("L3").scenario);
      assert.deepEqual(s.learn, { case: "L3", moment: 0 });
      assert.equal(s.clock_s, c.moments[0].clock_s);
      assert.equal(s.fork.pinnedCar, "SF-017");
      assert.deepEqual(s.selection, { car: "SF-017" });
      assert.equal(container.querySelector('[data-role="question"]').textContent, c.question);
      assert.equal(container.querySelector('[data-role="pinned-car"]').textContent, labels.learnPinnedCar("SF-017"));
      assert.equal(container.querySelector('[data-role="caption"] [data-key]').textContent, c.moments[0].caption);
      const buttons = container.querySelectorAll("[data-moment]");
      assert.deepEqual(buttons.map((b) => b.textContent), c.moments.map((m) => labels.momentLine({ clock: format.clock(m.clock_s), title: m.title })));
      assert.equal(buttons[0].getAttribute("aria-current"), "step");
      assert.equal(container.querySelector('[data-role="previous"]').disabled, true);
    });
  });

  test("a moment sets the clock, stops playback and keeps the car pinned; next and previous walk the moments", () => {
    withDom(() => {
      const { store, container } = mounted();
      container.querySelector('[data-case="L1"]').click();
      store.dispatch({ type: "playback/play" });
      const c = learn.learnCase("L1");
      container.querySelector('[data-moment="2"]').click();
      let s = store.getState();
      assert.equal(s.clock_s, c.moments[2].clock_s);
      assert.equal(s.playing, false);
      assert.equal(s.learn.moment, 2);
      assert.equal(s.fork.pinnedCar, c.car);
      assert.equal(container.querySelector('[data-role="caption"] .fl-small-label').textContent, labels.momentPosition(3, c.moments.length));
      container.querySelector('[data-role="next"]').click();
      s = store.getState();
      assert.equal(s.learn.moment, 3);
      assert.equal(container.querySelector('[data-role="next"]').disabled, true);
      container.querySelector('[data-role="previous"]').click();
      assert.equal(store.getState().clock_s, c.moments[2].clock_s);
    });
  });

  test("L2's first moment opens the exploratory probe panel with its §1.3 label", () => {
    withDom(() => {
      const { store, container } = mounted();
      container.querySelector('[data-case="L2"]').click();
      assert.equal(store.getState().reference, "probe");
      const panel = container.querySelector('article.fl-verdict[data-panel="probe"]');
      assert.equal(panel.querySelector('[data-role="teaching-chip"]').textContent, labels.HONESTY.twoZoneProbePanel);
      assert.equal(container.querySelector('[data-role="note"]').textContent, labels.LEARN_CASES[1].note);
    });
  });

  test("Learn never shows a teaching-run verdict and never hides a knob its preset changed", () => {
    withDom(() => {
      const { container } = mounted();
      for (const id of ["L1", "L3"]) {
        container.querySelector(`[data-case="${id}"]`).click();
        assert.equal(container.querySelector("article.fl-verdict"), null, `${id} shows no verdict card`);
        const expected = describeDifferences(presetById(DEFAULT_PRESET_ID).scenario, presetById(id).scenario);
        assert.ok(expected.length > 0, `${id} differs from the Bay teaching map (design §4.1)`);
        const items = container.querySelectorAll('[data-role="learn-differences"] li');
        assert.deepEqual(items.map((li) => li.textContent), expected.map(differenceText));
      }
      // L1 lowers San Francisco's off-peak requests from 15 to 8 per hour.
      assert.equal(differenceText({ knob: "DEM-2.SF", from: 15, to: 8 }), labels.changeItem({ knobName: "Off-peak requests per area, SF", from: "15 requests per hour", to: "8 requests per hour" }));
    });
  });

  test("Test it properly opens Experiment with the preset's axis and the exact spec its preset declares", () => {
    withDom(() => {
      const { store, container } = mounted();
      container.querySelector('[data-case="L3"]').click();
      const button = container.querySelector('[data-role="test-it-properly"] button');
      assert.equal(button.textContent, labels.EXPERIMENT_SETUP.testItProperly);
      button.click();
      const s = store.getState();
      const x = presetById("L3").experiment;
      assert.equal(s.mode, "experiment");
      assert.deepEqual(s.experiment.draft.axis, x.axis);
      assert.deepEqual(s.experiment.draft.primary, x.primary);
      assert.deepEqual(s.experiment.draft.guardrails, x.guardrails);
      assert.deepEqual(s.experiment.draft.baselineScenario, x.scenario);
      assert.equal(s.experiment.draft.axisSource, "learn");
      assert.equal(freezeSpec(specDraftOf(s.experiment.draft)).digest, freezeSpec(x).digest);
    });
  });

  test("L2 offers Test it properly for each preregistered spec, and each fills its own guardrails", () => {
    withDom(() => {
      const { store, container } = mounted();
      container.querySelector('[data-case="L2"]').click();
      const buttons = container.querySelectorAll('[data-role="test-it-properly"] button');
      assert.deepEqual(buttons.map((b) => b.textContent), ["L2a", "L2b"].map((id) => labels.testItProperlyFor(presetById(id).title)));
      buttons[1].click();
      assert.deepEqual(store.getState().experiment.draft.guardrails, presetById("L2b").experiment.guardrails);
      assert.equal(freezeSpec(specDraftOf(store.getState().experiment.draft)).digest, freezeSpec(presetById("L2b").experiment).digest);
    });
  });

  test("rendered Learn copy follows the copy rules and uses only classes styles.css defines", () => {
    withDom(() => {
      const { container } = mounted();
      for (const id of ["L1", "L2", "L3"]) {
        container.querySelector(`[data-case="${id}"]`).click();
        const texts = [container.textContent];
        for (const node of [container, ...container.descendants()]) {
          for (const name of ["aria-label", "title"]) if (node.getAttribute?.(name)) texts.push(node.getAttribute(name));
          for (const cls of (node.getAttribute?.("class") ?? "").split(/\s+/).filter(Boolean)) {
            assert.match(CSS, new RegExp(`\\.${cls}(?![\\w-])`), `styles.css defines .${cls}`);
          }
        }
        for (const text of texts) {
          assert.ok(!DASHES.test(text) && !BANNED_WORDS.test(text) && !H6_WORDS.test(text), text.slice(0, 120));
        }
      }
    });
  });
});

describe("Learn captions name views that are on screen (review: honesty-copy lens)", () => {
  test("L2's first moment keeps the probe's depot queue row visible beside its primary, as its caption asks", () => {
    withDom(() => {
      const { container } = mounted();
      container.querySelector('[data-case="L2"]').click();
      assert.equal(container.querySelector('[data-role="caption"] [data-key]').getAttribute("data-key"), "learn.L2.m1");
      const panel = container.querySelector('article.fl-verdict[data-panel="probe"]');
      assert.ok(panel.querySelector('[data-field="primary.metric"]'), "the primary row is shown");
      for (const metric of learn.MOMENT_REFERENCE_ROWS["learn.L2.m1"]) {
        const row = panel.querySelectorAll('[data-section="descriptives"] tbody tr').find((r) => r.getAttribute("data-metric") === metric);
        assert.ok(row, `${metric} is a row of the probe panel`);
        assert.equal(row.inHiddenOrInert(), false, `${metric} is visible without pressing all rows`);
      }
      assert.ok(labels.LEARN_LOOK["learn.L2.m1"].includes("depot queue row"));
    });
  });

  test("every row a moment keeps visible belongs to the panel that moment opens", () => {
    for (const [key, metrics] of Object.entries(learn.MOMENT_REFERENCE_ROWS)) {
      const panel = REFERENCE_PANELS[learn.MOMENT_REFERENCES[key]];
      for (const metric of metrics) assert.ok(panel.descriptives.some((d) => d.metric === metric), `${key}: ${metric}`);
    }
  });

  test("a look sentence that reads a depot's lot in a lane names a depot the case's fork draws in both lanes", () => {
    let named = 0;
    for (const c of labels.LEARN_CASES) {
      for (const m of c.moments) {
        const match = labels.LEARN_LOOK[m.key].match(/([A-Z]{2,3}-[0-9]+)'s lot in lane [AB]/);
        if (match === null) continue;
        named += 1;
        assert.ok((learn.LEARN_FORK_DEPOTS[c.id] ?? []).includes(match[1]), `${m.key}: the ${c.id} fork draws ${match[1]}`);
        assert.ok(presetById(learn.learnCase(c.id).presetId).scenario.depots.some((d) => d.id === match[1]));
      }
    }
    assert.ok(named >= 1, "L3's second moment reads SJ-1's lot in lane B");
  });
});
