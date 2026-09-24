import test from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {createLaunchPanel,launchComparisonView} from '../src/ui/launch-view.js';

test('launch workflow validates owners, runs both regions and invalidates on edit',async()=>{
 const restore=installFakeDom();try{
  const panel=createLaunchPanel();document.body.appendChild(panel.element);
  const owner=panel.element.querySelector('[aria-label="Commissioning owner for site 1"]');owner.value='';owner.dispatchEvent(new Event('change'));
  assert.equal(panel.validate().ok,false);assert.match(panel.element.textContent,/owner/i);
  panel.chooseTemplate('region_b');assert.equal(panel.validate().ok,true);
  const result=await panel.run();assert.equal(result.validity,'VALID');assert.equal(result.spec.region_id,'region_b');
  const view=panel.element.querySelector('.launch-results');assert.match(view.textContent,/within target/);assert.match(view.textContent,/Unfinished/);assert.match(view.textContent,/One seed/);
  const link=view.querySelector('[download="fleetlab-launch-rehearsal.json"]');assert.deepEqual(JSON.parse(decodeURIComponent(link.getAttribute('href').split(',').slice(1).join(','))),result);
  const delay=panel.element.querySelector('[aria-label="Commissioning delay (minutes)"]');delay.value='0';delay.dispatchEvent(new Event('input'));assert.equal(panel.getState().result,null);assert.match(view.textContent,/changed/i);
  const zero=await panel.run();assert.deepEqual(zero.baseline.metrics,zero.candidate.metrics);
  panel.chooseTemplate('peninsula');assert.equal(panel.getState().result,null);assert.equal(panel.validate().ok,true);panel.destroy();
 }finally{restore();}
});
test('pending launch results are discarded on edits or destroy',async()=>{
 const restore=installFakeDom();try{
  const panel=createLaunchPanel(),pending=panel.run();panel.chooseTemplate('region_b');await pending;assert.equal(panel.getState().result,null);
  const next=panel.run();panel.destroy();await next;assert.equal(panel.getState().result,null);
 }finally{restore();}
});
test('invalid and missing launch output never looks like a successful rehearsal',()=>{
 const restore=installFakeDom();try{
  const bad=launchComparisonView({validity:'INVALID_EXPERIMENT',reason:'different regions',comparison:{comparable:false}});assert.match(bad.textContent,/different regions/);assert.equal(bad.querySelectorAll('table').length,0);
 }finally{restore();}
});
test('installation defects stay fixed across arms and the displayed action rejection is not invalid state',async()=>{
 const restore=installFakeDom();try{
  const panel=createLaunchPanel(),p=panel.getState().config.launch.depots[0].ports[0];
  const installed=panel.element.querySelector(`[aria-label="${p.id} installed"]`);installed.checked=false;installed.dispatchEvent(new Event('change'));
  assert.equal(panel.validate().ok,true);const r=await panel.run();assert.equal(r.validity,'VALID');
  for(const arm of [r.baseline,r.candidate]){assert.equal(arm.config.launch.depots[0].ports[0].installed,false);assert.ok(arm.launch.actions.some(a=>a.reason==='RESOURCE_NOT_INSTALLED'));assert.equal(arm.launch.validity,'VALID');}
  assert.match(panel.element.querySelector('.launch-results').textContent,/RESOURCE_NOT_INSTALLED/);panel.destroy();
 }finally{restore();}
});
