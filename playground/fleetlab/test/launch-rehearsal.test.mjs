import test from 'node:test';
import assert from 'node:assert/strict';
import * as launch from '../src/model/launch-rehearsal.js';
import {simulateBayAreaOperations} from '../src/model/bay-operations.js';
import {freezeBayExperiment} from '../src/model/bay-experiment-contract.js';
import {mandatoryWorkComplete} from '../src/model/depot-readiness.js';

test('both versioned templates validate and Region B records only its own synthetic geometry',()=>{
  assert.equal(typeof launch.createLaunchConfig,'function');
  for(const id of ['peninsula','region_b']){
    const c=launch.createLaunchConfig(id);assert.equal(launch.validateLaunchConfig(c).ok,true);
    assert.equal(c.duration_hours,4);assert.notEqual(c.launch.depots[0].site_power_kw,c.launch.depots[1].site_power_kw);
    const r=simulateBayAreaOperations(c);assert.equal(r.launch.validity,'VALID');
    assert.equal(r.metrics.total_requests,r.requests.length);assert.equal(r.launch.metrics.requests,r.requests.length);
    assert.ok(r.visits.filter(v=>v.completed_minute!==null).every(mandatoryWorkComplete));
    if(id==='region_b'){
      assert.ok(r.locations.every(p=>p.id.startsWith('region-b:')));
      assert.ok(Object.values(r.routes).every(p=>p.id.startsWith('region_b:')&&p.source==='synthetic-kilometer-geometry'));
      assert.ok(!JSON.stringify(r.routes).includes('openstreetmap'));
    }
  }
});
test('zero commissioning delay is an exact null treatment and positive delay holds all external requests fixed',()=>{
  const c=launch.createLaunchConfig('region_b'),nullPair=launch.compareCommissioning(c,0);
  assert.equal(nullPair.validity,'VALID');assert.deepEqual(nullPair.baseline,nullPair.candidate);
  const pair=launch.compareCommissioning(c,180);assert.equal(pair.comparison.comparable,true);
  assert.deepEqual(pair.baseline.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]),pair.candidate.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]));
  for(const r of [pair.baseline,pair.candidate]){
    const m=r.launch.metrics;assert.equal(m.requests,m.pickup_within_target+m.pickup_late+m.pickup_missed+m.pickup_pending);
    assert.ok(Math.abs(r.metrics.energy_balance_error_kwh)<1e-6);
    assert.ok(r.frames.at(-1).depot_queues.every(d=>d.charging_kw===0));
    assert.equal(m.unfinished_visits,r.visits.filter(v=>v.completed_minute===null).length);
  }
  assert.equal(pair.descriptive,true);assert.equal(pair.evidence_status,'NOT_EVIDENCE');assert.equal(pair.deployment_permission,'NONE');
});
test('planned ports without events cannot add service or delivered energy',()=>{
  const a=launch.createLaunchConfig('region_b'),b=structuredClone(a),d=b.launch.depots[0];
  d.ports.push({...d.ports[0],id:d.id+':planned-extra',installed:false,commissioned:false});
  const x=simulateBayAreaOperations(a),y=simulateBayAreaOperations(b);
  assert.deepEqual(x.metrics,y.metrics);assert.deepEqual(x.requests,y.requests);
  assert.equal(y.launch.terminal_capacity[0].commissioned_ports,x.launch.terminal_capacity[0].commissioned_ports);
});
test('launch ownership and dependency cycles are structural blockers',()=>{
  const c=launch.createLaunchConfig('peninsula');c.launch.depots[0].tasks.at(-1).owner='';
  assert.equal(launch.validateLaunchConfig(c).ok,false);
  assert.throws(()=>simulateBayAreaOperations(c),/owner/i);
  const d=launch.createLaunchConfig('peninsula');d.launch.depots[0].tasks[0].depends_on=[d.launch.depots[0].tasks.at(-1).id];
  assert.equal(launch.validateLaunchConfig(d).ok,false);
});
test('duplicate, reordered, dependency-invalid and physically absent commissioning actions are named rejections, not invalid simulation',()=>{
  for(const [kind,change] of [
    ['DUPLICATE_EVENT',c=>c.launch.events.splice(1,0,structuredClone(c.launch.events[0]))],
    ['OUT_OF_ORDER_EVENT',c=>c.launch.events[1].sequence=1],
    ['DEPENDENCY_INCOMPLETE',c=>c.launch.depots[0].tasks[0].status='pending'],
    ['RESOURCE_NOT_INSTALLED',c=>c.launch.depots[0].ports[0].installed=false],
  ]){
    const c=launch.createLaunchConfig('region_b');change(c);const r=simulateBayAreaOperations(c);
    assert.equal(r.launch.validity,'VALID');assert.ok(r.launch.actions.some(a=>a.reason===kind),kind);
    assert.ok(r.launch.checks.some(a=>a.status==='FAIL'));
  }
});
test('site calendar stops new acquisition and charging power while active cleaning finishes',()=>{
  const c=launch.createLaunchConfig('region_b');c.cleaning_minutes=20;
  for(const d of c.launch.depots)d.calendar={open_minute:0,close_minute:30};
  const r=simulateBayAreaOperations(c);
  assert.ok(r.visits.some(v=>v.work_order.some(t=>t.stage==='cleaning'&&t.started_minute<30&&t.completed_minute>30)));
  assert.ok(r.visits.every(v=>v.work_order.every(t=>t.started_minute===null||t.started_minute<30)));
  assert.ok(r.frames.filter(f=>f.minute>=30).every(f=>f.depot_queues.every(d=>d.charging_kw===0)));
  assert.equal(r.readiness.validity,'VALID');
});
test('legacy experimental adapter explicitly rejects launch model and cross-region launch pairing is incompatible',()=>{
  const c=launch.createLaunchConfig('region_b');c.ojai_share_pct=0;
  assert.throws(()=>freezeBayExperiment(c,{treatment:'charging_redistribution'}),/launch|M4/i);
  const a=simulateBayAreaOperations(c),b=simulateBayAreaOperations(launch.createLaunchConfig('peninsula'));
  assert.equal(launch.compareLaunchRuns(a,b).comparable,false);
  const d=structuredClone(a);d.launch.version='future';assert.equal(launch.compareLaunchRuns(a,d).comparable,false);
});
test('named ports constrain compatibility and power independently of heterogeneous site caps',()=>{
  const c=launch.createLaunchConfig('region_b');c.ojai_share_pct=0;
  for(const d of c.launch.depots)for(const p of d.ports){p.cap_kw=7;p.compatible_vehicle_types=['ipace'];}
  const r=simulateBayAreaOperations(c);assert.equal(r.launch.validity,'VALID');
  assert.ok(r.frames.some(f=>f.vehicles.some(v=>v.power_kw>0)));
  for(const f of r.frames){
    for(const v of f.vehicles){assert.ok(v.power_kw<=7+1e-8);if(v.state==='charging')assert.equal(v.vehicle_type,'ipace');assert.ok(v.soc_kwh>=v.battery_kwh*c.reserve_soc_pct/100-1e-7);}
    for(const d of f.depot_queues){const site=c.launch.depots.find(s=>s.id===d.depot_id);assert.ok(d.charging_kw<=site.site_power_kw+1e-7);assert.ok(d.active.cleaning<=Math.min(site.cleaning_workers,site.cleaning_bays));assert.equal(d.resources.ports.length,site.ports.length);}
  }
  c.ojai_share_pct=100;assert.equal(simulateBayAreaOperations(c).metrics.energy_delivered_kwh,0);
});
test('initially commissioned ports require completed commissioning tasks and dependencies',()=>{
  for(const incomplete of ['commission','installation']){
    const c=launch.createLaunchConfig('region_b'),d=c.launch.depots[0];d.ports[0].commissioned=true;
    if(incomplete==='installation'){d.tasks.at(-1).status='completed';d.tasks[0].status='pending';}
    const v=launch.validateLaunchConfig(c);assert.equal(v.ok,false);assert.ok(v.checks.some(q=>q.name==='INITIAL_COMMISSIONING_DEPENDENCIES'&&q.status==='FAIL'));
    assert.throws(()=>simulateBayAreaOperations(c),/commission|dependenc/i);
  }
});
test('malformed nested config fails validation without throwing or silently converting missing values',()=>{
  for(const change of [c=>c.launch.region.places=[null,null],c=>c.launch.region.places=[{},{}],c=>c.launch.depots=[null],c=>c.launch.depots[0].tasks[0].depends_on='x',c=>c.launch.depots[0].tasks=[null],c=>c.launch.depots[0].ports=[null],c=>c.launch.region=null,c=>c.launch.events=null,c=>c.launch.depots[0].calendar={open_minute:20,close_minute:10}]){
    const c=launch.createLaunchConfig('region_b');change(c);assert.equal(launch.validateLaunchConfig(c).ok,false);
  }
});
test('comparison rejects unavailable and forged populations and nonzero baseline schedule',()=>{
  const c=launch.createLaunchConfig('region_b'),a=simulateBayAreaOperations(c),b=structuredClone(a);
  b.launch.metrics.pickup_within_target++;assert.equal(launch.compareLaunchRuns(a,b).comparable,false);
  const quiet=launch.createLaunchConfig('region_b');quiet.requests_per_hour=0;
  const result=launch.compareCommissioning(quiet,60);assert.equal(result.comparison.comparable,false);assert.equal(result.baseline.launch.metrics.pickup_within_target_fraction,null);
  c.launch.events[0].effective_minute=1;assert.throws(()=>launch.compareCommissioning(c,60),/minute zero|minute-zero|baseline/i);
});
test('closed start and midnight calendars use local opening-inclusive closing-exclusive minutes',()=>{
  const c=launch.createLaunchConfig('region_b');c.start_hour=23.5;c.duration_hours=1;
  for(const d of c.launch.depots)d.calendar={open_minute:0,close_minute:15};
  const r=simulateBayAreaOperations(c);
  assert.ok(r.visits.some(v=>v.work_order.some(t=>t.started_minute!==null)));
  assert.ok(r.visits.every(v=>v.work_order.every(t=>t.started_minute===null||(t.started_minute>=30&&t.started_minute<45))));
  assert.ok(r.frames.filter(f=>f.minute<30||f.minute>=45).every(f=>f.depot_queues.every(d=>d.charging_kw===0)));
});
test('commissioning after observation end cannot erase unfinished work or pending actions',()=>{
  const c=launch.createLaunchConfig('region_b'),r=launch.compareCommissioning(c,300).candidate;
  assert.ok(r.launch.terminal_capacity.every(d=>d.commissioned_ports===0));assert.equal(r.metrics.energy_delivered_kwh,0);
  assert.equal(r.launch.setup.unprocessed_mock_actions,5);assert.ok(r.launch.metrics.unfinished_tasks>0);
});
test('launch resource truth rejects legacy outage overrides and terminal commissioning delivers no interval energy',()=>{
  const c=launch.createLaunchConfig('region_b');c.resources.outage_ports=1;assert.equal(launch.validateLaunchConfig(c).ok,false);
  c.resources.outage_ports=0;const saved=structuredClone(c),r=launch.compareCommissioning(c,240).candidate;
  assert.deepEqual(c,saved);assert.equal(r.metrics.energy_delivered_kwh,0);
  assert.deepEqual(r.launch.terminal_capacity.map(d=>d.commissioned_ports),[3,2]);
  assert.ok(r.frames.at(-1).depot_queues.every(d=>d.charging_kw===0));
});
test('comparison rejects matched unsupported composite model and producer contract versions',()=>{
  const run=simulateBayAreaOperations(launch.createLaunchConfig('region_b'),{capture:false});
  for(const change of [r=>r.version='other-model-1',r=>r.extensions.producer='another-producer',r=>r.extensions.metric_version='future',r=>r.extensions.resources.version='future',r=>r.readiness.version='future',r=>r.readiness.metric_version='future',r=>r.readiness.required_work_rule='skip-mandatory-work']){
    const a=structuredClone(run),b=structuredClone(run);change(a);change(b);
    assert.equal(launch.compareLaunchRuns(a,b).comparable,false);
  }
});
test('comparison fails closed without throwing on missing or malformed nested populations',()=>{
  const run=simulateBayAreaOperations(launch.createLaunchConfig('region_b'),{capture:false});
  for(const change of [r=>delete r.readiness.metrics,r=>r.readiness.metrics=null,r=>r.requests=[null],r=>r.requests[0]={},r=>r.visits=[null],r=>r.visits[0].work_order=[null],r=>r.visits[0].work_order[0]={},r=>delete r.visits[0].completed_minute,r=>r.metrics=null,r=>r.launch.metrics=null,r=>r.launch.actions=null,r=>r.launch.terminal_capacity=null]){
    const other=structuredClone(run);change(other);
    let result;assert.doesNotThrow(()=>{result=launch.compareLaunchRuns(run,other);});assert.equal(result.comparable,false);
  }
});
test('comparison checks recorded commissioning actions and capacities against declared timeline',()=>{
  const run=simulateBayAreaOperations(launch.createLaunchConfig('region_b'),{capture:false});
  for(const change of [r=>r.config.launch.events.forEach(e=>e.effective_minute=120),r=>r.launch.actions[0].minute=3,r=>r.launch.actions[0].status='REJECTED',r=>r.launch.actions.pop(),r=>r.launch.initial_capacity[0].commissioned_ports=1,r=>r.launch.terminal_capacity[0].commissioned_kw+=1,r=>r.launch.setup.accepted_mock_actions=0]){
    const other=structuredClone(run);change(other);const result=launch.compareLaunchRuns(run,other);
    assert.equal(result.comparable,false);assert.match(result.reason,/commission|capacity|action|timeline|setup/i);
  }
  const delayed=launch.compareCommissioning(launch.createLaunchConfig('region_b'),120);assert.equal(delayed.comparison.comparable,true);
});
