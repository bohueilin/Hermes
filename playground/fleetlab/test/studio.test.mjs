import assert from "node:assert/strict";
import { test } from "node:test";
import { mountStudio } from "../src/ui/studio.js";
import { createInitialState, createStore } from "../src/ui/store.js";
import { defaultScenario } from "../src/model/schema.js";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import {simulationCatalog} from '../src/ui/simulation-catalog.js';
import {CHOOSER_PRESET_IDS} from '../src/ui/experiment.js';
import {routeHref} from '../src/ui/routes.js';
import {createSetup,encodeSetup} from '../src/ui/setup-codec.js';
import {defaultStreetConfig} from '../src/model/street-simulation.js';
import {getRegionalSetup} from '../src/ui/regional-setup.js';

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
 const x=setup();try{x.studio.navigate('catalog');x.studio.element.querySelector('[data-simulation="street-lombard"] a').click();assert.equal(x.studio.streets.element.querySelector('[aria-label="Street map focus"]').value,'lombard');assert.equal(x.studio.streets.getState().run,null);}finally{x.studio.destroy();x.restore();}
});

test('all lesson links restore the named setup without running either engine',()=>{
 const x=setup();try{
  const snapshots=new Map();
  const capture=record=>record.target==='operations'?x.studio.operations.getSharedSetup('current',record.id==='region-launch'?'launch-rehearsal':'fleet-day'):record.target==='streets'?x.studio.streets.getSharedSetup():getRegionalSetup(x.store.getState());
  for(const record of simulationCatalog()){
   const page=record.target==='operations'?'simulation':record.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(record.id)?'depots':'operations';
   const href=routeHref({page,lesson:record.id});x.studio.applyRoute(href);
   assert.equal(x.studio.element.getAttribute('data-page'),page,record.id);
   assert.equal(x.store.getState().run.status,'idle',record.id);
   assert.equal(x.store.getState().experiment.verdict,null,record.id);
   assert.equal(x.studio.streets.getState().run,null,record.id);
   if(record.target==='streets')assert.equal(x.studio.streets.getSharedSetup().config.hotspot,record.hotspot);
   assert.equal(x.studio.element.querySelector('.studio-route-error').hidden,true,record.id);
   snapshots.set(record.id,capture(record));
  }
  for(const record of simulationCatalog().reverse()){
   const page=record.target==='operations'?'simulation':record.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(record.id)?'depots':'operations';
   x.studio.applyRoute(routeHref({page,lesson:record.id}));
   assert.deepEqual(capture(record),snapshots.get(record.id),`${record.id} restores complete lesson settings after other lessons`);
  }
 }finally{x.studio.destroy();x.restore();}
});
test('malformed and wrong-model links quarantine the view until an explicit recovery',()=>{
 const x=setup();try{
  const payload=encodeSetup(createSetup({model:'street-lab',config:defaultStreetConfig()}));
  x.studio.applyRoute(routeHref({page:'simulation',setup:payload}));
  assert.equal(x.studio.element.getAttribute('data-page'),'error');
  assert.equal(x.studio.operations.element.hidden,true);
  assert.equal(x.studio.streets.getState().run,null);
  x.studio.element.querySelector('[data-action="recover-route"]').click();
  assert.equal(x.studio.element.getAttribute('data-page'),'overview');
  x.studio.applyRoute('#/street-lab?lesson=missing');assert.equal(x.studio.element.getAttribute('data-page'),'error');
 }finally{x.studio.destroy();x.restore();}
});
test('workspace main, native navigation, page titles and skip focus follow the active view',()=>{
 const x=setup();try{
  for(const page of ['overview','simulation','streets','depots','catalog','approach','operations','tour']){
   x.studio.navigate(page);
   const mains=x.studio.element.querySelectorAll('main').filter(n=>!n.inHiddenOrInert());assert.equal(mains.length,1,page);
   assert.ok(document.title.includes('FleetLab'));
   x.studio.element.querySelector('.studio-skip').click();assert.equal(document.activeElement,mains[0]);
  }
  assert.equal(x.studio.element.querySelectorAll('.studio-header nav a').length,6);
 }finally{x.studio.destroy();x.restore();}
});
