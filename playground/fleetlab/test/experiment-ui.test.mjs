// Experiment mode interface (src/ui/experiment.js): the setup sheet and its checks, Freeze and run, the freeze rule,
// the session log, the verdict card against real run_experiment payloads and computeVerdict results, NOT EVALUABLE,
// invalid verdicts, the copied result summary and the two quoted FleetLab reference panels.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { guardrailStatuses } from "../src/instrument/guardrails.js";
import { computeVerdict } from "../src/instrument/paired.js";
import { resultSummary, summaryText } from "../src/instrument/summary.js";
import { freezeSpec, isNullCheckDraft, thresholdValue } from "../src/model/experiment.js";
import { DEFAULT_PRESET_ID, OPS_THEME_IDS, opsPresetsOf, presetById, seedSet } from "../src/model/presets.js";
import { REFERENCE_PANELS } from "../src/model/reference-panels.js";
import { cloneScenario, describeDifferences } from "../src/model/schema.js";
import { tabbables } from "../src/ui/a11y.js";
import * as charts from "../src/ui/charts.js";
import * as experiment from "../src/ui/experiment.js";
import * as format from "../src/ui/format.js";
import * as labels from "../src/ui/labels.js";
import * as learn from "../src/ui/learn.js";
import { createInitialState, createStore, largestDeltaSeed, medianDeltaSeed } from "../src/ui/store.js";
import { installFakeDom, serialize } from "./helpers/fake-dom.mjs";
import { experimentDraft, experimentPayload, frozenExperiment, runThroughWorkerHandler } from "./helpers/model-payloads.mjs";

const FIXTURE = JSON.parse(readFileSync(new URL("../../../tests/fixtures/fleet_playground/reference_panels.json", import.meta.url), "utf8"));
const CSS = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const PHONE = "(max-width: 767.98px)";

const BANNED_WORDS = /\b(predict|forecast|live|real-time|realtime|real time|monitoring)\b|expected traffic/i;
const H6_WORDS = /\b(wins?|winners?|beats|scores?|scoring|gauges?|grades?|leaderboards?|revenue|costs?)\b|better option|best configuration/i;
const DASHES = /[\u2013\u2014]/; // en dash, em dash

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Runs `fn(dom)` with the fake DOM installed, and always uninstalls it. */
async function withDom(options, fn) {
  const uninstall = installFakeDom(globalThis, options);
  try {
    return await fn(uninstall.dom);
  } finally {
    uninstall();
  }
}

/** A store in Experiment mode whose draft is a preset's experiment draft (or `draft`) with `seedCount` seeds. */
function presetStore(presetId, { replications = 10, draft = experimentDraft({ presetId, replications }) } = {}) {
  const store = createStore(createInitialState({ presetId, scenario: draft.scenario }));
  store.dispatch({ type: "mode/set", mode: "experiment" });
  store.dispatch({
    type: "experiment/draft",
    patch: { question: draft.question, axis: draft.axis, primary: draft.primary, guardrails: draft.guardrails, seedSet: draft.seed_set, seedCount: draft.seeds.length, resamples: draft.resamples },
  });
  return store;
}

/** A host that answers run_experiment with `payloadFor(spec)` and records every call. */
function fakeHost({ path = "worker", payloadFor }) {
  const host = {
    path,
    calls: [],
    progress: [],
    cancelled: [],
    last: null,
    runExperiment(args, options) {
      host.calls.push(args);
      const marker = { done: 1, total: 2 * args.spec.seeds.length + 3, label: "Seed 1 of 10, baseline arm" };
      host.progress.push(marker);
      options.onProgress(marker);
      const promise = Promise.resolve(payloadFor(args.spec));
      promise.id = `run-${String(host.calls.length)}`;
      host.last = promise;
      return promise;
    },
    cancel(id) {
      host.cancelled.push(id);
    },
  };
  return host;
}

function mount(store, options = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const view = experiment.mountExperiment(container, { store, now: () => "14:02", matchMedia: (query) => window.matchMedia(query), ...options });
  return { container, view };
}

async function freezeByClick(container, host) {
  const button = container.querySelector('[data-role="freeze"]');
  assert.equal(button.disabled, false, "Freeze and run is enabled");
  button.click();
  await host.last;
  await tick();
  await tick();
}

const valueOf = (root, field) => {
  const node = root.querySelector(`[data-field="${field}"]`);
  assert.ok(node, `a value for ${field}`);
  return Number(node.getAttribute("data-value"));
};

const same = (actual, expected, what) => assert.ok(actual === expected, `${what}: ${String(actual)} is not ${String(expected)}`);

const checksOf = (container) =>
  Object.fromEntries(container.querySelectorAll('[data-role="checks"] li').map((li) => [li.getAttribute("data-check"), li.getAttribute("data-passes") === "true"]));

/** Every readable string of a subtree: its text and its aria-label and title values. */
function readable(root) {
  const out = [root.textContent];
  for (const node of [root, ...root.descendants()]) {
    for (const name of ["aria-label", "title"]) {
      const value = node.getAttribute?.(name);
      if (value) out.push(value);
    }
  }
  return out;
}

function assertCopyRules(root) {
  for (const text of readable(root)) {
    assert.ok(!DASHES.test(text), `no em or en dash: ${text.slice(0, 80)}`);
    assert.ok(!BANNED_WORDS.test(text), `no H-3 word: ${text.match(BANNED_WORDS)?.[0]}`);
    assert.ok(!H6_WORDS.test(text), `no H-6 word: ${text.match(H6_WORDS)?.[0]}`);
  }
}

function assertClassesDefined(root) {
  for (const node of [root, ...root.descendants()]) {
    for (const name of (node.getAttribute?.("class") ?? "").split(/\s+/).filter(Boolean)) {
      assert.match(CSS, new RegExp(`\\.${name}(?![\\w-])`), `styles.css defines .${name}`);
    }
  }
}

/** A store with a finished teaching-run verdict for `presetId`, run through Freeze and run. */
async function finishedRun(presetId, options = {}) {
  const payload = await experimentPayload({ presetId });
  const store = presetStore(presetId);
  const host = fakeHost({ payloadFor: () => payload });
  const { container, view } = mount(store, { host, ...options });
  await freezeByClick(container, host);
  return { payload, store, host, container, view };
}

// ---------------------------------------------------------------------------------------------------------------

