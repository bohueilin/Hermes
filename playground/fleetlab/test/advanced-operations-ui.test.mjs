import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {createOperationsLab} from '../src/ui/operations-lab.js';

test('extensions are independent opt-ins and historical preset clears them',()=>{
 const restore=installFakeDom();try{const lab=createOperationsLab({reducedMotion:()=>true});
 const mode=lab.element.querySelector('[aria-label="Enable charging allocation"]');assert.ok(mode);
 mode.checked=true;mode.dispatchEvent(new Event('change'));assert.ok(lab.getState().config.charging);assert.equal(lab.getState().config.resources,undefined);
 mode.checked=false;mode.dispatchEvent(new Event('change'));assert.equal(Object.hasOwn(lab.getState().config,'charging'),false);
 const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='airport';preset.dispatchEvent(new Event('change'));assert.ok(lab.getState().config.airport);
 preset.value='balanced';preset.dispatchEvent(new Event('change'));for(const key of ['charging','resources','airport'])assert.equal(Object.hasOwn(lab.getState().config,key),false);lab.destroy();
 }finally{restore();}
});

test('advanced replay projects recorded unknown resources, staging, exact checks and counterexample rejection',async()=>{
 const restore=installFakeDom();try{const lab=createOperationsLab({reducedMotion:()=>true});
 const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='resources';preset.dispatchEvent(new Event('change'));await lab.run();
 const detail=lab.element.querySelector('.ops-depot-detail');detail.open=true;detail.dispatchEvent(new Event('toggle'));lab.seek(0);
 assert.match(lab.element.querySelector('.ops-depot-status').textContent,/UNKNOWN/);assert.match(lab.element.textContent,/Simulator truth/);
 assert.match(lab.element.querySelector('.ops-advanced-result').textContent,/One replay is descriptive/);
 preset.value='charging';preset.dispatchEvent(new Event('change'));const policy=lab.element.querySelector('[aria-label="Charging policy"]');policy.value='overcommit';policy.dispatchEvent(new Event('change'));await lab.run();assert.match(lab.element.querySelector('.ops-advanced-result').textContent,/SITE_POWER_LIMIT/);
 preset.value='airport';preset.dispatchEvent(new Event('change'));await lab.run();assert.match(lab.element.querySelector('.ops-airport-frame').textContent,/Staged/);assert.match(lab.element.textContent,/M1 comparison unavailable/);lab.destroy();
 }finally{restore();}
});

test('paired comparison requires a fresh run and pending work is discarded on edits',async()=>{
 const restore=installFakeDom();try{const lab=createOperationsLab({reducedMotion:()=>true});assert.equal(typeof lab.compareAdvanced,'function');
 await lab.compareAdvanced({seeds:[1001],resamples:1000});assert.match(lab.element.querySelector('.ops-advanced-comparison').textContent,/Run fleet day/);
 const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='charging';preset.dispatchEvent(new Event('change'));await lab.run();
 const pending=lab.compareAdvanced({treatment:'charging_redistribution',seeds:[1001],resamples:1000});lab.setConfig({seed:47});await pending;assert.equal(lab.getState().advancedComparison,null);assert.match(lab.element.querySelector('.ops-advanced-comparison').textContent,/Settings changed/);lab.destroy();
 }finally{restore();}
});

test('one-seed experiment remains descriptive and exact downloadable records survive projection',async()=>{
 const restore=installFakeDom();try{const lab=createOperationsLab({reducedMotion:()=>true});const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='charging';preset.dispatchEvent(new Event('change'));await lab.run();
 const r=await lab.compareAdvanced({treatment:'charging_redistribution',seeds:[1001],resamples:1000});assert.ok(r);assert.equal(r.descriptive,true);assert.match(lab.element.querySelector('.ops-advanced-comparison').textContent,/no interval or recommendation/);
 const a=lab.element.querySelector('[download="fleetlab-bay-experiment.json"]');assert.deepEqual(JSON.parse(decodeURIComponent(a.getAttribute('href').split(',').slice(1).join(','))),r);lab.destroy();
 }finally{restore();}
});

