import test from 'node:test';
import assert from 'node:assert/strict';
import * as bay from '../src/model/bay-operations.js';

export const scenario=()=>({...bay.defaultBayAreaConfig(),place_ids:['menlo-park','palo-alto'],fleet_size:16,depot_count:1,
  duration_hours:4,start_hour:0,requests_per_hour:45,peak_multiplier:1,trips_between_visits:1,cleaning_minutes:18,
  cleaning_bays:3,software_every_visits:100,upload_minutes:1,chargers:8,charger_kw:150,site_power_kw:1000,
  initial_soc_pct:85,charge_target_pct:85,readiness:{version:'depot-readiness-1.0.0',cleaning_workers:1,scheduler:'fifo',max_task_wait_min:60}});

test('M1 is explicit and legacy results retain their model and shapes',()=>{
  const config=bay.defaultBayAreaConfig(),legacy=bay.simulateBayAreaOperations({...config,duration_hours:1});
  assert.equal(legacy.version,'fleetlab-bay-operations-1.0.0');
  assert.equal(legacy.readiness,undefined);assert.equal(config.readiness,undefined);
  const r=bay.simulateBayAreaOperations(scenario());
  assert.equal(r.version,'fleetlab-bay-operations-1.0.0+depot-readiness-1.0.0');
  assert.equal(r.readiness.evidence_status,'NOT_EVIDENCE');
});

test('worker reservations are finite, serial, and released only on recorded completion',()=>{
  const r=bay.simulateBayAreaOperations(scenario());
  assert.ok(r.frames.some(f=>f.vehicles.some(v=>v.readiness?.blocked_reason==='WORKER_UNAVAILABLE')));
  for(const f of r.frames){
    const working=f.vehicles.filter(v=>v.state==='cleaning');assert.ok(working.length<=1);
    assert.equal(new Set(working.map(v=>v.readiness.worker_id)).size,working.length);
    for(const d of f.depot_queues)assert.equal(d.cleaning_workers.in_use,d.active.cleaning);
  }
  for(const visit of r.visits){
    if(visit.completed_minute!==null)assert.ok(visit.work_order.filter(t=>t.required).every(t=>t.status==='completed'&&t.completion_record));
    for(const t of visit.work_order.filter(t=>t.status==='completed'))assert.equal(t.completed_minute-t.started_minute,t.active_minutes);
  }
  assert.equal(r.readiness.validity,'VALID');
});

test('zero workers block empty bays; extra workers cannot remove a bay bottleneck',()=>{
  const c=scenario();c.readiness.cleaning_workers=0;
  const zero=bay.simulateBayAreaOperations(c);
  assert.equal(zero.metrics.completed_visits,0);
  assert.ok(zero.frames.some(f=>f.vehicles.some(v=>v.readiness?.blocked_reason==='WORKER_UNAVAILABLE')));
  c.readiness.cleaning_workers=8;c.cleaning_bays=1;
  const one=bay.simulateBayAreaOperations(c);
  assert.ok(one.frames.some(f=>f.vehicles.some(v=>v.readiness?.blocked_reason==='BAY_UNAVAILABLE')));
  c.readiness.cleaning_workers=9;
  assert.deepEqual(bay.simulateBayAreaOperations(c).metrics,one.metrics);
});

test('all requests, visits and required work remain accounted for at the horizon',()=>{
  const r=bay.simulateBayAreaOperations(scenario()),m=r.readiness.metrics;
  assert.equal(m.required_tasks,m.completed_tasks+m.queued_tasks+m.active_tasks+m.not_reached_tasks);
  assert.equal(r.visits.length,r.metrics.completed_visits+r.metrics.censored_visits);
  assert.ok(m.unfinished_tasks>0);assert.ok(m.oldest_unfinished_task_age_min>0);
  assert.equal(m.onsite_observed_min,m.queue_observed_min+m.active_observed_min);
  assert.equal(r.metrics.total_requests,r.metrics.completed_trips+r.metrics.unserved_requests+r.metrics.pending_requests+r.metrics.in_progress_trips);
  const quiet=bay.simulateBayAreaOperations(scenario(),{capture:false});assert.deepEqual(quiet.readiness,r.readiness);
});

test('M1 preserves energy, reserve, charger and terminal-interval constraints',()=>{
  const r=bay.simulateBayAreaOperations(scenario());
  assert.ok(Math.abs(r.metrics.energy_balance_error_kwh)<1e-6);
  for(const f of r.frames){
    for(const v of f.vehicles)assert.ok(v.soc_kwh>=v.battery_kwh*r.config.reserve_soc_pct/100-1e-8&&v.soc_kwh<=v.battery_kwh+1e-8);
    for(const d of f.depot_queues)assert.ok(d.charging_kw<=r.config.site_power_kw+1e-8&&d.active.charging<=r.config.chargers);
  }
  assert.ok(r.frames.at(-1).depot_queues.every(d=>d.charging_kw===0));
});

test('broken policies are detected without turning a rejected proposal into invalid state',()=>{
  for(const scheduler of ['defer_cleaning','skip_cleaning','cancel_cleaning']){
    const c=scenario();c.readiness.scheduler=scheduler;
    const r=bay.simulateBayAreaOperations(c);
    assert.equal(r.readiness.validity,'VALID');assert.equal(r.metrics.completed_visits,0);
    assert.equal(r.readiness.checks.find(x=>x.name==='REQUIRED_WORK_MAX_WAIT').status,'FAIL');
    if(scheduler!=='defer_cleaning')assert.equal(r.readiness.checks.find(x=>x.name==='MANDATORY_WORK_POLICY').status,'FAIL');
    assert.ok(r.readiness.metrics.unfinished_tasks>0);
  }
});