describe("setup sheet and checks (design §7.2)", () => {
  test("a preset draft shows six blocks in order, passes the five checks and enables Freeze and run", async () => {
    await withDom({}, async () => {
      const { container } = mount(presetStore("UC-03"));
      const blocks = container.querySelectorAll("[data-block]");
      assert.deepEqual(blocks.map((b) => b.getAttribute("data-block")), ["question", "scenario", "oneChange", "primary", "guardrails", "seeds"]);
      // The Situation block belongs to a casebook preset only (section 4.4); an Experiment preset shows the six numbered ones.
      const { situation: _situation, ...numbered } = labels.EXPERIMENT_SETUP.blocks;
      assert.deepEqual(blocks.map((b) => b.querySelector("summary").textContent), Object.values(numbered));
      assert.deepEqual(checksOf(container), { "one axis": true, "margin above 0": true, "metrics registered": true, "ranges valid": true, "scopes valid": true });
      assert.equal(container.querySelector('[data-role="freeze"]').textContent, labels.EXPERIMENT_SETUP.freezeAndRun);
      assert.equal(container.querySelector('[data-role="freeze-disabled"]'), null);
      const setup = container.querySelector('[data-role="setup"]');
      assert.equal(setup.querySelector(".fl-teaching-chip").textContent, labels.HONESTY.verdictChip);
      // Seed set 1 with 10 seeds holds 1000 × 1 + 1 = 1001 to 1000 × 1 + 10 = 1010.
      assert.equal(setup.querySelector('[data-role="seed-set"]').textContent, labels.seedSetText({ seedSet: 1, firstSeed: 1001, lastSeed: 1010 }));
      assert.equal(container.querySelector('[data-block="primary"] [data-role="margin-hint"]').textContent, `"${labels.EXPERIMENT_SETUP.marginHint}"`);
      assertCopyRules(container);
      assertClassesDefined(container);
    });
  });

  const failing = [
    ["a margin of 0 fails margin above 0", "margin above 0", (store) => {
      const primary = { ...store.getState().experiment.draft.primary, margin_text: "0" };
      delete primary.margin_units;
      store.dispatch({ type: "experiment/draft", patch: { primary } });
    }],
    ["a scope the metric does not accept fails scopes valid", "scopes valid", (store) => {
      store.dispatch({ type: "experiment/guardrailUpdate", index: 0, patch: { scope: { depot: "SJ-1" } } });
    }],
    ["a metric outside the registry fails metrics registered", "metrics registered", (store) => {
      store.dispatch({ type: "experiment/draft", patch: { primary: { metric: "fleet.utilization_fraction", scope: {}, margin_units: 30 } } });
    }],
    ["two axes fail one axis", "one axis", (store) => {
      const axis = store.getState().experiment.draft.axis;
      store.dispatch({ type: "experiment/draft", patch: { axis: [axis, axis] } });
    }],
    ["a value outside the knob's range fails ranges valid", "ranges valid", (store) => {
      // RID-1 accepts 60 to 3600 s; 999999 s is outside it.
      store.dispatch({ type: "experiment/draft", patch: { axis: { id: "parameter:RID-1", baseline: 1200, candidate: 999999 } } });
    }],
    ["five paired replications fail the seeds check, listed beside the five", "seeds", (store) => {
      store.dispatch({ type: "experiment/draft", patch: { seedCount: 5 } });
    }],
    ["ten resamples fail the resamples check", "resamples", (store) => {
      store.dispatch({ type: "experiment/draft", patch: { resamples: 10 } });
    }],
  ];
  for (const [name, check, breakDraft] of failing) {
    test(`${name}, and Freeze and run stays disabled`, async () => {
      await withDom({}, async () => {
        const store = presetStore("UC-03");
        const { container } = mount(store);
        breakDraft(store);
        const checks = checksOf(container);
        assert.equal(checks[check], false, `${check} fails`);
        assert.equal(experiment.setupChecks(store.getState().experiment.draft).ok, false);
        assert.equal(container.querySelector('[data-role="freeze"]').disabled, true);
        assert.equal(container.querySelector('[data-role="freeze-disabled"]').textContent, labels.EXPERIMENT_SETUP.freezeDisabled);
        assert.ok(container.querySelectorAll('[data-role="check-errors"] li').length > 0, "the failing check explains itself under the checks");
      });
    });
  }

  test("typing in a field updates the draft and the checks, and focus stays in the field", async () => {
    await withDom({}, async () => {
      const store = presetStore("UC-03");
      const { container } = mount(store);
      const margin = container.querySelector('[data-focus-key="primary-threshold"]');
      assert.equal(margin.value, "30");
      margin.focus();
      margin.value = "0";
      margin.dispatchEvent(new Event("input", { bubbles: true }));
      assert.equal(store.getState().experiment.draft.primary.margin_text, "0");
      assert.equal(checksOf(container)["margin above 0"], false);
      assert.equal(document.activeElement.getAttribute("data-focus-key"), "primary-threshold");
      const again = container.querySelector('[data-focus-key="primary-threshold"]');
      again.value = "45";
      again.dispatchEvent(new Event("input", { bubbles: true }));
      assert.equal(checksOf(container)["margin above 0"], true);
      assert.equal(container.querySelector('[data-role="freeze"]').disabled, false);
    });
  });

  test("the axis tag appears only for an axis FleetLab cannot run, and the null check is labelled", async () => {
    assert.equal(experiment.isTeachingModelAxis("policy:depot_assignment"), true);
    assert.equal(experiment.isTeachingModelAxis("parameter:SUP-1.SJ"), true);
    assert.equal(experiment.isTeachingModelAxis("parameter:DEP-7"), false);
    await withDom({}, async () => {
      const tagOf = (presetId) => mount(presetStore(presetId)).container.querySelector('[data-role="axis-tag"]');
      assert.equal(tagOf("L3").textContent, labels.HONESTY.axisFleetLabCannotRun);
      assert.equal(tagOf("UC-03"), null);
      const uc01 = mount(presetStore("UC-01")).container;
      assert.equal(uc01.querySelector('[data-role="axis-tag"]'), null);
      assert.equal(uc01.querySelector('[data-role="null-check"]').textContent, labels.EXPERIMENT_SETUP.nullCheck);
      assert.equal(experiment.setupChecks(presetStore("UC-01").getState().experiment.draft).ok, true);
      const l3 = mount(presetStore("L3")).container;
      assert.equal(l3.querySelector('[data-block="primary"] [data-role="grammar-tag"]').textContent, labels.HONESTY.teachingModelGrammar);
    });
  });

  test("a guardrail row names its availability; adding and removing rows edits the draft", async () => {
    await withDom({}, async () => {
      const store = presetStore("L3");
      const { container } = mount(store);
      const availability = container.querySelectorAll('[data-block="guardrails"] [data-role="availability"]').map((n) => n.textContent);
      assert.deepEqual(availability, [labels.EXPERIMENT_SETUP.alwaysAvailable, labels.EXPERIMENT_SETUP.alwaysAvailable, labels.EXPERIMENT_SETUP.alwaysAvailable]);
      container.querySelector('[data-focus-key="guardrail-add"]').click();
      assert.equal(store.getState().experiment.draft.guardrails.length, 4);
      const select = container.querySelector('[data-focus-key="guardrail-3-metric"]');
      select.value = "depot.turnaround_p90_s";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      assert.equal(store.getState().experiment.draft.guardrails[3].metric, "depot.turnaround_p90_s");
      assert.equal(container.querySelectorAll('[data-block="guardrails"] [data-role="availability"]')[3].textContent, labels.EXPERIMENT_SETUP.sometimesAbsent);
      container.querySelector('[data-focus-key="guardrail-3-remove"]').click();
      assert.equal(store.getState().experiment.draft.guardrails.length, 3);
    });
  });

  test("the scope selectors merge into the reference's scope, and the frozen spec measures what they chose", async () => {
    await withDom({}, async () => {
      // L3 scopes its primary to San Francisco on day 2, 07:00 to 09:00, and a guardrail to depot SJ-1.
      const store = presetStore("L3");
      const { container } = mount(store);
      const draft = () => store.getState().experiment.draft;
      const change = (key, value) => {
        const select = container.querySelector(`[data-focus-key="${key}"]`);
        assert.ok(select, `a ${key} selector`);
        select.value = value;
        assert.equal(select.value, value, `${value} is an option of ${key}`);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const { area, window } = draft().primary.scope;
      assert.equal(area, "SF");
      // Only the window start changes: the area stays, and the end stays because it is still after the start.
      const start_s = window.start_s - 3600;
      change("primary-window-start", String(start_s));
      assert.deepEqual(draft().primary.scope, { area: "SF", window: { start_s, end_s: window.end_s } });
      const end_s = window.end_s - 3600;
      change("primary-window-end", String(end_s));
      assert.deepEqual(draft().primary.scope, { area: "SF", window: { start_s, end_s } });
      change("primary-area", "SJ");
      assert.deepEqual(draft().primary.scope, { area: "SJ", window: { start_s, end_s } });
      change("primary-area", "");
      assert.deepEqual(draft().primary.scope, { window: { start_s, end_s } }, "all areas removes the area and keeps the window");
      change("primary-area", "SJ");

      const index = draft().guardrails.findIndex((g) => g.metric === "depot.parking_peak_fraction");
      assert.ok(index >= 0, "L3 has the lot peak guardrail");
      assert.deepEqual(draft().guardrails[index].scope, { depot: "SJ-1" });
      change(`guardrail-${String(index)}-depot`, "SF-1");
      assert.deepEqual(draft().guardrails[index].scope, { depot: "SF-1" });

      assert.equal(experiment.setupChecks(draft()).ok, true);
      const { spec } = freezeSpec(experiment.specDraftOf(draft()));
      assert.deepEqual(spec.primary.scope, { area: "SJ", window: { start_s, end_s } });
      assert.deepEqual(spec.guardrails[index].scope, { depot: "SF-1" });
    });
  });

  test("Sandbox changes become the baseline and the axis, and View differences lists them", async () => {
    await withDom({}, async () => {
      const preset = presetById("UC-03");
      const store = createStore(createInitialState({ presetId: "UC-03", scenario: preset.scenario }));
      store.dispatch({ type: "knob/set", knob: "RID-1", path: ["patience_s"], value: 900 });
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      assert.deepEqual(store.getState().experiment.draft.axis, { id: "parameter:RID-1", baseline: 1200, candidate: 900 });
      assert.equal(container.querySelector('[data-role="baseline-line"]').textContent, labels.baselineLine({ presetName: preset.title, changes: 1 }));
      const list = container.querySelector('[data-role="differences"]');
      assert.equal(list.hidden, true);
      container.querySelector('[data-focus-key="differences"]').click();
      const shown = container.querySelector('[data-role="differences"]');
      assert.equal(shown.hidden, false);
      // 1200 s is 20 min and 900 s is 15 min.
      assert.equal(shown.textContent, labels.changeItem({ knobName: "Rider patience", from: "20 min", to: "15 min" }));
    });
  });

  test("on a phone the six blocks are an accordion that opens one block and keeps what the reader opened", async () => {
    await withDom({ media: { [PHONE]: true } }, async () => {
      const store = presetStore("UC-03");
      const { container } = mount(store);
      const open = () => container.querySelectorAll("details[data-block]").filter((d) => d.hasAttribute("open")).map((d) => d.getAttribute("data-block"));
      assert.deepEqual(open(), ["question"]);
      const primary = container.querySelector('details[data-block="primary"]');
      primary.setAttribute("open", "");
      primary.dispatchEvent(new Event("toggle"));
      store.dispatch({ type: "experiment/draft", patch: { question: "A new question?" } });
      assert.deepEqual(open(), ["question", "primary"]);
    });
    await withDom({}, async () => {
      const { container } = mount(presetStore("UC-03"));
      assert.equal(container.querySelectorAll("details[data-block]").filter((d) => d.hasAttribute("open")).length, 6);
    });
  });
});

describe("Freeze and run and the freeze rule (design §7.1)", () => {
  test("Freeze and run freezes exactly the draft's spec, runs it once and shows the verdict for that digest", async () => {
    await withDom({}, async () => {
      const { payload, store, host, container } = await finishedRun("UC-03");
      const expected = frozenExperiment({ presetId: "UC-03" });
      const ex = store.getState().experiment;
      assert.equal(host.calls.length, 1);
      assert.deepEqual(host.calls[0].spec, expected.spec);
      assert.equal(ex.frozen.digest, expected.digest);
      assert.equal(payload.digest, expected.digest);
      assert.equal(ex.frozen.frozenAt, "14:02");
      assert.equal(ex.status, "done");
      assert.equal(ex.verdict, payload.verdict);
      assert.equal(store.getState().engine.path, "worker");
      assert.ok(container.querySelector('article.fl-verdict[data-kind="teaching"]'));
      assert.equal(container.querySelector('[data-role="freeze-notice"]').textContent, labels.freezeNotice({ frozenAt: "14:02", changedKnobs: 0 }));
    });
  });

  test("while running, progress shows by runs finished and Cancel reaches the host; Freeze and run is off", async () => {
    await withDom({}, async () => {
      const store = presetStore("UC-03");
      let reject;
      const host = fakeHost({ payloadFor: () => new Promise((_, r) => { reject = r; }) });
      const { container } = mount(store, { host });
      container.querySelector('[data-role="freeze"]').click();
      await tick();
      assert.equal(store.getState().experiment.status, "running");
      assert.equal(container.querySelector('[data-role="progress"]').textContent, labels.experimentRunProgress(1, 23));
      assert.equal(container.querySelector('[data-role="freeze"]').disabled, true);
      container.querySelector('[data-role="cancel"]').click();
      assert.deepEqual(host.cancelled, ["run-1"]);
      const abort = new Error("cancelled");
      abort.name = "AbortError";
      reject(abort);
      await tick();
      await tick();
      assert.equal(store.getState().experiment.status, "cancelled");
      assert.equal(container.querySelector('[data-role="cancelled"]').textContent, labels.STATES.cancelled);
    });
  });

  test("an engine failure shows the stopped state with Retry", async () => {
    await withDom({}, async () => {
      const store = presetStore("UC-03");
      const host = fakeHost({ payloadFor: () => Promise.reject(new Error("the engine worker stopped")) });
      const { container } = mount(store, { host });
      container.querySelector('[data-role="freeze"]').click();
      await host.last.catch(() => {});
      await tick();
      await tick();
      assert.equal(container.querySelector('[data-role="engine-stopped"] p').textContent, labels.STATES.engineStopped);
      assert.equal(container.querySelector('[data-role="retry"]').textContent, labels.STATES.retry);
    });
  });

  test("editing the setup marks the verdict out of date and nothing runs again", async () => {
    await withDom({}, async () => {
      const { store, host, container } = await finishedRun("UC-03");
      store.dispatch({ type: "experiment/draft", patch: { question: "Does a shorter patience change wait?" } });
      const card = container.querySelector("article.fl-verdict");
      assert.match(card.getAttribute("class"), /(^| )fl-stale( |$)/);
      assert.equal(container.querySelector('[data-role="verdict-stale"]').textContent, labels.FREEZE.verdictStale);
      assert.equal(host.calls.length, 1);
    });
  });

  test("a Sandbox knob changed after the freeze is counted in the freeze notice", async () => {
    await withDom({}, async () => {
      const { store, container } = await finishedRun("UC-03");
      store.dispatch({ type: "knob/set", knob: "DEP-7", path: ["trips_between_visits"], value: 12 });
      assert.equal(container.querySelector('[data-role="freeze-notice"]').textContent, labels.freezeNotice({ frozenAt: "14:02", changedKnobs: 1 }));
    });
  });
});

describe("session log (design §7.1, §6 seed sets, §9.4)", () => {
  test("every run is listed with its seed set, spec label, outcome, recommendation and engine path", async () => {
    await withDom({}, async () => {
      const store = presetStore("UC-03");
      const host = fakeHost({ payloadFor: (spec) => experimentPayload({ presetId: "UC-03", seedSet: spec.seed_set }) });
      const { container } = mount(store, { host });
      assert.equal(container.querySelector('[data-role="session-log"] p').textContent, labels.SESSION_LOG.empty);
      await freezeByClick(container, host);
      container.querySelector('[data-role="another-seed-set"]').click();
      await host.last;
      await tick();
      await tick();
      assert.equal(host.calls.length, 2);
      assert.deepEqual(host.calls.map((c) => c.spec.seed_set), [1, 2]);
      const first = await experimentPayload({ presetId: "UC-03", seedSet: 1 });
      const second = await experimentPayload({ presetId: "UC-03", seedSet: 2 });
      assert.notEqual(first.label, second.label);
      const entries = container.querySelectorAll('[data-role="session-log"] li').map((li) => li.textContent);
      assert.deepEqual(entries, [
        // Seed set k holds 1000 × k + 1 to 1000 × k + 10: 1001 to 1010, then 2001 to 2010.
        labels.sessionLogEntry({ seedSet: 1, firstSeed: 1001, lastSeed: 1010, label: first.label, validity: first.verdict.validity, outcome: first.verdict.outcome, recommendation: first.verdict.recommendation, engine: "worker" }),
        labels.sessionLogEntry({ seedSet: 2, firstSeed: 2001, lastSeed: 2010, label: second.label, validity: second.verdict.validity, outcome: second.verdict.outcome, recommendation: second.verdict.recommendation, engine: "worker" }),
      ]);
      assert.equal(store.getState().experiment.frozen.spec.seed_set, 2);
    });
  });

  test("an engine path the host never reported reads not available, never blank", async () => {
    await withDom({}, async () => {
      const payload = await experimentPayload({ presetId: "UC-03" });
      const store = presetStore("UC-03");
      const host = fakeHost({ path: "starting", payloadFor: () => payload });
      const { container } = mount(store, { host });
      await freezeByClick(container, host);
      const entry = container.querySelector('[data-role="session-log"] li').textContent;
      assert.ok(entry.endsWith(`engine: ${labels.absentValue(labels.ABSENT_REASONS.enginePathNotReported)}`), entry);
    });
  });
});

describe("verdict card (design §7.2, P-7 to P-9)", () => {
  test("every field of a HOLD verdict equals the run_experiment payload, and the chip sits inside the card", async () => {
    await withDom({}, async () => {
      const { payload, store, container } = await finishedRun("L2b");
      const { verdict } = payload;
      const spec = store.getState().experiment.frozen.spec;
      const card = container.querySelector('article.fl-verdict[data-kind="teaching"]');
      assert.equal(card.getAttribute("data-validity"), verdict.validity);
      assert.equal(card.querySelector('[data-role="teaching-chip"]').textContent, labels.verdictHeader(spec.seeds.length));
      assert.equal(card.querySelector('[data-role="register"]').textContent, labels.acrossReplicationsChip(spec.seeds.length));
      assert.equal(card.querySelector('[data-field="label"]').textContent.trim(), payload.label);
      assert.ok(!serialize(card).includes(payload.digest), "the full digest is never shown");
      assert.equal(card.lastChild.getAttribute("class"), "fl-verdict__footer");
      assert.equal(card.lastChild.textContent, labels.HONESTY.verdictFooter);

      // Gate chain: validity, guardrails, primary outcome, recommendation, each with glyph and word.
      const gates = card.querySelectorAll("[data-gate]");
      assert.deepEqual(gates.map((g) => g.getAttribute("data-gate")), ["validity", "guardrails", "primary", "recommendation"]);
      const words = (gateId) => card.querySelectorAll(`[data-gate="${gateId}"] .fl-verdict-chip__word`).map((n) => n.textContent);
      assert.deepEqual(words("validity"), [verdict.validity]);
      assert.deepEqual(words("guardrails"), [labels.guardrailsRegressedCount(verdict.guardrail_regressions.length)]);
      assert.deepEqual(words("primary"), [verdict.outcome]);
      assert.deepEqual(words("recommendation"), [verdict.recommendation]);
      assert.equal(verdict.recommendation, "HOLD");
      assert.ok(card.querySelector('[data-gate="guardrails"] [data-role="decides"]'));
      assert.ok(card.querySelector('[data-gate="primary"] [data-role="shown-not-needed"]'));
      assert.equal(card.querySelector('[data-gate="recommendation"] [data-role="reason"]').textContent, labels.RECOMMENDATION_REASONS.guardrailHarmed);
      for (const chip of card.querySelectorAll(".fl-verdict-chip")) {
        assert.ok(chip.querySelector(".fl-verdict-chip__glyph").textContent.length > 0, "a glyph");
        assert.ok(chip.querySelector(".fl-verdict-chip__word").textContent.length > 0, "a word");
      }

      // Primary: means, deltas, interval and the margin the instrument received.
      const p = verdict.primary;
      // The metric shows its scope on the simulated clock (design §7.2 setup); the key itself stays in data-metric.
      const metricNode = card.querySelector('[data-field="primary.metric"]');
      assert.equal(metricNode.getAttribute("data-metric"), p.metric);
      assert.equal(metricNode.textContent, charts.metricSubject(p.metric));
      assert.ok(!metricNode.textContent.includes("{"), "no raw metric key on the card");
      for (const field of ["baseline_mean", "candidate_mean", "mean_delta", "median_delta", "ci_low", "ci_high"]) same(valueOf(card, `primary.${field}`), p[field], field);
      same(valueOf(card, "primary.equivalence_margin"), thresholdValue(spec.primary.metric, spec.primary.margin_units), "margin");
      assert.equal(card.querySelector('[data-role="outcome-sentence"]').textContent, labels.OUTCOME_SENTENCES[verdict.outcome]);

      // Guardrails in declared order, with status, harm and maximum harm.
      const rails = card.querySelectorAll('[data-section="guardrails"] tbody tr');
      assert.deepEqual(rails.map((r) => r.getAttribute("data-metric")), verdict.guardrail_statuses.map((g) => g.metric));
      rails.forEach((row, i) => {
        const g = verdict.guardrail_statuses[i];
        assert.equal(row.getAttribute("data-status"), g.status);
        same(valueOf(row, "harm"), g.harm, `${g.metric} harm`);
        same(valueOf(row, "max_harm"), g.max_harm, `${g.metric} max harm`);
        assert.equal(row.querySelector(".fl-verdict-chip__word").textContent, labels.STATUS_WORDS.guardrail[g.status].word);
      });

      // Descriptive deltas in record order, marked no claim.
      assert.equal(card.querySelector('[data-section="descriptives"] h3').textContent, labels.VERDICT.descriptive);
      const rows = card.querySelectorAll('[data-section="descriptives"] tbody tr');
      assert.deepEqual(rows.map((r) => r.getAttribute("data-metric")), verdict.descriptives.map((d) => d.metric));
      rows.forEach((row, i) => {
        const d = verdict.descriptives[i];
        for (const field of ["baseline_mean", "candidate_mean", "mean_delta"]) same(valueOf(row, field), d[field], `${d.metric} ${field}`);
      });
      assert.deepEqual(card.querySelectorAll('[data-section="limitations"] > ul:not([data-role]) li').map((li) => li.textContent), [...labels.VERDICT.limitationItems]);
      assertCopyRules(container);
      assertClassesDefined(container);
    });
  });

  test("the primary strip is charts.js's verdict strip, placed in the primary section", async () => {
    await withDom({}, async () => {
      const { container } = await finishedRun("UC-03");
      const figure = container.querySelector('[data-section="primary"] figure.fl-chart');
      assert.ok(figure, "a chart figure sits in the primary section");
      assert.match(figure.getAttribute("data-chart"), /^verdict/);
      assert.ok(figure.querySelector("svg"), "the strip is drawn");
      assertClassesDefined(container);
      assertCopyRules(container);
    });
  });

  test("each guardrail draws its bullet row (mean harm bar against a max harm tick) under the guardrail table", async () => {
    await withDom({}, async () => {
      for (const presetId of ["UC-03", "L3"]) {
        const { payload, container } = await finishedRun(presetId);
        const statuses = payload.verdict.guardrail_statuses;
        assert.ok(statuses.length > 0, `${presetId} declares guardrails`);
        const section = container.querySelector('[data-section="guardrails"]');
        const railsSection = container.querySelector('[data-section="guardrail-rows"]');
        assert.ok(railsSection, "the bullet rows have their own section");
        assert.equal(section.nextSibling, railsSection, "right under the guardrail table");
        const figures = railsSection.querySelectorAll('figure[data-chart="verdict_guardrail"]');
        assert.equal(figures.length, statuses.length, `${presetId}: one bullet row per guardrail`);
        figures.forEach((figure, i) => {
          const g = statuses[i];
          assert.equal(figure.querySelectorAll('[data-role="max-harm"]').length, 1, `${g.metric} max harm tick`);
          const evaluable = g.status !== "NOT_EVALUABLE";
          assert.equal(figure.querySelectorAll('[data-role="harm-bar"]').length, evaluable ? 1 : 0, `${g.metric} harm bar`);
          if (!evaluable) assert.ok(figure.querySelector('[data-role="absent"]'), `${g.metric} hatched when not evaluable`);
          assert.equal(figure.querySelector("h3").textContent, labels.chartTitle({ title: labels.VERDICT.guardrails, subject: charts.metricSubject(g.metric) }));
        });
        // The table rows stay, with their exact values, and name the scope on the clock.
        const rows = section.querySelectorAll("tbody tr");
        assert.equal(rows.length, statuses.length);
        rows.forEach((row, i) => assert.equal(row.querySelector("th").textContent, charts.metricSubject(statuses[i].metric)));
        // Gate chain: an ordered flow with arrows and no number markers (design §8.5); the session log has no markers.
        const gates = container.querySelector('[data-section="gates"] ol');
        assert.equal(gates.getAttribute("class"), "fl-flow");
        const items = gates.children;
        assert.ok(items.every((li) => li.localName === "li"), "only list items inside the ordered list");
        const arrowed = items.map((li) => li.lastChild?.getAttribute?.("class") === "fl-flow__arrow");
        assert.deepEqual(arrowed, items.map((_, i) => i < items.length - 1), "an arrow closes every gate but the last");
        const log = container.querySelector('[data-role="session-log"] ol');
        assert.ok(log, "the session log lists the run");
        assert.equal(log.getAttribute("class"), "fl-list-plain");
        assert.match(CSS, /\.fl-list-plain \{[^}]*list-style: none/);
        assertClassesDefined(container);
        assertCopyRules(container);
        container.remove();
      }
    });
  });

  test("a replacement guardrail renderer receives the verdict, its frozen spec and the view, and is skipped for void evidence", async () => {
    await withDom({}, async () => {
      const seen = [];
      const guardrailRows = (args) => {
        seen.push(args);
        return [document.createElement("figure")];
      };
      const { payload, store, container } = await finishedRun("UC-03", { guardrailRows });
      const { view, verdict, spec } = seen[seen.length - 1];
      assert.equal(verdict, payload.verdict);
      assert.equal(spec, store.getState().experiment.frozen.spec);
      assert.equal(view.guardrails.length, payload.verdict.guardrail_statuses.length);
      assert.equal(container.querySelectorAll('[data-section="guardrail-rows"] figure').length, 1);
      assert.deepEqual(experiment.chartsGuardrailRows({ verdict: { validity: "INVALID_EXPERIMENT" }, spec }), []);
    });
  });

  test("a replacement strip renderer receives the verdict, its frozen spec and the card's view", async () => {
    await withDom({}, async () => {
      const seen = [];
      const primaryStrip = (args) => {
        seen.push(args);
        return document.createElement("svg");
      };
      const { payload, store, container } = await finishedRun("UC-03", { primaryStrip });
      const { view, verdict, spec } = seen[seen.length - 1];
      assert.equal(verdict, payload.verdict);
      assert.equal(spec, store.getState().experiment.frozen.spec);
      assert.deepEqual(view.deltas, spec.seeds.map((seed, i) => ({ seed, delta: payload.verdict.primary.paired_deltas[i] })));
      assert.equal(view.primary.ci_low, payload.verdict.primary.ci_low);
      assert.ok(container.querySelector('[data-section="primary"] svg'), "the strip sits in the primary section");
    });
  });

  test("descriptive rows past the first three and the full limitations open on request", async () => {
    await withDom({}, async () => {
      const { payload, container } = await finishedRun("UC-03");
      const hiddenRows = () => container.querySelectorAll('[data-section="descriptives"] tbody tr').filter((r) => r.hidden).length;
      assert.equal(hiddenRows(), payload.verdict.descriptives.length - 3);
      container.querySelector('[data-focus-key="teaching-descriptives"]').click();
      assert.equal(hiddenRows(), 0);
      assert.equal(container.querySelector('[data-role="all-limitations"]').hidden, true);
      container.querySelector('[data-focus-key="teaching-limitations"]').click();
      assert.equal(container.querySelector('[data-role="all-limitations"]').hidden, false);
    });
  });

  test("the default seed is the median delta; picking the largest delta warns, and the median clears the warning", async () => {
    await withDom({}, async () => {
      const watched = [];
      const { payload, store, container } = await finishedRun("UC-03", { onWatchSeed: (seed) => watched.push(seed) });
      const seeds = store.getState().experiment.frozen.spec.seeds;
      // The lower middle of the ascending deltas (index floor((10 - 1) / 2) = 4), ties by seed.
      const sorted = seeds.map((seed, i) => ({ seed, delta: payload.verdict.primary.paired_deltas[i] })).sort((a, b) => a.delta - b.delta || a.seed - b.seed);
      const median = sorted[4].seed;
      const largest = [...sorted].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.seed - b.seed)[0].seed;
      assert.notEqual(median, largest, "this payload separates the two seeds");
      assert.equal(medianDeltaSeed(payload.verdict, seeds), median);
      assert.equal(largestDeltaSeed(payload.verdict, seeds), largest);

      assert.equal(store.getState().experiment.selectedSeed, median);
      const actions = container.querySelectorAll('[data-role="actions"] button').map((b) => b.getAttribute("data-role"));
      assert.deepEqual(actions.slice(0, 2), ["watch-median", "watch-largest"], "the median is the first action");
      assert.match(container.querySelector('[data-role="watch-median"]').getAttribute("class"), /fl-button--primary/);
      assert.equal(container.querySelector('[data-role="watch-median"]').textContent, labels.SEED_WATCH.watchMedian);
      assert.equal(container.querySelector('[data-role="now-watching"]').textContent, labels.nowWatching({ seed: median, index: seeds.indexOf(median) + 1, total: 10 }));
      assert.equal(container.querySelector('[data-role="largest-warning"]'), null);

      container.querySelector('[data-role="watch-largest"]').click();
      assert.equal(store.getState().experiment.selectedSeed, largest);
      assert.equal(container.querySelector('[data-role="largest-warning"]').textContent, labels.SEED_WATCH.largestWarning);
      container.querySelector('[data-role="watch-median"]').click();
      assert.equal(container.querySelector('[data-role="largest-warning"]'), null);
      assert.deepEqual(watched, [largest, median]);
    });
  });

  test("a guardrail absent in some replication reads NOT EVALUABLE beside the recommendation, never as a pass or 0", async () => {
    await withDom({}, async () => {
      const draft = experimentDraft({ presetId: "UC-03" });
      draft.guardrails.push({ metric: "depot.turnaround_p90_s", scope: {}, direction: "lower_is_better", max_harm_units: 60 });
      const { payload } = await runThroughWorkerHandler({ type: "run_experiment", spec: draft });
      const status = payload.verdict.guardrail_statuses[1];
      assert.equal(status.status, "NOT_EVALUABLE", "the model reports the guardrail as not evaluable");
      const store = presetStore("UC-03", { draft });
      const host = fakeHost({ payloadFor: () => payload });
      const { container } = mount(store, { host });
      await freezeByClick(container, host);
      assert.equal(store.getState().experiment.frozen.digest, payload.digest);

      const row = container.querySelector('[data-section="guardrails"] tr[data-metric="depot.turnaround_p90_s"]');
      assert.equal(row.getAttribute("data-status"), "NOT_EVALUABLE");
      const harm = row.querySelector('[data-field="harm"]');
      assert.equal(harm.textContent, labels.absentValue(labels.ABSENT_REASONS.metricAbsentInSomeReplication));
      assert.equal(harm.getAttribute("data-value"), null);
      assert.equal(row.querySelector(".fl-verdict-chip").getAttribute("data-status"), "cond");
      assert.equal(row.querySelector(".fl-verdict-chip__word").textContent, labels.STATUS_WORDS.guardrail.NOT_EVALUABLE.word);
      assert.ok(row.textContent.includes(labels.NOT_EVALUABLE_TEXT));
      const gate = container.querySelector('[data-gate="recommendation"]');
      assert.equal(gate.querySelector('[data-role="not-evaluable"]').textContent, labels.NOT_EVALUABLE_TEXT);
      assert.equal(gate.querySelector(".fl-verdict-chip__word").textContent, payload.verdict.recommendation);
      // UC-03's own unserved guardrail regresses since the population-trap fix (candidate 5 min, max harm 0.01; harm about
      // 0.018 on 10 seeds), so the gate reads one regressed guardrail beside the one that is not evaluable. It read the
      // WITHIN word when UC-03 used 10 min against 0.02.
      assert.equal(payload.verdict.guardrail_statuses[0].status, "REGRESSED");
      const railWords = container.querySelectorAll('[data-gate="guardrails"] .fl-verdict-chip__word').map((n) => n.textContent);
      assert.deepEqual(railWords, [labels.guardrailsRegressedCount(1), labels.guardrailsNotEvaluableCount(1)]);
    });
  });

  const frozenUc03 = () => frozenExperiment({ presetId: "UC-03" });
  const primaryDecl = { name: "wait.p90_s", direction: "lower_is_better", equivalence_margin: 30 };
  const invalid = {
    REPLICATION_MISMATCH: (key) => computeVerdict({ primary: primaryDecl, baselineRuns: [], candidateRuns: [], resamples: 2000, key, precheckMatched: false }),
    INVARIANT_VIOLATION: (key) => computeVerdict({ primary: primaryDecl, baselineRuns: [], candidateRuns: [], resamples: 2000, key, precheckMatched: true, invariantViolation: "seed 1003: P13: SJ-1 held 31 of 30 stalls" }),
    NOT_COMPARABLE: (key) => computeVerdict({ primary: primaryDecl, baselineRuns: [{}], candidateRuns: [{}], resamples: 2000, key, precheckMatched: true }),
  };
  for (const [reason, build] of Object.entries(invalid)) {
    test(`an invalid verdict (${reason}) shows only the reason and the void-evidence text`, async () => {
      await withDom({}, async () => {
        const frozen = frozenUc03();
        const verdict = build(frozen.digest);
        assert.equal(verdict.invalidity_reason, reason);
        const store = presetStore("UC-03");
        store.dispatch({ type: "experiment/freeze", spec: frozen.spec, digest: frozen.digest, label: frozen.label, frozenAt: "14:02", id: "x1" });
        store.dispatch({ type: "experiment/verdict", id: "x1", payload: { verdict, digest: frozen.digest, per_seed: [] } });
        let drawn = 0;
        const { container } = mount(store, { primaryStrip: () => { drawn += 1; return null; } });
        const card = container.querySelector('article.fl-verdict[data-kind="teaching"]');
        assert.equal(card.getAttribute("data-validity"), "INVALID_EXPERIMENT");
        for (const section of ["primary", "guardrails", "descriptives"]) assert.equal(card.querySelector(`[data-section="${section}"]`), null, `no ${section}`);
        assert.equal(drawn, 0, "no strip is drawn");
        assert.equal(card.querySelector('[data-gate="primary"]'), null, "no outcome");
        assert.deepEqual(card.querySelectorAll("[data-gate]").map((g) => g.getAttribute("data-gate")), ["validity", "recommendation"]);
        assert.equal(card.querySelector('[data-gate="recommendation"] .fl-verdict-chip__word').textContent, "NO_RECOMMENDATION");
        assert.equal(card.querySelector('[data-section="invalid"] .fl-verdict-chip__word').textContent, reason);
        assert.equal(card.querySelector('[data-role="invalid-meaning"]').textContent, labels.INVALIDITY_TEXT[reason]);
        assert.equal(card.querySelector('[data-role="void-evidence"]').textContent, labels.SEED_WATCH.voidEvidence);
        assert.equal(card.querySelector('[data-role="watch-median"]'), null);
        assert.equal(card.querySelector('[data-role="watch-largest"]'), null);
        const invariant = card.querySelector('[data-role="invariant"]');
        if (reason === "INVARIANT_VIOLATION") assert.equal(invariant.textContent, labels.invariantFailure({ rule: labels.INVARIANT_RULES.P13, id: "P13" }));
        else assert.equal(invariant, null);
        assert.ok(container.querySelector('[data-role="session-log"] li').textContent.includes(` · ${labels.SESSION_LOG.noOutcome} · `));
        assertCopyRules(container);
      });
    });
  }
});

