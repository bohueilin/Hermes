// Independent-review regressions for the verifier, job and session (BYP-01/02/04 to 07, ARITH-01/06/07, BND-02/03,
// BYP-05, COPY-01, DL-RT-02). Mutations start from a valid engine ledger and renumber, so only the intended invariant
// breaks; positive cases are the engine's own runs.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import * as m from './helpers/depot-lab-mutate.mjs';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
import {createDepotRun,stepDepotRun,cancelDepotRun} from '../src/model/depot-lab/engine.js';
import {createWriter,guardLimits,vec} from '../src/model/depot-lab/ledger.js';
import {compareDepotRuns} from '../src/model/depot-lab/compare.js';
import {runDepotJob} from '../src/runtime/depot-lab-job.js';
import {createDepotSession} from '../src/runtime/depot-lab-session.js';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {H as digest,refs} from '../src/model/depot-lab/identity.js';
import {REASON_CODES} from '../src/model/depot-lab/profiles.js';
import {jcs,utf8Length} from '../src/model/depot-lab/canonical.js';
import {Q,mulInt,formatRational,RationalGuardError} from '../src/model/depot-lab/rational.js';
import * as codec from '../src/ui/depot-lab-share.js';
const {T,GB}=h;
const base=c=>{const s=c.s??c,harness=c.harness??null;return {s,harness,ledger:h.run(s,{harness}).ledger};};
const verify=(c,L,o={})=>verifyDepotRun(c.s,L,{harness:c.harness,...o});
const valid=raw=>{const v=validateScenario(raw,{origin:'editor'});assert.ok(v.ok,JSON.stringify(v.issues?.slice(0,3)));return v.scenario;};
function invalid(c,mutate,code,o={}){
 const L=m.clone(c.ledger);mutate(L);m.renumber(L);
 const e=verify(c,L,o);
 assert.equal(e.status,'INVALID',`expected ${code}, got ${e.status} ${JSON.stringify(e.primary_violation)}`);
 assert.equal(e.primary_violation.code,code,JSON.stringify(e.primary_violation));assert.equal(e.projection,null);assert.equal(e.digests.run,null);
 return e;
}
const A21=base(h.a21()),A35=base(h.a35()),A37=base(h.a37());
// ----- BYP-01 / BYP-02 / FD-01: a target closure obliges the completion at that tick and is never credited again -----
// Note 10.2: the owed completion is checked at the end of the tick, so a later same-tick record that already violates
// lifecycle reports first (the code in the last column); with no later same-tick record it is MISSING_COMPLETION.
const CLOSURES=[['charge',A21,T('V1','charge'),2064,'PREREQUISITE_UNSATISFIED'],['download',A35,T('V1','software_download'),160,'UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE'],
 ['upload',base(h.uploadCase({uploadRequired:true,cabin:false})),T('V1','upload'),1600,'TASK_STATE_INVALID'],['cache fetch',base(h.a39(2*GB)),'task:cache:sw-new:fetch',80,'UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE']];
