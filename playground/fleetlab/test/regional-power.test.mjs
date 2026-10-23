import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBayAreaConfig,simulateBayAreaOperations,validateBayAreaConfig} from '../src/model/bay-operations.js';
import {defaultCharging} from '../src/model/charging-allocation.js';
import {freezeBayExperiment,bayExperimentSteps,validateBayPair} from '../src/model/bay-experiment-contract.js';

const profile=(fraction=1)=>({version:'site-power-profile-1.0.0',condition_id:'test-power',site_id:'depot-1',segments:[{start_minute:0,end_minute:120,fraction}]});
const config=()=>({...defaultBayAreaConfig(),place_ids:['menlo-park','palo-alto'],fleet_size:16,depot_count:1,duration_hours:2,start_hour:0,
  requests_per_hour:60,peak_multiplier:1,initial_soc_pct:35,charge_target_pct:85,trips_between_visits:1,
  cleaning_minutes:1,cleaning_bays:8,upload_minutes:1,software_every_visits:100,chargers:8,site_power_kw:120,charging:defaultCharging()});

test('power profiles reject unknown versions, gaps, overlaps, sites, nonfinite and unsupported fields',()=>{
  for(const p of [null,{}, {...profile(),version:'future'},{...profile(),site_id:'other'}, {...profile(),extra:1},
    {...profile(),segments:[]}, {...profile(),segments:[{start_minute:1,end_minute:120,fraction:1}]},
    {...profile(),segments:[{start_minute:0,end_minute:121,fraction:1}]},
    {...profile(),segments:[{start_minute:0,end_minute:60,fraction:1},{start_minute:59,end_minute:120,fraction:1}]},
    profile(NaN),profile(-.1),profile(1.1)]) {
    assert.ok(validateBayAreaConfig({...config(),site_power_profile:p}).length,JSON.stringify(p));
  }
});
test('constant full power preserves the existing numerical run exactly',()=>{
  const old=simulateBayAreaOperations(config()),now=simulateBayAreaOperations({...config(),site_power_profile:profile()});
  assert.notEqual(old.version,now.version);
  for(const key of ['metrics','requests','visits','demand_signature'])assert.deepEqual(now[key],old[key],key);
  assert.equal(now.extensions.site_power.interval_trace.length,120);
  assert.equal(now.extensions.site_power.interval_trace.reduce((n,p)=>n+p.delivered_kw/60,0),now.metrics.energy_delivered_kwh);
});
test('a minute-60 outage applies before [60,61), keeps connected cars, and recovers at 90',()=>{
  const p={...profile(),segments:[{start_minute:0,end_minute:60,fraction:1},{start_minute:60,end_minute:90,fraction:0},{start_minute:90,end_minute:120,fraction:1}]};
  const r=simulateBayAreaOperations({...config(),site_power_profile:p});
  assert.equal(r.frames[59].depot_queues[0].usable_site_kw,120);
  for(let t=60;t<90;t++){const d=r.frames[t].depot_queues[0];assert.equal(d.usable_site_kw,0);assert.equal(d.charging_kw,0);}
  assert.equal(r.frames[90].depot_queues[0].usable_site_kw,120);
  assert.ok(r.extensions.charging.zero_power_vehicle_min>0);
  assert.ok(r.frames.slice(60,90).some(f=>f.vehicles.some(v=>v.resource_blocked==='SITE_POWER_UNAVAILABLE')));
  assert.ok(Math.abs(r.metrics.energy_balance_error_kwh)<1e-6);
  assert.equal(r.frames.at(-1).depot_queues[0].charging_kw,0);
});
test('no demand means no invented direct effect and deliberately bad proposals cannot deliver power',()=>{
  const full=simulateBayAreaOperations({...config(),requests_per_hour:0,site_power_profile:profile(1)});
  const off=simulateBayAreaOperations({...config(),requests_per_hour:0,site_power_profile:profile(0)});
  assert.deepEqual(full.metrics,off.metrics);assert.equal(off.metrics.energy_delivered_kwh,0);
  const bad=simulateBayAreaOperations({...config(),charging:{...defaultCharging(),policy:'overcommit'},site_power_profile:profile(.6)});
  assert.ok(bad.extensions.charging.rejected_actions.length>0);assert.equal(bad.metrics.energy_delivered_kwh,0);
  assert.equal(bad.extensions.validity,'VALID');assert.equal(bad.extensions.checks[0].status,'FAIL');
});
test('regional graph is distinct, versioned, synthetic and routes only over declared edges',async()=>{
  const {AUSTIN_REGION,prepareRegionNetwork}=await import('../src/model/region-package.js');
  const {regionalPowerDemoConfig}=await import('../src/model/regional-power.js');
  const c=regionalPowerDemoConfig(),network=prepareRegionNetwork(c);
  assert.deepEqual(validateBayAreaConfig(c),[]);assert.ok(Object.isFrozen(AUSTIN_REGION));
  assert.equal(AUSTIN_REGION.geometry.coordinate_system,'local_meters');
  const path=network.routes[network.key('aus-north','aus-airport')];
  assert.ok(path.points.length>2);assert.ok(path.distance_km>0);
  assert.ok(!path.id.includes('bay-area'));assert.equal(network.places.find(p=>p.id==='aus-north').y,10);
  for(const patch of [{version:'future'},{graph_version:'future'},{id:'tokyo'}])assert.ok(validateBayAreaConfig({...c,region:{...c.region,...patch}}).length);
  assert.ok(validateBayAreaConfig({...c,place_ids:['menlo-park','palo-alto']}).length);
  assert.ok(validateBayAreaConfig({...c,depot_count:3}).length);
  assert.ok(validateBayAreaConfig({...c,launch:{}}).length);
});
test('severe regional shortage retains all requests, mandatory tasks, charge targets and bounded power',async()=>{
  const {regionalPowerDemoConfig}=await import('../src/model/regional-power.js');
  const c=regionalPowerDemoConfig('outage'),r=simulateBayAreaOperations(c);
  assert.equal(r.extensions.validity,'VALID');assert.equal(r.readiness.validity,'VALID');
  const m=r.metrics;assert.equal(m.total_requests,m.completed_trips+m.unserved_requests+m.pending_requests+m.in_progress_trips);
  assert.ok(r.readiness.metrics.unfinished_tasks>0);assert.ok(r.extensions.charging.unfinished_energy_kwh>0);
  assert.ok(Math.abs(m.energy_balance_error_kwh)<1e-6);
  for(const row of r.extensions.site_power.interval_trace){assert.ok(row.delivered_kw<=row.usable_site_kw+1e-8);assert.ok(row.delivered_kw>=0);}
  assert.ok(r.region.graph_digest);assert.ok(!r.assumptions.some(s=>s.includes('Real frozen OpenStreetMap')));
});
test('regional pairing preserves exogenous conditions and null treatment, and rejects incompatible identities',async()=>{
  const {regionalPowerDemoConfig}=await import('../src/model/regional-power.js');
  const c=regionalPowerDemoConfig(),f=freezeBayExperiment(c,{treatment:'charging_deadlines',seeds:[1001],null_treatment:true});
  assert.deepEqual(f.spec.baseline.site_power_profile,f.spec.candidate.site_power_profile);
  const a=simulateBayAreaOperations({...f.spec.baseline,seed:1001},{capture:false}),b=simulateBayAreaOperations({...f.spec.candidate,seed:1001},{capture:false});
  assert.deepEqual(a.requests,b.requests);assert.deepEqual(a.metrics,b.metrics);assert.equal(validateBayPair(f.spec,a,b,1001).ok,true);
  b.region.graph_digest='wrong';assert.equal(validateBayPair(f.spec,a,b,1001).ok,false);
  const steps=bayExperimentSteps(f);let n;do{n=steps.next();}while(!n.done);
  assert.equal(n.value.validity,'VALID');assert.equal(n.value.analysis,null);
  assert.equal(typeof n.value.per_seed[0].baseline.readiness.metrics.unfinished_tasks,'number');
  assert.equal(n.value.region.graph_digest,a.region.graph_digest);
  assert.equal(n.value.region.provenance.source_id,'fictional-austin-topology-v1');
  assert.equal(n.value.spec.region_digest,a.region.graph_digest);
});
test('future power changes cannot alter the past and reservations remain exclusive through an outage',async()=>{
  const {regionalPowerDemoConfig}=await import('../src/model/regional-power.js');
  const full=simulateBayAreaOperations(regionalPowerDemoConfig('full')),outage=simulateBayAreaOperations(regionalPowerDemoConfig('outage'));
  assert.deepEqual(full.frames.slice(0,90),outage.frames.slice(0,90));
  assert.deepEqual(full.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node]),outage.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node]));
  for(const f of outage.frames){const ports=f.depot_queues.flatMap(d=>d.resources.ports).filter(p=>p.owner!==null);assert.equal(new Set(ports.map(p=>p.owner)).size,ports.length);}
  assert.ok(outage.frames.slice(90,180).some(f=>f.depot_queues[0].resources.ports.some(p=>p.owner!==null)));
});