test('record-only projections preserve missing values, stale knowledge, expired forecast and invalid comparison quarantine',async()=>{
 const {advancedComparisonView,resourceFrameView,airportFrameView}=await import('../src/ui/advanced-operations-view.js');const restore=installFakeDom();try{
 const resources=resourceFrameView({ports:[{id:'p',truth:{healthy:true},observation:null,knowledge:'INFERRED_STALE',planner_eligible:false,owner:null,expires_minute:null}]});assert.match(resources.textContent,/Not available/);assert.match(resources.textContent,/INFERRED_STALE/);assert.match(resources.textContent,/false/);
 assert.match(airportFrameView({staged_vehicle_ids:['car-2'],forecast:null}).textContent,/Not available at this minute/);
 const invalid=advancedComparisonView({validity:'INVALID_EXPERIMENT',reason:'mismatch',replications:2,analysis:null});assert.match(invalid.textContent,/mismatch/);assert.equal(invalid.querySelectorAll('table').length,0);
 const valid=advancedComparisonView({validity:'VALID',replications:2,analysis:{outcome:'INCONCLUSIVE',recommendation:'Inspect guardrails',primary:{metric:'fraction',baseline_mean:null,candidate_mean:.3333333333333333,mean_delta:null,median_delta:null,ci_low:null,ci_high:null},guardrail_statuses:[]}});assert.match(valid.textContent,/Not available/);assert.match(valid.textContent,/0.3333333333333333/);
 }finally{restore();}
});

test('airport movement counts cover every vehicle and destroy cancels pending comparison',async()=>{
 const restore=installFakeDom();try{const lab=createOperationsLab({reducedMotion:()=>true});const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='airport';preset.dispatchEvent(new Event('change'));lab.setConfig({airport:{...lab.getState().config.airport,policy:'forecast'}});await lab.run();const frame=lab.getState().result.frames.find(f=>f.vehicles.some(v=>v.state==='airport_reposition'));assert.ok(frame);lab.seek(frame.minute);assert.equal([...lab.element.querySelector('.ops-frame-counts').querySelectorAll('strong')].reduce((n,e)=>n+Number(e.textContent),0),lab.getState().config.fleet_size);
 const pending=lab.compareAdvanced({treatment:'airport_forecast',seeds:[1001,1002],resamples:1000});lab.destroy();await pending;assert.equal(lab.getState().advancedComparison,null);
 }finally{restore();}
});

test('comparison exposes axis, held-out seeds, practical margin and per-seed service accounting outside JSON',async()=>{
 const {advancedComparisonView}=await import('../src/ui/advanced-operations-view.js');const restore=installFakeDom();try{
 const arm={metrics:{total_requests:10,completed_trips:4,unserved_requests:2,pending_requests:1,in_progress_trips:3,censored_visits:2},extensions:{charging:{queue_observed_min:12,active_observed_min:24,unfinished_energy_kwh:1.23456789}}};
 const node=advancedComparisonView({validity:'VALID',replications:1,descriptive:true,analysis:null,spec:{axis:{path:'charging.policy',baseline:'equal_share',candidate:'redistribute'},seeds:[1001],tuning_seeds:[42],margin:.02,null_treatment:false},per_seed:[{seed:1001,baseline:arm,candidate:arm}]});
 for(const d of node.querySelectorAll('details'))d.remove();
 assert.match(node.textContent,/charging.policy/);assert.match(node.textContent,/Held-out evaluation seeds: 1001/);assert.match(node.textContent,/Practical margin: 0.02/);assert.match(node.textContent,/Unfinished visits/);assert.match(node.textContent,/Queue/);assert.match(node.textContent,/1.23456789/);assert.match(node.textContent,/no interval or recommendation/);
 }finally{restore();}
});
