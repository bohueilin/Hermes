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

test('Depot flow lab is additive, direct-linkable and catalog-routed without running',()=>{
  const x=setup();try{
    x.studio.applyRoute('#/depot-flow-lab?lesson=two-vehicles');
    assert.equal(x.studio.element.getAttribute('data-page'),'flows');
    assert.equal(x.studio.flows.getState().result,null);
    assert.equal(x.studio.flows.element.hidden,false);
    assert.ok(x.studio.element.querySelector('[data-nav="simulation"]'));
    assert.ok(x.studio.element.querySelector('[data-nav="scale"]'));
    assert.ok(x.studio.element.querySelector('[data-simulation="two-vehicles"] a[href="#/depot-flow-lab?lesson=two-vehicles"]'));
    x.studio.navigate('overview');assert.equal(x.studio.flows.element.hidden,true);
    x.studio.applyRoute('#/depot-flow-lab?lesson=unknown');assert.equal(x.studio.element.getAttribute('data-page'),'error');
  }finally{x.studio.destroy();x.restore();}
});

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
  const capture=record=>record.target==='flows'?x.studio.flows.getState():record.target==='scale'?x.studio.scale.getState():record.target==='operations'?x.studio.operations.getSharedSetup('current',record.id==='region-launch'?'launch-rehearsal':'fleet-day'):record.target==='streets'?x.studio.streets.getSharedSetup():getRegionalSetup(x.store.getState());
  for(const record of simulationCatalog()){
   const page=record.target==='flows'?'flows':record.target==='scale'?'scale':record.target==='operations'?'simulation':record.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(record.id)?'depots':'operations';
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
   const page=record.target==='flows'?'flows':record.target==='scale'?'scale':record.target==='operations'?'simulation':record.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(record.id)?'depots':'operations';
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
  for(const page of ['overview','simulation','streets','depots','catalog','approach','operations','tour','scale']){
   x.studio.navigate(page);
   const mains=x.studio.element.querySelectorAll('main').filter(n=>!n.inHiddenOrInert());assert.equal(mains.length,1,page);
    assert.ok(document.title.includes('FleetLab'));
    if(page==='depots'){
     const name=x.studio.element.querySelector('[data-nav="depots"]').textContent;
     assert.equal(mains[0].querySelector('h1').textContent,name);
     assert.equal(document.title.split(' · ')[0],name);
    }
    x.studio.element.querySelector('.studio-skip').click();assert.equal(document.activeElement,mains[0]);
  }
  assert.equal(x.studio.element.querySelectorAll('.studio-header nav a').length,8);
 }finally{x.studio.destroy();x.restore();}
});

test("a launch lesson reached from another Fleet day lesson does not keep that lesson's heading", () => {
  const x = setup();
  try {
    const heading = () => [...x.studio.operations.element.querySelectorAll("h1")].map((h) => h.textContent);
    x.studio.applyRoute(routeHref({ page: "simulation", lesson: "region-launch" }));
    assert.deepEqual(heading(), ["Fleet day"], "a fresh arrival names the page");
    for (const before of ["airport-preparation", "cleaning"]) {
      x.studio.applyRoute(routeHref({ page: "simulation", lesson: before }));
      assert.equal(heading()[0], simulationCatalog().find((r) => r.id === before).title);
      x.studio.applyRoute(routeHref({ page: "simulation", lesson: "region-launch" }));
      assert.equal(document.title.split(" · ")[0], "Rehearse commissioning in Region B");
      assert.deepEqual(heading(), ["Fleet day"], `after ${before} the page heading names the page, not ${before}`);
    }
  } finally {
    x.restore();
  }
});

test('welcome actions open the fleet and scale workspaces without producing a result',()=>{
 const x=setup();try{
  const actions=x.studio.element.querySelector('.hero-actions');
  const fleet=actions.querySelector('a[href="#/fleet-day"]');
  const scale=actions.querySelector('a[href="#/scale-lab"]');
  assert.ok(fleet,'the welcome has a fleet-day entry');
  assert.ok(scale,'the welcome has a direct scale-lab entry');
  fleet.click();assert.equal(x.studio.operations.element.hidden,false);
  assert.equal(x.studio.operations.getState().result,null);
  x.studio.navigate('overview');scale.click();
  assert.equal(x.studio.scale.element.hidden,false);
  assert.equal(x.studio.scale.getState().result,null);
  assert.equal(x.store.getState().experiment.verdict,null);
 }finally{x.studio.destroy();x.restore();}
});

test('welcome names the teaching boundary before a visitor enters a model',()=>{
 const x=setup();try{
  const welcome=x.studio.element.querySelector('.studio-film-hero');
  assert.match(welcome.textContent,/Synthetic teaching simulator/);
  assert.match(welcome.textContent,/NOT_EVIDENCE/);
  assert.match(welcome.textContent,/decision authority NONE/);
 }finally{x.studio.destroy();x.restore();}
});

test('compact navigation exposes its state and closes after a destination is chosen',()=>{
 const x=setup();try{
  const toggle=x.studio.element.querySelector('[aria-controls="studio-navigation"]');
  assert.ok(toggle,'compact navigation has an accessible toggle');
  const nav=x.studio.element.querySelector('#studio-navigation');
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');
  assert.equal(nav.getAttribute('data-expanded'),'true');
  const scale=nav.querySelector('[data-nav="scale"]');assert.ok(scale,'Scale lab is discoverable from the header');
  scale.click();
  assert.equal(x.studio.element.getAttribute('data-page'),'scale');
  assert.equal(scale.getAttribute('aria-current'),'page');
  assert.equal(x.studio.scale.getState().result,null,'navigation keeps the lab idle');
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(nav.getAttribute('data-expanded'),'false');
  assert.equal(x.store.getState().run.status,'idle');
 }finally{x.studio.destroy();x.restore();}
});
