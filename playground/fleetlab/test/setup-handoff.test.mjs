import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createOperationsLab} from '../src/ui/operations-lab.js';
import {createLaunchPanel} from '../src/ui/launch-view.js';
import {defaultBayAreaConfig} from '../src/model/bay-operations.js';
import {advancedOperationsDemoConfig} from '../src/model/bay-experiment-contract.js';
import {createLaunchConfig} from '../src/model/launch-rehearsal.js';
import {defaultReadiness} from '../src/model/depot-readiness.js';
import {installFakeDom} from './helpers/fake-dom.mjs';

const field=(root,label)=>root.querySelector(`[aria-label="${label}"]`);
const smallConfig=()=>({...defaultBayAreaConfig(),fleet_size:4,requests_per_hour:5,duration_hours:1});
const pairedOptions=()=>({treatment:'charging_deadlines',seeds:[2101],tuning_seeds:[51,52],margin:.04,resamples:1100,null_treatment:true});
function requireHandoff(panel){assert.equal(typeof panel.getSharedSetup,'function','A panel must expose a detached sharing snapshot');assert.equal(typeof panel.loadSharedSetup,'function','A panel must accept a complete setup without running it');}

test('fleet handoff replaces every effective input and synchronizes nested controls without running',()=>{
 const restore=installFakeDom();const lab=createOperationsLab({reducedMotion:()=>false});try{
  requireHandoff(lab);
  const config={...smallConfig(),weather:'rain',seed:92,place_ids:['san-francisco','sfo'],ojai_share_pct:75,readiness:{...defaultReadiness(),cleaning_workers:3},charging:{...advancedOperationsDemoConfig('charging').charging,policy:'deadline'}};
  config.vehicle_profiles.ojai.battery_kwh=111;
  const setup={model:'fleet-day',config,options:pairedOptions()};lab.loadSharedSetup(setup);
  assert.deepEqual(lab.getSharedSetup(),setup);
  assert.equal(field(lab.element,'Start with a situation').value,'custom');
  for(const [name,value]of [['AV cars','4'],['Weather','rain'],['Demand seed','92'],['Ojai share of fleet','75'],['Ojai modeled battery','111'],['Qualified cleaning workers / depot','3'],['Charging policy','deadline'],['Paired treatment','charging_deadlines'],['Evaluation seeds','2101'],['Tuning seeds','51,52'],['Practical margin (fraction)','0.04'],['Bootstrap resamples','1100']])assert.equal(field(lab.element,name).value,value,name);
  assert.equal(field(lab.element,'Null treatment control').checked,true);
  assert.equal(field(lab.element,'Include San Francisco').checked,true);assert.equal(field(lab.element,'Include Palo Alto').checked,false);
  assert.equal(lab.getState().result,null);assert.equal(lab.getState().playing,false);
  setup.config.vehicle_profiles.ojai.battery_kwh=150;setup.options.seeds[0]=3000;
  assert.equal(lab.getSharedSetup().config.vehicle_profiles.ojai.battery_kwh,111);assert.deepEqual(lab.getSharedSetup().options.seeds,[2101]);
  const snapshot=lab.getSharedSetup();snapshot.config.place_ids.push('palo-alto');snapshot.options.tuning_seeds.push(99);
  assert.deepEqual(lab.getSharedSetup().config.place_ids,['san-francisco','sfo']);assert.deepEqual(lab.getSharedSetup().options.tuning_seeds,[51,52]);
  lab.loadSharedSetup({model:'fleet-day',config:smallConfig(),options:{}});
  assert.equal(Object.hasOwn(lab.getSharedSetup().config,'charging'),false);assert.equal(field(lab.element,'Enable charging allocation').checked,false);assert.deepEqual(lab.getSharedSetup().options,{});
 }finally{lab.destroy();restore();}
});