describe("copied result summary (design H-4, P-10)", () => {
  test("Copy result summary hands the injected callback the NOT_EVIDENCE summary of the verdict", async () => {
    await withDom({}, async () => {
      const copied = [];
      const { payload, store, container } = await finishedRun("UC-03", { copy: (text) => { copied.push(text); } });
      container.querySelector('[data-role="copy-summary"]').click();
      await tick();
      const spec = store.getState().experiment.frozen.spec;
      const expected = summaryText(resultSummary(payload.verdict, {
        specDigest: payload.digest,
        modelVersion: spec.model_version,
        question: spec.question,
        axis: spec.axis.id,
        baselineValue: spec.axis.baseline,
        candidateValue: spec.axis.candidate,
        seedSet: { set: spec.seed_set, seeds: spec.seeds.slice() },
      }));
      assert.deepEqual(copied, [expected]);
      const lines = copied[0].split("\n");
      assert.ok(lines.includes("Evidence status: NOT_EVIDENCE"));
      assert.ok(lines.includes("Decision authority: NONE"));
      assert.ok(lines.includes(`Spec: ${payload.label}`));
      assert.ok(!copied[0].includes(payload.digest), "never the full digest");
      assert.equal(container.querySelector('[data-role="copy-status"]').textContent, labels.VERDICT.copied);
    });
  });

  test("a refused clipboard says so, and an invalid verdict's summary still carries NOT_EVIDENCE", async () => {
    await withDom({}, async () => {
      const { container } = await finishedRun("UC-03", { copy: () => Promise.reject(new Error("denied")) });
      container.querySelector('[data-role="copy-summary"]').click();
      await tick();
      await tick();
      assert.equal(container.querySelector('[data-role="copy-status"]').textContent, labels.VERDICT.copyFailed);
    });
    await withDom({}, async () => {
      const frozen = frozenExperiment({ presetId: "UC-03" });
      const verdict = computeVerdict({ primary: { name: "wait.p90_s", direction: "lower_is_better", equivalence_margin: 30 }, baselineRuns: [], candidateRuns: [], resamples: 2000, key: frozen.digest, precheckMatched: false });
      const store = presetStore("UC-03");
      store.dispatch({ type: "experiment/freeze", spec: frozen.spec, digest: frozen.digest, label: frozen.label, frozenAt: "14:02", id: "x1" });
      store.dispatch({ type: "experiment/verdict", id: "x1", payload: { verdict, digest: frozen.digest, per_seed: [] } });
      const copied = [];
      const { view } = mount(store, { copy: (text) => { copied.push(text); } });
      await view.copySummary();
      assert.ok(copied[0].split("\n").includes("Evidence status: NOT_EVIDENCE"));
      assert.ok(copied[0].includes(labels.SEED_WATCH.voidEvidence));
    });
  });

  test("without a copy callback the button is disabled", async () => {
    await withDom({}, async () => {
      const { container } = await finishedRun("UC-03");
      assert.equal(container.querySelector('[data-role="copy-summary"]').disabled, true);
    });
  });
});

