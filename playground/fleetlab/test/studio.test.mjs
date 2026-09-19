import assert from "node:assert/strict";
import { test } from "node:test";
import { mountStudio } from "../src/ui/studio.js";
import { createInitialState, createStore } from "../src/ui/store.js";
import { defaultScenario } from "../src/model/schema.js";
import { installFakeDom } from "./helpers/fake-dom.mjs";

function setup() {
  const restore = installFakeDom();
  const root = document.createElement("div");
  document.body.appendChild(root);
  const store = createStore(createInitialState({ presetId: "bay_teaching_map", scenario: defaultScenario() }));
  const calls = [];
  const app = { root, store, playback: { pause: () => calls.push("pause") }, present: { open: () => calls.push("present"), close: () => calls.push("close") } };
  const studio = mountStudio(app);
  return { restore, root, store, calls, studio };
}

test("overview does not execute a simulation and a depot stage explains its boundary", () => {
  const x = setup();
  try {
    assert.equal(x.root.hidden, true);
    assert.equal(x.store.getState().run.status, "idle");
    const stage = document.querySelector('[data-stage="service"]');
    stage.click();
    assert.equal(stage.getAttribute("aria-pressed"), "true");
    assert.match(document.querySelector('[data-role="stage-detail"]').textContent, /service/i);
    assert.equal(x.calls.includes("present"), false);
  } finally { x.studio.destroy(); x.restore(); }
});

test("capacity pathway loads the real preset without silently running an experiment", () => {
  const x = setup();
  try {
    x.studio.navigate("depots");
    assert.equal(x.root.hidden, false);
    assert.equal(x.store.getState().presetId, "UC-08a");
    assert.equal(x.store.getState().mode, "experiment");
    assert.equal(x.store.getState().experiment.verdict, null);
    const priorExperiment = x.store.getState().experiment;
    const priorScenario = x.store.getState().scenario;
    x.studio.navigate("overview");
    assert.equal(x.root.hidden, true);
    assert.ok(x.calls.includes("pause"));
    x.studio.navigate("depots");
    assert.equal(x.store.getState().experiment, priorExperiment, "navigation preserves the experiment");
    assert.equal(x.store.getState().scenario, priorScenario, "navigation preserves the scenario");
  } finally { x.studio.destroy(); x.restore(); }
});

test("walkthrough uses the existing presenter and returning does not erase its scenario", () => {
  const x = setup();
  try {
    x.studio.navigate("tour");
    assert.ok(x.calls.includes("present"));
    assert.equal(x.root.hidden, false);
    x.studio.navigate("approach");
    assert.equal(x.root.hidden, true);
    assert.match(document.querySelector('.studio-approach').textContent, /not.*digital twin/i);
  } finally { x.studio.destroy(); x.restore(); }
});
test("Street lab navigation keeps the separate models idle and restores the page",()=>{
 const x=setup();try{x.studio.navigate('streets');assert.equal(x.studio.streets.element.hidden,false);assert.equal(x.studio.operations.element.hidden,true);assert.equal(x.root.hidden,true);assert.equal(x.studio.streets.getState().run,null);x.studio.navigate('overview');assert.equal(x.studio.streets.element.hidden,true);}finally{x.studio.destroy();x.restore();}
});
test('a catalog street case opens its named corridor before running',()=>{
 const x=setup();try{x.studio.navigate('catalog');x.studio.element.querySelector('[data-simulation="street-lombard"] button').click();assert.equal(x.studio.streets.element.querySelector('[aria-label="Street map focus"]').value,'lombard');assert.equal(x.studio.streets.getState().run,null);}finally{x.studio.destroy();x.restore();}
});