test('fleet current edits stay separate from detached last-run inputs and exact result provenance',async()=>{
 const restore=installFakeDom();const lab=createOperationsLab({reducedMotion:()=>true});try{
  requireHandoff(lab);assert.throws(()=>lab.getSharedSetup('last-run'),/run.*first|no.*run/i);
  lab.loadSharedSetup({model:'fleet-day',config:smallConfig(),options:{}});await lab.run();
  const submitted=lab.getSharedSetup('last-run');lab.setConfig({fleet_size:7});
  assert.equal(lab.getSharedSetup().config.fleet_size,7);assert.equal(lab.getSharedSetup('last-run').config.fleet_size,4);assert.equal(lab.getState().stale,true);
  submitted.config.vehicle_profiles.ipace.battery_kwh=130;assert.notEqual(lab.getSharedSetup('last-run').config.vehicle_profiles.ipace.battery_kwh,130);
  const provenance=lab.element.querySelector('.ops-result-provenance');assert.ok(provenance);assert.match(provenance.textContent,/model.*1\.0\.0/i);assert.match(provenance.textContent,/seed 42/i);assert.match(provenance.textContent,/NOT_EVIDENCE/);assert.match(provenance.textContent,/authority NONE/i);
  const exact=JSON.parse(provenance.querySelector('pre').textContent);assert.deepEqual(exact.config,lab.getState().result.config);assert.deepEqual(exact.metrics,lab.getState().result.metrics);
 }finally{lab.destroy();restore();}
});

test('loading a fleet setup cancels pending run delivery and never schedules playback',async()=>{
 const restore=installFakeDom();let replays=0;const lab=createOperationsLab({reducedMotion:()=>false,requestFrame:()=>{replays++;return 1;},cancelFrame:()=>{}});try{
  requireHandoff(lab);lab.setConfig(smallConfig());const pending=lab.run();
  lab.loadSharedSetup({model:'fleet-day',config:{...smallConfig(),fleet_size:9},options:{}});await pending;
  assert.equal(lab.getState().result,null);assert.equal(lab.getState().playing,false);assert.equal(replays,0);assert.equal(lab.getSharedSetup().config.fleet_size,9);
  await lab.run();lab.pause();lab.loadSharedSetup({model:'fleet-day',config:smallConfig(),options:{}});
  assert.equal(lab.getState().result.config.fleet_size,9);assert.equal(lab.getState().stale,true);assert.equal(lab.getState().playing,false);
 }finally{lab.destroy();restore();}
});

test('paired settings keep the submitted options after later edits and cannot attach to a different replay',async()=>{
 const restore=installFakeDom();const lab=createOperationsLab({reducedMotion:()=>true});try{
  requireHandoff(lab);const config={...advancedOperationsDemoConfig('charging'),fleet_size:4,duration_hours:1,requests_per_hour:8};const options=pairedOptions();
  lab.loadSharedSetup({model:'fleet-day',config,options});await lab.run();assert.deepEqual(lab.getSharedSetup('last-run').options,{});
  const comparison=await lab.compareAdvanced();assert.ok(comparison);assert.deepEqual(lab.getSharedSetup('last-run').options,options);
  const seeds=field(lab.element,'Evaluation seeds');seeds.value='2201,2202';seeds.dispatchEvent(new Event('change'));
  assert.deepEqual(lab.getSharedSetup().options.seeds,[2201,2202]);assert.deepEqual(lab.getSharedSetup('last-run').options.seeds,[2101]);
  lab.setConfig({fleet_size:6});assert.equal(lab.getSharedSetup('last-experiment').config.fleet_size,4);assert.deepEqual(lab.getSharedSetup('last-run').options,options);
  await lab.run();assert.equal(lab.getSharedSetup('last-run').config.fleet_size,6);assert.deepEqual(lab.getSharedSetup('last-run').options,{});
 }finally{lab.destroy();restore();}
});

test('fleet sharing does not invent options when the selected treatment extension is absent',()=>{
 const restore=installFakeDom();const lab=createOperationsLab({reducedMotion:()=>true});try{
  requireHandoff(lab);lab.loadScenario(advancedOperationsDemoConfig('resources'));
  field(lab.element,'Paired treatment').value='airport_forecast';assert.deepEqual(lab.getSharedSetup().options,{});
 }finally{lab.destroy();restore();}
});