describe("FleetLab reference panels (design §1.3, §7.2; contract 5.2)", () => {
  test("the panels the interface quotes are the regenerator's fixture", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(REFERENCE_PANELS)), FIXTURE);
  });

  const chipOf = { fleet005: labels.HONESTY.fleet005Panel, probe: labels.HONESTY.twoZoneProbePanel };
  for (const id of experiment.REFERENCE_IDS) {
    test(`${id}: its §1.3 label, values equal to the fixture, suppressed rows named, no digest`, async () => {
      await withDom({}, async () => {
        const expected = FIXTURE[id];
        const store = presetStore("UC-03");
        const { container } = mount(store);
        container.querySelector(`[data-reference="${id}"]`).click();
        assert.equal(store.getState().reference, id);
        const panel = container.querySelector(`article.fl-verdict[data-panel="${id}"]`);
        assert.equal(panel.getAttribute("data-kind"), "reference");
        assert.equal(panel.querySelector('[data-role="teaching-chip"]').textContent, chipOf[id]);
        assert.ok(!panel.textContent.includes(labels.HONESTY.verdictChip), "a quoted panel is not labelled a teaching run");
        assert.equal(panel.querySelector('[data-role="register"]').textContent, labels.acrossReplicationsChip(expected.replications));
        assert.equal(panel.querySelector('[data-field="question"]').textContent, expected.question);
        assert.equal(panel.querySelector('[data-field="label"]'), null);

        const words = (gateId) => panel.querySelectorAll(`[data-gate="${gateId}"] .fl-verdict-chip__word`).map((n) => n.textContent);
        assert.deepEqual(words("validity"), [expected.validity]);
        assert.deepEqual(words("primary"), [expected.outcome]);
        assert.deepEqual(words("recommendation"), [expected.recommendation]);

        for (const field of Object.keys(expected.primary).filter((k) => k !== "metric" && k !== "direction")) {
          same(valueOf(panel, `primary.${field}`), expected.primary[field], `${id} primary ${field}`);
        }
        const rails = panel.querySelectorAll('[data-section="guardrails"] tbody tr');
        assert.deepEqual(rails.map((r) => r.getAttribute("data-metric")), expected.guardrails.map((g) => g.metric));
        rails.forEach((row, i) => {
          const g = expected.guardrails[i];
          assert.equal(g.direction, "lower_is_better", "harm is the mean delta for a lower-is-better guardrail");
          same(valueOf(row, "harm"), g.mean_delta, `${g.metric} mean delta`);
          same(valueOf(row, "max_harm"), g.max_harm, `${g.metric} max harm`);
          assert.equal(row.getAttribute("data-status"), g.regressed ? "REGRESSED" : "WITHIN");
        });

        const rows = panel.querySelectorAll('[data-section="descriptives"] tbody tr');
        const quoted = rows.filter((r) => r.getAttribute("data-suppressed") !== "true");
        assert.deepEqual(quoted.map((r) => r.getAttribute("data-metric")), expected.descriptives.map((d) => d.metric));
        quoted.forEach((row, i) => {
          for (const field of ["baseline_mean", "candidate_mean", "mean_delta"]) same(valueOf(row, field), expected.descriptives[i][field], `${expected.descriptives[i].metric} ${field}`);
        });
        const suppressed = rows.filter((r) => r.getAttribute("data-suppressed") === "true");
        assert.deepEqual(suppressed.map((r) => r.getAttribute("data-metric")), expected.suppressed);
        for (const row of suppressed) {
          assert.equal(row.textContent, labels.suppressedMetric(row.getAttribute("data-metric")));
          assert.equal(row.querySelector("[data-value]"), null, "a suppressed row shows no value");
        }

        const text = serialize(panel);
        assert.ok(!/[0-9a-f]{64}/.test(text), "no 64-character digest");
        assert.ok(!/digest/i.test(text), "no digest at all");
        assertCopyRules(panel);
        assertClassesDefined(panel);

        panel.querySelector(`[data-focus-key="close-${id}"]`).click();
        assert.equal(store.getState().reference, null);
        assert.equal(container.querySelector(`article.fl-verdict[data-panel="${id}"]`), null);
      });
    });
  }
});

