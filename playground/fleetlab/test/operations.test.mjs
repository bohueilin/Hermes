import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/model/operations.js';
const run = (patch = {}, options) => model.simulateOperations({...model.defaultOperationsConfig(), ...patch}, options);

test('operations exports a usable bounded simulator', () => {
  assert.equal(typeof model.simulateOperations, 'function');
  assert.equal(typeof model.analyzeOperationsCapacity, 'function');
});
test('same seed reproduces all observations and capture does not change outcomes', () => {
  const first = run();
  assert.deepEqual(first, run());
  const quiet = run({}, {capture:false});
  assert.deepEqual(quiet.metrics, first.metrics);
  assert.deepEqual(quiet.requests, first.requests);
  assert.deepEqual(quiet.frames, []);
  assert.deepEqual(quiet.events, []);
});
test('vehicles and requests are conserved, including the unfinished horizon', () => {
  const r = run({fleet_size:4,requests_per_hour:100,duration_hours:1});
  const m = r.metrics;
  assert.equal(m.total_requests, m.completed_trips+m.unserved_requests+m.pending_requests+m.in_progress_trips);
  assert.ok(m.unserved_requests > 0 && m.in_progress_trips > 0 && m.pending_requests > 0);
  for (const f of r.frames) {
    assert.equal(f.vehicles.length,4);
    assert.equal(new Set(f.vehicles.map(v=>v.id)).size,4);
    assert.equal(Object.values(f.counts).reduce((a,b)=>a+b,0),4);
    for (const v of f.vehicles) {
      assert.ok(v.state in model.OPERATIONS_STATES);
      assert.ok(v.progress >= 0 && v.progress <= 1);
      if (v.from !== null) assert.ok(r.locations.some(n=>n.id===v.from) && r.locations.some(n=>n.id===v.to));
    }
  }
});
test('finite bays and site power bound active stages while queues accumulate', () => {
  const r=run({fleet_size:30,depot_count:1,requests_per_hour:100,trips_between_visits:1,chargers:2,site_power_kw:18,charger_kw:50,cleaning_bays:1,software_bays:1,upload_bays:1,software_every_visits:1});
  assert.ok(r.metrics.max_queue>0);
  for (const f of r.frames) for(const d of f.depot_queues) {
    assert.ok(d.active.cleaning<=1 && d.active.software<=1 && d.active.upload<=1 && d.active.charging<=2);
    assert.ok(d.charging_kw<=18+1e-9);
    for(const stage of ['software','cleaning','charging','upload']) {
      assert.equal(d[stage],f.vehicles.filter(v=>v.depot_id===d.depot_id && v.state===`queued_${stage}`).length);
      assert.equal(d.active[stage],f.vehicles.filter(v=>v.depot_id===d.depot_id && v.state===stage).length);
    }
  }
});
test('energy is conserved, SOC bounded, and delivered energy respects each minute site budget', () => {
  const r=run({depot_count:1,requests_per_hour:70,trips_between_visits:1,site_power_kw:24,chargers:4});
  const m=r.metrics;
  assert.ok(m.energy_delivered_kwh>0);
  assert.ok(Math.abs(m.initial_energy_kwh+m.energy_delivered_kwh-m.energy_consumed_kwh-m.final_energy_kwh)<1e-6);
  for(let i=0;i<r.frames.length;i++) {
    for(const v of r.frames[i].vehicles) assert.ok(v.soc_kwh>=-1e-9 && v.soc_kwh<=r.config.battery_kwh+1e-9);
    if(i) {
      const delivered=r.frames[i].vehicles.reduce((sum,v,j)=>sum+Math.max(0,v.soc_kwh-r.frames[i-1].vehicles[j].soc_kwh),0);
      assert.ok(delivered<=24/60+1e-8);
    }
  }
});
test('missing completed populations are null and censored visits are explicit', () => {
  const empty=run({requests_per_hour:0,duration_hours:1});
  assert.equal(empty.metrics.total_requests,0);
  assert.equal(empty.metrics.avg_wait_min_completed,null);
  assert.equal(empty.metrics.avg_depot_turnaround_min,null);
  assert.equal(empty.metrics.avg_active_service_min,null);
  const r=run({fleet_size:8,requests_per_hour:60,trips_between_visits:1,duration_hours:1,cleaning_minutes:120});
  assert.ok(r.metrics.censored_visits>0);
  assert.equal(r.metrics.avg_depot_turnaround_min,null);
  assert.equal(r.metrics.censored_visits,r.visits.filter(v=>v.completed_minute===null).length);
});
test('weather and time are explicit causal inputs and clocks wrap midnight', () => {
  const clear=run({start_hour:7}), rain=run({start_hour:7,weather:'rain'}), night=run({start_hour:23,duration_hours:2});
  assert.ok(rain.requests[0].trip_minutes>clear.requests[0].trip_minutes);
  assert.notEqual(clear.metrics.total_requests,run({start_hour:0}).metrics.total_requests);
  assert.equal(night.frames[60].clock_minute,0);
});
test('sequential depot lifecycle runs scheduled software and completes service before ready', () => {
  const r=run({fleet_size:1,depot_count:1,requests_per_hour:12,trips_between_visits:1,trip_minutes:3,pickup_minutes:1,cleaning_minutes:2,software_minutes:2,upload_minutes:2,software_every_visits:2,charger_kw:120,site_power_kw:120,duration_hours:5});
  const completed=r.visits.filter(v=>v.completed_minute!==null);
  assert.ok(completed.length>=2);
  for(const visit of completed) {
    const active=visit.stages.filter(s=>s.started_minute!==null);
    assert.deepEqual(active.map(s=>s.stage),visit.software_scheduled?['software','cleaning','charging','upload']:['cleaning','charging','upload']);
    for(let i=1;i<active.length;i++) assert.ok(active[i].started_minute>=active[i-1].completed_minute);
    assert.ok(visit.completed_minute>=active.at(-1).completed_minute);
  }
  assert.ok(r.frames.some(f=>f.vehicles[0].state==='ready'));
});
test('capacity trials share demand and travel inputs and do not invent a minimum', () => {
  const a=run({fleet_size:3,depot_count:1,duration_hours:1}), b=run({fleet_size:8,depot_count:3,duration_hours:1});
  const demand=r=>r.requests.map(({id,created_minute,pickup_node,dropoff_node,pickup_minutes,trip_minutes})=>({id,created_minute,pickup_node,dropoff_node,pickup_minutes,trip_minutes}));
  assert.deepEqual(demand(a),demand(b));
  const c=model.analyzeOperationsCapacity({...model.defaultOperationsConfig(),fleet_size:1,requests_per_hour:240,duration_hours:1});
  assert.equal(c.min_depots,null);
  assert.equal(c.target_completion_fraction,.95);
  for(const trial of [...c.fleet_trials,...c.depot_trials]) {
    assert.equal(trial.metrics.total_requests,c.depot_trials[0].metrics.total_requests);
    assert.equal(trial.demand_signature,c.depot_trials[0].demand_signature);
    assert.equal(trial.completion_fraction,trial.metrics.completed_trips/trial.metrics.total_requests);
  }
});
test('invalid numeric and structural inputs are rejected before running', () => {
  const invalid=[{fleet_size:121},{fleet_size:1.5},{fleet_size:0},{depot_count:7},{duration_hours:25},{duration_hours:0},{requests_per_hour:241},{requests_per_hour:-1},{start_hour:24},{start_hour:-1},{seed:NaN},{weather:'snow'},{cleaning_bays:0},{chargers:1.2},{charger_kw:0},{site_power_kw:Infinity},{battery_kwh:-1},{initial_soc_pct:101},{reserve_soc_pct:90},{charge_target_pct:10},{trip_minutes:0},{software_every_visits:0},{energy_kwh_per_minute:NaN}];
  for(const patch of invalid) {
    const config={...model.defaultOperationsConfig(),...patch};
    assert.ok(model.validateOperationsConfig(config).length>0,JSON.stringify(patch));
    assert.throws(()=>model.simulateOperations(config));
  }
  for(const config of [null,{},[],{fleet_size:undefined}]) assert.ok(model.validateOperationsConfig(config).length>0);
});
test('minute rounding is explicit and no horizon energy is charged after the last frame', () => {
  const r=run({duration_hours:1.01,start_hour:7.01,trip_minutes:3.2,pickup_minutes:1.1});
  assert.equal(r.frames.at(-1).minute,61);
  assert.equal(r.frames[0].clock_minute,421);
  assert.equal(r.metrics.final_energy_kwh,r.frames.at(-1).vehicles.reduce((s,v)=>s+v.soc_kwh,0));
});
test('energy-infeasible trips remain accounted for without fabricated travel or negative SOC', () => {
  const r=run({fleet_size:2,battery_kwh:0.01,requests_per_hour:60,duration_hours:1});
  assert.equal(r.metrics.completed_trips,0);
  assert.equal(r.metrics.in_progress_trips,0);
  assert.equal(r.metrics.energy_consumed_kwh,0);
  assert.equal(r.metrics.total_requests,r.metrics.pending_requests+r.metrics.unserved_requests);
  assert.equal(r.metrics.energy_blocked_vehicle_count,2);
});
test('each in-flight request has one vehicle and vehicles preserve their motion between frames', () => {
  const r=run({fleet_size:12,requests_per_hour:80});
  const map=new Map(r.requests.map(q=>[q.id,q]));
  for(let i=0;i<r.frames.length;i++) {
    const frame=r.frames[i], active=frame.vehicles.filter(v=>v.request_id!==null);
    assert.equal(new Set(active.map(v=>v.request_id)).size,active.length);
    for(const v of active) {
      const q=map.get(v.request_id);
      assert.equal(q.vehicle_id,v.id);
      assert.ok(q.assigned_minute<=frame.minute);
      assert.ok(q.completed_minute===null||q.completed_minute>frame.minute);
      assert.ok(['pickup','passenger_trip'].includes(v.state));
    }
    if(!i) continue;
    for(let j=0;j<frame.vehicles.length;j++) {
      const v=frame.vehicles[j], prev=r.frames[i-1].vehicles[j];
      if(prev.from!==null && prev.remaining_min>1) {
        assert.equal(v.from,prev.from);assert.equal(v.to,prev.to);assert.equal(v.state,prev.state);
        assert.ok(v.progress>prev.progress);
      }
      if(v.soc_kwh>prev.soc_kwh+1e-10) {
        assert.equal(prev.state,'charging');
        assert.ok(v.soc_kwh-prev.soc_kwh<=r.config.charger_kw/60+1e-8);
        assert.ok(v.soc_kwh<=r.config.battery_kwh*r.config.charge_target_pct/100+1e-8);
      }
    }
  }
});
test('maximum fleet, depot and horizon settings remain finite and conserve all populations', () => {
  const r=run({fleet_size:120,depot_count:6,duration_hours:24,requests_per_hour:240},{capture:false});
  const m=r.metrics;
  assert.equal(m.total_requests,m.completed_trips+m.unserved_requests+m.pending_requests+m.in_progress_trips);
  assert.ok(Math.abs(m.energy_balance_error_kwh)<1e-6);
  for(const v of Object.values(m)) if(typeof v==='number') assert.ok(Number.isFinite(v));
});
test('changing result observations cannot mutate caller config or another captured frame', () => {
  const c=model.defaultOperationsConfig(), before=structuredClone(c), r=model.simulateOperations(c);
  r.frames[0].vehicles[0].state='tampered';
  r.config.fleet_size=1;
  assert.deepEqual(c,before);
  assert.notEqual(r.frames[1].vehicles[0].state,'tampered');
});
test('zero-demand capacity cannot claim a sufficient depot count', () => {
  const capacity=model.analyzeOperationsCapacity({...model.defaultOperationsConfig(),requests_per_hour:0,duration_hours:1});
  assert.equal(capacity.min_depots,null);
  assert.ok(capacity.depot_trials.every(t=>t.completion_fraction===null));
});
test('reported charging power matches delivered energy including partial final charge minutes', () => {
  const r=run({fleet_size:6,depot_count:2,trips_between_visits:1,requests_per_hour:40,charger_kw:200,site_power_kw:500});
  for(let i=1;i<r.frames.length;i++) {
    for(const d of r.frames[i-1].depot_queues) {
      const delivered=r.frames[i].vehicles.reduce((sum,v,j)=>{
        const previous=r.frames[i-1].vehicles[j];
        return sum+(previous.depot_id===d.depot_id?Math.max(0,v.soc_kwh-previous.soc_kwh):0);
      },0);
      assert.ok(Math.abs(d.charging_kw/60-delivered)<1e-8,`minute ${i}: recorded kW must reflect actual energy`);
    }
  }
  assert.ok(r.frames.at(-1).depot_queues.every(d=>d.charging_kw===0));
});
test('a depot leg cannot consume reserved energy when no request is dispatchable', () => {
  const r=run({fleet_size:3,depot_count:1,reserve_soc_pct:64,initial_soc_pct:65,charge_target_pct:85,pickup_minutes:20,requests_per_hour:60,duration_hours:1});
  assert.equal(r.metrics.energy_consumed_kwh,0);
  assert.equal(r.metrics.completed_trips,0);
  assert.equal(r.metrics.energy_blocked_vehicle_count,3);
  assert.ok(r.metrics.unserved_requests>0);
  assert.equal(r.metrics.total_requests,r.metrics.unserved_requests+r.metrics.pending_requests);
});
test('dispatch reserves a whole depot leg separately from the SOC reserve', () => {
  const r=run({fleet_size:4,depot_count:1,reserve_soc_pct:1,initial_soc_pct:65,battery_kwh:12,pickup_minutes:12,trip_minutes:4,trips_between_visits:1,energy_kwh_per_minute:0.12,requests_per_hour:24,duration_hours:4});
  assert.ok(r.visits.some(v=>v.arrived_minute!==null));
  for(const f of r.frames) for(const v of f.vehicles) assert.ok(v.soc_kwh>=0.12-1e-8);
  assert.ok(Math.abs(r.metrics.energy_balance_error_kwh)<1e-7);
});
test('synthetic rush-hour congestion changes travel with identical request-keyed randomness', () => {
  const calm=run({start_hour:0,requests_per_hour:60,duration_hours:1});
  const rush=run({start_hour:7,requests_per_hour:60,duration_hours:4});
  assert.equal(calm.requests[0].pickup_node,rush.requests[0].pickup_node);
  assert.equal(calm.requests[0].dropoff_node,rush.requests[0].dropoff_node);
  assert.ok(rush.requests[0].trip_minutes>calm.requests[0].trip_minutes);
  assert.equal(calm.frames[0].traffic_multiplier,1);
  assert.equal(rush.frames[0].traffic_multiplier,1.25);
  assert.equal(rush.frames[180].traffic_multiplier,1);
  const slower=run({start_hour:0,requests_per_hour:60,duration_hours:1,traffic_multiplier:2});
  assert.ok(slower.requests[0].trip_minutes>calm.requests[0].trip_minutes);
  assert.equal(slower.frames[0].traffic_multiplier,2);
  for(const traffic_multiplier of [0,0.49,3.01,NaN]) assert.ok(model.validateOperationsConfig({...model.defaultOperationsConfig(),traffic_multiplier}).length>0);
});
test('terminal trip completion does not initiate a new depot visit',()=>{
  const r=run({fleet_size:1,depot_count:1,start_hour:0,requests_per_hour:60,pickup_minutes:0.01,trip_minutes:0.01,duration_hours:2/60,trips_between_visits:1});
  assert.equal(r.metrics.completed_trips,1);
  assert.equal(r.metrics.censored_visits,0);
  assert.equal(r.visits.length,0);
  assert.ok(!r.events.some(e=>e.minute===2&&e.kind==='drive_to_depot'));
  assert.ok(Math.abs(r.metrics.energy_consumed_kwh-2*r.config.energy_kwh_per_minute)<1e-9);
});
test('on-site depot mean excludes return travel and retains the completed population',()=>{
  const r=run({duration_hours:8});
  const complete=r.visits.filter(v=>v.completed_minute!==null);
  assert.ok(complete.length>0);
  const expected=complete.reduce((sum,v)=>sum+v.completed_minute-v.arrived_minute,0)/complete.length;
  assert.equal(r.metrics.avg_depot_onsite_min,expected);
  assert.ok(r.metrics.avg_depot_onsite_min<r.metrics.avg_depot_turnaround_min);
  assert.equal(run({requests_per_hour:0}).metrics.avg_depot_onsite_min,null);
});
