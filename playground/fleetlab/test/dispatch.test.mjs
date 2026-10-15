import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,normalize,hash} from '../src/model/dispatch-contract.js';
import {runDispatch} from '../src/model/dispatch.js';
const copy=x=>JSON.parse(JSON.stringify(x));
test('default analytical fixture and counterexample are executed, not substituted',()=>{
 for(const [id,expect]of [['default',[[6,6,4000,90,90],[8,8,3000,30,90]]],['counterexample',[[3,3,1000,30,90],[2,2,1000,60,90]]]]){
  for(const [i,p]of ['greedy','joint'].entries()){const r=runDispatch(fixture(id),p),m=r.metrics;assert.deepEqual([m.served,m.completed,m.emptyMeters,m.medianWait,m.p95Wait],expect[i]);assert.equal(r.final.phase,'OBSERVATION_END');assert.equal(r.ledger.length,41);}
 }
});
test('zero trip closes and frees vehicle before dispatch; horizon never dispatches',()=>{
 const x={horizon:60,vehicles:[{id:'ev-001',at:[0,0]}],requests:[{id:'r-001',arrival:0,origin:[0,0],destination:[0,0],deadline:30},{id:'r-002',arrival:30,origin:[0,0],destination:[0,0],deadline:60},{id:'r-003',arrival:60,origin:[0,0],destination:[0,0],deadline:60}]};
 const r=runDispatch(x,'joint');assert.equal(r.metrics.completed,2);assert.equal(r.metrics.expired,1);assert.deepEqual(r.events.filter(e=>e.kind==='assign').map(e=>e.t),[0,30]);const at30=r.events.filter(e=>e.t===30).map(e=>e.kind);assert.ok(at30.indexOf('trip_end')<at30.indexOf('assign'));
});
test('manual PRE pending at deadline is distinct from completed POST expiry',()=>{
 const x={horizon:60,vehicles:[{id:'ev-001',at:[0,0]}],requests:[{id:'r-001',arrival:0,origin:[2,0],destination:[2,1],deadline:30}]};
 const a=runDispatch(x,'manual',{end:30,decisions:[{t:0,pairs:[]}]});assert.equal(a.final.phase,'PRE_DISPATCH');assert.equal(a.final.requests[0].state,'pending');assert.equal(a.ledger.length,1);
 const b=runDispatch(x,'manual',{end:60,decisions:[{t:0,pairs:[]},{t:30,pairs:[]}]});assert.equal(b.ledger[1].requests[0].state,'expired');assert.equal(b.final.phase,'OBSERVATION_END');assert.notEqual(a.digest,b.digest);
});
test('manual batch rejects duplicate cars, infeasible pickups and missing decisions',()=>{
 const x=fixture('default');assert.throws(()=>runDispatch(x,'manual',{end:30,decisions:[]}));assert.throws(()=>runDispatch(x,'manual',{end:30,decisions:[{t:0,pairs:[['r-001','ev-001'],['r-002','ev-001']]}]}));assert.throws(()=>runDispatch(x,'manual',{end:30,decisions:[{t:0,pairs:[['r-002','ev-004']]}]}));
});
test('no future oracle: second-wave changes preserve earlier action prefix',()=>{
 const x=fixture('default'),y=copy(x);y.requests[4].destination=[4,0];y.requests[5].origin=[4,0];
 for(const p of ['greedy','joint']){const a=runDispatch(x,p),b=runDispatch(y,p);assert.deepEqual(a.events.filter(e=>e.t<600),b.events.filter(e=>e.t<600));assert.notEqual(a.digest,b.digest);}
});
test('bounded domain, canonical order and unavailable waits',()=>{
 const x=fixture('default'),y=copy(x);y.requests.reverse();assert.equal(hash(normalize(x)),hash(normalize(y)));assert.throws(()=>normalize({...x,extra:1}));assert.throws(()=>normalize({...x,horizon:31}));assert.throws(()=>normalize({...x,requests:[...x.requests,...x.requests]}));
 const r=runDispatch({...x,requests:[]},'joint');assert.equal(r.metrics.medianWait,null);assert.equal(r.metrics.serviceRate,null);assert.equal(r.metrics.emptyMeters,0);
});
test('automatic comparison preserves checked pre-decision states for explaining feasible edges',()=>{const r=runDispatch(fixture(),'joint');assert.equal(r.preDecision.length,40);assert.equal(r.preDecision[0].phase,'PRE_DISPATCH');assert.equal(r.preDecision[0].vehicles.filter(v=>v.mode==='idle').length,4);assert.equal(r.ledger[0].vehicles.filter(v=>v.mode==='idle').length,0);});
test('feasible pairing explanations are part of checked snapshot evidence',()=>{const r=runDispatch(fixture(),'joint');assert.ok(r.preDecision[0].edges.some(e=>e.request==='r-002'&&e.vehicle==='ev-001'&&e.pickupAt===30));assert.equal(r.preDecision[0].edges.some(e=>e.request==='r-002'&&e.vehicle==='ev-002'),false);});
test('IDs must be strings, never objects that happen to stringify as IDs',()=>{
 const x=fixture();x.vehicles[0].id={toString:()=> 'ev-001'};assert.throws(()=>normalize(x),/Invalid vehicle ID/);
 const y=fixture();y.requests[0].id={toString:()=> 'r-001'};assert.throws(()=>normalize(y),/Invalid request ID/);
 assert.throws(()=>runDispatch(fixture(),'manual',{end:30,decisions:[{t:0,pairs:[[{toString:()=> 'r-001'},'ev-001']]}]}),/Invalid assignment pair/);
});
test('endpoint clips passenger mileage and preserves unfinished trips; inclusive pickup succeeds',()=>{
 const x={horizon:60,vehicles:[{id:'ev-001',at:[0,0]}],requests:[{id:'r-001',arrival:0,origin:[0,0],destination:[4,4],deadline:30}]};
 const r=runDispatch(x,'joint');assert.equal(r.metrics.served,1);assert.equal(r.metrics.unfinished,1);assert.equal(r.metrics.completed,0);assert.equal(r.metrics.passengerMeters,500);assert.deepEqual(r.final.vehicles[0].at,[500,0]);
});
test('neutral disclosure fixture gives both policies the same outcomes',()=>{const x=fixture('neutral'),a=runDispatch(x,'greedy'),b=runDispatch(x,'joint');assert.deepEqual(a.metrics,b.metrics);assert.equal(a.metrics.served,4);assert.equal(a.metrics.emptyMeters,0);});
