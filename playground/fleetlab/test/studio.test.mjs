import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mountStudio } from "../src/ui/studio.js";
import { createInitialState, createStore } from "../src/ui/store.js";
import { defaultScenario } from "../src/model/schema.js";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import {mediaBlockRules} from './helpers/css-rules.mjs';
import {simulationCatalog} from '../src/ui/simulation-catalog.js';
import {CHOOSER_PRESET_IDS} from '../src/ui/experiment.js';
import {routeHref} from '../src/ui/routes.js';
import {createSetup,encodeSetup} from '../src/ui/setup-codec.js';
import {defaultStreetConfig} from '../src/model/street-simulation.js';
import {getRegionalSetup} from '../src/ui/regional-setup.js';
import {presetById} from '../src/model/presets.js';

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
  assert.equal(x.studio.element.querySelectorAll('.studio-header nav a').length,3);
  assert.deepEqual(x.studio.element.querySelectorAll('.studio-header nav a').map(a=>a.textContent),['Home','Explore','About & limits']);
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

test('welcome actions open the first experiment and the start points without producing a result',()=>{
 const x=setup();try{
  const actions=x.studio.element.querySelector('.hero-actions');
  const primary=actions.querySelector('a[href="#/depot-flow-lab?lesson=two-vehicles"]');
  assert.ok(primary,'the welcome opens the first experiment');
  assert.ok(primary.classList.contains('studio-button-primary'),'the first experiment is the one primary action');
  assert.ok(actions.querySelector('a[href="#/catalog"]'),'the welcome links to Explore');
  primary.click();assert.equal(x.studio.flows.element.hidden,false);
  assert.equal(x.studio.flows.getState().result,null);
  x.studio.navigate('overview');
  const starts=x.studio.element.querySelector('.start-points');
  const fleet=starts.querySelector('a[href="#/fleet-day"]');
  assert.ok(fleet,'a start card opens Fleet day');
  assert.ok(starts.querySelector('a[href="#/street-lab"]'),'a start card opens the Street lab');
  fleet.click();assert.equal(x.studio.operations.element.hidden,false);
  assert.equal(x.studio.operations.getState().result,null);
  assert.equal(x.store.getState().experiment.verdict,null);
 }finally{x.studio.destroy();x.restore();}
});

test('quick lab links carry data-nav ids and open their pages idle',()=>{
 const x=setup();try{
  const links=x.studio.element.querySelector('.simulation-catalog .lab-links');
  assert.ok(links);
  for(const id of ['simulation','streets','depots','scale','flows','tour'])assert.ok(links.querySelector(`[data-nav="${id}"]`),id);
  const depots=links.querySelector('[data-nav="depots"]');
  depots.click();
  assert.equal(x.studio.element.getAttribute('data-page'),'depots');
  assert.equal(depots.getAttribute('aria-current'),'page');
  const main=x.studio.element.querySelectorAll('main').find(n=>!n.inHiddenOrInert());
  assert.equal(main.querySelector('h1').textContent,depots.textContent);
  assert.equal(document.title.split(' · ')[0],depots.textContent);
  assert.equal(x.store.getState().experiment.verdict,null);
 }finally{x.studio.destroy();x.restore();}
});