describe("what the walkthrough borrows from the verdict card (demo plan beat 2.2)", () => {
  test("the frozen spec in words names its axis, its margin, its guardrails, its seeds and its resamples", () => {
    const { spec } = frozenExperiment({ presetId: "OPS-01", replications: 20 });
    const sentence = experiment.specInWords(spec);
    assert.equal(sentence, labels.specSentence({
      axis: spec.axis.id,
      margin: experiment.thresholdText(spec.primary.metric, thresholdValue(spec.primary.metric, spec.primary.margin_units)),
      guardrails: spec.guardrails.length,
      seeds: spec.seeds.length,
      resamples: format.count(spec.resamples),
    }));
    assert.ok(sentence.includes(spec.axis.id), sentence);
    assert.ok(sentence.includes(String(spec.seeds.length)), sentence);
  });

  test("the SITUATION block the setup sheet draws is exported whole, and is the record's own copy", async () => {
    await withDom({}, () => {
      const preset = presetById("OPS-01");
      const root = document.createElement("div");
      for (const node of experiment.situationBlock(preset, true)) root.appendChild(node);
      assert.equal(root.querySelector('[data-role="situation-lead"]').textContent, labels.SITUATION.lead);
      assert.equal(root.querySelector('[data-role="situation"]').textContent, preset.situation);
      assert.deepEqual(root.querySelectorAll('[data-role="proxy"] [data-part="standsFor"]').map((n) => n.textContent), preset.proxy.map((p) => p.standsFor));
      assert.deepEqual(root.querySelectorAll('[data-role="outside-model"] li').map((li) => li.textContent), [...preset.outsideModel]);
      assert.equal(root.querySelector('[data-role="watch"]').textContent, preset.watch);
      assertCopyRules(root);
    });
  });

  test("a value in seconds carries its minutes beside it in a readout, and a value that is not in seconds does not", () => {
    assert.equal(
      experiment.valueWithMinutes("wait.p90_s", -1565.6, { withSign: true }),
      labels.withMinutes({ seconds: experiment.metricValueText("wait.p90_s", -1565.6, { withSign: true }), minutes: format.signed(-1565.6 / 60, 1) }),
    );
    assert.equal(experiment.valueWithMinutes("unserved.fraction", 0.034), experiment.metricValueText("unserved.fraction", 0.034));
    assert.equal(experiment.valueWithMinutes("requests.total", 1870), experiment.metricValueText("requests.total", 1870));
  });

  test("the freeze notice says whose clock the freeze time is on", async () => {
    await withDom({}, async () => {
      const { container } = await finishedRun("UC-01");
      const notice = container.querySelector('[data-role="freeze-notice"]');
      assert.equal(notice.textContent, labels.freezeNotice({ frozenAt: "14:02", changedKnobs: 0 }));
      assert.ok(notice.textContent.includes(labels.yourClock("14:02")), notice.textContent);
    });
  });
});