// Removes the task's COMPLETE and the rest of its completion step (release delta, content transition) at tick t.
function cut(L,id,t){
 const i=m.at(L,r=>r.tick===t&&r.kind==='TASK_TRANSITION'&&r.payload.task_id===id&&r.payload.transition==='COMPLETE');
 let j=i+1;while(L.records[j]?.tick===t&&L.records[j].phase===0&&['RESOURCE_DELTA','CONTENT_TRANSITION'].includes(L.records[j].kind))j++;
 return L.records.splice(i,j-i);
}
test('BYP-01/FD-01: a charge, download, upload or cache fetch at its target with the COMPLETE omitted or deferred is INVALID at that tick, with note 10.2 precedence',()=>{
 for(const [what,c,id,t,later]of CLOSURES){
  assert.equal(verify(c,c.ledger).status,'VERIFIED',what);
  assert.ok(c.ledger.records.some(r=>r.tick===t&&r.phase===0&&r.kind==='PROGRESS'),`${what} closes at ${t}`);
  assert.ok(c.ledger.records.some(r=>r.tick===t&&r.phase>0&&r.kind!=='OBSERVATION'),`${what} has a later same-tick record`);
  const omitted=invalid(c,L=>{cut(L,id,t);},later);assert.equal(omitted.primary_violation.tick,t,what);
  const deferred=invalid(c,L=>{const moved=cut(L,id,t),next=L.records.find(r=>r.tick>t).tick;m.insertBefore(L,r=>r.tick>t,...moved.map((r,k)=>({...r,tick:next,group_id:`group:new:deferred:${k}`})));},later);
  assert.equal(deferred.primary_violation.tick,t,what);
  const alone=invalid(c,L=>{cut(L,id,t);L.records=L.records.filter(r=>!(r.tick===t&&r.phase>0));},'MISSING_COMPLETION');
  assert.equal(alone.primary_violation.tick,t,what);assert.match(alone.primary_violation.detail,new RegExp(`${id} reached its target at ${t}`));
 }
});
test('FD-01: a same-tick PAUSE of a download already at its target is OVERLAP_VIOLATION, never an uncaught error',()=>{
 const H=1800,s=h.scenario({H,positions:[h.position('K1','cleaning'),h.position('W1','waiting')],workers:[h.worker('C01',['cabin'],{H}),h.worker('L01',h.LEAD,{H}),h.worker('M01',h.MOVER,{H,availability:[{start_tick:160,end_tick:H}]})],
  objects:[h.object('sw-old','software',2*GB),h.object('sw-new','software',2*GB)],visits:[h.visit('V1',{due:H,cabin:true,installed:['sw-old'],required:['sw-new']})]});
 const c=base({s,harness:{initial:{V1:{position:'W1',completed:['admit','intake']}}}}),DL=T('V1','software_download'),MV=T('V1','to_cleaning');
 assert.equal(verify(c,c.ledger).status,'VERIFIED');
 assert.deepEqual(c.ledger.records.filter(r=>r.tick===160&&r.kind==='TASK_TRANSITION').map(r=>[r.payload.task_id,r.payload.transition]),[[DL,'COMPLETE'],[MV,'START']]);
 const e=invalid(c,L=>{cut(L,DL,160);const d=m.where(L,r=>r.tick===160&&r.kind==='POLICY_DECISION'&&r.payload.task_id===MV);
  m.insertAfter(L,r=>r===d,m.record(160,4,'TASK_TRANSITION',{action_id:d.payload.action_id,observation_seq:d.payload.observation_seq,task_id:DL,transition:'PAUSE'}));},'OVERLAP_VIOLATION');
 assert.deepEqual([e.primary_violation.tick,e.primary_violation.detail],[160,`pause of ${DL}`]);
});
const credit=(flow,anchor,after,to)=>({allocation_anchor_tick:anchor,anchor_credited_after:after,anchor_credited_before:0,credited:after,flow_id:flow,from_tick:anchor,quantization_slack:'0/1',to_tick:to,undrawn_final_tick:'0/1'});
const unreleased=(L,ids)=>{const z=L.records.find(r=>r.kind==='HORIZON');z.payload.released_visit_ids=[];z.payload.unreleased_visit_ids=ids;return z;};
const H4=2000,A23H={s:h.scenario({H:H4,positions:[h.position('C1','charging'),h.position('C2','charging')],ports:[h.port('DC1','C1'),h.port('DC2','C2')],supply:100000,workers:[h.worker('L01',h.LEAD,{H:H4}),h.worker('M01',h.MOVER,{H:H4})],visits:[h.visit('A',{due:H4,soc:30}),h.visit('B',{due:H4,soc:55})]}),harness:h.a23().harness};
const A23_H2000=base(A23H);
test('BYP-02: the m01, m02 and m04 double-credit ledgers (credit past the target and the pack, a stale max-min share) are INVALID',()=>{
 // m01: A35 download COMPLETE omitted at 160 and its interval re-reported at H, 4 GB for one 2-GB object.
 invalid(A35,L=>{const R=L.records,o=R.find(r=>r.tick===160&&r.kind==='OBSERVATION');o.payload.facts=[{entity_id:T('V1','software_download'),field:'task_state',value:'RUNNING'}];
  const z=unreleased(L,['visit:V1']);
  L.records=[...R.filter(r=>r.tick<160),R.find(r=>r.tick===160&&r.kind==='PROGRESS'),o,...R.filter(r=>r.tick===1800&&r.kind!=='HORIZON'),
   m.record(1800,6,'PROGRESS',{changes:[credit('flow:V1:software_download',0,2*GB,1800)]}),m.record(1800,6,'CONTENT_TRANSITION',{bytes:4*GB,object_id:'object:sw-new',owner_id:'visit:V1',transition:'RECEIVED_PROVISIONAL'}),z];},'MISSING_COMPLETION');
 // m02: A21 charge COMPLETE omitted at 2064 and the 1344-anchored band interval credited again at H (100% SOC).
 invalid(A21,L=>{const R=L.records,z=unreleased(L,['visit:V1']);
  L.records=[...R.filter(r=>r.tick<2064),R.find(r=>r.tick===2064&&r.kind==='PROGRESS'),...R.filter(r=>r.tick===3600&&r.kind!=='HORIZON'),m.record(3600,6,'PROGRESS',{changes:[credit('flow:V1:charge',1344,43200000000,3600)]}),z];},'MISSING_COMPLETION');
 // m04: B at target at 1080 keeps a 50 kW share, A is never reallocated to 100 kW, and B is credited past its pack.
 assert.equal(verify(A23_H2000,A23_H2000.ledger).status,'VERIFIED');
 invalid(A23_H2000,L=>{const R=L.records,o=R.find(r=>r.tick===1080&&r.kind==='OBSERVATION');o.payload.facts=[{entity_id:T('A','charge'),field:'task_state',value:'RUNNING'},{entity_id:T('B','charge'),field:'task_state',value:'RUNNING'}];
  const z=unreleased(L,['visit:A','visit:B']);
  L.records=[...R.filter(r=>r.tick<1080),R.find(r=>r.tick===1080&&r.kind==='PROGRESS'&&r.phase===0),o,...R.filter(r=>r.tick===H4&&r.kind!=='HORIZON'&&r.kind!=='PROGRESS'),
   m.record(H4,6,'PROGRESS',{changes:[credit('flow:A:charge',0,100000000000,H4),credit('flow:B:charge',0,54000000000,H4)]}),z];},'ALLOCATION_DELTA_INCOMPLETE');
 // (m04: B's closure frees its share, so A's reallocation at 1080 is owed in phase 5 and fails before the end-of-tick
 // MISSING_COMPLETION, note 10.2.)
 // With the completion present, a second horizon credit for the closed interval is refused.
 invalid(A21,L=>{m.insertBefore(L,r=>r.kind==='HORIZON',m.record(3600,6,'PROGRESS',{changes:[credit('flow:V1:charge',1344,43200000000,3600)]}));},'PROGRESS_MISMATCH');
});
// ----- ARITH-01: a DC band edge exactly at H (note 20, F4) -----
test('ARITH-01: a band edge exactly at H verifies, alone and beside other active flows; a zero-span H item for it fails',()=>{
 for(const H of [1343,1344,1345]){const c=base(h.a21({H}));assert.equal(verify(c,c.ledger).status,'VERIFIED',`H ${H}`);}
 const edge=base(h.a21({H:1344}));
 assert.ok(edge.ledger.records.some(r=>r.tick===1344&&r.phase===0&&r.kind==='PROGRESS')&&!edge.ledger.records.some(r=>r.phase===6&&r.kind==='PROGRESS'),'the edge closes in phase 0 with no H item');
 invalid(edge,L=>{m.insertBefore(L,r=>r.kind==='HORIZON',m.record(1344,6,'PROGRESS',{changes:[{...credit('flow:V1:charge',1344,0,1344)}]}));},'PROGRESS_MISMATCH');
 // Preset B with End of run moved onto a band-edge tick; availability ends equal to H move with it, as the control does.
 const raw=preset('B').baseline,full=h.run(valid(raw)).ledger.records,done=new Set(full.filter(r=>r.kind==='TASK_TRANSITION'&&r.payload.transition==='COMPLETE').map(r=>`${r.tick}|${r.payload.task_id}`));
 const H=full.filter(r=>r.kind==='PROGRESS'&&r.phase===0&&r.tick>raw.arrival_window_tick).flatMap(r=>r.payload.changes.filter(c=>c.flow_id.endsWith(':charge')&&!done.has(`${r.tick}|${c.flow_id.replace('flow:','task:')}`)).map(()=>r.tick))[0];
 assert.equal(H,22176);
 const fit=l=>l.forEach(i=>{if(i.end_tick===raw.horizon_tick)i.end_tick=H;});raw.workers.forEach(w=>fit(w.availability));fit(raw.vendor.availability);raw.horizon_tick=H;
 const reply=runDepotJob({type:'run',id:'edge',generation:1,arms:{baseline:jcs(valid(raw)),candidate:null}},{createDepotRun,stepDepotRun,verifyDepotRun,compareDepotRuns});
 assert.equal(reply.type,'result');const e=reply.envelopes.baseline;assert.equal(e.status,'VERIFIED',JSON.stringify(e.primary_violation));
 assert.ok(JSON.parse(reply.ledger_texts.baseline).records.some(r=>r.tick===H&&r.phase===6&&r.kind==='PROGRESS'),'other flows are still reported at H');
});
// ----- BND-02 / BYP-05 / BYP-04 / ARITH-06: guards and prefixes -----
const B=valid(preset('B').baseline),CB={s:B,harness:null};
const lowered=over=>({createDepotRun:s=>createDepotRun(s,{guardOverrides:over}),stepDepotRun,compareDepotRuns});
const bRequest={type:'run',id:'guard',generation:1,arms:{baseline:jcs(B),candidate:null}};
test('BND-02/BYP-05: the engine guard travels beside the ledger text into the envelope with a prefix digest; run digest stays null',()=>{
 const reply=runDepotJob(bRequest,{...lowered({maxRecords:300}),verifyDepotRun:(s,l,o)=>verifyDepotRun(s,l,{...o,allowLoweredGuards:true})});
 assert.equal(reply.type,'result');
 const g=reply.ledger_guards.baseline,e=reply.envelopes.baseline,L=JSON.parse(reply.ledger_texts.baseline);
 assert.equal(g.guard,'RECORD_COUNT');assert.equal(g.detail.bound,300);assert.ok(g.detail.records>300&&L.records.length<=300);
 assert.deepEqual([e.status,e.consistency,e.projection,e.digests.run,e.primary_violation],['INCOMPLETE_RESOURCE_LIMIT','NOT_AVAILABLE',null,null,null]);
 assert.deepEqual(e.ledger.guard,g);assert.equal(e.digests.prefix,digest('fleetlab.depot.ledger-prefix.v1',L));
 // The public path accepts only the contract bounds.
 const pub=runDepotJob(bRequest,{...lowered({maxRecords:300}),verifyDepotRun}).envelopes.baseline;
 assert.deepEqual([pub.status,pub.primary_violation.code,pub.ledger.guard],['INVALID','TERMINAL_STATUS_MISMATCH',null]);
});
test('BYP-04: an INCOMPLETE label needs a named guard consistent with the prefix; COMPLETE and CANCELLED claim none',()=>{
 const inc=h.run(B,{guardOverrides:{maxRecords:500}}),ok={claimedGuard:inc.guard,allowLoweredGuards:true};
 assert.equal(verify(CB,inc.ledger,ok).status,'INCOMPLETE_RESOURCE_LIMIT');
 const code=(L,o)=>{const e=verify(CB,L,o);return e.status==='INVALID'?e.primary_violation.code:e.status;};
 assert.equal(code(inc.ledger,{}),'TERMINAL_STATUS_MISMATCH','no guard named');
 assert.equal(code(inc.ledger,{claimedGuard:inc.guard}),'TERMINAL_STATUS_MISMATCH','a lowered bound on the public path');
 for(const detail of [{records:500,bound:500},{records:501,bound:400},{records:501,bound:500,extra:1}])assert.equal(code(inc.ledger,{...ok,claimedGuard:{guard:'RECORD_COUNT',detail}}),'TERMINAL_STATUS_MISMATCH',JSON.stringify(detail));
 assert.equal(code(inc.ledger,{...ok,claimedGuard:{guard:'NOT_A_GUARD',detail:{}}}),'TERMINAL_STATUS_MISMATCH');
 const bytes=h.run(B,{guardOverrides:{maxLedgerBytes:200000}});assert.equal(bytes.guard.guard,'LEDGER_BYTES');
 assert.equal(code(bytes.ledger,{claimedGuard:bytes.guard,allowLoweredGuards:true}),'INCOMPLETE_RESOURCE_LIMIT');
 assert.equal(code(bytes.ledger,{claimedGuard:{guard:'LEDGER_BYTES',detail:{bytes:150000,bound:200000}},allowLoweredGuards:true}),'TERMINAL_STATUS_MISMATCH');
 // S1: a complete A37 ledger relabelled INCOMPLETE far below any guard.
 const S1={...m.clone(A37.ledger),terminal_status:'INCOMPLETE_RESOURCE_LIMIT'};S1.records=S1.records.filter(r=>r.kind!=='HORIZON');m.renumber(S1);
 assert.equal(verify(A37,S1).primary_violation?.code,'TERMINAL_STATUS_MISMATCH');
 assert.equal(verify(A37,S1,{claimedGuard:{guard:'RECORD_COUNT',detail:{records:S1.records.length+1,bound:100000}}}).primary_violation?.code,'TERMINAL_STATUS_MISMATCH');
 assert.equal(verify(A37,A37.ledger,{claimedGuard:inc.guard,allowLoweredGuards:true}).primary_violation?.code,'TERMINAL_STATUS_MISMATCH','a complete ledger claims no guard');
 // A sub-quantum stop is confirmed arithmetically against H.
 const sq=h.anchorCase('change',3),r=h.run(sq.s,{harness:sq.harness});assert.equal(r.guard.guard,'SUB_QUANTUM_POSITIVE_SHARE');
 assert.equal(verify(sq,r.ledger,{claimedGuard:r.guard}).status,'INCOMPLETE_RESOURCE_LIMIT');
 assert.equal(verify(sq,r.ledger,{claimedGuard:{...r.guard,detail:{...r.guard.detail,rate:'1/1'}}}).primary_violation?.code,'TERMINAL_STATUS_MISMATCH');
});
test('BYP-04/ARITH-06: prefixes replay semantically; tampered INCOMPLETE and CANCELLED prefixes are INVALID with the replay code',()=>{
 const bump=L=>{const p=L.records.find(r=>r.kind==='PROGRESS');p.payload.changes[0].credited+=123456789;p.payload.changes[0].anchor_credited_after+=123456789;return L;};
 const inc=h.run(B,{guardOverrides:{maxRecords:500}}),o={claimedGuard:inc.guard,allowLoweredGuards:true};
 assert.equal(verify(CB,bump(m.clone(inc.ledger)),o).primary_violation?.code,'PROGRESS_MISMATCH');
 const R=createDepotRun(B);stepDepotRun(R,{maxTicks:40});cancelDepotRun(R);const cancelled=stepDepotRun(R).ledger;
 assert.equal(verify(CB,cancelled).status,'CANCELLED');
 assert.equal(verify(CB,bump(m.clone(cancelled))).primary_violation?.code,'PROGRESS_MISMATCH');
 // The A21 ledger without its HORIZON and with one more mJ at its first closure, labelled each way. A cancelled ledger
 // ends before H (the engine finishes COMPLETE in the step that processes H), so its tick-H records are cut there.
 const A=bump(m.clone(A21.ledger));A.records=A.records.filter(r=>r.kind!=='HORIZON');
 for(const [status,opt,keep]of [['CANCELLED',{},r=>r.tick<3600],['INCOMPLETE_RESOURCE_LIMIT',{claimedGuard:{guard:'RECORD_COUNT',detail:{records:A.records.length+1,bound:A.records.length}},allowLoweredGuards:true},()=>true]]){
  assert.equal(verify(A21,{...A,records:A.records.filter(keep),terminal_status:status},opt).primary_violation?.code,'PROGRESS_MISMATCH',status);
 }
 // The last tick of a prefix must still be an event tick; its records are replayed first (note 21).
 const X=m.clone(A21.ledger);X.terminal_status='CANCELLED';X.records=X.records.filter(r=>r.tick<=120);
 X.records.push({...m.clone(X.records.find(r=>r.kind==='OBSERVATION'&&r.tick===120)),tick:121,group_id:'group:new:late'});m.renumber(X);
 const x=verify(A21,X).primary_violation;assert.deepEqual([x?.code,x?.tick],['OBSERVATION_MISMATCH',121],'the extra-tick record reports its own code first');
});
// ----- NP-1: a CANCELLED prefix is whole ticks; an INCOMPLETE prefix is replayed up to its cut, its last tick included -----
const LAST={
 credit:L=>{const r=L.records.filter(x=>x.tick===L.records.at(-1).tick&&x.kind==='PROGRESS').at(-1);if(!r)return null;r.payload.changes[0].credited+=123456789;r.payload.changes[0].anchor_credited_after+=123456789;return r.seq;},
 unknownTask:L=>{const r=L.records.filter(x=>x.tick===L.records.at(-1).tick&&x.kind==='TASK_TRANSITION').at(-1);if(!r)return null;r.payload.task_id='task:ZZZ99:intake';return r.seq;},
 flipStart:L=>{const r=L.records.filter(x=>x.tick===L.records.at(-1).tick&&x.kind==='TASK_TRANSITION'&&x.payload.transition==='START').at(-1);if(!r)return null;r.payload.transition='COMPLETE';return r.seq;},
};
// The same edit on the same record of the complete ledger gives the code the prefix must report.
const onComplete=(full,P,seq)=>{const L=m.clone(full);L.records[seq]=m.clone(P.records[seq]);const e=verify(CB,L);assert.equal(e.status,'INVALID');return e.primary_violation.code;};
test('NP-1: a tampered final tick of a CANCELLED or INCOMPLETE prefix is INVALID with the complete ledger code',()=>{
 const full=h.run(B).ledger,cases=[];
 // Cancels after 4 steps and records 29 (after a closure) and 50 (between phase-5 PROGRESS and ALLOCATION_DELTA) end
 // with a credit in their last tick.
 for(const k of [1,4,40,120,260]){const R=createDepotRun(B);stepDepotRun(R,{maxTicks:k});cancelDepotRun(R);cases.push([`cancel ${k}`,stepDepotRun(R).ledger,{}]);}
 for(const n of [29,50,500,1201,2300]){const r=h.run(B,{guardOverrides:{maxRecords:n}});cases.push([`records ${n}`,r.ledger,{claimedGuard:r.guard,allowLoweredGuards:true}]);}
 const used=new Set();
 for(const [name,L,o]of cases){
  assert.deepEqual(L.records,full.records.slice(0,L.records.length),`${name} is a prefix`);
  assert.equal(verify(CB,L,o).status,L.terminal_status,name);
  for(const mut of Object.keys(LAST)){
   const P=m.clone(L),seq=LAST[mut](P);if(seq===null)continue;used.add(mut);
   const e=verify(CB,P,o);assert.equal(e.status,'INVALID',`${name} ${mut}`);
   assert.equal(e.primary_violation.code,onComplete(full,P,seq),`${name} ${mut}`);
  }
 }
 assert.deepEqual([...used].sort(),Object.keys(LAST).sort());
 // A cancelled ledger never carries records at H.
 const atH=m.clone(full);atH.records=atH.records.filter(r=>r.kind!=='HORIZON');atH.terminal_status='CANCELLED';
 assert.equal(verify(CB,atH).primary_violation?.code,'TERMINAL_STATUS_MISMATCH');
 // S2: the A37 same-tick double acquisition in a tick-0-only CANCELLED prefix (its last tick).
 const S2=m.clone(A37.ledger);S2.records=S2.records.filter(r=>r.tick===0);S2.terminal_status='CANCELLED';
 assert.equal(verify(A37,S2).status,'CANCELLED');
 const d=S2.records.find(r=>r.kind==='POLICY_DECISION'&&r.payload.task_id===T('V002','admit'));d.payload.accepted=true;d.payload.reasons=[];
 m.insertAfter(S2,r=>r===d,m.record(0,4,'RESOURCE_DELTA',{action_id:d.payload.action_id,changes:[{change:'ACQUIRE',owner_task_id:T('V002','admit'),resource_id:'lane:01'},{change:'RESERVE',owner_task_id:T('V002','admit'),resource_id:'position:P002'},{change:'ACQUIRE',owner_task_id:T('V002','admit'),resource_id:'worker:M01'}]}),m.record(0,4,'TASK_TRANSITION',{task_id:T('V002','admit'),transition:'START',action_id:d.payload.action_id,observation_seq:d.payload.observation_seq}));
 m.renumber(S2);assert.equal(verify(A37,S2).primary_violation?.code,'DOUBLE_RESOURCE_ACQUISITION_SAME_TICK');
 // S3 (BYP-04): 999,999,999,999,999 mJ more at the closure of the prefix's last tick, on the public path both ways.
 const S3=m.clone(A21.ledger);S3.records=S3.records.filter(r=>r.tick<=1344);const p=S3.records.findLast(r=>r.kind==='PROGRESS');assert.equal(p.tick,1344);
 p.payload.changes[0].credited+=999999999999999;p.payload.changes[0].anchor_credited_after+=999999999999999;
 assert.equal(verify(A21,{...S3,terminal_status:'CANCELLED'}).primary_violation?.code,'PROGRESS_MISMATCH');
 assert.equal(verify(A21,{...S3,terminal_status:'INCOMPLETE_RESOURCE_LIMIT'},{claimedGuard:{guard:'RECORD_COUNT',detail:{records:100001,bound:100000}}}).primary_violation?.code,'PROGRESS_MISMATCH');
});
// ----- FD-02: a guard claim names the replay's own refused step -----
const relabel=(c,keep=()=>true)=>{const L={...m.clone(c.ledger),terminal_status:'INCOMPLETE_RESOURCE_LIMIT'};L.records=L.records.filter(r=>r.kind!=='HORIZON'&&keep(r));return m.renumber(L);};
const claimCode=(c,L,claimedGuard,o={})=>{const e=verify(c,L,{claimedGuard,...o});return e.status==='INVALID'?e.primary_violation.code:e.status;};
test('FD-02: MICROSTEP_LIMIT and guard claims the replay does not reach are TERMINAL_STATUS_MISMATCH',()=>{
 const S1=relabel(A37);
 for(const g of [{guard:'MICROSTEP_LIMIT',detail:{}},{guard:'MICROSTEP_LIMIT',detail:'x'},{guard:'MICROSTEP_LIMIT',detail:{microstep:65}},{guard:'RATIONAL_GUARD',detail:{}},{guard:'RATIONAL_GUARD',detail:'x'},
  {guard:'VECTOR_LIMIT',detail:{field:'unmet_alternatives',entries:65,bound:64}},{guard:'VECTOR_LIMIT',detail:{field:'zzz',entries:65,bound:64}},
  {guard:'RECORD_BYTES',detail:{kind:'OBSERVATION',bytes:16385,bound:16384}},{guard:'RECORD_BYTES',detail:{kind:'RESOURCE_DELTA',bytes:16385,bound:16384}},{guard:'RECORD_BYTES',detail:{kind:'BLOCKAGE',bytes:16385,bound:16384}}])
  assert.equal(claimCode(A37,S1,g),'TERMINAL_STATUS_MISMATCH',JSON.stringify(g));
 // A vector refusal happens only at H: a prefix cut at 120 of 240 cannot replay to it.
 assert.equal(verify(A37,relabel(A37,r=>r.tick<=120),{claimedGuard:{guard:'VECTOR_LIMIT',detail:{field:'unmet_alternatives',entries:65,bound:64}}}).status,'INVALID');
 // A sub-quantum claim must equal the interval the replay itself refuses in phase 5 of the last tick.
 const sq=h.anchorCase('change',3),r=h.run(sq.s,{harness:sq.harness}),d=r.guard.detail;
 assert.deepEqual(d,{flow_id:'flow:V1:software_download',rate:'1/3',anchor_tick:1,horizon_tick:3,remainder:'1'});
 assert.equal(claimCode(sq,r.ledger,r.guard),'INCOMPLETE_RESOURCE_LIMIT');
 for(const x of [{flow_id:'flow:V2:software_download'},{flow_id:'flow:nobody:charge'},{remainder:'2'},{rate:'1/4'},{anchor_tick:2}])
  assert.equal(claimCode(sq,r.ledger,{guard:'SUB_QUANTUM_POSITIVE_SHARE',detail:{...d,...x}}),'TERMINAL_STATUS_MISMATCH',JSON.stringify(x));
 const A=relabel(A21,r=>r.tick<=480);
 assert.equal(claimCode(A21,A,{guard:'SUB_QUANTUM_POSITIVE_SHARE',detail:{flow_id:'flow:nobody:charge',rate:'1/100000',anchor_tick:480,horizon_tick:3600,remainder:'1'}}),'TERMINAL_STATUS_MISMATCH');
 // Phases 0 to 4 of the anchor tick are committed whole before the refusal: a prefix one record short does not reach it.
 const short={...r.ledger,records:r.ledger.records.slice(0,-1)};assert.equal(verify(sq,short,{claimedGuard:r.guard}).status,'INVALID');
});
test('FD-02: an honest BLOCKAGE byte refusal at H verifies through the replay to H; its forged size or count does not',()=>{
 const raw=preset('M').candidate;raw.visits.forEach(v=>{v.id=`${v.id}-${'x'.repeat(31)}`.slice(0,31);});
 const s=valid(raw),r=h.run(s,{guardOverrides:{maxRecordBytes:726}}),c={s,harness:null};
 assert.deepEqual(r.guard,{guard:'RECORD_BYTES',detail:{kind:'BLOCKAGE',bytes:727,bound:726}});
 assert.ok(r.ledger.records.at(-1).tick===s.horizon_tick||!r.ledger.records.some(x=>x.tick===s.horizon_tick),'the refusal is in phase 6 at H');
 const o={allowLoweredGuards:true};
 assert.equal(claimCode(c,r.ledger,r.guard,o),'INCOMPLETE_RESOURCE_LIMIT');
 assert.equal(claimCode(c,r.ledger,{...r.guard,detail:{...r.guard.detail,bytes:728}},o),'TERMINAL_STATUS_MISMATCH');
 assert.equal(claimCode(c,r.ledger,{guard:'VECTOR_LIMIT',detail:{field:'unmet_alternatives',entries:65,bound:64}},o),'CHUNK_GROUP_INVALID','chunked under the lowered bound');
 // At the contract bound, the M candidate cut just before its first BLOCKAGE at H: that record fits and has at most
 // 64 alternatives, so neither refusal is the replay's own.
 const Mc={s:valid(preset('M').candidate),harness:null};Mc.ledger=h.run(Mc.s).ledger;
 const first=Mc.ledger.records.findIndex(x=>x.kind==='BLOCKAGE');assert.ok(first>0);
 const pre={...m.clone(Mc.ledger),terminal_status:'INCOMPLETE_RESOURCE_LIMIT'};pre.records=pre.records.slice(0,first);
 for(const g of [{guard:'VECTOR_LIMIT',detail:{field:'unmet_alternatives',entries:65,bound:64}},{guard:'RECORD_BYTES',detail:{kind:'BLOCKAGE',bytes:16385,bound:16384}}])
  assert.equal(claimCode(Mc,pre,g),'TERMINAL_STATUS_MISMATCH',JSON.stringify(g));
});
test('FD-02: under the contract bound only a BLOCKAGE record can exceed 16,384 bytes (largest schema-valid single-entry record per kind)',()=>{
 const id=(c,i=0)=>`${c}${i}`.padEnd(96,'x'),ids=(c,n)=>Array.from({length:n},(_,i)=>id(c,i)),rat=`${'9'.repeat(256)}/${'7'.repeat(256)}`,u=9007199254740991,code=[...REASON_CODES].sort((a,b)=>b.length-a.length)[0];
 const row={ARRIVAL:{visit_id:id('v')},SHIFT_CHANGE:{available:false,worker_id:id('w')},WINDOW_OPEN:{task_id:id('t')},TASK_TRANSITION:{action_id:id('a'),observation_seq:99999,task_id:id('t'),transition:'COMPLETE'},
  RESOURCE_DELTA:{action_id:id('a'),changes:ids('r',32).map(r=>({change:'RELEASE',owner_task_id:id('t'),resource_id:r}))},CONTENT_TRANSITION:{bytes:u,object_id:id('o'),owner_id:id('v'),transition:'RECEIVED_PROVISIONAL'},
  OBSERVATION:{base_observation_seq:99999,facts:[{entity_id:id('e'),field:'prerequisite_ready_tick',value:id('x')}],state_digest:'f'.repeat(64)},
  PROGRESS:{changes:[{allocation_anchor_tick:172800,anchor_credited_after:u,anchor_credited_before:u,credited:u,flow_id:id('f'),from_tick:172800,quantization_slack:rat,to_tick:172800,undrawn_final_tick:rat}]},
  ALLOCATION_DELTA:{changes:[{flow_id:id('f'),rate:rat,resource_path:ids('p',64),tight_resource_ids:ids('q',64),unit:'bytes_per_tick'}]},
  HORIZON:{arrived_visit_ids:[id('a')],derived_state_digest:'f'.repeat(64),released_visit_ids:[id('b')],unreleased_visit_ids:[id('c')]},
  POLICY_DECISION:{accepted:false,action_id:id('a'),blockage_group_id:id('g'),observation_seq:99999,reasons:Array.from({length:14},()=>({code,holder_visit_ids:[id('h')],resource_ids:[id('r')]})),task_id:id('t')},
  BLOCKAGE:{classification:'TERMINAL_BLOCKAGE_BEFORE_H',enabling_event_key:null,enabling_event_seq:null,held_resource_ids:[id('r')],member_visit_ids:[id('m')],next_tick:null,terminal_holder_id:id('h'),unmet_alternatives:ids('v',64).map(v=>({all_required_resources:[id('r')],blocking_holder_visit_ids:[id('h')],task_id:id('t'),visit_id:v}))}};
 const size=(kind,payload)=>measured({chunk_count:1,chunk_index:0,class_rank:31,group_id:refs.group(172800,64,999999),kind,microstep:64,payload,phase:6,seq:0,stable_key:refs.stableKey(999999,kind,0,99999),tick:172800});
 for(const [kind,payload]of Object.entries(row))assert.equal(size(kind,payload)>16384,kind==='BLOCKAGE',kind);
});
// Documented residual (note 10.1, the verifier never runs the engine): the step a rational guard refused is not in the
// ledger, so a RATIONAL_GUARD claim is confirmed only in form, as one of the messages rational.js raises.
test('FD-02: a RATIONAL_GUARD claim is accepted only with a message rational.js itself raises',()=>{
 const inc=h.run(B,{guardOverrides:{maxRecords:500}}),raised=[];
 for(const f of [()=>mulInt(2n**4096n,2n**4097n),()=>Q(2n**8192n),()=>Q(1n,2n**8192n),()=>formatRational(Q(10n**256n))]){try{f();}catch(e){assert.ok(e instanceof RationalGuardError);raised.push(e.detail);}}
 assert.equal(raised.length,4);
 for(const detail of raised)assert.equal(claimCode(CB,inc.ledger,{guard:'RATIONAL_GUARD',detail}),'INCOMPLETE_RESOURCE_LIMIT',detail);
 for(const detail of ['product operand bits ','numerator exceeds 8191 bits',{text:'product operand bits'}])assert.equal(claimCode(CB,inc.ledger,{guard:'RATIONAL_GUARD',detail}),'TERMINAL_STATUS_MISMATCH',JSON.stringify(detail));
});
test('session: the reply guard field is closed and bounded; a prefix digest is accepted only on a prefix envelope',()=>{
 const workers=[],s=createDepotSession({workerFactory:()=>{const w={posted:[],postMessage(x){this.posted.push(x);},terminate(){}};workers.push(w);return w;},codec});
 s.run('baseline');const w=workers[0],model={...lowered({maxRecords:300}),verifyDepotRun:(a,b,o)=>verifyDepotRun(a,b,{...o,allowLoweredGuards:true})};
 const reply=runDepotJob(w.posted[0],model),env=reply.envelopes.baseline,before=s.get(),{ledger_guards,...old}=reply;
 for(const bad of [old,{...reply,ledger_guards:{baseline:{guard:'G'.repeat(65),detail:null},candidate:null}},{...reply,ledger_guards:{baseline:{guard:'RECORD_COUNT',detail:'d'.repeat(5000)},candidate:null}},
  {...reply,ledger_guards:{baseline:{guard:'RECORD_COUNT'},candidate:null}},{...reply,ledger_guards:{baseline:null}},{...reply,envelopes:{baseline:{...env,digests:{...env.digests,prefix:'zz'}},candidate:null}}]){
  w.onmessage({data:bad});assert.equal(s.get(),before);
 }
 w.onmessage({data:reply});const st=s.get();
 assert.equal(st.status,'incomplete');assert.deepEqual(st.result.ledger_guards,ledger_guards);assert.equal(st.result.envelopes.baseline.ledger.guard.guard,'RECORD_COUNT');
});
// ----- BYP-06 / BYP-07: canonical chunking and pause order -----
test('BYP-06: only the writer chunking verifies; split, empty, duplicated, non-greedy and non-parallel chunks fail',()=>{
 const A23=base(h.a23());assert.equal(verify(A23,A23.ledger).status,'VERIFIED');
 const facts=(r,f)=>({...m.clone(r),payload:{...m.clone(r.payload),facts:f}});
 const resplit=(L,pred,k)=>{const i=m.at(L,pred),r=L.records[i],f=r.payload.facts;assert.ok(f.length>=2);L.records.splice(i,1,facts(r,f.slice(0,k)),facts(r,f.slice(k)));};
 const at160=r=>r.tick===160&&r.kind==='OBSERVATION';
 invalid(A35,L=>resplit(L,at160,2),'CHUNK_GROUP_INVALID');
 invalid(A35,L=>resplit(L,at160,m.where(L,at160).payload.facts.length),'CHUNK_GROUP_INVALID');
 invalid(A35,L=>{const z=m.where(L,r=>r.kind==='HORIZON');m.insertAfter(L,r=>r===z,{...m.clone(z),payload:{...m.clone(z.payload),arrived_visit_ids:[],released_visit_ids:[],unreleased_visit_ids:[]}});},'CHUNK_GROUP_INVALID');
 invalid(A35,L=>{const d=m.where(L,r=>r.kind==='POLICY_DECISION'&&r.payload.accepted);m.insertAfter(L,r=>r===d,m.clone(d));},'CHUNK_GROUP_INVALID');
 invalid(A23,L=>{const i=m.at(L,r=>r.kind==='OBSERVATION'&&r.chunk_count===2),[a,b]=[L.records[i],L.records[i+1]];
  assert.deepEqual([a.payload.facts.length,b.payload.facts.length],[64,10]);b.payload.facts.unshift(a.payload.facts.pop());},'CHUNK_GROUP_INVALID');
 invalid(A23,L=>{const i=m.at(L,r=>r.kind==='HORIZON'),z=L.records[i],p=z.payload;assert.ok(p.arrived_visit_ids.length&&p.released_visit_ids.length);
  L.records.splice(i,1,{...m.clone(z),payload:{...m.clone(p),released_visit_ids:[],unreleased_visit_ids:[]}},{...m.clone(z),payload:{...m.clone(p),arrived_visit_ids:[]}});},'CHUNK_GROUP_INVALID');
});
// ----- BYP-06-R1: every vector record with an entry fits the writer's measure (note 19), single-chunk groups included -----
const measured=r=>utf8Length(jcs({...r,chunk_count:100000,chunk_index:99999,seq:99999}));
test('BYP-06-R1: a byte-bound chunk one entry fuller than the writer emits is CHUNK_GROUP_INVALID (S200 with 32-character ids)',()=>{
 const raw=preset('S200').baseline;raw.visits.forEach((v,i)=>{v.id=`${String(i+1).padStart(3,'0')}-${'x'.repeat(28)}`;});
 const s=valid(raw),c={s,harness:null,ledger:h.run(s).ledger},R=c.ledger.records;
 assert.equal(verify(c,c.ledger).status,'VERIFIED');assert.ok(R.every(r=>!r.payload.changes?.length&&!r.payload.facts?.length||measured(r)<=16384));
 const fuller=k=>({...R[k],payload:{changes:[...R[k].payload.changes,R[k+1].payload.changes[0]]}});
 const i=R.findIndex((r,k)=>r.kind==='PROGRESS'&&r.chunk_index<r.chunk_count-1&&r.payload.changes.length<64&&utf8Length(jcs(fuller(k)))<=16384);
 assert.ok(i>0&&measured(fuller(i))>16384,'the real record still fits; only the writer measure crosses');
 invalid(c,L=>{const [a,b]=[L.records[i],L.records[i+1]];a.payload.changes.push(b.payload.changes.shift());if(!b.payload.changes.length)L.records.splice(i+1,1);},'CHUNK_GROUP_INVALID');
});
test('BYP-06-R1: one 64-fact record that fits 16,384 real bytes but not the writer measure is CHUNK_GROUP_INVALID; the writer split passes structure',()=>{
 const big=(i,n)=>({entity_id:`task:V1:${String(i).padStart(3,'0')}${'y'.repeat(96)}`.slice(0,96),field:'first_eligible_task_id',value:'v'.repeat(n)});
 const split=f=>{const w=createWriter(A35.ledger,guardLimits({})),ev=w.event(0,1,3,0);vec(ev,'OBSERVATION',[f],([x])=>({base_observation_seq:null,facts:x,state_digest:'0'.repeat(64)}));w.commit(ev);return w.records.map(r=>r.payload.facts);};
 const splice=parts=>L=>{const i=m.at(L,r=>r.tick===0&&r.kind==='OBSERVATION'),o=L.records[i];L.records.splice(i,1,...parts.map(f=>({...m.clone(o),payload:{...m.clone(o.payload),facts:f}})));};
 let hits=0;
 for(let n=90;n<=96;n++){
  const f=Array.from({length:64},(_,i)=>big(i,i===0?n:94)),parts=split(f),one=m.clone(A35.ledger);splice([f])(one);m.renumber(one);
  const r=one.records.find(x=>x.tick===0&&x.kind==='OBSERVATION');if(!(utf8Length(jcs(r))<=16384&&measured(r)>16384))continue;hits++;
  assert.deepEqual(parts.map(x=>x.length),[63,1]);
  invalid(A35,splice([f]),'CHUNK_GROUP_INVALID');
  const w=m.clone(A35.ledger);splice(parts)(w);m.renumber(w);assert.notEqual(verify(A35,w).primary_violation?.code,'CHUNK_GROUP_INVALID');
 }
 assert.ok(hits>0);
});
test('BYP-07: PAUSE records inside an accepted action group must be in ascending task-id order',()=>{
 const c=base(h.uploadCase({required:['sw-new'],installed:['sw-old'],objects:[h.object('sw-old','software',2*GB),h.object('sw-new','software',2*GB)]}));
 assert.equal(verify(c,c.ledger).status,'VERIFIED');
 invalid(c,L=>{const i=m.at(L,r=>r.kind==='TASK_TRANSITION'&&r.payload.transition==='PAUSE');assert.equal(L.records[i+1].payload.transition,'PAUSE');[L.records[i],L.records[i+1]]=[L.records[i+1],L.records[i]];},'RECORD_ORDER_INVALID');
});
// ----- ARITH-07: owned fraction per unit -----
test('ARITH-07: every port and position carries an exact owned_fraction over its enabled window; a disabled unit has none',()=>{
 const p=verify(A21,A21.ledger).projection,of=q=>Object.fromEntries([...q.resources.ports,...q.resources.positions].map(x=>[x.id,x.owned_fraction]));
 assert.deepEqual(of(p),{'port:DC1':'187/300','position:C1':'197/300','position:W1':'1/10'});
 const s=h.scenario({positions:[h.position('C1','charging'),h.position('C2','charging',false),h.position('W1','waiting')],ports:[h.port('DC1','C1'),h.port('DC2','C2')],workers:[h.worker('X01',h.ALL)],visits:[h.visit('V1',{due:3600,soc:20})]});
 const e=verifyDepotRun(s,h.run(s).ledger);assert.equal(e.status,'VERIFIED');const q=of(e.projection);
 assert.deepEqual([q['port:DC2'],q['position:C2']],[null,null]);assert.match(q['port:DC1'],/^[1-9][0-9]*\/[1-9][0-9]*$/);
 assert.equal(e.projection.metrics['resource.owned_fraction'],undefined,'A26 keeps metrics identical under id renaming');
});
test('ARITH-07: resources.owned_summary recomputes from the scenario and the ledger over installed, enabled and eligible unit-ticks',()=>{
 const gcd=(a,b)=>{while(b){[a,b]=[b,a%b];}return a;},frac=(a,b)=>{if(!b)return null;const k=gcd(BigInt(a),BigInt(b));return `${BigInt(a)/k}/${BigInt(b)/k}`;};
 const edit=(id,f)=>{const raw=preset(id).baseline;f(raw);return valid(raw);};
 const cases=[['B',valid(preset('B').baseline)],['P, DC01 disabled',edit('P',r=>{r.site.ports.find(p=>p.id==='DC01').enabled=false;})],
  ['B, position P020 disabled',edit('B',r=>{r.site.positions.find(p=>p.id==='P020').enabled=false;})],['S200',valid(preset('S200').baseline)]];
 for(const [what,s]of cases){
  const L=h.run(s).ledger,e=verifyDepotRun(s,L),H=s.horizon_tick,pos=new Map(s.site.positions.map(p=>[p.id,p]));assert.equal(e.status,'VERIFIED',what);
  const held=ref=>h.ownership(L.records,ref).reduce((n,[a,b])=>n+Math.min(b??H,H)-(a??0),0);
  const want=(units,eligible,ref)=>{const o={installed_unit_ticks:units.length*H,enabled_unit_ticks:units.filter(u=>u.enabled).length*H,eligible_unit_ticks:units.filter(eligible).length*H,owned_unit_ticks:units.reduce((n,u)=>n+held(ref(u)),0)};
   return {...o,fraction:{installed:frac(o.owned_unit_ticks,o.installed_unit_ticks),enabled:frac(o.owned_unit_ticks,o.enabled_unit_ticks),eligible:frac(o.owned_unit_ticks,o.eligible_unit_ticks)}};};
  const got=e.projection.resources.owned_summary;
  assert.deepEqual(got,{ports:want(s.site.ports,p=>p.enabled&&pos.get(p.position_id).enabled,p=>`port:${p.id}`),positions:want(s.site.positions,p=>p.enabled,p=>`position:${p.id}`)},what);
  if(what.includes('P020'))assert.ok(got.ports.eligible_unit_ticks<got.ports.enabled_unit_ticks,'an enabled port on an out-of-service position is not eligible');
  if(what.includes('DC01'))assert.ok(got.ports.enabled_unit_ticks<got.ports.installed_unit_ticks);
 }
});
// ----- BND-03 / COPY-01 / DL-RT-02: a shared preset name is kept only on that preset's exact arms -----
test('BND-03: an imported or shared preset name stays only when both arms equal that preset; otherwise it is your own setup',()=>{
 const session=()=>createDepotSession({workerFactory:()=>({postMessage(){},terminate(){}}),codec});
 const names=x=>[x.get().preset,x.get().presentation.preset];
 const exact=session();exact.selectPreset('P');const q=session();q.importText(exact.exportText().text);assert.deepEqual(names(q),['P','P']);
 const one=session();one.selectPreset('S200');const r=session();r.importText(one.exportText().text);assert.deepEqual(names(r),['S200','S200']);
 const edited=session();edited.selectPreset('B');edited.edit(x=>{x.requirements.energy.target_soc_pct=90;},{scope:'both'});
 const file=edited.exportText();assert.ok(file.ok);assert.equal(JSON.parse(file.text).presentation.preset,'B');
 const b=session();b.importText(file.text);assert.deepEqual(names(b),[null,null]);
 const g=preset('G'),crafted=codec.buildConfigurationExport({arms:{baseline:valid(g.baseline),candidate:valid(g.candidate)},presentation:{preset:'B'}});assert.ok(crafted.ok);
 const c=session();c.importText(crafted.text);assert.deepEqual(names(c),[null,null]);
 const raw=preset('B').baseline;raw.site.supply_w=1000000;const link=codec.encodeShare({arms:{baseline:valid(raw),candidate:null},presentation:{preset:'P'}});assert.ok(link.ok);
 const l=session();l.openFragment(link.fragment);assert.deepEqual(names(l),[null,null]);
 const half=codec.buildConfigurationExport({arms:{baseline:valid(preset('B').baseline),candidate:null},presentation:{preset:'B'}});
 const hb=session();hb.importText(half.text);assert.deepEqual(names(hb),[null,null],'a baseline-only copy of a pair preset is not that preset');
});