test('About & limits keeps the model boundary and the depot stages',()=>{
 const x=setup();try{
  x.studio.navigate('approach');
  const about=x.studio.element.querySelector('.studio-approach');
  assert.equal(about.hidden,false);
  assert.match(about.textContent,/not.*digital twin/i);
  assert.match(about.textContent,/Outside the model/);
  assert.ok(about.querySelector('[data-stage="arrive"]'));
  assert.match(about.textContent,/Five labs, each with its own model and limits\./,'the labs are not described as one unified simulator');
  assert.match(about.textContent,/06 \/ READING ACROSS MODELS/);assert.doesNotMatch(about.textContent,/SOURCES, CONTEXT AND CONTACT/);
  assert.equal(x.studio.element.querySelector('.home-browse a[href="#/approach"]').textContent,'About & limits  →','Home names the destination as the header does');
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

test('Home document order is the phone reading order, with no CSS reordering',()=>{
 const x=setup();try{
  const main=x.studio.element.querySelector('main.studio-overview'),shape=node=>node.children.map(c=>`${c.localName}.${c.getAttribute('class')}`);
  assert.deepEqual(shape(main),['section.studio-film-hero','nav.home-browse']);
  assert.deepEqual(shape(main.children[0]),['div.film-copy','section.start-points','div.welcome-visual','div.film-caption'],'the caption follows the film inside the hero');
  const source=readFileSync(new URL('../styles.css',import.meta.url),'utf8'),css=source.replace(/\/\*[\s\S]*?\*\//g,''),desktop=mediaBlockRules(source,1000,'.studio-film-hero');
  for(const child of main.children[0].children)assert.ok(desktop.some(r=>/grid-(area|column)\s*:/.test(r.body)&&r.selectors.some(x=>child.matches(x))),`${child.getAttribute('class')} has a desktop placement`);
  for(const [,selector,body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
   if(/\.(start-points|welcome-visual|film-caption|home-browse)(?![\w-])/.test(selector))assert.doesNotMatch(body,/(^|[;\s])order\s*:/,selector.trim());
   if(/\.studio-film-hero(?![\w-])/.test(selector))assert.doesNotMatch(body,/display\s*:\s*contents/,selector.trim());
  }
 }finally{x.studio.destroy();x.restore();}
});

test('compact navigation exposes its state and closes after a destination is chosen',()=>{
 const x=setup();try{
  const toggle=x.studio.element.querySelector('[aria-controls="studio-navigation"]');
  assert.ok(toggle,'compact navigation has an accessible toggle');
  const nav=x.studio.element.querySelector('#studio-navigation');
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(toggle.textContent,'Menu');
  toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');
  assert.equal(nav.getAttribute('data-expanded'),'true');
  assert.equal(toggle.textContent,'Close');
  const explore=nav.querySelector('[data-nav="catalog"]');assert.ok(explore,'Explore is discoverable from the header');
  explore.click();
  assert.equal(x.studio.element.getAttribute('data-page'),'catalog');
  assert.equal(explore.getAttribute('aria-current'),'page');
  assert.equal(x.studio.scale.getState().result,null,'navigation keeps the labs idle');
  assert.equal(toggle.textContent,'Menu');
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(nav.getAttribute('data-expanded'),'false');
  assert.equal(x.store.getState().run.status,'idle');
 }finally{x.studio.destroy();x.restore();}
});

test('confirmed defect: walkthrough entry after Four-area experiments names the setup the map shows until Prepare',()=>{
  const x=setup();try{
    x.studio.navigate('depots');x.studio.navigate('tour');
    assert.equal(x.store.getState().presetId,'UC-08a','entering the walkthrough keeps the depot setup');
    const intro=x.studio.element.querySelector('.workspace-intro').textContent;
    assert.match(intro,/OPS-01 asks/);assert.ok(intro.includes(presetById('UC-08a').title),'the intro names the loaded UC-08a setup');
    x.studio.navigate('approach');x.studio.navigate('tour');assert.ok(x.studio.element.querySelector('.workspace-intro').textContent.includes(presetById('UC-08a').title));
  }finally{x.studio.destroy();x.restore();}
});
test('confirmed at base, closed by the Task 3 pause clear: Depot flow lab announcements do not survive leaving the page',async()=>{
  const x=setup();try{
    x.studio.applyRoute('#/depot-flow-lab?lesson=two-vehicles');await x.studio.flows.run();
    const live=x.studio.flows.element.querySelector('div.fl-sr-only[role="status"]'),result=JSON.stringify(x.studio.flows.getState().result);
    x.studio.flows.element.querySelector('[data-next-event]').click();assert.match(live.textContent,/^Minute 1\. /);
    x.studio.navigate('overview');assert.equal(live.textContent,'');
    x.studio.navigate('flows');assert.equal(live.textContent,'','nothing is announced on return until a user action');
    assert.equal(JSON.stringify(x.studio.flows.getState().result),result);
  }finally{x.studio.destroy();x.restore();}
});
test('direct lesson routes in sequence: a played lesson leaves nothing behind in the next one',async()=>{
  const x=setup();try{
    const flows=x.studio.flows.element,live=flows.querySelector('div.fl-sr-only[role="status"]');
    x.studio.applyRoute('#/depot-flow-lab?lesson=two-vehicles');await x.studio.flows.run();
    flows.querySelector('[data-next-event]').click();assert.notEqual(live.textContent,'','stepping announces the event');
    x.studio.applyRoute('#/depot-flow-lab?lesson=crossed-priorities');
    assert.equal(flows.querySelector('h1').textContent,'Who should upload next?');
    assert.equal(flows.querySelector('[data-flow-run]').textContent,'Compare the four rules');
    assert.equal(flows.querySelector('[data-flow-outcomes]'),null,'no outcomes from the other lesson');
    assert.equal(live.textContent,'','no announcement carries over');
    // The UC-01 lesson copy says "A null check" on purpose; any other "null" would be a rendered missing value.
    const stray=()=>document.body.textContent.replaceAll('A null check','');
    x.studio.applyRoute('#/depot-flow-lab?lesson=two-vehicles');
    assert.equal(x.studio.flows.getState().result,null);
    assert.doesNotMatch(stray(),/null/);
    x.studio.applyRoute('#/street-lab');
    assert.doesNotMatch(stray(),/null/);
  }finally{x.studio.destroy();x.restore();}
});