describe("value text", () => {
  test("metric values and thresholds read in their unit, and knob values in the knob's unit", () => {
    assert.equal(experiment.metricValueText("wait.p90_s", 826.15, { withSign: true }), "+826.1 s");
    assert.equal(experiment.metricValueText("unserved.fraction", 0.0565410199556541, { withSign: true }), "+0.057");
    assert.equal(experiment.metricValueText("requests.served", 425.5), "425.5");
    assert.equal(experiment.metricValueText("depot.bay_wait_p90_s{depot=SJ-1}", 600), "600.0 s");
    assert.equal(experiment.metricValueText("depot.queue_p90_s", 146.33999999999997), "146.3 s");
    assert.equal(experiment.thresholdText("unserved.fraction", 0.02), "0.02");
    assert.equal(experiment.thresholdText("wait.p90_s", 30), "30 s");
    // 20000 ppm is 0.02; 15 ppm is 0.000015; 60 s stays 60.
    assert.equal(experiment.unitsAsText("unserved.fraction", 20000), "0.02");
    assert.equal(experiment.unitsAsText("unserved.fraction", 15), "0.000015");
    assert.equal(experiment.unitsAsText("wait.p90_s", 60), "60");
    assert.equal(experiment.parseAxisValue(" 16 "), 16);
    assert.equal(experiment.parseAxisValue("nearest_depot"), "nearest_depot");
    assert.equal(experiment.differenceText({ knob: "DEP-3.SJ-1", from: 3, to: 1 }), labels.changeItem({ knobName: "Cleaning bays per depot, SJ-1", from: "3 bays", to: "1 bays" }));
    assert.equal(experiment.differenceText({ knob: "RD-3.highway.SJ>SF", from: Array(48).fill(1000), to: [...Array(16).fill(1000), 1600, 1600, 1600, ...Array(29).fill(1000)] }), `Congestion by hour, class and direction, highway SJ to SF: ${labels.hoursChanged(3)}`);
    const spec = freezeSpec(experimentDraft({ presetId: "UC-03" })).spec;
    assert.equal(experiment.specDraftOf({ question: spec.question, baselineScenario: spec.scenario, axis: spec.axis, primary: spec.primary, guardrails: spec.guardrails, seedSet: 1, seedCount: 10, resamples: 2000 }).seeds.length, 10);
    assert.equal(experiment.specDraftOf({ seedSet: 1, seedCount: "ten" }).seeds, null);
  });

  test("a nonzero metric value never reads as zero, keeps its sign, and a zero never reads -0 (honesty review)", () => {
    const text = experiment.metricValueText;
    const signed = { withSign: true };
    // At three decimals 2.7e-5 rounds to 0.000, so the text falls back to the exact double, signed on a delta.
    assert.equal(text("unserved.fraction", 2.7e-5, signed), "+0.000027");
    assert.equal(text("unserved.fraction", 2.7e-5), "0.000027");
    assert.equal(text("unserved.fraction", -2.7e-5, signed), "-0.000027");
    // Below 1e-6 String() prints an exponent; the text stays plain decimals. Seconds and counts follow the same rule.
    assert.equal(text("unserved.fraction", -1e-7, signed), "-0.0000001");
    assert.equal(text("wait.p90_s", -0.00001, signed), "-0.00001 s");
    assert.equal(text("requests.served", 0.04, signed), "+0.04");
    // A value that keeps a nonzero digit still rounds: 0.0005 is stored just above the tie and reads +0.001.
    assert.equal(text("unserved.fraction", 0.0005, signed), "+0.001");
    // Zero and negative zero round to zero exactly and read with no sign.
    for (const zero of [0, -0]) {
      assert.equal(text("unserved.fraction", zero, signed), "0.000");
      assert.equal(text("wait.p90_s", zero, signed), "0.0 s");
    }
  });

  test("a REGRESSED fraction guardrail with harm 2.7e-5 against max harm 0 reads a signed nonzero harm on the card (honesty review)", async () => {
    await withDom({}, async () => {
      const [rail] = guardrailStatuses([{ metric: "unserved.fraction", mean_delta: 2.7e-5 }], [{ metric: "unserved.fraction", max_harm: 0, direction: "lower_is_better" }]);
      assert.equal(rail.status, "REGRESSED", "harm above max harm 0 regresses (strict)");
      // UC-03's frozen spec (one unserved.fraction guardrail, 10 seeds) with a fraction primary, so the small primary
      // values read on the fraction rule too. Every number of the verdict is written here.
      const frozen = structuredClone(frozenExperiment({ presetId: "UC-03" }));
      frozen.spec.primary = { metric: "unserved.fraction", scope: {}, direction: "lower_is_better", margin_units: 1000 };
      const verdict = {
        validity: "VALID",
        invalidity_reason: null,
        invalidity_detail: null,
        outcome: "UNCHANGED",
        recommendation: "HOLD",
        primary: { metric: "unserved.fraction", role: "PRIMARY", baseline_mean: 0.05, candidate_mean: 0.05, paired_deltas: [-0.00027, ...Array(9).fill(0)], mean_delta: -2.7e-5, median_delta: 0, ci_low: -0.00004, ci_high: -0 },
        guardrail_results: [],
        guardrail_statuses: [rail],
        guardrail_regressions: ["unserved.fraction"],
        descriptives: [{ metric: "wait.p90_s", role: "DESCRIPTIVE", baseline_mean: 600, candidate_mean: 600, paired_deltas: [], mean_delta: -0.00001, median_delta: 0 }],
      };
      const card = experiment.renderVerdictCard(experiment.verdictView({ verdict }, frozen));

      // The harm used to read 0.000 with no sign beside max harm 0, so a regression looked like no harm at all.
      const row = card.querySelector('[data-section="guardrails"] tr[data-metric="unserved.fraction"]');
      assert.equal(row.getAttribute("data-status"), "REGRESSED");
      const harm = row.querySelector('[data-field="harm"]').textContent;
      const maxHarm = row.querySelector('[data-field="max_harm"]').textContent;
      assert.equal(harm, "+0.000027");
      assert.match(harm, /^\+0\.0*[1-9]/, "the harm is signed and nonzero");
      assert.equal(maxHarm, "0", "the max harm is a plain zero");
      assert.notEqual(Number(harm), Number(maxHarm), "harm and max harm never read as the same number");

      // A tiny negative delta keeps its sign and digits; a zero and a negative zero read 0.000 with no sign.
      const shown = (field) => card.querySelector(`[data-field="${field}"]`).textContent;
      assert.equal(shown("primary.mean_delta"), "-0.000027");
      assert.equal(shown("primary.median_delta"), "0.000");
      assert.equal(shown("primary.ci_low"), "-0.00004");
      assert.equal(shown("primary.ci_high"), "0.000", "a negative zero bound never reads -0.000");
      assert.equal(card.querySelector('[data-section="descriptives"] [data-field="mean_delta"]').textContent, "-0.00001 s");
      for (const node of card.querySelectorAll("[data-value]")) {
        const field = node.getAttribute("data-field");
        if (Number(node.getAttribute("data-value")) !== 0) assert.match(node.textContent, /[1-9]/, `${field} reads ${node.textContent}`);
        assert.doesNotMatch(node.textContent, /^-0(?:\.0+)?(?: s)?$/, `${field} reads a negative zero`);
      }
      assertCopyRules(card);
    });
  });
});

describe("honesty copy on the verdict card (review: honesty-copy lens)", () => {
  test("the PRIMARY heading and the strip give one definition of the plotted delta for either direction", async () => {
    await withDom({}, async () => {
      const payload = await experimentPayload({ presetId: "UC-03" });
      // The UC-03 spec with its primary's direction set each way; only the declared direction differs between the cards.
      for (const direction of ["lower_is_better", "higher_is_better"]) {
        const frozen = structuredClone(frozenExperiment({ presetId: "UC-03" }));
        frozen.spec.primary.direction = direction;
        const view = experiment.verdictView(payload, frozen);
        const strip = experiment.chartsPrimaryStrip({ verdict: payload.verdict, spec: frozen.spec });
        const card = experiment.renderVerdictCard(view, { strip });
        const caption = labels.primaryDeltaCaption(direction);
        assert.equal(card.querySelector('[data-role="delta-caption"]').textContent, ` · ${caption} · ${labels.DIRECTIONS[direction]}`);
        assert.ok(card.querySelector('[data-section="primary"] [data-role="axis-unit"]').textContent.startsWith(caption), `${direction}: the strip reads the heading's caption`);
        if (direction === "higher_is_better") {
          assert.ok(!card.querySelector('[data-role="delta-caption"]').textContent.includes(labels.VERDICT.perSeedDelta), "a higher-is-better heading never calls the plotted value candidate minus baseline");
        }
        // The dl rows stay raw candidate minus baseline and say so, without the strip's orientation.
        const terms = card.querySelectorAll('[data-section="primary"] dt').map((dt) => dt.textContent);
        for (const term of [labels.VERDICT.meanDelta, labels.VERDICT.medianDelta, labels.VERDICT.interval95]) {
          assert.ok(terms.includes(labels.candidateMinusBaseline(term)), `${direction}: ${term} names its sign`);
        }
        for (const term of terms) assert.ok(!term.includes(labels.VERDICT.leftIsBetter));
        same(valueOf(card, "primary.ci_low"), payload.verdict.primary.ci_low, "the dl interval is the raw payload interval");
        assert.equal(card.lastChild.textContent, labels.HONESTY.verdictFooter, "a teaching run keeps its footer");
        assert.equal(card.querySelector('[data-section="differences"]'), null, "a teaching run has no FleetLab differences panel");
        assertCopyRules(card);
      }
    });
  });

  for (const id of experiment.REFERENCE_IDS) {
    test(`${id}: no teaching-run footer or teaching-model limits, and the differences panel explains every suppressed row`, async () => {
      await withDom({}, async () => {
        const store = presetStore("UC-03");
        const { container } = mount(store);
        container.querySelector(`[data-reference="${id}"]`).click();
        const panel = container.querySelector(`article.fl-verdict[data-panel="${id}"]`);
        assert.equal(panel.querySelector(".fl-verdict__footer"), null);
        assert.ok(!panel.textContent.includes(labels.HONESTY.verdictFooter), "the footer's world contrast is false for a FleetLab run");
        for (const [key, text] of Object.entries(labels.MODEL_LIMITS)) {
          if (key !== "heading") assert.ok(!panel.textContent.includes(text), `the teaching-model limit ${key} is not listed`);
        }
        assert.equal(panel.querySelector('[data-role="all-limitations"]'), null);
        assert.deepEqual(panel.querySelectorAll('[data-section="limitations"] > ul li').map((li) => li.textContent), [...labels.VERDICT.limitationItems]);

        const suppressed = panel.querySelectorAll('[data-section="descriptives"] tbody tr').filter((r) => r.getAttribute("data-suppressed") === "true");
        assert.ok(suppressed.length > 0, `${id} suppresses values`);
        const differences = panel.querySelector('[data-section="differences"]');
        assert.ok(differences, "a suppressed row's target exists");
        assert.equal(differences.querySelector("h3").textContent, labels.REFERENCE.differencesPanel);
        assert.deepEqual(differences.querySelectorAll('[data-role="intentionally-different"] li').map((li) => li.textContent), [...labels.REFERENCE_DIFFERENCES.different]);
        const withheld = differences.querySelectorAll('[data-role="withheld"] li');
        assert.deepEqual(withheld.map((li) => li.getAttribute("data-metric")), suppressed.map((r) => r.getAttribute("data-metric")));
        for (const li of withheld) assert.equal(li.textContent, labels.withheldReason(li.getAttribute("data-metric")));
        for (const row of suppressed) {
          const link = row.querySelector('[data-role="differences-link"]');
          assert.equal(link.textContent, labels.REFERENCE.suppressedRowLink);
          link.click();
          assert.equal(document.activeElement, differences, "the link moves focus to the differences panel");
          link.focus();
        }
        assertCopyRules(panel);
        assertClassesDefined(panel);
      });
    });
  }
});