test('unknown extension versions, malformed capacities and policies fail closed',()=>{
  for(const patch of [{version:'unknown'},{cleaning_workers:-1},{cleaning_workers:1.5},{cleaning_workers:NaN},{scheduler:'magic'},{max_task_wait_min:0},{extra:1}]){
    const c=scenario();Object.assign(c.readiness,patch);assert.ok(bay.validateBayAreaConfig(c).length);assert.throws(()=>bay.simulateBayAreaOperations(c));
  }
});

test('controlled worker and bay trials reuse external demand and declare exactly one change',()=>{
  assert.equal(typeof bay.analyzeDepotReadiness,'function');
  const c=scenario(),comparison=bay.analyzeDepotReadiness(c);
  const [a,b,n]=comparison.arms.map(a=>a.result);
  const demand=r=>r.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]);
  assert.deepEqual(demand(a),demand(b));assert.deepEqual(demand(a),demand(n));
  assert.deepEqual(n.metrics,a.metrics);assert.ok(b.metrics.completed_trips>a.metrics.completed_trips);
  const workerConfig=structuredClone(b.config);workerConfig.readiness.cleaning_workers--;assert.deepEqual(workerConfig,a.config);
  const bayConfig=structuredClone(n.config);bayConfig.cleaning_bays--;assert.deepEqual(bayConfig,a.config);
  assert.deepEqual(comparison,bay.analyzeDepotReadiness(c));
  assert.equal(comparison.evidence_status,'NOT_EVIDENCE');assert.equal(comparison.replications,1);
});

test('mandatory completion rejects missing, forged and undersized completion records',async()=>{
  const {mandatoryWorkComplete}=await import('../src/model/depot-readiness.js');
  const r=bay.simulateBayAreaOperations(scenario()),visit=r.visits.find(v=>v.completed_minute!==null);
  assert.ok(visit);assert.equal(mandatoryWorkComplete(visit),true);
  for(const mutate of [v=>v.work_order.pop(),v=>v.work_order.find(t=>t.stage==='cleaning').required=false,
    v=>v.work_order.find(t=>t.stage==='cleaning').completion_record=null,
    v=>v.work_order.find(t=>t.stage==='cleaning').active_minutes=0]){
    const copy=structuredClone(visit);mutate(copy);assert.equal(mandatoryWorkComplete(copy),false);
  }
});

test('readiness comparison rejects different producers, metric versions and non-treatment settings',async()=>{
  const {compareReadinessRuns}=await import('../src/model/depot-readiness.js');assert.equal(typeof compareReadinessRuns,'function');
  const a=bay.simulateBayAreaOperations(scenario(),{capture:false}),b=structuredClone(a);b.config.readiness.cleaning_workers++;
  assert.equal(compareReadinessRuns(a,b,'cleaning_workers').comparable,true);
  for(const mutate of [r=>r.version='street-lab',r=>r.readiness.metric_version='unknown',r=>r.config.requests_per_hour++,r=>r.requests[0].created_minute++,r=>r.readiness.validity='INVALID_SIMULATION']){
    const bad=structuredClone(b);mutate(bad);assert.equal(compareReadinessRuns(a,bad,'cleaning_workers').comparable,false);
  }
});

test('historical Bay whole-result fixtures remain byte-identical to published f85a28f',async()=>{
  const {createHash}=await import('node:crypto');
  for(const [patch,expected] of [
    [{duration_hours:1},'09c60db29ffa103fe1fa171d05c0d9ef9dfe06a22448c9f9d6c0ef729132d4f4'],
    [{duration_hours:4,place_ids:['menlo-park','palo-alto'],trips_between_visits:1},'bac185dd960ec60d8194f63fee6c8a5a55bb9224fa3834bec72461487ca5ef13'],
  ]){
    const r=bay.simulateBayAreaOperations({...bay.defaultBayAreaConfig(),...patch});
    assert.equal(createHash('sha256').update(JSON.stringify(r)).digest('hex'),expected);
  }
});

test('waiting check is unavailable until a task reaches a queue, including inbound-only runs',()=>{
  for(const patch of [{requests_per_hour:0},{duration_hours:6/60}]){
    const r=bay.simulateBayAreaOperations({...scenario(),...patch});
    assert.ok(r.visits.flatMap(v=>v.work_order).every(t=>t.queued_minute===null));
    const check=r.readiness.checks.find(c=>c.name==='REQUIRED_WORK_MAX_WAIT');
    assert.equal(check.status,'NOT_AVAILABLE');assert.equal(check.value,null);assert.equal(r.readiness.metrics.max_task_queue_min,null);
  }
});

test('an out-of-range treatment is unavailable without suppressing the independent valid arm',()=>{
  for(const axis of ['cleaning_workers','cleaning_bays']){
    const c=scenario();if(axis==='cleaning_workers')c.readiness.cleaning_workers=120;else c.cleaning_bays=120;
    const comparison=bay.analyzeDepotReadiness(c),blocked=comparison.arms.find(a=>a.axis===axis),other=comparison.arms.find(a=>a.axis&&a.axis!==axis);
    assert.equal(blocked.result,null);assert.equal(blocked.available,false);assert.match(blocked.reason,/between/);
    assert.equal(blocked.from,120);assert.equal(blocked.to,121);assert.equal(other.available,true);assert.equal(other.comparison.comparable,true);
  }
});