test('NP-1: an INCOMPLETE prefix whose cut tick omits a phase-0 completion below a later recorded one is MISSING_COMPLETION',()=>{
 const s=validateScenario(preset('B').baseline,{origin:'import'}).scenario,I=h.run(s,{guardOverrides:{maxRecords:92}}),t=I.ledger.records.at(-1).tick;
 assert.equal(I.guard.guard,'RECORD_COUNT');
 assert.equal(verifyDepotRun(s,m.clone(I.ledger),{claimedGuard:I.guard,allowLoweredGuards:true}).status,'INCOMPLETE_RESOURCE_LIMIT');
 const L=m.clone(I.ledger),i=L.records.findIndex(r=>r.tick===t&&m.task('task:01:to_charging','COMPLETE')(r));assert.ok(i>=0);
 assert.ok(L.records.some((r,k)=>k>i&&r.tick===t&&m.task('task:02:intake','COMPLETE')(r)),'a later same-tick completion follows');
 let j=i+1;while(L.records[j].tick===t&&L.records[j].phase===0&&['RESOURCE_DELTA','CONTENT_TRANSITION'].includes(L.records[j].kind))j++;
 L.records.splice(i,j-i);m.renumber(L);
 for(const claimedGuard of [I.guard,{guard:'RECORD_COUNT',detail:{records:100001,bound:100000}}]){
  const e=verifyDepotRun(s,m.clone(L),{claimedGuard,allowLoweredGuards:true});
  assert.equal(e.status,'INVALID');assert.equal(e.primary_violation.code,'MISSING_COMPLETION');assert.equal(e.primary_violation.tick,t);
 }
});

test('FDR2-01: a null or non-object last record under a sub-quantum claim returns TERMINAL_STATUS_MISMATCH, never throws',()=>{
 const sq=h.anchorCase('change',3),r=h.run(sq.s,{harness:sq.harness});assert.equal(r.guard.guard,'SUB_QUANTUM_POSITIVE_SHARE');
 for(const last of [null,7,[],'x',{}]){
  const L=m.clone(r.ledger);L.records.push(last);
  const e=verifyDepotRun(sq.s,L,{harness:sq.harness,claimedGuard:r.guard});
  assert.equal(e.status==='INVALID'?e.primary_violation.code:e.status,'TERMINAL_STATUS_MISMATCH',JSON.stringify(last));
 }
});

test('FDR2-02: a completion owed exactly at H is MISSING_COMPLETION before the horizon digest, which restates the observations',()=>{
 const c=base(h.a21({H:2064}));assert.equal(verify(c,m.clone(c.ledger)).status,'VERIFIED');
 const e=invalid(c,L=>m.remove(L,m.task('task:V1:charge','COMPLETE')),'MISSING_COMPLETION');assert.equal(e.primary_violation.tick,2064);
});
