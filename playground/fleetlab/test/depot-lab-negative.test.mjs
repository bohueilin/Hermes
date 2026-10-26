// Negative ledger mutations (annex C4 A37-A39, D1-13 A25 planted violations): start from a valid engine ledger, apply one
// semantic mutation, renumber seq, ordinals, keys, action ids and observation references, then expect INVALID with the
// named primary code and a quarantined projection. Positive controls stay VERIFIED.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import * as m from './helpers/depot-lab-mutate.mjs';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
const {T,GB}=h;
const base=c=>{const s=c.s??c,harness=c.harness??null;return {s,harness,ledger:h.run(s,{harness}).ledger};};
const verify=(c,ledger)=>verifyDepotRun(c.s,ledger,{harness:c.harness});
function invalid(c,mutate,code,{renumber=true}={}){
 const L=m.clone(c.ledger);mutate(L);if(renumber)m.renumber(L);
 const e=verify(c,L);
 assert.equal(e.status,'INVALID',`expected ${code}`);assert.equal(e.consistency,'INVALID_EVIDENCE');
 assert.equal(e.primary_violation.code,code,JSON.stringify(e.primary_violation));
 assert.equal(e.projection,null);assert.equal(e.digests.run,null);
 return e;
}
const decision=(L,id,tick)=>m.where(L,r=>r.kind==='POLICY_DECISION'&&r.payload.task_id===id&&(tick===undefined||r.tick===tick));
const start=(tick,id,obs=0)=>m.record(tick,4,'TASK_TRANSITION',{task_id:id,transition:'START',action_id:'action:new',observation_seq:obs});
const A37=base(h.a37()),A23=base(h.a23()),A21=base(h.a21()),A35=base(h.a35());
test('renumbering a valid ledger without a mutation keeps it VERIFIED',()=>{
 for(const c of [A37,A23,A21,A35]){const L=m.renumber(m.clone(c.ledger));assert.deepEqual(L,c.ledger);assert.equal(verify(c,L).status,'VERIFIED');}
});
test('A37: a same-tick double acquisition and an incomplete atomic bundle',()=>{
 invalid(A37,L=>{
  const d=decision(L,T('V002','admit'),0);d.payload.accepted=true;d.payload.reasons=[];
  m.insertAfter(L,r=>r===d,{...m.record(0,4,'RESOURCE_DELTA',{action_id:d.payload.action_id,changes:[{change:'ACQUIRE',owner_task_id:T('V002','admit'),resource_id:'lane:01'},{change:'RESERVE',owner_task_id:T('V002','admit'),resource_id:'position:P002'},{change:'ACQUIRE',owner_task_id:T('V002','admit'),resource_id:'worker:M01'}]})},{...start(0,T('V002','admit')),payload:{task_id:T('V002','admit'),transition:'START',action_id:d.payload.action_id,observation_seq:d.payload.observation_seq}});
 },'DOUBLE_RESOURCE_ACQUISITION_SAME_TICK');
 invalid(A37,L=>{const r=m.where(L,x=>x.kind==='RESOURCE_DELTA'&&x.tick===0);r.payload.changes=r.payload.changes.filter(c=>c.resource_id!=='lane:01');},'RESOURCE_BUNDLE_MISMATCH');
});
const A38=base(h.a38());
test('A38: a removed local check and a fabricated postcheck fail the content lifecycle',()=>{
 invalid(A38,L=>{m.remove(L,m.task(T('V1','software_check'),'COMPLETE'));m.remove(L,r=>r.kind==='CONTENT_TRANSITION'&&r.payload.transition==='CHECK_COMPLETE');
  assert.equal(m.where(L,m.task(T('V1','software_activation'),'START')).tick,60);},'UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE');
 invalid(A38,L=>{m.insertBefore(L,r=>r.tick>600,m.record(600,0,'CONTENT_TRANSITION',{bytes:2*GB,object_id:'object:sw-new',owner_id:'visit:V1',transition:'POSTCHECK_COMPLETE'}));},'UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE');
});
const A39a=base(h.a39(1000000000)),A39b=base(h.a39(2000000000));
test('A39: a direct download past the cold cache and an eviction while served',()=>{
 invalid(A39a,L=>{
  const d=decision(L,'task:cache:sw-new:fetch',0),id=T('V1','software_download');
  m.insertAfter(L,r=>r===d,m.record(0,4,'POLICY_DECISION',{accepted:true,action_id:'action:bypass',blockage_group_id:null,observation_seq:d.payload.observation_seq,reasons:[],task_id:id}),
   m.record(0,4,'CONTENT_TRANSITION',{bytes:2*GB,object_id:'object:sw-new',owner_id:'visit:V1',transition:'RESERVED'}),{...start(0,id),payload:{task_id:id,transition:'START',action_id:'action:bypass',observation_seq:d.payload.observation_seq}},
   m.record(0,5,'ALLOCATION_DELTA',{changes:[{flow_id:'flow:V1:software_download',rate:'12500000/1',resource_path:['client:V1','network:pool','network:wan_down'],tight_resource_ids:['client:V1'],unit:'bytes_per_tick'}]}));
 },'UNAUTHORIZED_CACHE_EVICTION_OR_BYPASS');
 invalid(A39b,L=>{m.insertBefore(L,r=>r.tick>200,m.record(200,0,'CONTENT_TRANSITION',{bytes:2*GB,object_id:'object:sw-new',owner_id:'cache:depot',transition:'RECLAIMED'}));},'UNAUTHORIZED_CACHE_EVICTION_OR_BYPASS');
});
test('planted ownership and location violations',()=>{
 // A worker token held by one inspection is acquired by another across ticks.
 const A24=base(h.a24(2));
 invalid(A24,L=>{const d=decision(L,T('B','inspection'),2520);d.payload.accepted=true;d.payload.reasons=[];m.insertAfter(L,r=>r===d,m.record(2520,4,'RESOURCE_DELTA',{action_id:d.payload.action_id,changes:[{change:'ACQUIRE',owner_task_id:T('B','inspection'),resource_id:'worker:L01'}]}),{...start(2520,T('B','inspection')),payload:{task_id:T('B','inspection'),transition:'START',action_id:d.payload.action_id,observation_seq:d.payload.observation_seq}});},'RESOURCE_ALREADY_OWNED');
 // Two vehicles in one position.
 invalid(A37,L=>{const r=m.where(L,x=>x.kind==='RESOURCE_DELTA'&&x.tick===120&&x.phase===4);r.payload.changes.find(c=>c.resource_id==='position:P002').resource_id='position:P001';r.payload.changes.sort((a,b)=>a.resource_id<b.resource_id?-1:1);},'RESOURCE_ALREADY_OWNED');
 // One vehicle in two locations: an admit completion also occupies a second position.
 invalid(A37,L=>{const r=m.where(L,x=>x.kind==='RESOURCE_DELTA'&&x.tick===120&&x.phase===0);r.payload.changes.push({change:'ACQUIRE',owner_task_id:T('V001','admit'),resource_id:'position:P002'});r.payload.changes.sort((a,b)=>a.resource_id<b.resource_id?-1:1);},'LOCATION_VIOLATION');
});
test('planted allocation and credit violations',()=>{
 const rate=(L,t,i,v)=>{m.where(L,r=>r.kind==='ALLOCATION_DELTA'&&r.tick===t).payload.changes[i].rate=v;};
 invalid(A23,L=>rate(L,0,0,'50000001/1'),'ALLOCATION_INFEASIBLE');
 invalid(A23,L=>{rate(L,0,0,'70000000/1');rate(L,0,1,'30000000/1');},'ALLOCATION_NOT_MAX_MIN');
 invalid(A23,L=>rate(L,1080,0,'90000000/1'),'ALLOCATION_NOT_MAX_MIN');
 invalid(A23,L=>{m.where(L,r=>r.kind==='ALLOCATION_DELTA'&&r.tick===0).payload.changes[0].tight_resource_ids=[];},'ALLOCATION_NOT_MAX_MIN');
 invalid(A23,L=>m.remove(L,r=>r.kind==='ALLOCATION_DELTA'&&r.tick===1080),'ALLOCATION_DELTA_INCOMPLETE');
 // Credit above a band cap: a 60 kW band allocation above its acceptance, and a closure crediting past the band edge.
 invalid(A21,L=>rate(L,1344,0,'60000001/1'),'ALLOCATION_INFEASIBLE');
 invalid(A21,L=>{const c=m.where(L,r=>r.kind==='PROGRESS'&&r.tick===1344).payload.changes[0];c.anchor_credited_after+=1;c.credited+=1;},'PROGRESS_MISMATCH');
 // Bytes credited twice.
 invalid(A35,L=>{const p=m.where(L,r=>r.kind==='PROGRESS'&&r.tick===160);m.insertAfter(L,r=>r.kind==='CONTENT_TRANSITION'&&r.tick===160,{...m.clone(p),group_id:'group:new:dup'});},'PROGRESS_MISMATCH');
});
test('planted lifecycle and release violations',()=>{
 // Logs reclaimed while only received_provisional.
 const up=base(h.uploadCase());
 invalid(up,L=>{m.insertAfter(L,r=>r.kind==='CONTENT_TRANSITION'&&r.payload.transition==='RECEIVED_PROVISIONAL',m.record(1240,0,'CONTENT_TRANSITION',{bytes:12500000000,object_id:'logs:V1',owner_id:'visit:V1',transition:'RECLAIMED'}));},'UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE');
 // Egress without inspection complete.
 invalid(A35,L=>{const c=m.where(L,m.task(T('V1','inspection'),'COMPLETE'));m.remove(L,r=>r===c);m.remove(L,r=>r.kind==='RESOURCE_DELTA'&&r.tick===1180&&r.phase===0);},'RELEASE_CONDITION_UNMET');
 // COMPLETE before START with contiguous seq.
 invalid(A21,L=>{const c=m.where(L,m.task(T('V1','intake'),'COMPLETE'));m.remove(L,r=>r===c);m.insertAfter(L,r=>r.kind==='RESOURCE_DELTA'&&r.tick===120&&r.phase===0,{...c,tick:120,group_id:'group:new:early'});},'TASK_STATE_INVALID');
});
test('planted fixed-policy violations',()=>{
 // A later-ready task started while an earlier feasible one waits (A24 two ports at 120: B's move was ready at 0).
 const A24=base(h.a24(2));
 invalid(A24,L=>{
  const b=decision(L,T('B','to_charging'),120);b.payload.accepted=false;b.payload.reasons=[{code:'HELD_UNITS',holder_visit_ids:['visit:A'],resource_ids:['worker:M01']}];
  m.remove(L,m.deltaOf(b.payload.action_id));m.remove(L,m.task(T('B','to_charging'),'START'));
  const a=decision(L,T('A','connect'),120);a.payload.accepted=true;a.payload.reasons=[];
  m.insertAfter(L,r=>r===a,m.record(120,4,'RESOURCE_DELTA',{action_id:a.payload.action_id,changes:[{change:'ACQUIRE',owner_task_id:T('A','connect'),resource_id:'worker:M01'}]}),{...start(120,T('A','connect')),payload:{task_id:T('A','connect'),transition:'START',action_id:a.payload.action_id,observation_seq:a.payload.observation_seq}});
 },'POLICY_MISSED_FEASIBLE_START');
 // AC taken while a compatible DC port is free; a feasible AC port declined.
 const ac=base(h.acDc());
 invalid(ac,L=>{const r=m.where(L,x=>x.kind==='RESOURCE_DELTA'&&x.tick===0&&x.payload.changes.some(c=>c.resource_id==='port:DC01'));for(const c of r.payload.changes){if(c.resource_id==='port:DC01')c.resource_id='port:AC01';if(c.resource_id==='position:C2')c.resource_id='position:C1';}r.payload.changes.sort((a,b)=>a.resource_id<b.resource_id?-1:1);},'POLICY_NONCONFORMANCE');
 invalid(ac,L=>{const b=decision(L,T('B','to_charging'),120);b.payload.accepted=false;b.payload.reasons=[{code:'HELD_UNITS',holder_visit_ids:['visit:A'],resource_ids:['port:DC01','position:C2']}];m.remove(L,m.deltaOf(b.payload.action_id));m.remove(L,m.task(T('B','to_charging'),'START'));},'POLICY_MISSED_FEASIBLE_START');
 // A non-lowest-id position, and a non-lowest-id worker.
 invalid(A37,L=>{const r=m.where(L,x=>x.kind==='RESOURCE_DELTA'&&x.tick===0);r.payload.changes.find(c=>c.resource_id==='position:P001').resource_id='position:P002';},'POLICY_NONCONFORMANCE');
 const two=base(h.scenario({H:240,lanes:2,positions:[h.position('P001','waiting'),h.position('P002','waiting')],workers:[h.worker('M01',['move'],{H:240}),h.worker('M02',['move'],{H:240})],visits:[h.visit('V001',{due:240}),h.visit('V002',{due:240})]}));
 assert.equal(verify(two,two.ledger).status,'VERIFIED');
 invalid(two,L=>{const r=m.where(L,x=>x.kind==='RESOURCE_DELTA'&&x.tick===0);r.payload.changes.find(c=>c.resource_id==='worker:M01').resource_id='worker:M03';},'UNKNOWN_REFERENCE');
 invalid(two,L=>{const r=m.where(L,x=>x.kind==='RESOURCE_DELTA'&&x.tick===0);for(const c of r.payload.changes)if(c.resource_id==='worker:M01')c.resource_id='worker:M02';},'POLICY_NONCONFORMANCE');
});
test('planted observation and reason violations',()=>{
 // An observation exposing a not-yet-arrived visit.
 const late=base(h.scenario({H:1200,A:700,positions:[h.position('W1','waiting'),h.position('W2','waiting')],workers:[h.worker('L01',h.LEAD,{H:1200}),h.worker('M01',h.MOVER,{H:1200})],visits:[h.visit('V1'),h.visit('V2',{arrival:600})]}));
 assert.equal(verify(late,late.ledger).status,'VERIFIED');
 invalid(late,L=>{const o=m.where(L,r=>r.kind==='OBSERVATION');o.payload.facts.push({entity_id:'visit:V2',field:'arrival_tick',value:600});o.payload.facts.sort((a,b)=>a.entity_id<b.entity_id?-1:a.entity_id>b.entity_id?1:a.field<b.field?-1:1);},'OBSERVATION_MISMATCH');
 // A recorded rejection with a wrong reason set.
 invalid(A37,L=>{decision(L,T('V002','admit'),0).payload.reasons[0].resource_ids=['worker:M01'];},'REASON_MISMATCH');
 // A missing rejection after the code set changed (the upload's memory resets when it is paused).
 const s=h.scenario({positions:[h.position('K1','cleaning'),h.position('W1','waiting')],workers:[h.worker('C01',['cabin']),h.worker('L01',h.LEAD),h.worker('L02',h.LEAD,{availability:[{start_tick:1080,end_tick:3600}]}),h.worker('M01',h.MOVER)],visits:[h.visit('V1',{cabin:true,logs:20*GB})]});
 const pause=base({s,harness:{initial:{V1:{position:'W1',completed:['admit','intake']}}}});
 assert.equal(verify(pause,pause.ledger).status,'VERIFIED');
 invalid(pause,L=>m.remove(L,r=>r.kind==='POLICY_DECISION'&&r.payload.task_id===T('V1','upload')&&r.tick===1080),'REASON_MISMATCH');
});
test('planted record-structure violations',()=>{
 invalid(A21,L=>{m.where(L,r=>r.kind==='PROGRESS').payload.changes[0].quantization_slack='6/8';},'NONCANONICAL_RATIONAL');
 const B=base(validateScenario(preset('B').baseline,{origin:'editor'}).scenario);
 invalid(B,L=>{const i=L.records.findIndex(r=>r.chunk_count>1);L.records.splice(i+1,1);L.records.forEach((r,k)=>{r.seq=k;});},'CHUNK_GROUP_INVALID',{renumber:false});
 invalid(A21,L=>{L.records[5].seq=4;},'SEQ_INVALID',{renumber:false});
 invalid(A21,L=>{const i=L.records.findIndex(r=>r.kind==='RESOURCE_DELTA');[L.records[i],L.records[i+1]]=[L.records[i+1],L.records[i]];L.records.forEach((r,k)=>{r.seq=k;});},'RECORD_ORDER_INVALID',{renumber:false});
 invalid(A21,L=>{L.records[3].payload.extra=1;},'RECORD_SCHEMA_INVALID');
});
test('positive controls stay VERIFIED: exact capacity, half-open handover, final-tick remainder, release at due',()=>{
 assert.equal(verify(A23,A23.ledger).status,'VERIFIED');
 const m01=A37.ledger.records.filter(r=>r.kind==='RESOURCE_DELTA'&&r.tick===120).flatMap(r=>r.payload.changes.filter(c=>c.resource_id==='worker:M01').map(c=>c.change));
 assert.deepEqual(m01,['RELEASE','ACQUIRE']);assert.equal(verify(A37,A37.ledger).status,'VERIFIED');
 const soc=base(h.a21({target:21}));assert.ok(soc.ledger.records.some(r=>r.kind==='PROGRESS'&&r.payload.changes[0].undrawn_final_tick==='40000000/1'));assert.equal(verify(soc,soc.ledger).status,'VERIFIED');
 const s=h.scenario({positions:[h.position('C1','charging'),h.position('W1','waiting')],ports:[h.port('DC1','C1')],workers:[h.worker('X01',h.ALL)],visits:[h.visit('V1',{due:2604,soc:20})]});
 const e=verify({s,harness:null},h.run(s).ledger);assert.equal(e.status,'VERIFIED');
 assert.deepEqual([e.projection.visits[0].released_at,e.projection.visits[0].on_time,e.projection.metrics['visit.overdue_s']],[2604,true,0]);
});
