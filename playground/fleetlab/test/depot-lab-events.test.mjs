// Event kernel contract (C1.5, C2.2, C2.3; engineering note 8.2, 8.3, 8.7, 8.9, 12): phases, microsteps, ordinals,
// group ids, chunking, observation hash chain, byte accounting, guards, step-budget invariance and cancellation.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {createDepotRun,stepDepotRun,cancelDepotRun} from '../src/model/depot-lab/engine.js';
import {jcs,utf8Length} from '../src/model/depot-lab/canonical.js';
import {H as digest} from '../src/model/depot-lab/identity.js';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
const presetArm=(id,arm='baseline')=>validateScenario(preset(id)[arm],{origin:'editor'}).scenario;
const B=presetArm('B'),FULL_B=h.run(B);
const PHASE_KINDS=[['PROGRESS','TASK_TRANSITION','RESOURCE_DELTA','CONTENT_TRANSITION'],['SHIFT_CHANGE','ARRIVAL'],['WINDOW_OPEN','TASK_TRANSITION','CONTENT_TRANSITION'],['OBSERVATION'],['POLICY_DECISION','TASK_TRANSITION','RESOURCE_DELTA','CONTENT_TRANSITION'],['PROGRESS','ALLOCATION_DELTA'],['PROGRESS','CONTENT_TRANSITION','BLOCKAGE','HORIZON']];
const ledgers=()=>{const c=[h.a21(),h.a22('A'),h.a24(2),h.a39(2000000000),h.uploadCase(),h.anchorCase('change')].map(x=>x.s?h.run(x.s,{harness:x.harness}):h.run(x));return [FULL_B,...c];};
function checkStructure(ledger){
 const recs=ledger.records,H=Math.max(...recs.map(r=>r.tick));
 let prev=null;const groups=new Map(),grpOrd=new Map();
 recs.forEach((r,i)=>{
  assert.equal(r.seq,i);
  assert.equal(r.microstep,r.phase<=1?0:1);
  assert.ok(PHASE_KINDS[r.phase].includes(r.kind),`${r.kind} in phase ${r.phase}`);
  if(r.phase===6)assert.equal(r.tick,H);
  const rank=r.kind==='ARRIVAL'?2:r.kind==='SHIFT_CHANGE'?(r.payload.available?1:0):0;assert.equal(r.class_rank,rank);
  const m=/^(\d{6}):([A-Z_]+):(\d{2}):(\d{5})$/.exec(r.stable_key);assert.ok(m,r.stable_key);assert.equal(m[2],r.kind);assert.equal(Number(m[4]),r.chunk_index);
  assert.equal(r.group_id.slice(0,16),`group:${String(r.tick).padStart(6,'0')}:${String(r.microstep).padStart(2,'0')}:`);
  if(prev){const k=[r.tick-prev.tick,r.microstep-prev.microstep,r.phase-prev.phase,r.class_rank-prev.class_rank].find(x=>x!==0);assert.ok(k>0||(k===undefined&&r.stable_key>prev.stable_key),`order at ${i}`);}
  const tm=`${r.tick}/${r.microstep}`;
  // Each group has its own event ordinal, equal to the per-(tick, microstep) group counter; group ordinal 00.
  const g=groups.get(r.group_id);
  if(!g){
   const gc=Number(r.group_id.slice(-6)),lastG=grpOrd.get(tm);assert.equal(gc,lastG===undefined?0:lastG+1);grpOrd.set(tm,gc);
   assert.equal(Number(m[1]),gc);assert.equal(m[3],'00');
   assert.equal(r.chunk_index,0);groups.set(r.group_id,{n:r.chunk_count,seen:1,kind:r.kind});
  }else{assert.equal(r.chunk_count,g.n);assert.equal(r.chunk_index,g.seen);g.seen++;}
  for(const k of ['facts','changes'])if(r.payload[k])assert.ok(r.payload[k].length<=64);
  assert.ok(utf8Length(jcs(r))<=16384);assert.equal(JSON.stringify(r),jcs(r));
  prev=r;
 });
 for(const g of groups.values())assert.equal(g.seen,g.n);
 assert.equal(recs[recs.length-1].kind,'HORIZON');
}
test('records: contiguous seq, total key order, phase and microstep rules, ordinals and chunk groups',()=>{
 for(const r of ledgers()){assert.equal(r.terminal_status,'COMPLETE');checkStructure(r.ledger);}
 assert.ok(FULL_B.ledger.records.some(r=>r.chunk_count>1),'the default run chunks its first observation');
});
test('canonical byte accounting equals utf8Length(jcs(ledger))',()=>{
 for(const r of ledgers())assert.equal(r.bytes,utf8Length(jcs(r.ledger)));
});
test('observations: full first snapshot, net deltas, hash chain and decision references',()=>{
 for(const {ledger}of ledgers()){
  const recs=ledger.records,pub=new Map();let lastSeq=null,prevDigest=null,cur=null;
  const close=()=>{
   const facts=cur.flatMap(r=>r.payload.facts),d=digest('fleetlab.depot.observation-state.v1',{previous:prevDigest,facts});
   assert.ok(cur.every(r=>r.payload.state_digest===d&&r.payload.base_observation_seq===lastSeq));
   for(const f of facts){const k=f.entity_id+'|'+f.field;assert.ok(!pub.has(k)||pub.get(k)!==f.value,`unchanged fact ${k}`);pub.set(k,f.value);}
   const keys=facts.map(f=>[f.entity_id,f.field]);assert.deepEqual(keys,keys.slice().sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0));
   lastSeq=cur[cur.length-1].seq;prevDigest=d;cur=null;
  };
  for(const r of recs){
   if(r.kind==='OBSERVATION'){(cur??=[]).push(r);if(r.chunk_index===r.chunk_count-1)close();continue;}
   if(r.kind==='POLICY_DECISION'||(r.kind==='TASK_TRANSITION'&&r.phase===4))assert.equal(r.payload.observation_seq,lastSeq);
   if(r.kind==='HORIZON'){const hz=h.horizon(recs);assert.equal(r.payload.derived_state_digest,digest('fleetlab.depot.horizon-state.v1',{observation:prevDigest,released:hz.released,unreleased:hz.unreleased}));}
  }
  assert.equal(recs.find(r=>r.kind==='OBSERVATION').payload.base_observation_seq,null);
 }
});
test('the caller step budget never changes the ledger',()=>{
 const R=createDepotRun(B);let r,steps=0;
 do{r=stepDepotRun(R,{maxTicks:1});steps++;}while(!r.done);
 assert.ok(steps>100);assert.deepEqual(r.ledger,FULL_B.ledger);assert.equal(r.bytes,FULL_B.bytes);
});
test('cancellation returns CANCELLED with the complete prefix',()=>{
 const R=createDepotRun(B);const p=stepDepotRun(R,{maxTicks:5});assert.equal(p.done,false);
 cancelDepotRun(R);const r=stepDepotRun(R);
 assert.equal(r.terminal_status,'CANCELLED');assert.equal(r.ledger.terminal_status,'CANCELLED');
 assert.deepEqual(r.ledger.records,FULL_B.ledger.records.slice(0,r.ledger.records.length));
 assert.equal(r.bytes,utf8Length(jcs(r.ledger)));assert.equal(stepDepotRun(R),r);
});
// A refused run keeps whole atomic commits: no partial chunk group and no partial action (same tick and action id).
const prefixAtEventBoundary=(part,full)=>{
 const n=part.length;assert.ok(n>0);assert.deepEqual(part,full.slice(0,n));
 const last=part[n-1];assert.equal(last.chunk_index,last.chunk_count-1);
 const act=r=>r.payload.action_id?`${r.tick}/${r.payload.action_id}`:null,k=act(last);
 if(k&&n<full.length)assert.notEqual(act(full[n]),k,'prefix ends after a whole action');
};
test('record-count and ledger-byte guards keep only the last complete prefix',()=>{
 for(const max of [7,20,333]){
  const r=h.run(B,{guardOverrides:{maxRecords:max}});
  assert.equal(r.terminal_status,'INCOMPLETE_RESOURCE_LIMIT');assert.equal(r.guard.guard,'RECORD_COUNT');
  assert.ok(r.ledger.records.length<=max);prefixAtEventBoundary(r.ledger.records,FULL_B.ledger.records);
  assert.equal(r.bytes,utf8Length(jcs(r.ledger)));
 }
 const bound=FULL_B.bytes-1,r=h.run(B,{guardOverrides:{maxLedgerBytes:bound}});
 assert.equal(r.guard.guard,'LEDGER_BYTES');assert.ok(r.bytes<=bound);prefixAtEventBoundary(r.ledger.records,FULL_B.ledger.records);
 assert.equal(r.bytes,utf8Length(jcs(r.ledger)));
});
test('record-size and chunk guards: smaller chunks still complete; an oversized single record refuses',()=>{
 const r2=h.run(B,{guardOverrides:{maxChunkEntries:2}});
 assert.equal(r2.terminal_status,'COMPLETE');checkStructure(r2.ledger);
 // By design (note 19, AF-01): only contract-bound chunking verifies, so a test ledger chunked at 2 entries does not.
 assert.equal(verifyDepotRun(B,r2.ledger).primary_violation?.code,'CHUNK_GROUP_INVALID');
 assert.ok(r2.ledger.records.filter(r=>['OBSERVATION','PROGRESS','ALLOCATION_DELTA'].includes(r.kind)).every(r=>(r.payload.facts??r.payload.changes).length<=2));
 const facts=l=>l.records.filter(r=>r.kind==='OBSERVATION').flatMap(r=>r.payload.facts);assert.deepEqual(facts(r2.ledger),facts(FULL_B.ledger));
 const r=h.run(B,{guardOverrides:{maxRecordBytes:500}});
 assert.equal(r.terminal_status,'INCOMPLETE_RESOURCE_LIMIT');assert.deepEqual([r.guard.guard,r.guard.detail.kind],['RECORD_BYTES','RESOURCE_DELTA']);
 assert.ok(r.ledger.records.every(x=>utf8Length(jcs(x))<=500));assert.ok(r.ledger.records.some(x=>x.kind==='OBSERVATION'&&x.chunk_count>1));
 assert.equal(r.bytes,utf8Length(jcs(r.ledger)));
 for(const bad of [{maxRecords:100001},{maxRecordBytes:16385},{maxLedgerBytes:33554433},{maxChunkEntries:65},{maxChunkEntries:0},{unknown:1}])assert.throws(()=>createDepotRun(B,{guardOverrides:bad}),RangeError);
});
test('the sub-quantum guard refuses a positive share that cannot deliver by H',()=>{
 const c=h.anchorCase('change',3),r=h.run(c.s,{harness:c.harness});
 assert.equal(r.terminal_status,'INCOMPLETE_RESOURCE_LIMIT');assert.equal(r.guard.guard,'SUB_QUANTUM_POSITIVE_SHARE');
 assert.deepEqual([r.guard.detail.rate,r.guard.detail.anchor_tick,r.guard.detail.horizon_tick],['1/3',1,3]);
 assert.equal(r.bytes,utf8Length(jcs(r.ledger)));
});
test('no positive-duration start at H; completions at H count',()=>{
 const s=h.scenario({H:120,positions:[h.position('P001','waiting'),h.position('P002','waiting')],workers:[h.worker('M01',['move'],{H:120})],visits:[h.visit('V001'),h.visit('V002')]});
 const recs=h.run(s).ledger.records;
 assert.deepEqual(h.interval(recs,h.T('V001','admit')),[0,120]);assert.equal(h.startTick(recs,h.T('V002','admit')),null);
 assert.ok(!recs.some(r=>r.tick===120&&(r.kind==='POLICY_DECISION'||r.kind==='ALLOCATION_DELTA'||(r.kind==='TASK_TRANSITION'&&/START|RESUME/.test(r.payload.transition)))));
 for(const {ledger}of ledgers()){const H=ledger.records.at(-1).tick;assert.ok(!ledger.records.some(r=>r.tick===H&&r.phase===4));}
});
test('window boundaries and shift changes are exogenous records only where something changes',()=>{
 const c=h.uploadCase(),recs=h.run(c.s,{harness:c.harness}).ledger.records;
 assert.deepEqual(h.of(recs,'WINDOW_OPEN').map(r=>[r.tick,r.microstep,r.phase,r.payload.task_id]),[[100,1,2,'task:V1:cabin'],[100,1,2,'task:V1:to_cleaning']]);
 const shifts=av=>{const s=h.scenario({H:1000,positions:[h.position('W1','waiting')],workers:[h.worker('L01',h.LEAD,{availability:av}),h.worker('M01',h.MOVER,{H:1000})],visits:[h.visit('V1')]});return h.of(h.run(s).ledger.records,'SHIFT_CHANGE').filter(r=>r.payload.worker_id==='worker:L01').map(r=>[r.tick,r.class_rank,r.payload.available]);};
 assert.deepEqual(shifts([{start_tick:0,end_tick:500},{start_tick:500,end_tick:1000}]),[[0,1,true],[1000,0,false]]);
 assert.deepEqual(shifts([{start_tick:0,end_tick:500},{start_tick:600,end_tick:1000}]),[[0,1,true],[500,0,false],[600,1,true],[1000,0,false]]);
 const first=FULL_B.ledger.records.filter(r=>r.tick===0&&r.phase===1).map(r=>r.kind);
 assert.deepEqual(first,[...first.filter(k=>k==='SHIFT_CHANGE'),...first.filter(k=>k==='ARRIVAL')]);
});
test('horizon accounting partitions every arrival; the run binds the harness digest separately',()=>{
 for(const {ledger}of ledgers()){
  const hz=h.horizon(ledger.records);
  assert.deepEqual([...hz.released,...hz.unreleased].sort(),hz.arrived.slice().sort());assert.equal(new Set(hz.arrived).size,hz.arrived.length);
 }
 const c=h.a35(),plain=h.run(c.s),bound=h.run(c.s,{harness:c.harness});
 assert.notEqual(plain.ledger.scenario_digest,bound.ledger.scenario_digest);assert.equal(plain.ledger.workload_digest,bound.ledger.workload_digest);
 assert.throws(()=>createDepotRun(preset('B').baseline),TypeError);
});
