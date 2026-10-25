// Independent verifier, positive analytical oracles (annex D1-13 A21-A24, A35; C4 A38/A39 valid references) and the
// VerificationEnvelope contract (note 10.5, 13, 18). Expected values are the written annex numbers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {verifyDepotRun,VERIFICATION_SCHEMA} from '../src/model/depot-lab-verify/verify.js';
import {createDepotRun,stepDepotRun,cancelDepotRun} from '../src/model/depot-lab/engine.js';
import {checkPairCompatibility,compareDepotRuns} from '../src/model/depot-lab/compare.js';
import {preset,defaultScenario} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {term} from '../src/model/depot-lab/registry.js';
const {GB}=h;
const check=c=>{const s=c.s??c,harness=c.harness??null,r=h.run(s,{harness});assert.equal(r.terminal_status,'COMPLETE');const e=verifyDepotRun(s,r.ledger,{harness});assert.equal(e.status,'VERIFIED',JSON.stringify(e.primary_violation));return {e,p:e.projection,ledger:r.ledger,s,harness};};
const V=p=>p.vector.components.map(c=>c.value);
const zeroWork=n=>Array(n).fill('0/1');
const visit=(p,id)=>p.visits.find(v=>v.id===`visit:${id}`);
const hold=(p,port,v)=>p.intervals.ports.filter(([u,,,x,c])=>u===port&&x===`visit:${v}`&&!['free','unavailable','unconnected_position_blocked'].includes(c)).reduce((n,[,a,b])=>n+b-a,0);
test('envelope: verified status, trust axes, digests, versions and an immutable projection',()=>{
 const {e,ledger,s}=check(h.a21());
 assert.equal(e.schema,VERIFICATION_SCHEMA);assert.equal(e.consistency,'INTERNALLY_CONSISTENT');assert.equal(e.primary_violation,null);
 assert.deepEqual(e.trust,{authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',deployment_permission:'NONE',evidence:'NOT_EVIDENCE'});
 assert.equal(e.digests.scenario,ledger.scenario_digest);assert.match(e.digests.run,/^[0-9a-f]{64}$/);
 assert.deepEqual(e.versions,{engine:'depot-lab-engine.1.0.0',verifier:'depot-lab-verifier.1.0.0',projection:'depot_projection_v1',metric:'depot_metrics_v1'});
 assert.deepEqual(e.ledger,{records:ledger.records.length,bytes:h.run(s).bytes,terminal_status:'COMPLETE',guard:null});
 assert.ok(Object.isFrozen(e)&&Object.isFrozen(e.projection.visits[0]));
 assert.deepEqual(verifyDepotRun(s,JSON.parse(JSON.stringify(ledger))),e,'a fresh parse verifies identically');
 for(const k of Object.keys(e.projection.metrics))assert.ok(term(k),`metric ${k} is a registry term`);
 for(const c of e.projection.vector.components)assert.ok(term(c.id),`component ${c.id} is a registry term`);
});
test('A21: V, worker 1,020/3,600, port 2,244 then 120 position-blocked, ownership 360 + 2,364 and dwell 120 + 2,124',()=>{
 const {p}=check(h.a21()),v=visit(p,'V1');
 assert.deepEqual(V(p),[1,0,2604,0,...zeroWork(5),0,0]);
 assert.equal(v.released_at,2604);assert.equal(v.tasks.find(t=>t.template==='charge').end,2064);assert.equal(v.energy.credited_mj,36*3600000000);
 assert.deepEqual(p.resources.workers,[{id:'worker:X01',available_s:3600,busy_s:1020,attention:'17/60'}]);
 const port=p.resources.ports[0];assert.equal(port.owned_ticks,2244);assert.equal(port.partition.unconnected_position_blocked,120);assert.equal(port.partition.connected_drawing,864+720);
 assert.equal(Object.values(port.partition).reduce((a,b)=>a+b,0),3600);
 const pos=Object.fromEntries(p.resources.positions.map(x=>[x.id,x.owned_ticks]));
 assert.deepEqual(pos,{'position:C1':2364,'position:W1':360});assert.equal(pos['position:C1']+pos['position:W1'],2724);assert.equal(p.resources.positions.length*3600,7200);
 assert.equal(p.resources.positions.find(x=>x.id==='position:C1').port_released_position_held_s,120);
 assert.deepEqual(v.dwell_by_zone,{waiting:120,charging:2124});
 for(const x of p.resources.positions)assert.equal(Object.values(x.partition).reduce((a,b)=>a+b,0),3600);
});
test('A22: both stable-id assignments on one port',()=>{
 for(const [first,rel,sum,firstHold]of [['A',[1860,3180],5040,1740],['B',[1320,3180],4500,1200]]){
  const {p}=check(h.a22(first));
  assert.deepEqual([visit(p,'A').released_at,visit(p,'B').released_at],rel,first);
  assert.equal(p.metrics['visit.turnaround_observed_s'],sum);assert.equal(p.metrics['release.on_time_count'],2);
  assert.equal(p.metrics['visit.overdue_s'],0);assert.equal(p.metrics['release.unreleased_count'],0);
  assert.equal(hold(p,'port:DC1','A'),firstHold,first);
 }
});
test('A23: two ports share the 100 kW site with zero slack',()=>{
 const {p}=check(h.a23());
 assert.deepEqual(V(p),[2,0,3780,0,...zeroWork(5),0,0]);
 assert.equal(p.resources.site.peak_draw_w,'100000/1');assert.equal(p.resources.site.tight_s,1620);
 assert.equal(p.metrics['charge.energy_credited_mj'],45*3600000000);
 assert.deepEqual([visit(p,'B').tasks.find(t=>t.template==='charge').end,visit(p,'A').tasks.find(t=>t.template==='charge').end],[1080,1620]);
});
test('A24: one port versus two ports is worse, with the 180-s wait for the lead',()=>{
 const one=check(h.a24(1)),two=check(h.a24(2)),m=x=>['release.on_time_count','visit.overdue_s','visit.turnaround_observed_s','release.unreleased_count'].map(k=>x.p.metrics[k]);
 assert.deepEqual(m(one),[1,1740,5580,0]);assert.deepEqual(m(two),[0,2220,6180,0]);
 assert.deepEqual([visit(two.p,'A').released_at,visit(two.p,'B').released_at],[2940,3240]);
 assert.ok(visit(two.p,'B').waits.some(w=>w[0]===2520&&w[1]===2700&&w[2]==='HELD_UNITS'));
 const t=checkPairCompatibility(one.s,two.s);assert.equal(t.compatible,true);
 assert.equal(compareDepotRuns(one.e,two.e,t.treatment).classification,'worse');
});
test('A35: Wi-Fi 6 and 7 verify to the same V and compare as a tie',()=>{
 const a=check(h.a35('wifi6')),b=check(h.a35('wifi7'));
 for(const x of [a,b])assert.deepEqual(V(x.p),[1,0,1300,0,...zeroWork(6),0,0]);
 assert.notEqual(a.e.digests.run,b.e.digests.run);
 const t=checkPairCompatibility(a.s,b.s);assert.equal(compareDepotRuns(a.e,b.e,t.treatment).classification,'tie');
});
test('A38 valid reference: local software completion 720, release 1,140',()=>{
 const {p}=check(h.a38()),v=visit(p,'V1');
 assert.equal(v.tasks.find(t=>t.template==='software_postcheck').end,720);assert.equal(v.released_at,1140);
 assert.deepEqual([p.metrics['release.on_time_count'],p.metrics['visit.turnaround_observed_s'],p.metrics['release.unreleased_count'],p.metrics['data.remaining_required_bytes']],[1,1140,0,0]);
});
test('A38: bytes complete at 0 leave zero bytes but 720 lifecycle reference seconds',()=>{
 const s=h.scenario({H:120,positions:[h.position('W1','waiting')],workers:[h.worker('L01',h.LEAD,{H:120}),h.worker('M01',h.MOVER,{H:120})],objects:[h.object('sw-old','software',2*GB),h.object('sw-new','software',2*GB)],visits:[h.visit('V1',{due:120,installed:['sw-old'],required:['sw-new']})]});
 const {p}=check({s,harness:{initial:{V1:{position:'W1',completed:['admit'],content:{'sw-new':'object_complete'}}}}}),v=visit(p,'V1');
 assert.equal(v.remaining.bytes,0);assert.equal(p.metrics['data.remaining_required_bytes'],0);
 const r=v.remaining.reference;assert.deepEqual([r.check,r.activation,r.postcheck],['60/1','600/1','60/1']);
 assert.equal(v.data.find(d=>d.object==='object:sw-new').state,'object_complete');assert.equal(v.released_at,null);
});
test('A39: a 1 GB cold cache waits throughout; the 2 GB companion releases at 1,440',()=>{
 const {p}=check(h.a39(1000000000)),v=visit(p,'V1'),m=k=>p.metrics[k];
 assert.deepEqual([m('release.released_count'),m('release.unreleased_count'),m('visit.turnaround_observed_s'),m('visit.overdue_s'),m('data.remaining_required_bytes')],[0,1,1800,0,2000000000]);
 assert.deepEqual(v.remaining.reference,{check:'60/1',activation:'600/1',postcheck:'60/1',inspection:'300/1',move:'120/1'});
 assert.deepEqual(v.waits,[[0,1800,'FULL_STOCK_CACHE']]);assert.equal(m('network.useful_bytes_down'),0);
 assert.equal(visit(check(h.a39(2000000000)).p,'V1').released_at,1440);
});
test('incomplete and cancelled ledgers return their status with no projection',()=>{
 const s=validateScenario(preset('B').baseline,{origin:'editor'}).scenario;
 // The engine's guard travels beside the ledger; a lowered bound is accepted only when the caller allows it (tests).
 const inc=h.run(s,{guardOverrides:{maxRecords:50}}),e=verifyDepotRun(s,inc.ledger,{claimedGuard:inc.guard,allowLoweredGuards:true});
 assert.equal(e.status,'INCOMPLETE_RESOURCE_LIMIT');assert.equal(e.consistency,'NOT_AVAILABLE');assert.equal(e.projection,null);assert.equal(e.digests.run,null);
 assert.deepEqual(e.ledger.guard,inc.guard);assert.match(e.digests.prefix,/^[0-9a-f]{64}$/);
 const R=createDepotRun(s);stepDepotRun(R,{maxTicks:3});cancelDepotRun(R);const c=verifyDepotRun(s,stepDepotRun(R).ledger);
 assert.deepEqual([c.status,c.projection,c.primary_violation,c.ledger.guard],['CANCELLED',null,null,null]);assert.match(c.digests.prefix,/^[0-9a-f]{64}$/);
});
test('a harness ledger never verifies as a public run (BD-02)',()=>{
 const c=h.a35(),r=h.run(c.s,{harness:c.harness}),e=verifyDepotRun(c.s,r.ledger);
 assert.deepEqual([e.status,e.primary_violation.code,e.projection],['INVALID','BINDING_MISMATCH',null]);
});
// Engine defect DEF-1 (report): this test fails until the engine stops publishing a received_provisional data state
// for an optional upload cancelled at release before any byte arrived (no RECEIVED_PROVISIONAL record exists).
test('an optional upload cancelled at release before any byte keeps a null data state',()=>{
 const raw=defaultScenario();raw.services.uploads.service_reachable='unreachable';
 const s=validateScenario(raw,{origin:'editor'}).scenario,L=h.run(s).ledger;
 assert.ok(!L.records.some(r=>r.kind==='CONTENT_TRANSITION'&&r.payload.transition==='RECEIVED_PROVISIONAL'),'no byte was received');
 const e=verifyDepotRun(s,L);assert.equal(e.status,'VERIFIED',JSON.stringify(e.primary_violation));
 assert.ok(e.projection.visits.every(v=>v.data.find(d=>d.direction==='up').state===null));
});