describe("Experiment flow across modes, presets and seed sets (review: experiment-flow lens)", () => {
  // The seven Experiment presets, the two L2 specs, then the operations casebook in theme order (design §10.1, section 4.4).
  const CHOOSER = [
    "UC-01", "UC-02", "UC-03", "UC-05", "UC-08a", "UC-08b", "UC-10",
    "L2a", "L2b",
    "OPS-01", "OPS-02", "OPS-03", "OPS-04",
    "OPS-05", "OPS-06", "OPS-07", "OPS-08",
    "OPS-09", "OPS-10", "OPS-11", "OPS-12",
    "OPS-13", "OPS-14", "OPS-15", "OPS-16",
    "OPS-17", "OPS-18", "OPS-19", "OPS-20",
  ];

  function defaultStore() {
    const base = presetById(DEFAULT_PRESET_ID);
    return createStore(createInitialState({ presetId: base.id, scenario: cloneScenario(base.scenario) }));
  }

  test("after Test it properly and a verdict, a Sandbox round trip keeps the frozen setup; a knob change marks it out of date", async () => {
    await withDom({}, async () => {
      const store = defaultStore();
      const dispatch = (action) => store.dispatch(action);
      learn.openLearnCase(dispatch, "L3");
      learn.testItProperly(dispatch, "L3");
      store.dispatch({ type: "experiment/draft", patch: { seedCount: 10 } });
      const payload = await experimentPayload({ presetId: "L3" });
      const host = fakeHost({ payloadFor: () => payload });
      const { container } = mount(store, { host });
      await freezeByClick(container, host);
      const frozen = store.getState().experiment.frozen;
      assert.equal(frozen.digest, payload.digest);
      const l3 = presetById("L3");
      const declaredChanges = describeDifferences(l3.scenario, l3.experiment.scenario).length;
      assert.ok(declaredChanges > 0, "the declared scenario differs from the Learn preset (travel variation)");

      store.dispatch({ type: "mode/set", mode: "sandbox" });
      store.dispatch({ type: "mode/set", mode: "experiment" });
      assert.equal(freezeSpec(experiment.specDraftOf(store.getState().experiment.draft)).digest, frozen.digest, "the setup still freezes as the verdict's spec");
      assert.equal(container.querySelector('[data-role="verdict-stale"]'), null);
      assert.equal(container.querySelector('[data-role="baseline-line"]').textContent, labels.baselineLine({ presetName: l3.title, changes: declaredChanges }));

      store.dispatch({ type: "mode/set", mode: "sandbox" });
      store.dispatch({ type: "knob/set", knob: "DEP-7", path: ["trips_between_visits"], value: 12 });
      store.dispatch({ type: "mode/set", mode: "experiment" });
      assert.notEqual(freezeSpec(experiment.specDraftOf(store.getState().experiment.draft)).digest, frozen.digest);
      assert.equal(container.querySelector('[data-role="verdict-stale"]').textContent, labels.FREEZE.verdictStale);
      assert.equal(host.calls.length, 1, "nothing re-runs silently");
    });
  });

  test("the chooser groups its options: the Experiment presets, the L2 specs, then one casebook theme each (section 4.4)", async () => {
    await withDom({}, async () => {
      const store = defaultStore();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      const select = container.querySelector('[data-role="preset-chooser"] select');
      // The placeholder stays first and outside any group; every preset sits inside a labelled group.
      const [placeholder, ...groups] = select.children;
      assert.equal(placeholder.localName, "option");
      assert.equal(placeholder.getAttribute("value"), "");
      assert.ok(groups.every((g) => g.localName === "optgroup"), "every other child is a group");
      const casebook = OPS_THEME_IDS.map((theme) => ({ label: labels.casebookGroup(theme), ids: opsPresetsOf(theme).map((p) => p.id) }));
      const expected = [
        { label: labels.PRESET_GROUPS.experiment, ids: ["UC-01", "UC-02", "UC-03", "UC-05", "UC-08a", "UC-08b", "UC-10"] },
        { label: labels.PRESET_GROUPS.learn, ids: ["L2a", "L2b"] },
        ...casebook,
      ];
      assert.deepEqual(groups.map((g) => ({ label: g.getAttribute("label"), ids: g.querySelectorAll("option").map((o) => o.getAttribute("value")) })), expected);
      assert.deepEqual(experiment.CHOOSER_GROUPS.map((g) => ({ label: g.label, ids: [...g.ids] })), expected);
      assert.deepEqual(experiment.CHOOSER_GROUPS.flatMap((g) => [...g.ids]), CHOOSER);
      for (const { ids } of casebook) {
        assert.equal(ids.length, 4, "four presets per theme");
        assert.ok(ids.every((id) => presetById(id).kind === "ops"));
      }
      assert.ok(Object.isFrozen(experiment.CHOOSER_GROUPS) && experiment.CHOOSER_GROUPS.every((g) => Object.isFrozen(g) && Object.isFrozen(g.ids)));
      assertCopyRules(container);
    });
  });

  test("Start from a preset offers every Experiment preset, both L2 presets and the casebook; UC-01 reaches Freeze and run with the null check note", async () => {
    await withDom({}, async () => {
      const store = defaultStore();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      const select = container.querySelector('[data-role="preset-chooser"] select');
      const options = Array.from(select.querySelectorAll("option"));
      assert.deepEqual(options.map((o) => o.getAttribute("value")), ["", ...CHOOSER]);
      assert.deepEqual(experiment.CHOOSER_PRESET_IDS, CHOOSER);
      assert.equal(CHOOSER.length, 29);
      assert.deepEqual(options.slice(1).map((o) => o.textContent), CHOOSER.map((id) => labels.presetOption({ id, title: presetById(id).title })));
      assert.equal(options[0].textContent, labels.EXPERIMENT_SETUP.choosePreset);
      assert.equal(container.querySelector('[data-role="freeze"]').disabled, true);

      select.value = "UC-01";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const s = store.getState();
      assert.equal(s.presetId, "UC-01");
      assert.equal(s.mode, "experiment");
      assert.equal(s.experiment.draft.axisSource, "preset");
      assert.equal(freezeSpec(experiment.specDraftOf(s.experiment.draft)).digest, freezeSpec(presetById("UC-01").experiment).digest);
      assert.equal(container.querySelector('[data-role="preset-chooser"] select').value, "UC-01");
      assert.equal(container.querySelector('[data-role="freeze"]').disabled, false);
      assert.equal(container.querySelector('[data-role="null-check"]').textContent, labels.EXPERIMENT_SETUP.nullCheck);
      assert.equal(container.querySelector('[data-role="baseline-line"]').textContent, labels.baselineLine({ presetName: presetById("UC-01").title, changes: 0 }));
      assertCopyRules(container);
      assertClassesDefined(container);
    });
  });

  test("the null check note needs the UC-01 draft itself, not only its axis (G9)", async () => {
    await withDom({}, async () => {
      const uc01Axis = structuredClone(presetById("UC-01").experiment.axis);
      const store = presetStore("L3");
      store.dispatch({ type: "experiment/draft", patch: { axis: uc01Axis } });
      const { container } = mount(store);
      assert.equal(isNullCheckDraft(experiment.specDraftOf(store.getState().experiment.draft)), false);
      assert.equal(container.querySelector('[data-role="null-check"]'), null, "L3's scenario and primary with UC-01's axis is not the null check");
      const uc01 = presetStore("UC-01");
      assert.equal(isNullCheckDraft(experiment.specDraftOf(uc01.getState().experiment.draft)), true);
      assert.equal(mount(uc01).container.querySelector('[data-role="null-check"]').textContent, labels.EXPERIMENT_SETUP.nullCheck);
    });
  });

  test("all 29 offered presets are in the chooser, a tab stop that keeps focus as each one loads (G10)", async () => {
    await withDom({}, async () => {
      const store = defaultStore();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      const select = () => container.querySelector('[data-role="preset-chooser"] select');
      assert.ok(tabbables(container).includes(select()), "keyboard: the chooser is a tab stop");
      assert.equal(select().getAttribute("aria-label"), labels.EXPERIMENT_SETUP.startFromPreset);
      const offered = select().querySelectorAll("option").map((o) => o.getAttribute("value"));
      for (const id of CHOOSER) {
        assert.ok(offered.includes(id), `${id} is offered`);
        select().focus();
        select().value = id;
        select().dispatchEvent(new Event("change", { bubbles: true }));
        assert.equal(store.getState().presetId, id);
        assert.equal(select().value, id);
        assert.equal(document.activeElement, select(), `focus stays on the chooser after ${id} loads`);
        assert.equal(freezeSpec(experiment.specDraftOf(store.getState().experiment.draft)).digest, freezeSpec(presetById(id).experiment).digest);
      }
    });
  });

  /** The chooser set to `id`, as a reader would do it. */
  function choose(container, id) {
    const select = container.querySelector('[data-role="preset-chooser"] select');
    select.value = id;
    assert.equal(select.value, id, `${id} is offered`);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  test("a casebook preset loads its draft and shows its Situation block before the question; an Experiment preset removes it (section 4.4)", async () => {
    await withDom({}, async () => {
      const store = defaultStore();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      const blockIds = () => container.querySelectorAll("[data-block]").map((b) => b.getAttribute("data-block"));
      assert.equal(container.querySelector('[data-block="situation"]'), null, "no Situation block before a casebook preset is chosen");

      choose(container, "OPS-01");
      const preset = presetById("OPS-01");
      assert.equal(preset.kind, "ops");
      assert.equal(store.getState().presetId, "OPS-01");
      assert.equal(freezeSpec(experiment.specDraftOf(store.getState().experiment.draft)).digest, freezeSpec(preset.experiment).digest);
      assert.equal(container.querySelector('[data-role="freeze"]').disabled, false);
      assert.deepEqual(blockIds(), ["situation", "question", "scenario", "oneChange", "primary", "guardrails", "seeds"]);

      const block = container.querySelector('[data-block="situation"]');
      assert.equal(block.localName, "details");
      assert.ok(block.hasAttribute("open"), "open on a desktop like the other blocks");
      const summary = block.firstChild;
      assert.equal(summary.localName, "summary");
      assert.equal(summary.textContent, labels.EXPERIMENT_SETUP.blocks.situation);
      assert.equal(summary.getAttribute("class"), "fl-title");
      assert.equal(summary.getAttribute("data-focus-key"), "block-situation");
      assert.doesNotMatch(summary.textContent, /^[0-9]/, "unnumbered: the six numbered blocks keep their numbers");

      // The body, in order: the lead, the situation, the proxy, what lies outside the model, and what to watch.
      assert.equal(block.querySelector('[data-role="situation-lead"]').textContent, labels.SITUATION.lead);
      assert.equal(block.querySelector('[data-role="situation"]').textContent, preset.situation);
      assert.deepEqual(block.querySelectorAll("h3").map((h) => h.textContent), [labels.SITUATION.proxyHeading, labels.SITUATION.outsideHeading, labels.SITUATION.watchHeading]);
      const entries = block.querySelectorAll('[data-role="proxy"] > li');
      assert.equal(entries.length, preset.proxy.length);
      assert.ok(entries.length > 0, "OPS-01 declares a proxy");
      entries.forEach((entry, i) => {
        assert.equal(entry.getAttribute("data-proxy"), String(i));
        assert.deepEqual(entry.querySelectorAll("dt").map((dt) => dt.textContent), [labels.SITUATION.standsFor, labels.SITUATION.setAs, labels.SITUATION.misses]);
        for (const part of ["standsFor", "setAs", "misses"]) assert.equal(entry.querySelector(`[data-part="${part}"]`).textContent, preset.proxy[i][part]);
      });
      assert.deepEqual(block.querySelectorAll('[data-role="outside-model"] li').map((li) => li.textContent), [...preset.outsideModel]);
      assert.ok(preset.outsideModel.length > 0, "OPS-01 names what lies outside the model");
      assert.equal(block.querySelector('[data-role="watch"]').textContent, preset.watch);
      const order = [labels.SITUATION.lead, preset.situation, labels.SITUATION.proxyHeading, labels.SITUATION.outsideHeading, labels.SITUATION.watchHeading, preset.watch].map((t) => block.textContent.indexOf(t));
      assert.deepEqual(order, [...order].sort((a, b) => a - b), "the parts read in that order");
      assert.ok(order.every((at) => at >= 0));

      // Keyboard: the block sits between the chooser and the question, and its summary (a native tab stop) adds no
      // control that would break the sheet's order: the chooser is still followed by the question field.
      const setup = container.querySelector('[data-role="setup"]');
      const chooser = setup.querySelector('[data-role="preset-chooser"]');
      assert.equal(chooser.nextSibling, block, "the Situation block follows the chooser");
      assert.equal(block.nextSibling.getAttribute("data-block"), "question");
      const stops = tabbables(setup);
      assert.equal(stops[0], chooser.querySelector("select"));
      assert.equal(stops[1].getAttribute("data-focus-key"), "question");
      assert.ok(!stops.some((node) => block.contains(node) && node !== summary), "no control inside the block precedes the question");
      assertCopyRules(container);
      assertClassesDefined(container);

      choose(container, "UC-02");
      assert.equal(store.getState().presetId, "UC-02");
      assert.equal(freezeSpec(experiment.specDraftOf(store.getState().experiment.draft)).digest, freezeSpec(presetById("UC-02").experiment).digest);
      assert.equal(container.querySelector('[data-block="situation"]'), null, "absent, not hidden");
      assert.deepEqual(blockIds(), ["question", "scenario", "oneChange", "primary", "guardrails", "seeds"]);
      assert.ok(!container.textContent.includes(preset.situation));

      // Back to the casebook: the block returns, still open, with the new preset's situation.
      choose(container, "OPS-07");
      assert.deepEqual(blockIds().slice(0, 2), ["situation", "question"]);
      assert.ok(container.querySelector('[data-block="situation"]').hasAttribute("open"));
      assert.equal(container.querySelector('[data-role="situation"]').textContent, presetById("OPS-07").situation);
    });
  });

  test("an edited setup keeps the lead and the situation and says it no longer matches the case; the other lines return when it matches again", async () => {
    await withDom({}, async () => {
      const store = defaultStore();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      choose(container, "OPS-01");
      const preset = presetById("OPS-01");
      const block = () => container.querySelector('[data-block="situation"]');
      assert.ok(block().querySelector('[data-role="proxy"]'), "the proxy shows while the draft is the case");
      assert.equal(block().querySelector('[data-role="situation-edited"]'), null);

      // Rephrasing the question keeps the lines: the proxy and watch do not depend on it.
      store.dispatch({ type: "experiment/draft", patch: { question: "A question in the reader's words?" } });
      assert.ok(block().querySelector('[data-role="proxy"]'));
      assert.equal(block().querySelector('[data-role="watch"]').textContent, preset.watch);

      // Another axis is another setup: the block keeps the lead and the situation and says so in place of the rest, so
      // the sheet never shows the case's proxy beside a ONE CHANGE block that names a different knob.
      store.dispatch({ type: "experiment/draft", patch: { axis: { id: "parameter:DEP-4", baseline: 1200, candidate: 1800 } } });
      assert.notEqual(freezeSpec(experiment.specDraftOf(store.getState().experiment.draft)).digest, freezeSpec(preset.experiment).digest);
      assert.equal(block().querySelector('[data-role="situation-lead"]').textContent, labels.SITUATION.lead);
      assert.equal(block().querySelector('[data-role="situation"]').textContent, preset.situation);
      assert.equal(block().querySelector('[data-role="situation-edited"]').textContent, labels.situationEdited({ id: "OPS-01" }));
      for (const role of ["proxy", "outside-model", "watch"]) assert.equal(block().querySelector(`[data-role="${role}"]`), null, `${role} is absent, not hidden`);
      assert.deepEqual(block().querySelectorAll("h3"), []);
      assert.ok(!container.textContent.includes(preset.watch));
      assertCopyRules(container);

      // Back on the case's axis, the lines return.
      store.dispatch({ type: "experiment/draft", patch: { axis: preset.experiment.axis } });
      assert.equal(block().querySelector('[data-role="situation-edited"]'), null);
      assert.equal(block().querySelector('[data-role="watch"]').textContent, preset.watch);

      // An invalid draft is an edited one too, and the sheet renders without freezing it.
      store.dispatch({ type: "experiment/draft", patch: { axis: { id: "parameter:DEP-4", baseline: 1200, candidate: 999999 } } });
      assert.equal(container.querySelector('[data-role="freeze"]').disabled, true);
      assert.ok(block().querySelector('[data-role="situation-edited"]'));
      assert.equal(block().querySelector('[data-role="proxy"]'), null);
    });
  });

  test("the Situation block also follows a casebook preset opened from Sandbox, and closes with the reader's choice", async () => {
    await withDom({}, async () => {
      const preset = presetById("OPS-12");
      const store = createStore(createInitialState({ presetId: preset.id, scenario: cloneScenario(preset.scenario) }));
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      assert.equal(store.getState().experiment.draft.baselineSource.presetId, "OPS-12");
      const block = () => container.querySelector('[data-block="situation"]');
      assert.equal(block().querySelector('[data-role="situation"]').textContent, preset.situation);
      assert.ok(block().hasAttribute("open"));
      block().removeAttribute("open");
      block().dispatchEvent(new Event("toggle"));
      store.dispatch({ type: "experiment/draft", patch: { question: "A new question?" } });
      assert.ok(!block().hasAttribute("open"), "the reader's closed block stays closed across a re-render");
      assert.ok(container.querySelector('[data-block="question"]').hasAttribute("open"));
    });
  });

  test("on a phone the Situation block starts closed and the question stays the one open block", async () => {
    await withDom({ media: { [PHONE]: true } }, async () => {
      const store = defaultStore();
      store.dispatch({ type: "mode/set", mode: "experiment" });
      const { container } = mount(store);
      choose(container, "OPS-15");
      const open = () => container.querySelectorAll("details[data-block]").filter((d) => d.hasAttribute("open")).map((d) => d.getAttribute("data-block"));
      assert.equal(container.querySelectorAll("details[data-block]").length, 7);
      assert.deepEqual(open(), ["question"]);
      const situation = container.querySelector('details[data-block="situation"]');
      situation.setAttribute("open", "");
      situation.dispatchEvent(new Event("toggle"));
      store.dispatch({ type: "experiment/draft", patch: { question: "A new question?" } });
      assert.deepEqual(open(), ["situation", "question"]);
      assertCopyRules(container);
      assertClassesDefined(container);
    });
  });

  test("an edit made while the run is going marks the verdict out of date when it arrives", async () => {
    await withDom({}, async () => {
      const payload = await experimentPayload({ presetId: "UC-03" });
      const store = presetStore("UC-03");
      let resolve;
      const host = fakeHost({ payloadFor: () => new Promise((r) => { resolve = r; }) });
      const { container } = mount(store, { host });
      container.querySelector('[data-role="freeze"]').click();
      await tick();
      assert.equal(store.getState().experiment.status, "running");
      const question = container.querySelector('[data-focus-key="question"]');
      question.value = "edited during the run";
      question.dispatchEvent(new Event("input", { bubbles: true }));
      resolve(payload);
      await host.last;
      await tick();
      await tick();
      const ex = store.getState().experiment;
      assert.equal(ex.status, "done");
      assert.equal(ex.verdictStale, true);
      assert.match(container.querySelector("article.fl-verdict").getAttribute("class"), /(^| )fl-stale( |$)/);
      assert.equal(container.querySelector('[data-role="verdict-stale"]').textContent, labels.FREEZE.verdictStale);
      assert.equal(host.calls.length, 1);
    });
  });

  test("Use another seed set freezes the frozen spec on set k + 1, identical except its seed set and seeds", async () => {
    await withDom({}, async () => {
      const store = presetStore("UC-03");
      const host = fakeHost({ payloadFor: (spec) => experimentPayload({ presetId: "UC-03", seedSet: spec.seed_set }) });
      const { container } = mount(store, { host });
      await freezeByClick(container, host);
      const first = store.getState().experiment.frozen.spec;
      container.querySelector('[data-role="another-seed-set"]').click();
      await host.last;
      await tick();
      await tick();
      assert.equal(host.calls.length, 2);
      const { seed_set: k1, seeds: seeds1, ...rest1 } = first;
      const { seed_set: k2, seeds: seeds2, ...rest2 } = host.calls[1].spec;
      assert.deepEqual(rest2, rest1);
      assert.equal(k2, k1 + 1);
      assert.deepEqual(seeds2, seedSet(k1 + 1, seeds1.length));
      assert.equal(store.getState().experiment.draft.seedSet, k2, "the draft follows the new frozen spec");
      assert.equal(store.getState().experiment.verdictStale, false);
    });
  });

  test("with the setup edited after the verdict, Use another seed set is off, says why, and runs nothing", async () => {
    await withDom({}, async () => {
      const { store, host, container, view } = await finishedRun("UC-03");
      const { margin_units: _units, ...primary } = store.getState().experiment.draft.primary;
      store.dispatch({ type: "experiment/draft", patch: { primary: { ...primary, margin_text: "0" } } });
      const edited = store.getState().experiment.draft;
      assert.equal(container.querySelector('[data-role="another-seed-set"]').disabled, true);
      assert.equal(container.querySelector('[data-role="another-seed-set-off"]').textContent, labels.SESSION_LOG.anotherSeedSetOff);
      assert.equal(await view.useAnotherSeedSet(), null);
      const ex = store.getState().experiment;
      assert.equal(ex.draft, edited, "the edited draft is untouched");
      assert.equal(ex.frozen.spec.seed_set, 1);
      assert.equal(ex.sessionLog.length, 1);
      assert.equal(host.calls.length, 1);
      assertCopyRules(container);
      assertClassesDefined(container);
    });
  });

  test("runEstimate: the target per device, a timed run, rounding up, and the fewer-seeds count", () => {
    assert.deepEqual(experiment.runEstimate({ seedCount: 20 }), { seconds: 10, fewerSeeds: null });
    assert.deepEqual(experiment.runEstimate({ seedCount: 20, phone: true }), { seconds: 45, fewerSeeds: null });
    // 40 seeds on a phone: 2,250 ms per seed is 90 s; 60 s fits 26 seeds.
    assert.deepEqual(experiment.runEstimate({ seedCount: 40, phone: true }), { seconds: 90, fewerSeeds: 26 });
    assert.deepEqual(experiment.runEstimate({ seedCount: 3, msPerSeed: 0.1 }), { seconds: 1, fewerSeeds: null });
    assert.deepEqual(experiment.runEstimate({ seedCount: 30, msPerSeed: 100 }), { seconds: 3, fewerSeeds: null });
    assert.deepEqual(experiment.runEstimate({ seedCount: 61, msPerSeed: 1000 }), { seconds: 61, fewerSeeds: 60 });
    for (const bad of [0, -1, 1001, 2.5, "20", null]) assert.equal(experiment.runEstimate({ seedCount: bad }), null);
  });

  test("the seeds block shows the run estimate from the target, then from the timed run; above 60 s it suggests fewer seeds", async () => {
    await withDom({}, async () => {
      const payload = await experimentPayload({ presetId: "UC-03" });
      const store = presetStore("UC-03");
      const host = fakeHost({ payloadFor: () => payload });
      const times = [1000, 4000];
      const { container } = mount(store, { host, clock: () => times.shift() });
      const estimate = () => container.querySelector('[data-block="seeds"] [data-role="run-estimate"]').textContent;
      // Before any run: 10 s for 20 seeds on a laptop (design §7.7), so 10 seeds take about 5 s.
      assert.equal(estimate(), labels.aboutDuration(format.seconds(5)));
      assert.equal(container.querySelector('[data-role="slow-advice"]'), null);
      await freezeByClick(container, host);
      // The run took 3,000 ms for 10 seeds: 300 ms per seed.
      assert.equal(estimate(), labels.aboutDuration(format.seconds(3)));
      store.dispatch({ type: "experiment/draft", patch: { seedCount: 400 } });
      // 400 × 300 ms is 120 s; 60 s fits 200 seeds; the interval grows about the square root of 2, 1.4 times.
      const about = labels.aboutDuration(format.seconds(120));
      assert.equal(estimate(), about);
      assert.equal(container.querySelector('[data-role="slow-advice"]').textContent, labels.slowExperimentAdvice({ estimate: about, seeds: 400, fewerSeeds: 200, widening: labels.timesAsWide("1.4") }));
      store.dispatch({ type: "experiment/draft", patch: { seedCount: "many" } });
      assert.equal(estimate(), labels.absentValue(labels.ABSENT_REASONS.seedCountNotValid));
      assertCopyRules(container);
      assertClassesDefined(container);
    });
  });
});
