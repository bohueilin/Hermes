import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBayAreaConfig,simulateBayAreaOperations,validateBayAreaConfig} from '../src/model/bay-operations.js';
import {defaultCharging} from '../src/model/charging-allocation.js';
import {defaultResources} from '../src/model/resource-observations.js';
import {defaultAirport} from '../src/model/airport-demand.js';
const config=()=>({...defaultBayAreaConfig(),place_ids:['menlo-park','palo-alto'],fleet_size:16,depot_count:1,duration_hours:4,start_hour:0,
  requests_per_hour:45,peak_multiplier:1,trips_between_visits:1,cleaning_minutes:1,cleaning_bays:16,software_every_visits:100,upload_minutes:1,
  chargers:8,charger_kw:80,site_power_kw:120,initial_soc_pct:30,charge_target_pct:85,charging:defaultCharging()});
const demand=r=>r.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]);
test('M2 preserves exogenous demand, full accounting, terminal energy and historical default',()=>{
  const c=config(),a=simulateBayAreaOperations(c);c.charging.policy='redistribute';const b=simulateBayAreaOperations(c);
  assert.deepEqual(demand(a),demand(b));assert.match(a.version,/depot-charging-1/);
  for(const r of [a,b]){
    assert.equal(r.extensions.validity,'VALID');assert.equal(r.extensions.evidence_status,'NOT_EVIDENCE');
    assert.ok(Math.abs(r.metrics.energy_balance_error_kwh)<1e-6);
    for(const f of r.frames){for(const d of f.depot_queues)assert.ok(d.charging_kw<=c.site_power_kw+1e-8);
      for(const v of f.vehicles)assert.ok(v.soc_kwh>=v.battery_kwh*c.reserve_soc_pct/100-1e-7);}
    assert.ok(r.frames.at(-1).depot_queues.every(d=>d.charging_kw===0));
    assert.deepEqual(simulateBayAreaOperations(r.config,{capture:false}).extensions,r.extensions);
    const m=r.extensions.charging;assert.equal(m.visits,m.ready_by_deadline+m.missed_deadline+m.deadline_pending);
    assert.ok(m.queue_observed_min>0);assert.ok(m.active_observed_min>0);assert.ok(m.unfinished_visits>0);
  }
});
test('bad power policy is rejected before mutation and detected by its named policy check',()=>{
  const c=config();c.charging.policy='overcommit';const r=simulateBayAreaOperations(c);
  assert.equal(r.extensions.validity,'VALID');assert.equal(r.metrics.energy_delivered_kwh,0);
  assert.equal(r.extensions.checks.find(c=>c.name==='POWER_PROPOSAL_FEASIBILITY').status,'FAIL');
  assert.ok(r.extensions.charging.rejected_actions.some(a=>a.reason==='SITE_POWER_LIMIT'));
});
test('resource truth blocks outage delivery, exposes stale knowledge and recovers without double reservation',()=>{
  const c=config();c.resources={...defaultResources(),policy:'last_known',delay_min:20,period_min:5,outage_start_min:50,outage_end_min:100,outage_ports:8};
  const r=simulateBayAreaOperations(c);assert.equal(r.extensions.validity,'VALID');
  assert.ok(r.extensions.resources.stale_port_minutes>0);
  assert.ok(r.frames.slice(50,100).every(f=>f.depot_queues.every(d=>d.charging_kw===0)));
  assert.ok(r.frames.slice(100,-1).some(f=>f.depot_queues.some(d=>d.charging_kw>0)));
  for(const f of r.frames)for(const d of f.depot_queues){const owners=d.resources.ports.map(p=>p.owner).filter(Boolean);assert.equal(new Set(owners).size,owners.length);}
  assert.deepEqual(simulateBayAreaOperations(c,{capture:false}).extensions,r.extensions);
});
test('airport preparation has bounded staging, valid forecasts and the identical external wave',()=>{
  const c=config();c.place_ids=['sfo','menlo-park','palo-alto'];c.initial_soc_pct=85;c.requests_per_hour=5;c.airport={...defaultAirport(),staging_capacity:3};
  const a=simulateBayAreaOperations(c);c.airport.policy='forecast';const b=simulateBayAreaOperations(c);
  assert.deepEqual(demand(a),demand(b));assert.ok(b.requests.every(q=>q.created_minute<c.airport.intake_end_min));
  assert.ok(b.frames.some(f=>f.vehicles.some(v=>v.state==='airport_reposition')));
  assert.ok(b.frames.every(f=>f.airport.staged_vehicle_ids.length<=3));
  assert.ok(b.frames.filter(f=>f.minute<30||f.minute>120).every(f=>f.airport.forecast===null));
  const m=b.extensions.airport;assert.equal(m.requests,m.within_target+m.missed+m.pending);
  assert.equal(b.extensions.validity,'VALID');assert.ok(Math.abs(b.metrics.energy_balance_error_kwh)<1e-6);
  c.airport.forecast_count=0;const negative=simulateBayAreaOperations(c);assert.deepEqual(negative.metrics,a.metrics);
  assert.deepEqual(demand(negative),demand(a));
});
test('unknown new versions and incoherent windows reject before execution',()=>{
  for(const k of ['charging','resources','airport']){const c=config();c[k]={version:'unknown'};assert.ok(validateBayAreaConfig(c).length);assert.throws(()=>simulateBayAreaOperations(c));}
});
