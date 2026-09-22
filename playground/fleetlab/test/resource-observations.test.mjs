import test from 'node:test';import assert from 'node:assert/strict';
import {createResourcePool,defaultResources,validateResources,acceptObservation} from '../src/model/resource-observations.js';
const config=patch=>({depot_count:1,chargers:2,duration_hours:3,resources:{...defaultResources(),...patch}});
test('unknown and stale observations are unavailable; later received data is not fresher data',()=>{
  const pool=createResourcePool(config({delay_min:20,ttl_min:5}));pool.tick(0);
  assert.equal(pool.reserve('car-1','depot-1',0).accepted,false);
  pool.tick(20);assert.equal(pool.snapshot('depot-1',20).ports[0].knowledge,'INFERRED_STALE');
  assert.equal(pool.reserve('car-1','depot-1',20).reason,'NO_FRESH_ELIGIBLE_RESOURCE');
});
test('truth rejects stale healthy proposals during an outage and recovers without double reservation',()=>{
  const pool=createResourcePool(config({policy:'last_known',period_min:30,delay_min:0,outage_start_min:5,outage_end_min:10,outage_ports:2}));
  pool.tick(0);pool.tick(5);assert.equal(pool.reserve('car-1','depot-1',5).reason,'RESOURCE_UNHEALTHY');
  pool.tick(10);assert.equal(pool.reserve('car-1','depot-1',10).accepted,true);
  assert.deepEqual(pool.reserve('car-1','depot-1',10),{accepted:true,resource_id:'depot-1:port-1',idempotent:true});
  assert.equal(pool.reserve('car-1','depot-2',10).reason,'ALREADY_RESERVED');
  assert.equal(pool.reserve('car-2','depot-1',10).accepted,true);assert.equal(pool.reserve('car-3','depot-1',10).accepted,false);
  pool.release('car-1');assert.equal(pool.reserve('car-3','depot-1',10).accepted,true);
});
test('planned and installed-but-uncommissioned ports are never simulated execution capacity',()=>{
  const pool=createResourcePool(config({planned_ports:1,uncommissioned_ports:1,delay_min:0}));pool.tick(0);
  const s=pool.snapshot('depot-1',0);assert.equal(s.ports.filter(p=>p.truth.commissioned).length,0);assert.equal(s.ports.filter(p=>p.truth.installed).length,1);
  assert.equal(pool.reserve('car-1','depot-1',0).accepted,false);
});
test('version, times, duplicate and reordered observations fail closed',()=>{
  const a={source:'synthetic-port-feed-1',idempotency_key:'depot-1:port-1:2',resource_id:'depot-1:port-1',sequence:2,observed_minute:5,received_minute:7,installed:true,commissioned:true,healthy:true,compatible:true};
  assert.equal(acceptObservation(null,a,7).accepted,true);
  for(const patch of [{sequence:1},{sequence:2},{observed_minute:4},{received_minute:6,observed_minute:8},{healthy:null}])assert.equal(acceptObservation(a,{...a,sequence:3,idempotency_key:'depot-1:port-1:3',...patch},9).accepted,false);
});
test('held leases preserve occupancy during outage but never deliver power from unhealthy truth',()=>{
  const pool=createResourcePool(config({delay_min:0,outage_start_min:5,outage_end_min:10,outage_ports:2}));pool.tick(0);pool.reserve('v','depot-1',0);
  pool.tick(5);assert.equal(pool.usable('v',5),false);assert.equal(pool.snapshot('depot-1',5).ports.filter(p=>p.owner==='v').length,1);
  pool.tick(10);assert.equal(pool.usable('v',10),true);assert.equal(pool.usable('v',181),false);pool.tick(181);assert.equal(pool.snapshot('depot-1',181).ports.filter(p=>p.owner).length,0);
});
test('resource config rejects unbounded, unknown or inconsistent input',()=>{
  assert.deepEqual(validateResources(config({})),[]);
  for(const patch of [{version:'x'},{ttl_min:0},{delay_min:NaN},{outage_end_min:1},{planned_ports:3},{unknown:true}])assert.ok(validateResources(config(patch)).length);
});
