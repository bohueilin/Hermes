// Fixed policy fcfs_eligible_fair_resources_v1 (D1-05, D1-09, D1-10, D1-12; engineering note 8.4, 8.5, 8.8, BD-08 to
// BD-10, BD-14): ranked worklist, lowest ids, DC before AC, supervised options, reason sets and recording, blockage.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {createState} from '../src/model/depot-lab/state.js';
import {workerOptions} from '../src/model/depot-lab/policy.js';
import {TEMPLATE_RANK,REASON_CODES} from '../src/model/depot-lab/profiles.js';
const {T}=h;
const arm=(id,a)=>validateScenario(preset(id)[a],{origin:'editor'}).scenario;
const RUNS=['B/baseline','B/candidate','G/candidate','M/baseline','M/candidate','D/baseline','W/baseline','T2/candidate','P/baseline'].map(k=>{const s=arm(...k.split('/'));return [k,h.run(s).ledger.records,s];});
test('each microstep evaluates proposals in (ready tick, template rank, owner key, task id) order',()=>{
 for(const [k,recs,s]of RUNS){
  const ready=new Map(),kind=new Map(s.content_objects.map(o=>[o.id,o.kind]));let last=null;
  for(const r of recs){
   if(r.kind==='OBSERVATION')for(const f of r.payload.facts)if(f.field==='prerequisite_ready_tick')ready.set(f.entity_id,f.value);
   if(r.kind!=='POLICY_DECISION')continue;
   const id=r.payload.task_id,parts=id.split(':'),cache=parts[1]==='cache';
   const key=[ready.get(id),TEMPLATE_RANK[cache?`${kind.get(parts[2])}_${parts[3]==='fetch'?'download':'check'}`:parts[2]],cache?'':parts[1],id];
   if(last&&last.tick===r.tick){const c=key[0]-last.key[0]||key[1]-last.key[1]||(key[2]<last.key[2]?-1:key[2]>last.key[2]?1:0)||(key[3]<last.key[3]?-1:1);assert.ok(c>0,`${k} at ${r.tick}: ${id} after ${last.key[3]}`);}
   last={tick:r.tick,key};
  }
 }
});
test('DC before AC, and a feasible AC port is never declined to wait for DC',()=>{
 const c=h.acDc(),recs=h.run(c.s,{harness:c.harness}).ledger.records;
 const port=v=>h.of(recs,'RESOURCE_DELTA').find(r=>r.payload.changes.some(x=>x.change==='RESERVE'&&x.owner_task_id===T(v,'to_charging')&&x.resource_id.startsWith('port:'))).payload.changes.find(x=>x.resource_id.startsWith('port:')).resource_id;
 assert.equal(port('A'),'port:DC01');assert.equal(port('B'),'port:AC01');
 assert.equal(h.startTick(recs,T('B','to_charging')),120);
 assert.deepEqual(h.allocationsOf(recs,'flow:B:charge').map(a=>a.rate),['11000000/1']);
});
test('worker options: solo independent by id, then supervised pairs with the slower solo duration',()=>{
 const s=h.scenario({positions:[h.position('W1','waiting')],workers:[
  h.worker('C01',['cabin']),
  h.worker('C02',[],{extra:{cabin:{level:'supervised_only',proficiency:'advanced'}}}),
  h.worker('C03',[],{extra:{cabin:{level:'independent',proficiency:'developing',may_supervise:true}}}),
  h.worker('C04',[],{extra:{cabin:{level:'independent',proficiency:'advanced',may_supervise:false}}}),
 ],visits:[h.visit('V1')]});
 assert.deepEqual(workerOptions(createState(s),'cabin'),[
  {worker_ids:['worker:C01'],duration_ticks:600},{worker_ids:['worker:C03'],duration_ticks:900},{worker_ids:['worker:C04'],duration_ticks:480},
  {worker_ids:['worker:C02','worker:C01'],duration_ticks:600},{worker_ids:['worker:C02','worker:C03'],duration_ticks:900},
 ]);
 assert.deepEqual(workerOptions(createState(s),'intake'),[]);
 // The independent solo option always precedes, so the supervised pair adds no capacity (TN structural null).
 const recs=h.run(arm('TN','candidate')).ledger.records;
 assert.ok(h.of(recs,'RESOURCE_DELTA').every(r=>!r.payload.changes.some(c=>c.resource_id==='worker:C02')));
});
test('reasons: Q15 order, one entry per code, sorted ids, decision-family codes only, holders own the held units',()=>{
 const forbidden=new Set(['PREREQUISITE','DIVISIBLE_CAPACITY_TIGHT','FINISHED_BUT_BLOCKED','DECLARED_RULE_DEFERRAL']);
 for(const [k,recs]of RUNS){
  const own=new Map();
  for(const r of recs){
   if(r.kind==='RESOURCE_DELTA')for(const c of r.payload.changes){if(c.change==='RELEASE')own.delete(c.resource_id);else own.set(c.resource_id,c.owner_task_id);}
   if(r.kind!=='POLICY_DECISION')continue;
   const p=r.payload,codes=p.reasons.map(x=>x.code);
   assert.equal(p.accepted,codes.length===0);assert.equal(p.blockage_group_id,null);
   assert.deepEqual(codes,REASON_CODES.filter(c=>codes.includes(c)));
   for(const x of p.reasons){
    assert.ok(!forbidden.has(x.code));
    for(const a of [x.resource_ids,x.holder_visit_ids])assert.deepEqual(a,[...new Set(a)].sort());
    if(x.code==='HELD_UNITS'){
     assert.ok(x.resource_ids.every(id=>own.has(id)),`${k} ${p.task_id} held units are owned`);
     assert.deepEqual(x.holder_visit_ids,[...new Set(x.resource_ids.map(id=>own.get(id)).filter(t=>!t.startsWith('task:cache:')).map(t=>'visit:'+t.split(':')[1]))].sort());
    }
   }
  }
 }
});
test('BD-08: a rejection is recorded only when its code set changes since the task became READY or PAUSED',()=>{
 // A22: B waits from 0 to 1860 on held units through many events but is recorded once.
 const c=h.a22('A');let recs=h.run(c.s,{harness:c.harness}).ledger.records;
 assert.deepEqual(h.decisionsOf(recs,T('B','to_charging')).map(d=>[d.tick,d.accepted]),[[0,false],[1860,true]]);
 // Vendor episode: the code set alternates between overlap and location, and every change is recorded.
 recs=RUNS.find(x=>x[0]==='G/candidate')[1];
 const d=h.decisionsOf(recs,T('08','upload')).filter(x=>!x.accepted).map(x=>x.reasons.map(r=>r.code).join());
 for(let i=1;i<d.length;i++)assert.notEqual(d[i],d[i-1]);
 // A pause restarts the memory: the same code set as before the start is recorded again after the egress pause.
 const s=h.scenario({positions:[h.position('K1','cleaning'),h.position('W1','waiting')],workers:[h.worker('C01',['cabin']),h.worker('L01',h.LEAD),h.worker('L02',h.LEAD,{availability:[{start_tick:1080,end_tick:3600}]}),h.worker('M01',h.MOVER)],visits:[h.visit('V1',{cabin:true,logs:20*h.GB})]});
 recs=h.run(s,{harness:{initial:{V1:{position:'W1',completed:['admit','intake']}}}}).ledger.records;
 assert.deepEqual(h.decisionsOf(recs,T('V1','upload')).map(x=>[x.tick,x.reasons.map(r=>r.code)]),[[0,['OVERLAP_EXCLUSION']],[120,[]],[1080,['OVERLAP_EXCLUSION']]]);
 assert.deepEqual(h.transitions(recs,T('V1','upload')),[['START',120],['PAUSE',1020],['CANCEL',1140]]);
});
test('service endpoint 2 x 3 table blocks new transfers and activations with the full reason set',()=>{
 const table=[['reachable','valid',[]],['reachable','denied',['DENIED_ENTITLEMENT']],['reachable','unknown',['UNKNOWN_MANDATORY_STATE']],
  ['unreachable','valid',['UNREACHABLE_SERVICE']],['unreachable','denied',['UNREACHABLE_SERVICE','DENIED_ENTITLEMENT']],['unreachable','unknown',['UNREACHABLE_SERVICE','UNKNOWN_MANDATORY_STATE']]];
 for(const [reach,ent,codes]of table){
  const svc={software:h.ENDPOINT(reach,ent)};
  for(const [task,c]of [['software_download',h.a35('wifi6',svc)],['software_activation',h.a38(svc)]]){
   const recs=h.run(c.s,{harness:c.harness}).ledger.records,d=h.decisionsOf(recs,T('V1',task));
   assert.equal(h.startTick(recs,T('V1',task))!==null,codes.length===0,`${reach}/${ent} ${task}`);
   if(codes.length){assert.deepEqual(d.map(x=>x.reasons.map(r=>r.code)),[codes]);assert.ok(d[0].reasons.every(r=>r.resource_ids.join()==='service:software'));assert.deepEqual(h.horizon(recs).unreleased,['visit:V1']);}
  }
 }
});
test('a READY task waits for its window with SCHEDULED_WINDOW, never a policy deferral',()=>{
 const c=h.uploadCase({logs:0}),recs=h.run(c.s,{harness:c.harness}).ledger.records;
 assert.deepEqual(h.decisionsOf(recs,T('V1','to_cleaning')).map(d=>[d.tick,d.reasons.map(r=>r.code)]),[[0,['SCHEDULED_WINDOW']],[100,[]]]);
});
test('horizon blockage: frontier waits on held units become terminal blockage, never deadlock on the forward route',()=>{
 for(const [k,recs]of RUNS){
  const own=new Map();
  for(const r of h.of(recs,'RESOURCE_DELTA'))for(const c of r.payload.changes){if(c.change==='RELEASE')own.delete(c.resource_id);else own.set(c.resource_id,c.owner_task_id);}
  const unreleased=new Set(h.horizon(recs).unreleased),b=h.of(recs,'BLOCKAGE');
  assert.deepEqual(b.map(r=>r.payload.member_visit_ids[0]),b.map(r=>r.payload.member_visit_ids[0]).slice().sort());
  for(const {payload:p,tick}of b){
   assert.equal(tick,recs.at(-1).tick);assert.equal(p.classification,'TERMINAL_BLOCKAGE_BEFORE_H',k);
   assert.deepEqual([p.enabling_event_key,p.enabling_event_seq,p.next_tick],[null,null,null]);
   assert.equal(p.member_visit_ids.length,1);assert.ok(unreleased.has(p.member_visit_ids[0]));
   assert.ok(p.held_resource_ids.every(id=>own.has(id)));
   const holders=[...new Set(p.unmet_alternatives.flatMap(a=>a.blocking_holder_visit_ids))].sort();
   assert.equal(p.terminal_holder_id,holders[0]);assert.ok(!holders.includes(p.member_visit_ids[0]));
  }
 }
 const m=RUNS.find(x=>x[0]==='M/candidate')[1];
 assert.ok(h.of(m,'BLOCKAGE').length>0);assert.equal(h.horizon(m).released.length,0);
});
