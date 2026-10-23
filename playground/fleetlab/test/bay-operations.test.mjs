import test from 'node:test';
import assert from 'node:assert/strict';
import {bayAreaRoute} from '../src/model/bay-area.js';
import * as model from '../src/model/bay-operations.js';
const run=(patch={},options)=>model.simulateBayAreaOperations({...model.defaultBayAreaConfig(),...patch},options);
const demand=r=>r.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]);
test('Bay operations provides all18 selected places, routed trips and visible boarding',()=>{
  assert.equal(typeof model.simulateBayAreaOperations,'function');
  const r=run();
  assert.equal(r.config.place_ids.length,18);
  assert.ok(r.metrics.completed_trips>0);
  assert.ok(r.frames.some(f=>f.vehicles.some(v=>v.state==='boarding')));
  for(const q of r.requests){assert.notEqual(q.pickup_node,q.dropoff_node);assert.equal(q.trip_distance_km,bayAreaRoute(q.pickup_node,q.dropoff_node).distance_km);}
  for(const f of r.frames)for(const v of f.vehicles){
    assert.ok(v.state in model.BAY_OPERATIONS_STATES);
    if(v.from!==null){assert.ok(r.routes[v.route_id]?.available);assert.ok(v.remaining_min>0);}
  }
});
test('same demand survives fleet, depot and vehicle-mix changes and capture is neutral',()=>{
  const a=run({duration_hours:2}),b=run({duration_hours:2,fleet_size:12,depot_count:3,ojai_share_pct:100});
  assert.deepEqual(demand(a),demand(b));assert.equal(a.demand_signature,b.demand_signature);
  const quiet=run({duration_hours:2},{capture:false});assert.deepEqual(quiet.metrics,a.metrics);assert.deepEqual(quiet.frames,[]);
});
test('vehicle and request totals including incomplete horizon and type/place slices conserve',()=>{
  const r=run({fleet_size:5,ojai_share_pct:50,requests_per_hour:100,duration_hours:1});const m=r.metrics;
  assert.equal(m.total_requests,m.completed_trips+m.unserved_requests+m.pending_requests+m.in_progress_trips);
  assert.equal(m.by_vehicle_type.reduce((s,t)=>s+t.vehicle_count,0),5);
  assert.equal(m.by_vehicle_type.find(t=>t.vehicle_type==='ojai').vehicle_count,3);
  assert.equal(m.by_vehicle_type.reduce((s,t)=>s+t.completed_trips,0),m.completed_trips);
  assert.equal(m.by_place.reduce((s,p)=>s+p.total_requests,0),m.total_requests);
  for(const f of r.frames){assert.equal(f.vehicles.length,5);assert.equal(Object.values(f.counts).reduce((a,b)=>a+b,0),5);}
});
test('distance-based energy conserves and every per-vehicle reserve remains intact',()=>{
  const r=run({requests_per_hour:60,trips_between_visits:1});const m=r.metrics;
  assert.ok(m.energy_delivered_kwh>0);
  assert.ok(Math.abs(m.initial_energy_kwh+m.energy_delivered_kwh-m.energy_consumed_kwh-m.final_energy_kwh)<1e-6);
  for(const f of r.frames)for(const v of f.vehicles)assert.ok(v.soc_kwh>=v.battery_kwh*r.config.reserve_soc_pct/100-1e-8&&v.soc_kwh<=v.battery_kwh+1e-8);
  for(const t of m.by_vehicle_type)assert.ok(Math.abs(t.distance_km*r.config.vehicle_profiles[t.vehicle_type].energy_kwh_per_km-t.energy_consumed_kwh)<1e-6);
});
test('active bays are finite and each charging interval respects site, port and vehicle caps',()=>{
  const config=model.defaultBayAreaConfig();config.vehicle_profiles.ipace.charge_limit_kw=10;config.vehicle_profiles.ojai.charge_limit_kw=15;
  const r=model.simulateBayAreaOperations({...config,fleet_size:30,requests_per_hour:70,depot_count:1,trips_between_visits:1,site_power_kw:24,charger_kw:20,chargers:3});
  assert.ok(r.metrics.energy_delivered_kwh>0);
  for(let i=0;i<r.frames.length;i++){
    for(const d of r.frames[i].depot_queues){assert.ok(d.active.charging<=3&&d.active.cleaning<=config.cleaning_bays&&d.active.software<=config.software_bays&&d.active.upload<=config.upload_bays);assert.ok(d.charging_kw<=24+1e-8);}
    if(!i)continue;
    let delivered=0;
    for(let j=0;j<r.frames[i].vehicles.length;j++){
      const v=r.frames[i].vehicles[j],prev=r.frames[i-1].vehicles[j],gain=v.soc_kwh-prev.soc_kwh;
      if(gain>0){assert.equal(prev.state,'charging');assert.ok(gain<=config.vehicle_profiles[v.vehicle_type].charge_limit_kw/60+1e-8);delivered+=gain;}
    }
    assert.ok(delivered<=24/60+1e-8);
    assert.ok(Math.abs(delivered-r.frames[i-1].depot_queues[0].charging_kw/60)<1e-7);
  }
});
test('equal profile parameters produce equal trip and energy outcomes regardless of branding',()=>{
  const c=model.defaultBayAreaConfig();c.vehicle_profiles.ojai={...c.vehicle_profiles.ipace};
  const a=model.simulateBayAreaOperations({...c,ojai_share_pct:0}),b=model.simulateBayAreaOperations({...c,ojai_share_pct:100});
  for(const key of ['completed_trips','unserved_requests','energy_consumed_kwh','energy_delivered_kwh','avg_wait_min_completed'])assert.equal(a.metrics[key],b.metrics[key],key);
  assert.deepEqual(a.requests.map(q=>[q.assigned_minute,q.completed_minute]),b.requests.map(q=>[q.assigned_minute,q.completed_minute]));
});
test('higher energy intensity changes measured energy on the same low-demand trips',()=>{
  const c=model.defaultBayAreaConfig();c.place_ids=['menlo-park','palo-alto'];c.fleet_size=4;c.requests_per_hour=4;c.duration_hours=2;c.trips_between_visits=100;c.ojai_share_pct=0;
  const a=model.simulateBayAreaOperations(c);const higher=structuredClone(c);higher.vehicle_profiles.ipace.energy_kwh_per_km*=2;
  const b=model.simulateBayAreaOperations(higher);
  assert.equal(a.metrics.completed_trips,b.metrics.completed_trips);
  assert.ok(Math.abs(b.metrics.energy_consumed_kwh-2*a.metrics.energy_consumed_kwh)<1e-8);
});
test('route distance controls moving duration and same-anchor pickups consume no time or energy',()=>{
  const r=run({place_ids:['san-francisco','san-jose'],fleet_size:2,requests_per_hour:4,duration_hours:4,start_hour:0,road_speed_kph:40});
  const completed=r.requests.filter(q=>q.completed_minute!==null);assert.ok(completed.length>0);
  for(const q of completed){assert.ok(q.passenger_drive_min>100);assert.equal(q.trip_minutes,q.boarding_min+q.passenger_drive_min);}
  assert.ok(r.requests.some(q=>q.assigned_minute!==null&&q.pickup_distance_km===0&&q.pickup_drive_min===0));
  for(const f of r.frames)for(const v of f.vehicles)if(v.from!==null)assert.ok(r.routes[v.route_id].distance_km>0);
});
test('selected-place, speed and mix bounds reject unsupported inputs',()=>{
  for(const patch of [{place_ids:[]},{place_ids:['sfo']},{place_ids:['sfo','sfo']},{place_ids:['sfo','unknown']},{ojai_share_pct:-1},{ojai_share_pct:101},{road_speed_kph:4},{road_speed_kph:101}]){const c={...model.defaultBayAreaConfig(),...patch};assert.ok(model.validateBayAreaConfig(c).length>0);assert.throws(()=>model.simulateBayAreaOperations(c));}
});
test('legacy travel and battery keys cannot silently affect Bay outcomes',()=>{
  const a=run({duration_hours:1});const b=run({duration_hours:1,battery_kwh:1,energy_kwh_per_minute:4,pickup_minutes:200,trip_minutes:200});
  assert.deepEqual(a.metrics,b.metrics);assert.deepEqual(a.requests,b.requests);
});
test('empty completed populations and censored depot visits stay explicit',()=>{
  const empty=run({requests_per_hour:0,duration_hours:1});assert.equal(empty.metrics.avg_wait_min_completed,null);assert.equal(empty.metrics.avg_depot_turnaround_min,null);
  const r=run({place_ids:['menlo-park','palo-alto'],trips_between_visits:1,requests_per_hour:30,duration_hours:1,cleaning_minutes:200});assert.ok(r.metrics.censored_visits>0);assert.equal(r.metrics.avg_depot_turnaround_min,null);
});
test('capacity and mix comparisons keep shared demand and report actual tested settings',()=>{
  const c={...model.defaultBayAreaConfig(),duration_hours:1,fleet_size:4};
  const cap=model.analyzeBayAreaCapacity(c),mix=model.analyzeVehicleMix(c);
  assert.equal(cap.target_completion_fraction,.95);assert.equal(cap.depot_trials.length,6);
  assert.deepEqual(mix.trials.map(t=>t.ojai_share_pct),[0,50,100]);
  const trials=[...cap.fleet_trials,...cap.depot_trials,...mix.trials];assert.equal(new Set(trials.map(t=>t.demand_signature)).size,1);
});
test('FIFO dispatch chooses an available car already at pickup over a distant car',()=>{
  const r=run({place_ids:['san-francisco','san-jose'],fleet_size:2,requests_per_hour:60,start_hour:0,duration_hours:1/60,seed:10000});
  assert.equal(r.requests[0].pickup_node,'san-jose');
  assert.equal(r.requests[0].vehicle_id,'car-2');
  assert.equal(r.requests[0].pickup_distance_km,0);
});
test('profile boarding and service multipliers change measured stage durations',()=>{
  const c=model.defaultBayAreaConfig();c.place_ids=['menlo-park','palo-alto'];c.fleet_size=2;c.requests_per_hour=8;c.duration_hours=4;c.trips_between_visits=1;c.software_every_visits=1;
  c.vehicle_profiles.ojai={...c.vehicle_profiles.ipace,boarding_minutes:5,cleaning_multiplier:2,software_multiplier:1.5,upload_multiplier:2};c.ojai_share_pct=100;
  const r=model.simulateBayAreaOperations(c),visits=r.visits.filter(v=>v.completed_minute!==null);assert.ok(visits.length>0);
  for(const q of r.requests.filter(q=>q.completed_minute!==null)){assert.equal(q.boarding_min,5);assert.equal(q.departed_minute-q.picked_up_minute,5);}
  for(const v of visits)for(const stage of v.stages){if(stage.stage==='charging')continue;assert.equal(stage.active_minutes,Math.ceil(c[`${stage.stage}_minutes`]*c.vehicle_profiles.ojai[`${stage.stage}_multiplier`]));}
});
test('zero-minute boarding settles immediately without zero-duration moving frames',()=>{
  const c=model.defaultBayAreaConfig();c.vehicle_profiles.ipace.boarding_minutes=0;c.vehicle_profiles.ojai.boarding_minutes=0;c.place_ids=['menlo-park','palo-alto'];c.requests_per_hour=10;c.duration_hours=1;
  const r=model.simulateBayAreaOperations(c);assert.ok(r.metrics.completed_trips>0);
  assert.ok(r.frames.every(f=>f.vehicles.every(v=>v.state!=='boarding')));
  for(const q of r.requests.filter(q=>q.completed_minute!==null))assert.equal(q.departed_minute,q.picked_up_minute);
});
test('infeasible maximum fleet/day demand remains bounded, stationary and accounted for',()=>{
  const c=model.defaultBayAreaConfig();for(const type of ['ipace','ojai']){c.vehicle_profiles[type].battery_kwh=1;c.vehicle_profiles[type].energy_kwh_per_km=3;}
  Object.assign(c,{place_ids:['san-francisco','san-jose'],fleet_size:120,depot_count:6,requests_per_hour:240,duration_hours:24,peak_multiplier:4,patience_minutes:240});
  const r=model.simulateBayAreaOperations(c,{capture:false});assert.equal(r.metrics.completed_trips,0);assert.equal(r.metrics.energy_consumed_kwh,0);
  assert.equal(r.metrics.total_requests,r.metrics.unserved_requests+r.metrics.pending_requests);
  assert.ok(Math.abs(r.metrics.energy_balance_error_kwh)<1e-6);
});
test('returned configuration and last-frame energy are independently inspectable',()=>{
  const c=model.defaultBayAreaConfig(),before=structuredClone(c),r=model.simulateBayAreaOperations(c);
  r.config.vehicle_profiles.ojai.battery_kwh=1;r.config.place_ids.pop();assert.deepEqual(c,before);
  assert.equal(r.metrics.final_energy_kwh,r.frames.at(-1).vehicles.reduce((sum,v)=>sum+v.soc_kwh,0));
  assert.ok(r.frames.at(-1).depot_queues.every(d=>d.charging_kw===0));
});
test('zero demand has unavailable completion fractions and no invented sufficient capacity',()=>{
  const c={...model.defaultBayAreaConfig(),requests_per_hour:0,duration_hours:1};
  const a=model.analyzeBayAreaCapacity(c);assert.equal(a.min_depots,null);assert.ok(a.depot_trials.every(t=>t.completion_fraction===null));
});
test('on-site depot and passenger trip means use complete measured populations only',()=>{
  const r=run({place_ids:['menlo-park','palo-alto'],requests_per_hour:12,trips_between_visits:1,duration_hours:4});
  const visits=r.visits.filter(v=>v.completed_minute!==null),trips=r.requests.filter(q=>q.completed_minute!==null);
  assert.ok(visits.length>0&&trips.length>0);
  assert.equal(r.metrics.avg_depot_onsite_min,visits.reduce((s,v)=>s+v.completed_minute-v.arrived_minute,0)/visits.length);
  assert.equal(r.metrics.avg_trip_min_completed,trips.reduce((s,q)=>s+q.completed_minute-q.picked_up_minute,0)/trips.length);
  const empty=run({requests_per_hour:0,duration_hours:1});assert.equal(empty.metrics.avg_depot_onsite_min,null);assert.equal(empty.metrics.avg_trip_min_completed,null);
});
test('equally near co-located depots share arriving vehicles and added sites supply usable capacity',()=>{
  const common={place_ids:['menlo-park','palo-alto'],fleet_size:24,requests_per_hour:120,duration_hours:8,trips_between_visits:1,cleaning_bays:1,software_bays:1,upload_bays:1,chargers:1};
  const two=run({...common,depot_count:2},{capture:false}),six=run({...common,depot_count:6},{capture:false});
  const counts=Object.fromEntries(six.locations.filter(p=>p.kind==='depot').map(d=>[d.id,six.visits.filter(v=>v.depot_id===d.id).length]));
  assert.ok(Object.values(counts).every(n=>n>0),`all co-located sites must be selectable: ${JSON.stringify(counts)}`);
  assert.ok(six.metrics.completed_trips>two.metrics.completed_trips,'extra bays and charging sites must relieve this specified depot bottleneck');
  assert.ok(six.metrics.energy_delivered_kwh>two.metrics.energy_delivered_kwh);
  assert.deepEqual(demand(two),demand(six));
  assert.ok(Math.abs(six.metrics.energy_balance_error_kwh)<1e-6);
  const repeated=run({...common,depot_count:6},{capture:false});assert.deepEqual(six.metrics,repeated.metrics);assert.deepEqual(six.visits,repeated.visits);
});
