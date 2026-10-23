import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../web/view-model.mjs';
import {clearFleetInsights,renderFleetInsights} from '../web/fleet-insights.mjs';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';

const roster = ['a','b','c','d'].map(id=>({id}));
const fixture = () => ({vehicles: [
  {vehicle:'a',completed:0,distance_m:0,empty_m:0,queue_s:3600,final_state:'queue_charge'},
  {vehicle:'b',completed:4,distance_m:100,empty_m:100,queue_s:1800,final_state:'charging'},
  {vehicle:'c',completed:8,distance_m:900,empty_m:0,queue_s:0,final_state:'passenger'},
  {vehicle:'d',completed:12,distance_m:1000,empty_m:400,queue_s:1800,final_state:'queue_charge'},
]});

test('fleet totals include zero-trip vehicles and weight empty miles by distance',()=>{
  assert.equal(typeof model.fleetInsights,'function');
  const result=model.fleetInsights(fixture(),roster,3600);
  assert.equal(result.completed,24);
  assert.equal(result.meanTrips,6);
  assert.equal(result.medianTrips,6);
  assert.equal(result.emptyFraction,.25);
  assert.equal(result.queueFraction,.5);
  assert.equal(result.vehicleHours,4);
  assert.equal(result.queueHours,2);
  assert.equal(result.servedVehicles,3);
  assert.equal(result.waitingForCharge,2);
  assert.deepEqual(result.bins.map(b=>b.count),[1,1,1,1]);
});

test('missing, duplicated or foreign vehicles cannot masquerade as a full fleet',()=>{
  for(const change of [f=>f.vehicles.pop(),f=>f.vehicles.push({...f.vehicles[0]}),f=>f.vehicles[0].vehicle='other']) {
    const f=fixture();change(f);
    assert.throws(()=>model.fleetInsights(f,roster,3600),/inventory/i);
  }
});

test('unavailable and invalid measurements never become zero or a plausible percentage',()=>{
  for(const [key,value] of [['queue_s',null],['queue_s',3601],['distance_m',NaN],['empty_m',-1],['completed',1.5],['final_state',undefined]]){
    const f=fixture();f.vehicles[0][key]=value;
    assert.throws(()=>model.fleetInsights(f,roster,3600),/measurement/i);
  }
  assert.throws(()=>model.fleetInsights(fixture(),roster,0),/duration/i);
  const f=fixture();f.vehicles.forEach(v=>{v.distance_m=0;v.empty_m=0;});
  assert.equal(model.fleetInsights(f,roster,3600).emptyFraction,null);
});

test('fleet rendering exposes denominators, refreshes layout identity and clears obsolete values',()=>{
  const restore=installFakeDom();
  try {
    for(const id of ['fleet-insights','fleet-context','fleet-metrics','fleet-charts']){
      const node=document.createElement('div');node.id=id;document.body.appendChild(node);
    }
    const trace={elapsed_s:3600,seed:1001,layout:'A',execution:'COMPLETE'};
    renderFleetInsights(fixture(),roster,trace);
    assert.match(document.getElementById('fleet-metrics').textContent,/2 of 4 combined vehicle-hours/);
    assert.match(document.getElementById('fleet-charts').textContent,/2 of 4 vehicles were waiting/);
    clearFleetInsights();
    assert.equal(document.getElementById('fleet-metrics').textContent,'');
    assert.equal(document.getElementById('fleet-charts').textContent,'');
    assert.equal(document.getElementById('fleet-insights').getAttribute('aria-busy'),'true');
    renderFleetInsights(fixture(),roster,{...trace,seed:1002,layout:'B',execution:'INCOMPLETE'});
    assert.match(document.getElementById('fleet-context').textContent,/One depot · B · seed 1002/);
    assert.match(document.getElementById('fleet-context').textContent,/Recording stopped early/);
    clearFleetInsights('Fleet summary unavailable',false);
    assert.equal(document.getElementById('fleet-metrics').textContent,'');
    assert.equal(document.getElementById('fleet-insights').getAttribute('aria-busy'),'false');
  } finally {restore();}
});
