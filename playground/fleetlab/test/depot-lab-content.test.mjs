// Network, content and storage lifecycle (D1-10, D12-02 Q1/Q19; engineering note 8.3, 8.4, 12): single-flight cache with
// reservations and no eviction, storage reservation, serial activation after charge, transfer pause and resume,
// optional upload cancellation at egress, mandatory durable acknowledgment with reclaim and horizon provisional bytes.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
const {T,GB}=h;
const arm=(id,a='baseline')=>validateScenario(preset(id)[a],{origin:'editor'}).scenario;
const B=h.run(arm('B')).ledger.records,M=h.run(arm('M')).ledger.records;
test('whole-object single-flight cache: one reserved fetch, checked before any vehicle serve, never evicted',()=>{
 assert.equal(h.starts(B,'fetch').length,1);
 const cache=h.contentOf(B,c=>c.owner_id==='cache:depot');
 assert.deepEqual(cache.map(c=>c.transition),['RESERVED','OBJECT_COMPLETE','CHECK_COMPLETE']);
 const checked=cache[2].tick;
 for(const r of h.starts(B,'software_download'))assert.ok(r.tick>=checked);
 assert.equal(h.of(B,'ALLOCATION_DELTA').flatMap(r=>r.payload.changes).filter(c=>c.flow_id.endsWith(':software_download')&&!c.resource_path.includes('cache:read')).length,0);
 assert.ok(!h.contentOf(B).some(c=>c.transition==='RECLAIMED'&&!c.object_id.startsWith('logs:')));
});
test('vehicle storage reservation waits on full stock until acknowledged logs are reclaimed',()=>{
 const c=h.uploadCase({logs:49*GB,uploadRequired:true,cabin:false,H:8000,objects:[h.object('sw-new','software',2*GB)],required:['sw-new']});
 const recs=h.run(c.s,{harness:c.harness}).ledger.records;
 assert.deepEqual(h.decisionsOf(recs,T('V1','software_download')).map(d=>d.reasons.map(r=>[r.code,r.resource_ids.join()])),[[['FULL_STOCK_CACHE','storage:V1']],[]]);
 const ack=h.completeTick(recs,T('V1','acknowledgment'));
 assert.equal(ack,h.completeTick(recs,T('V1','upload')));assert.equal(h.startTick(recs,T('V1','software_download')),ack);
 assert.deepEqual(h.contentOf(recs,x=>x.tick===ack&&x.object_id==='logs:V1').map(x=>[x.transition,x.bytes]),[['OBJECT_COMPLETE',49*GB],['DURABLE_ACKNOWLEDGED',49*GB],['RECLAIMED',49*GB]]);
});
test('serial lifecycle: activation and postcheck after charge; inspection after postcheck while still connected',()=>{
 for(let i=1;i<=24;i++){
  const v=String(i).padStart(2,'0'),ch=h.completeTick(B,T(v,'charge')),[a0,a1]=h.interval(B,T(v,'software_activation')),[p0,p1]=h.interval(B,T(v,'software_postcheck'));
  assert.ok(h.completeTick(B,T(v,'software_check'))<=a0&&ch<=a0&&a1===a0+600&&a1<=p0&&p1===p0+60,v);
  const [i0,i1]=h.interval(B,T(v,'inspection'));assert.ok(p1<=i0&&i1<=h.startTick(B,T(v,'unplug')),v);
 }
});
test('map refresh precedes software activation; at most one activation per vehicle at a time',()=>{
 for(let i=1;i<=24;i++){
  const v=String(i).padStart(2,'0'),[m0,m1]=h.interval(M,T(v,'map_activation')),mp=h.completeTick(M,T(v,'map_postcheck')),[s0]=h.interval(M,T(v,'software_activation'));
  assert.ok(m1<=mp&&mp<=s0&&m1<=s0,v);assert.ok(m0>=h.completeTick(M,T(v,'charge')),v);
 }
 const cand=h.run(arm('M','candidate')).ledger.records;
 assert.equal(h.starts(cand,'map_download').length,0);assert.equal(h.starts(cand,'map_activation').length,0);
 assert.ok(h.decisionsOf(cand,'task:cache:map-v2:fetch').every(d=>d.reasons.map(r=>r.code).join()==='UNREACHABLE_SERVICE'));
});
test('a move pauses a running transfer, which resumes with a fresh interval; egress cancels an optional upload',()=>{
 const c=h.uploadCase(),recs=h.run(c.s,{harness:c.harness}).ledger.records;
 assert.deepEqual(h.transitions(recs,T('V1','upload')),[['START',0],['PAUSE',100],['RESUME',220],['PAUSE',1120],['CANCEL',1240]]);
 const p=h.progressOf(recs,'flow:V1:upload');
 assert.deepEqual(p.map(x=>[x.allocation_anchor_tick,x.to_tick,x.credited,x.quantization_slack,x.phase]),[[0,100,1250000000,'0/1',5],[220,1120,11250000000,'0/1',5]]);
 assert.deepEqual(h.allocationsOf(recs,'flow:V1:upload').map(a=>a.tick),[0,220]);
 assert.deepEqual(h.contentOf(recs,x=>x.object_id==='logs:V1').map(x=>[x.tick,x.transition,x.bytes]),[[1240,'RECEIVED_PROVISIONAL',12500000000]]);
 assert.equal(h.releaseTick(recs,'V1'),1240);assert.equal(h.startTick(recs,T('V1','acknowledgment')),null);
});
test('a mandatory upload gates inspection through the zero-duration acknowledgment and reclaim',()=>{
 const c=h.uploadCase({logs:1*GB,uploadRequired:true,cabin:false}),recs=h.run(c.s,{harness:c.harness}).ledger.records;
 assert.deepEqual(h.interval(recs,T('V1','upload')),[0,80]);
 const ack=h.of(recs,'TASK_TRANSITION').filter(r=>r.payload.task_id===T('V1','acknowledgment'));
 assert.deepEqual(ack.map(r=>[r.tick,r.microstep,r.phase,r.payload.transition]),[[80,1,2,'START'],[80,1,2,'COMPLETE']]);
 assert.equal(ack[0].payload.action_id,ack[1].payload.action_id);
 assert.deepEqual(h.contentOf(recs,x=>x.tick===80).map(x=>x.transition),['OBJECT_COMPLETE','DURABLE_ACKNOWLEDGED','RECLAIMED']);
 assert.deepEqual(h.interval(recs,T('V1','inspection')),[80,380]);assert.equal(h.releaseTick(recs,'V1'),500);
});
test('at H, unfinished transfers report their span and keep received bytes provisional',()=>{
 const c=h.uploadCase({logs:1*GB,uploadRequired:true,cabin:false,H:60}),recs=h.run(c.s,{harness:c.harness}).ledger.records;
 assert.deepEqual(h.progressOf(recs,'flow:V1:upload').map(x=>[x.phase,x.from_tick,x.to_tick,x.credited,x.quantization_slack,x.undrawn_final_tick]),[[6,0,60,750000000,'0/1','0/1']]);
 assert.deepEqual(h.contentOf(recs).map(x=>[x.tick,x.transition,x.bytes]),[[60,'RECEIVED_PROVISIONAL',750000000]]);
 assert.deepEqual(h.horizon(recs).unreleased,['visit:V1']);
});
test('data work needs a covered zone; uncovered positions report the zone',()=>{
 const s=h.scenario({H:1800,network:{covered_zones:['charging']},positions:[h.position('W1','waiting')],workers:[h.worker('L01',h.LEAD,{H:1800}),h.worker('M01',h.MOVER,{H:1800})],objects:[h.object('sw-new','software',2*GB)],visits:[h.visit('V1',{required:['sw-new']})]});
 const recs=h.run(s,{harness:{initial:{V1:{position:'W1',completed:['admit','intake']}}}}).ledger.records;
 assert.deepEqual(h.decisionsOf(recs,T('V1','software_download')).map(d=>d.reasons),[[{code:'ABSENT_INCOMPATIBLE_UNQUALIFIED',holder_visit_ids:[],resource_ids:['zone:waiting']}]]);
});
