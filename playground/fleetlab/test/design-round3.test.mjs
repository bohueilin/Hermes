import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {createOperationsLab} from '../src/ui/operations-lab.js';
import {renderHeadlines} from '../src/ui/rebalancing-view.js';
import {routeHref} from '../src/ui/routes.js';
import {defaultReadiness} from '../src/model/depot-readiness.js';

test('disabled fleet comparisons explain current prerequisites and stale settings',async()=>{
 const restore=installFakeDom(),lab=createOperationsLab({reducedMotion:()=>true});
 try{
  const hint=()=>lab.element.querySelector('#staffing-help').textContent;
  assert.match(hint(),/staffing-aware/);
  lab.setConfig({readiness:defaultReadiness()});
  assert.match(hint(),/Run a fleet day/);
  const value=lab.element.querySelector('[aria-label="Rush-hour demand"]');
  assert.equal(value.getAttribute('aria-valuetext'),'1.6');
  assert.equal(lab.getState().config.peak_multiplier,1.6);
  value.value='2.1';value.dispatchEvent(new Event('input'));
  assert.equal(value.getAttribute('aria-valuetext'),'2.1');
  assert.equal(lab.getState().config.peak_multiplier,1.6,'typing does not apply model settings');
  const profile=lab.element.querySelector('[aria-label="Jaguar I-PACE driving energy"]');
  const previous=lab.getState().config.vehicle_profiles.ipace.energy_kwh_per_km;
  profile.value='0.31';profile.dispatchEvent(new Event('input'));
  assert.equal(profile.getAttribute('aria-valuetext'),'0.31');
  assert.equal(lab.getState().config.vehicle_profiles.ipace.energy_kwh_per_km,previous);
 }finally{lab.destroy();restore();}
});
test('zone wait bars use exact accepted values on a shared scale and retain missingness',()=>{
 const restore=installFakeDom();try{
  for(const id of ['headline','paired-waits']){const n=document.createElement('div');n.id=id;document.body.appendChild(n);}
  const rec=policy=>({policy:{id:policy},metrics:{empty_m:{n:1,d:1},pickup_m:{n:1,d:1},rebalancing_m:{n:0,d:1},expired:0,wait:Object.fromEntries(['A','B','C','D'].map(z=>[z,{median:60,p95:policy==='reactive'?360:258,n:3,unserved:0}]))}});
  const records=[rec('reactive'),rec('forecast')];records[1].metrics.wait.D.median=null;
  const before=JSON.stringify(records);renderHeadlines(document,records);
  const bars=document.querySelectorAll('[data-wait-bar]');assert.equal(bars.length,15);
  const b=[...bars].find(n=>n.getAttribute('data-wait-bar')==='B:forecast:p95');
  assert.equal(b.getAttribute('value'),'258');assert.equal(b.getAttribute('max'),'360');
  assert.match(document.getElementById('paired-waits').textContent,/Not available/);
  assert.equal(JSON.stringify(records),before);
 }finally{restore();}
});
test('default depot lesson has one canonical route, crossed priorities stays distinct',()=>{
 assert.equal(routeHref({page:'flows'}),'#/depot-flow-lab?lesson=two-vehicles');
 assert.equal(routeHref({page:'flows',lesson:'crossed-priorities'}),'#/depot-flow-lab?lesson=crossed-priorities');
});
