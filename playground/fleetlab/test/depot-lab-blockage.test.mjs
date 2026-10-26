// Supported-resource blockage (annex C3) and A40's synthetic closed-subset, stall, terminal and escape graphs, with
// continued all-arrivals horizon accounting (C1.5, C4 A40). The graphs are verifier-only constructions, not public runs.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import * as m from './helpers/depot-lab-mutate.mjs';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
import {classifyBlockage,verifyCertificates,checkHorizonAccounting} from '../src/model/depot-lab-verify/blockage.js';
import {preset} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
const V3={id:'V003',owns:['R099'],alternatives:null};
const graph=({v1=[{task:'T1',units:['R002']}],v2=[{task:'T2',units:['R001']}],events=[]}={})=>({t:0,H:1800,events:[{key:'000300:00:V003',tick:300,visit:'V003',releases:['R099']},...events],
 visits:[{id:'V001',owns:['R001'],alternatives:v1},{id:'V002',owns:['R002'],alternatives:v2},V3]});
const DEADLOCK={classification:'DEADLOCK_DECLARED',member_visit_ids:['V001','V002'],held_resource_ids:['R001','R002'],
 unmet_alternatives:[{visit_id:'V001',task_id:'T1',units:['R002']},{visit_id:'V002',task_id:'T2',units:['R001']}],terminal_holder_id:null};
test('A40 closed subset: exactly [V001,V002] holding [R001,R002]; the V003 event is not a stall',()=>{
 assert.deepEqual(classifyBlockage(graph()),[DEADLOCK]);
 assert.deepEqual(verifyCertificates(graph(),[DEADLOCK]).ok,true);
});
test('A40 stall: a relevant release at 120 is STALL, and declaring deadlock first is premature',()=>{
 const g=graph({events:[{key:'000120:00:V002:T2b',tick:120,visit:'V002',releases:['R002']}]});
 assert.deepEqual(classifyBlockage(g),[{classification:'STALL',member_visit_ids:['V001','V002'],enabling_event_key:'000120:00:V002:T2b',next_tick:120}]);
 assert.equal(verifyCertificates(g,[DEADLOCK]).code,'PREMATURE_DEADLOCK_DURING_ACTIVE_STALL');
});
test('A40 terminal: V002 holds R002 for an unattended task ending at 2,000 > H; V001 is blocked behind it',()=>{
 const g=graph({v2:null,events:[{key:'002000:00:V002:abstract',tick:2000,visit:'V002',releases:['R002']}]});
 assert.deepEqual(classifyBlockage(g),[{classification:'TERMINAL_BLOCKAGE_BEFORE_H',member_visit_ids:['V001'],terminal_holder_id:'V002',lower_bound_tick:2000}]);
 assert.equal(verifyCertificates(g,[DEADLOCK]).code,'UNPROVEN_DEADLOCK');
});
test('A40 escape: a free admissible alternative R003 leaves no certificate; absence alone never seeds closure',()=>{
 const g=graph({v1:[{task:'T1',units:['R002']},{task:'T1b',units:['R003']}]});
 assert.deepEqual(classifyBlockage(g),[]);
 assert.equal(verifyCertificates(g,[DEADLOCK]).code,'UNPROVEN_DEADLOCK');
 assert.deepEqual(classifyBlockage(graph({v1:[],v2:[]})),[]);
 // A cycle with an outside alternative is pruned: V001 stalls on V003's release; V002 waits behind a progressing holder.
 const out=graph({v1:[{task:'T1',units:['R002']},{task:'T1c',units:['R099']}]});
 assert.deepEqual(classifyBlockage(out),[{classification:'STALL',member_visit_ids:['V001'],enabling_event_key:'000300:00:V003',next_tick:300}]);
 // Without that release nobody progresses before H: terminal blockage behind each holder, still never deadlock.
 assert.deepEqual(classifyBlockage({...out,events:[]}).map(c=>[c.classification,c.member_visit_ids[0],c.terminal_holder_id]),[['TERMINAL_BLOCKAGE_BEFORE_H','V001','V002'],['TERMINAL_BLOCKAGE_BEFORE_H','V002','V001']]);
});
test('A40 accounting: V003 continues to release at 1,300; three arrived, one released, two unreleased, 4,900 s',()=>{
 const visits=[{id:'V001',arrival_tick:0,released_at:null},{id:'V002',arrival_tick:0,released_at:null},{id:'V003',arrival_tick:0,released_at:1300}];
 const claim={tick:1800,arrived_visit_ids:['V001','V002','V003'],released_visit_ids:['V003'],unreleased_visit_ids:['V001','V002']};
 const r=checkHorizonAccounting({horizon_tick:1800,visits,claim});
 assert.deepEqual([r.ok,r.arrived.length,r.released,r.unreleased,r.observed_s],[true,3,['V003'],['V001','V002'],4900]);
 for(const bad of [{...claim,tick:0},{...claim,released_visit_ids:[],unreleased_visit_ids:['V001','V002']},{...claim,arrived_visit_ids:['V001','V002']},null])
  assert.equal(checkHorizonAccounting({horizon_tick:1800,visits,claim:bad}).code,'INCOMPLETE_HORIZON_ACCOUNTING');
});
test('main path: a ledger stopping before H or omitting a release is INCOMPLETE_HORIZON_ACCOUNTING',()=>{
 const c=h.a35(),L=h.run(c.s,{harness:c.harness}).ledger;
 const stop=m.clone(L);stop.records=stop.records.filter(r=>r.tick===0);
 const e=verifyDepotRun(c.s,m.renumber(stop),{harness:c.harness});assert.deepEqual([e.status,e.primary_violation.code],['INVALID','INCOMPLETE_HORIZON_ACCOUNTING']);
 const omit=m.clone(L),hz=m.where(omit,r=>r.kind==='HORIZON');hz.payload.released_visit_ids=[];hz.payload.unreleased_visit_ids=['visit:V1'];
 const f=verifyDepotRun(c.s,m.renumber(omit),{harness:c.harness});assert.deepEqual([f.status,f.primary_violation.code,f.projection],['INVALID','INCOMPLETE_HORIZON_ACCOUNTING',null]);
});
test('public forward route: horizon waits on held units are terminal blockage, and a claimed deadlock is unproven',()=>{
 const s=validateScenario(preset('M').candidate,{origin:'editor'}).scenario,L=h.run(s).ledger,e=verifyDepotRun(s,L);
 assert.equal(e.status,'VERIFIED');assert.ok(e.projection.blockage.length>0);
 assert.ok(e.projection.blockage.every(b=>b.classification==='TERMINAL_BLOCKAGE_BEFORE_H'&&b.member_visit_ids.length===1&&b.terminal_holder_id));
 const bad=m.clone(L),b=m.where(bad,r=>r.kind==='BLOCKAGE');b.payload.classification='DEADLOCK_DECLARED';b.payload.terminal_holder_id=null;
 const f=verifyDepotRun(s,m.renumber(bad));assert.deepEqual([f.status,f.primary_violation.code],['INVALID','UNPROVEN_DEADLOCK']);
 const gone=m.clone(L);m.remove(gone,r=>r.kind==='BLOCKAGE');
 assert.equal(verifyDepotRun(s,m.renumber(gone)).primary_violation.code,'BLOCKAGE_MISMATCH');
});