test('reloading an identical fleet setup cancels pending capacity and readiness comparisons',async()=>{
 const restore=installFakeDom();const lab=createOperationsLab({reducedMotion:()=>true});try{
  const setup={model:'fleet-day',config:{...smallConfig(),readiness:defaultReadiness()},options:{}};lab.loadSharedSetup(setup);await lab.run();
  const capacity=lab.compareCapacity();lab.loadSharedSetup(setup);await capacity;
  assert.equal(lab.getState().capacity,null);assert.equal(lab.element.querySelector('.ops-capacity-content').querySelectorAll('table').length,0);
  const readiness=lab.compareReadiness();lab.loadSharedSetup(setup);await readiness;
  assert.equal(lab.getState().readinessComparison,null);assert.equal(lab.element.querySelector('.ops-readiness-comparison').querySelectorAll('table').length,0);
  [...lab.element.querySelectorAll('button')].find(b=>b.textContent==='Compare I-PACE · mixed · Ojai').click();lab.loadSharedSetup(setup);await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(lab.element.querySelector('.bay-mix-results').querySelectorAll('table').length,0);
 }finally{lab.destroy();restore();}
});

test('launch setup preserves nested config and delay, syncs fields and exposes detached submitted state',async()=>{
 const restore=installFakeDom();const panel=createLaunchPanel();try{
  requireHandoff(panel);assert.throws(()=>panel.getSharedSetup('last-run'),/rehears.*first|no.*rehears/i);
  const config=createLaunchConfig('region_b');config.fleet_size=4;config.duration_hours=1;config.requests_per_hour=8;config.seed=81;config.launch.depots[0].site_power_kw=85;config.launch.depots[0].ports[0].healthy=false;
  const setup={model:'launch-rehearsal',config,options:{delay:17}};panel.loadSharedSetup(setup);
  assert.deepEqual(panel.getSharedSetup(),setup);assert.equal(panel.getState().result,null);
  for(const [name,value]of [['Launch region template','region_b'],['Rehearsal fleet size','4'],['Rehearsal demand seed','81'],['Site 1 power (kW)','85'],['Commissioning delay (minutes)','17']])assert.equal(field(panel.element,name).value,value,name);
  assert.equal(field(panel.element,`${config.launch.depots[0].ports[0].id} healthy`).checked,false);
  setup.config.launch.depots[0].site_power_kw=90;assert.equal(panel.getSharedSetup().config.launch.depots[0].site_power_kw,85);
  const result=await panel.run();assert.ok(result);const submitted=panel.getSharedSetup('last-run');
  const delay=field(panel.element,'Commissioning delay (minutes)');delay.value='44';delay.dispatchEvent(new Event('change'));
  assert.equal(panel.getState().result,null);assert.equal(panel.getSharedSetup().options.delay,44);assert.equal(panel.getSharedSetup('last-run').options.delay,17);
  submitted.config.launch.depots[0].ports[0].healthy=true;assert.equal(panel.getSharedSetup('last-run').config.launch.depots[0].ports[0].healthy,false);
  const state=panel.getState();state.config.launch.depots[0].site_power_kw=999;assert.equal(panel.getSharedSetup().config.launch.depots[0].site_power_kw,85);
 }finally{panel.destroy();restore();}
});

test('operations routes launch sharing to the launch panel and load cancels a pending rehearsal',async()=>{
 const restore=installFakeDom();const lab=createOperationsLab({reducedMotion:()=>false});const panel=createLaunchPanel();try{
  requireHandoff(lab);requireHandoff(panel);const setup={model:'launch-rehearsal',config:createLaunchConfig('region_b'),options:{delay:23}};
  lab.loadSharedSetup(setup);assert.deepEqual(lab.getSharedSetup('current','launch-rehearsal'),setup);assert.equal(lab.getState().result,null);
  const pending=panel.run();panel.loadSharedSetup(setup);await pending;assert.equal(panel.getState().result,null);assert.throws(()=>panel.getSharedSetup('last-run'),/rehears.*first|no.*rehears/i);
  assert.throws(()=>lab.getSharedSetup('current','street-lab'),/model/i);
 }finally{panel.destroy();lab.destroy();restore();}
});

test('choosing a launch template restores its default delay after prior edits',()=>{
 const restore=installFakeDom();const panel=createLaunchPanel();try{
  const delay=field(panel.element,'Commissioning delay (minutes)');delay.value='333';delay.dispatchEvent(new Event('change'));
  assert.equal(panel.getSharedSetup().options.delay,333);
  panel.chooseTemplate('region_b');
  assert.equal(panel.getSharedSetup().options.delay,90);assert.equal(field(panel.element,'Commissioning delay (minutes)').value,'90');
  assert.equal(panel.getSharedSetup().config.launch.region.id,'region_b');assert.equal(panel.getState().result,null);
 }finally{panel.destroy();restore();}
});
