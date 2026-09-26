import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {mountStudio} from '../src/ui/studio.js';
import {createInitialState,createStore} from '../src/ui/store.js';
import {defaultScenario} from '../src/model/schema.js';
import {createSetup,encodeSetup} from '../src/ui/setup-codec.js';
import {routeHref} from '../src/ui/routes.js';
import {getRegionalSetup} from '../src/ui/regional-setup.js';
import {defaultStreetConfig} from '../src/model/street-simulation.js';
import {defaultBayAreaConfig} from '../src/model/bay-operations.js';
import {createLaunchConfig} from '../src/model/launch-rehearsal.js';
import {regionalPowerDemoConfig} from '../src/model/regional-power.js';
import {installFakeDom} from './helpers/fake-dom.mjs';
function setup(){const restore=installFakeDom(),root=document.createElement('div');document.body.appendChild(root);const store=createStore(createInitialState({presetId:'bay_teaching_map',scenario:defaultScenario()}));const studio=mountStudio({root,store,playback:{pause(){}},present:{open(){},close(){}}});return {restore,store,studio,close(){studio.destroy();restore();}};}
const digest=input=>createHash('sha256').update(encodeSetup(createSetup(input))).digest('hex');
test('Fleet day puts a paused partition before the workspace; Run focuses without scroll and keeps one primary',async()=>{
 const x=setup();try{const lab=x.studio.operations;x.studio.navigate('simulation');
  const children=[...lab.element.children],summary=lab.element.querySelector('.ops-result-summary'),workspace=lab.element.querySelector('.ops-workspace');
  assert.ok(summary);assert.ok(children.indexOf(summary)<children.indexOf(workspace));assert.match(children.at(-1).textContent,/Other experiments on this page/);
  assert.equal(lab.element.querySelector('.ops-scenario-learning').hasAttribute('open'),false);
  let scrolls=0;for(const node of [lab.element,...lab.element.querySelectorAll('*')])node.scrollIntoView=()=>scrolls++;
  await lab.run();assert.equal(document.activeElement,summary.querySelector('h2'));assert.equal(scrolls,0);assert.equal(lab.getState().playing,false);
  assert.match(summary.textContent,/95 completed · 176 unserved · 4 waiting · 9 in progress = 284 requests/);
  assert.equal(lab.element.querySelectorAll('button.studio-button-primary').filter(b=>!b.disabled).length,1);
  const version=lab.getState().result.version;lab.setConfig({fleet_size:25});assert.match(lab.element.querySelector('.model-identity').textContent,new RegExp(version));assert.match(lab.element.querySelector('.model-identity').textContent,/stale/);
 }finally{x.close();}
});
test('all five setup payloads remain identical and focus their own idle surface and share control',()=>{
 const x=setup();try{
  const cases=[
   [{model:'fleet-day',config:defaultBayAreaConfig()},'simulation','b459e8a6b7873c909edc9dbcf1a5cece9c55a38a56ea3bfa529089f39611874b','.ops-result-summary'],
   [{model:'launch-rehearsal',config:createLaunchConfig('peninsula'),options:{delay:90}},'simulation','40a999a592ae9e786f48b11a2af1fa4d2f5dcb0db499c0be8f40e0cb252be6dc','.ops-launch-rehearsal'],
   [{model:'regional-power',config:regionalPowerDemoConfig(),options:{treatment:'charging_deadlines',seeds:[1001,1002],tuning_seeds:[42],margin:.02,resamples:1000,null_treatment:false}},'simulation','b2fe9c0c85a219a7696ec3956e6da62639a1f2b18eb949a35fe3583929e712c0','.ops-regional-power'],
   [{model:'street-lab',config:defaultStreetConfig()},'streets','32112ebc77e115af2f37d9d3dccab0f86f4b503c47ad7668209f56f1d9e88527','.street-lab'],
   [getRegionalSetup(x.store.getState()),'operations','e9e6f2d8239f08c4743b5e46151daedb34b0bb13aca4fcf9bbad6d593759ad5e','.studio-workspace'],
  ];
  for(const [input,page,sha,selector]of cases){assert.equal(digest(input),sha,input.model);x.studio.applyRoute(routeHref({page,setup:encodeSetup(createSetup(input))}));assert.equal(x.studio.element.getAttribute('data-page'),page);
   const surface=x.studio.element.querySelector(selector);assert.ok(surface,input.model);assert.ok(surface.contains(document.activeElement),input.model+' focus');assert.equal(surface.querySelector('.setup-sharing').open,true,input.model+' loaded control');
   const output=input.model==='regional'?getRegionalSetup(x.store.getState()):input.model==='street-lab'?x.studio.streets.getSharedSetup():x.studio.operations.getSharedSetup('current',input.model);assert.equal(digest(output),sha,input.model+' restored');
   assert.equal(x.studio.operations.getState().result,null);assert.equal(x.studio.streets.getState().run,null);assert.equal(x.store.getState().run.status,'idle');
  }
 }finally{x.close();}
});
test('Launch identity follows its template and four-area routes expose their actual geography',()=>{const x=setup();try{
 const launch=x.studio.operations.launchPanel;assert.ok(launch);launch.chooseTemplate('region_b');assert.match(launch.element.querySelector('.model-identity').textContent,/Fictional compact Region B.*depot-launch-1.0.0/);
 for(const page of ['operations','depots','tour']){x.studio.navigate(page);assert.match(x.studio.element.querySelector('.workspace-intro').textContent,/Schematic four-area Bay Area zones.*not road geometry/);}
 assert.equal(x.studio.element.querySelector('.studio-boundary'),null);
}finally{x.close();}});
test('studio motion overrides drive both replay factories and preserve one preference',async()=>{const x=setup();try{
 const lab=x.studio.operations;x.store.dispatch({type:'motion/system',reduced:true});x.store.dispatch({type:'motion/override',value:false});await lab.run();lab.element.querySelector('.ops-transport button').click();x.restore.dom.frames.flush(0);x.restore.dom.frames.flush(110);assert.equal(lab.getState().minute,.55);
 x.store.dispatch({type:'motion/override',value:true});x.restore.dom.frames.flush(126);assert.equal(lab.getState().minute,0);lab.pause();lab.seek(0);lab.element.querySelector('.ops-transport button').click();x.restore.dom.frames.flush(1000);for(const t of [1250,1500,1750])x.restore.dom.frames.flush(t);assert.equal(lab.getState().minute,0);x.restore.dom.frames.flush(2000);assert.equal(lab.getState().minute,1);lab.pause();
 const street=x.studio.streets;street.setConfig({duration_minutes:10,background_per_hour:0});await street.run();street.element.querySelector('.street-playback button').click();x.restore.dom.frames.flush(0);x.restore.dom.frames.flush(1000);assert.equal(street.getState().time,60);assert.equal(street.getState().time%60,0);
}finally{x.close();}});
