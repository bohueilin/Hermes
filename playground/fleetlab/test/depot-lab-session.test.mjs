// Session controller: explicit runs on fresh workers, terminate-to-cancel, A42 stale isolation and inbound checks.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDepotSession,MAX_REPLY_BYTES} from '../src/runtime/depot-lab-session.js';
import {runDepotJob} from '../src/runtime/depot-lab-job.js';
import {compareDepotRuns,VERIFICATION_SCHEMA} from '../src/model/depot-lab/compare.js';
import {scenarioDigest,workloadDigest,policyDigest,H} from '../src/model/depot-lab/identity.js';
import {jcs} from '../src/model/depot-lab/canonical.js';
import {ENGINE_VERSION,VERIFIER_VERSION,PROJECTION_VERSION,METRIC_VERSION} from '../src/model/depot-lab/profiles.js';
import * as codec from '../src/ui/depot-lab-share.js';
const V=(on,over)=>[{id:'on_time_count',direction:'up',value:on},{id:'overdue_seconds',direction:'down',value:over},{id:'observed_visit_seconds',direction:'down',value:900},{id:'unreleased_count',direction:'down',value:0},{id:'remaining_reference_seconds:inspection',direction:'down',value:'0/1'},{id:'remaining_required_kWh',direction:'down',value:0},{id:'remaining_required_bytes',direction:'down',value:0}];
// Fake model functions with the engine/verifier API of the engineering note; outcomes depend only on the scenario.
function fakeModel(log={starts:0}){
 return {
  createDepotRun(s){log.starts++;return {s,t:0};},
  stepDepotRun(c){if(c.t<c.s.horizon_tick){c.t=Math.min(c.s.horizon_tick,c.t+10000);return {done:false,tick:c.t,records:[]};}return {done:true,ledger:{schema:'fleetlab.depot.ledger.v1',scenario_digest:scenarioDigest(c.s),records:[]},terminal_status:'COMPLETE',guard:null};},
  verifyDepotRun(s,ledger){const d=scenarioDigest(s),ports=s.site.ports.length;return {schema:VERIFICATION_SCHEMA,status:'VERIFIED',consistency:'INTERNALLY_CONSISTENT',primary_violation:null,
   digests:{scenario:d,workload:workloadDigest(s),policy:policyDigest(),run:H('fleetlab.test.run.v1',{scenario_digest:d,ledger})},
   versions:{engine:ENGINE_VERSION,verifier:VERIFIER_VERSION,projection:PROJECTION_VERSION,metric:METRIC_VERSION},
   trust:{authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',deployment_permission:'NONE',evidence:'NOT_EVIDENCE'},
   ledger:{records:0,bytes:jcs(ledger).length,terminal_status:'COMPLETE',guard:null},
   projection:{version:PROJECTION_VERSION,horizon_tick:s.horizon_tick,target_soc_pct:s.requirements.energy.target_soc_pct,metrics:{'release.on_time_count':ports},vector:{classes:['inspection'],components:V(ports,100-ports)}}};},
  compareDepotRuns,
 };
}
function harness(options={}){
 const workers=[],changes=[];
 const workerFactory=()=>{const w={posted:[],terminated:false,postMessage(m){this.posted.push(m);},terminate(){this.terminated=true;}};workers.push(w);return w;};
 const session=createDepotSession({workerFactory,onChange:s=>changes.push(s),codec,...options});
 const deliver=(w,data)=>w.onmessage({data});
 const answer=(w,model=fakeModel())=>{const progress=[];const reply=runDepotJob(w.posted[0],{...model,onProgress:m=>progress.push(m)});return {reply,progress};};
 const finish=w=>{const {reply,progress}=answer(w);for(const m of progress)deliver(w,m);deliver(w,reply);return reply;};
 return {session,workers,changes,deliver,answer,finish};
}
const target=pct=>s=>{s.requirements.energy.target_soc_pct=pct;};
const frozenDeep=v=>!v||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(frozenDeep);

test('entry, presets, edits, presentation, export, share and import never start a model',()=>{
 const h=harness(),s=h.session;
 s.selectPreset('B');s.edit(target(90),{scope:'both'});s.setPresentation({reading_level:'technical',cursor:120,selection:'visit:01'});
 const file=s.exportText();assert.ok(file.ok);
 assert.equal(s.shareFragment().ok,false);
 s.importText(file.text);s.selectPreset('D');s.edit(x=>{x.network.pool_bytes_per_tick=600*125000;},{scope:'candidate'});
 assert.equal(h.workers.length,0);assert.equal(s.get().status,'draft');assert.equal(s.get().pending,null);
});

test('a baseline run uses one fresh worker, a bound request, honest progress and a deep-frozen verified result',()=>{
 const h=harness(),s=h.session;s.run('baseline');
 assert.equal(h.workers.length,1);const w=h.workers[0],req=w.posted[0];
 assert.deepEqual(Object.keys(req),['type','id','generation','arms']);assert.equal(req.generation,1);assert.equal(req.arms.candidate,null);
 assert.equal(s.get().status,'running');
 const {reply,progress}=h.answer(w);
 for(const m of progress){h.deliver(w,m);assert.equal(s.get().status,'running');assert.equal(s.get().result,null);}
 assert.deepEqual(progress.map(m=>m.stage).filter((x,i,a)=>a.indexOf(x)===i),['checking_setup','running_baseline','checking_results']);
 h.deliver(w,reply);
 const st=s.get();assert.equal(st.status,'verified');assert.equal(st.result.scenario_digests.baseline,st.digests.baseline);assert.equal(st.result.comparison,null);
 assert.ok(w.terminated);assert.ok(frozenDeep(st.result));assert.ok(frozenDeep(st));assert.equal(st.pending,null);
});

test('a pair run attaches the comparison and keeps both verified traces',()=>{
 const h=harness({preset:'B'}),s=h.session;s.run('pair');h.finish(h.workers[0]);
 const r=s.get().result;assert.equal(s.get().status,'verified');
 assert.equal(r.comparison.classification,'improvement');assert.equal(r.comparison.treatment.fields.length,2);
 assert.equal(typeof r.ledger_texts.baseline,'string');assert.equal(typeof r.ledger_texts.candidate,'string');
});

test('A42: a delayed generation-1 result never attaches to the edited draft; a fresh run binds normally',()=>{
 const h=harness({preset:'B'}),s=h.session,DA=s.get().digests;
 assert.equal(s.get().generation,1);s.run('pair');
 const w1=h.workers[0],old=h.answer(w1).reply;
 assert.equal(old.generation,1);assert.deepEqual(old.scenario_digests,DA);
 s.edit(target(90),{scope:'both'});
 const DB=s.get().digests;assert.equal(s.get().generation,2);assert.notEqual(DB.baseline,DA.baseline);assert.notEqual(DB.candidate,DA.candidate);
 assert.equal(s.get().result,null);
 // Negative mutation: the old result relabelled with the current generation is refused too.
 const before=s.get();h.deliver(w1,{...old,generation:2});assert.equal(s.get(),before);
 h.deliver(w1,old);
 const st=s.get();assert.deepEqual(st.digests,DB);assert.equal(st.result,null);assert.equal(st.status,'stale');
 assert.equal(st.history.length,1);assert.equal(st.history[0].label,'stale');assert.equal(st.history[0].generation,1);assert.deepEqual(st.history[0].scenario_digests,DA);
 s.run('pair');const w2=h.workers[1];assert.equal(w2.posted[0].generation,2);
 const b4=s.get();h.deliver(w2,{...old,id:w2.posted[0].id,generation:2});assert.equal(s.get(),b4);
 h.finish(w2);assert.equal(s.get().status,'verified');assert.deepEqual(s.get().result.scenario_digests,DB);
});

test('A42 edit-back: 80 to 90 to 80 gives generation 3 with digest D_A and the old result still cannot attach',()=>{
 const h=harness({preset:'B'}),s=h.session,DA=s.get().digests;s.run('pair');
 const w1=h.workers[0],old=h.answer(w1).reply;
 s.edit(target(90),{scope:'both'});s.edit(target(80),{scope:'both'});
 assert.equal(s.get().generation,3);assert.deepEqual(s.get().digests,DA);
 h.deliver(w1,old);
 assert.equal(s.get().result,null);assert.notEqual(s.get().status,'verified');
 s.run('pair');const w2=h.workers[1];assert.equal(w2.posted[0].generation,3);assert.ok(w1.terminated);
 h.deliver(w1,old);assert.equal(s.get().status,'running');
 h.finish(w2);assert.equal(s.get().status,'verified');assert.deepEqual(s.get().result.scenario_digests,DA);assert.equal(s.get().result.generation,3);
});

test('cancel is immediate, leaves no partial result, and late messages after cancel change nothing',()=>{
 const h=harness({preset:'B'}),s=h.session;s.run('pair');
 const w=h.workers[0],{reply,progress}=h.answer(w);h.deliver(w,progress[0]);h.deliver(w,progress[1]);
 s.cancel();
 assert.ok(w.terminated);const st=s.get();
 assert.equal(st.status,'cancelled');assert.equal(st.result,null);assert.equal(st.progress,null);assert.equal(st.pending,null);
 const n=h.changes.length;for(const m of [...progress,reply])h.deliver(w,m);
 assert.equal(s.get(),st);assert.equal(h.changes.length,n);
});

test('forged, malformed, oversized, wrong-id and wrong-type messages are rejected without any state change',()=>{
 const h=harness(),s=h.session;s.run('baseline');s.cancel();s.run('baseline');
 const stale=h.workers[0],w=h.workers[1],{reply}=h.answer(w),env=reply.envelopes.baseline;
 const before=s.get(),n=h.changes.length;
 const bad=[null,'result',42,[],{},
  {...reply,id:'depot-run-999'},{...reply,type:'done'},{...reply,extra:1},{...reply,generation:2},
  {...reply,scenario_digests:{baseline:'0'.repeat(64),candidate:null}},
  {...reply,envelopes:{baseline:{...env,ledger:{...env.ledger,bytes:1.5}},candidate:null}},
  {...reply,envelopes:{baseline:{...env,projection:null},candidate:null}},
  {...reply,envelopes:{baseline:{...env,trust:{...env.trust,authenticity:'AUTHENTICATED'}},candidate:null}},
  {...reply,envelopes:{baseline:{...env,schema:'fleetlab.depot.verification.v0'},candidate:null}},
  {...reply,envelopes:{baseline:{...env,status:'PASSED'},candidate:null}},
  {...reply,comparison:{schema:'fleetlab.depot.comparison.v1',classification:'tie',components:[],digest:null}},
  {...reply,ledger_texts:{baseline:'a'.repeat(MAX_REPLY_BYTES+1),candidate:null}},
  {...reply,ledger_texts:{baseline:null,candidate:null}},
  {type:'refused',id:reply.id,generation:1,reason:'invalid_setup',issues:Array.from({length:201},()=>({code:'X',path:'',value:null,bound:null}))},
  {type:'refused',id:reply.id,generation:1,reason:'x'.repeat(65),issues:[]},
  {type:'progress',id:reply.id,generation:1,stage:'running_everything',done:0,total:1},
  {type:'progress',id:reply.id,generation:1,stage:'running_baseline',done:2,total:1},
  {type:'failed',id:reply.id,generation:1,stage:'running_baseline',message:'m'.repeat(501)},
 ];
 for(const m of bad){h.deliver(w,m);assert.equal(s.get(),before,JSON.stringify(m)?.slice(0,120));}
 h.deliver(stale,{...reply});assert.equal(s.get(),before);
 assert.equal(h.changes.length,n);
 h.deliver(w,reply);assert.equal(s.get().status,'verified');
});

test('refusals before a run start zero workers: no candidate, incompatible one-arm target, invalid setup',()=>{
 const h=harness(),s=h.session;
 s.run('pair');assert.equal(s.get().status,'refused');assert.equal(s.get().refusal.code,'NO_CANDIDATE');
 s.edit(target(90),{scope:'candidate'});assert.equal(s.get().compatibility.compatible,false);
 s.run('pair');assert.equal(s.get().status,'incompatible');assert.equal(s.get().refusal.issues[0].path,'/requirements/energy/target_soc_pct');
 s.edit(x=>{x.site.lane_count=-1;},{scope:'both'});s.run('baseline');assert.equal(s.get().status,'refused');assert.equal(s.get().refusal.code,'INVALID_SETUP');
 assert.equal(h.workers.length,0);
});

test('job refusals, worker failure and dispose are reported without a result',()=>{
 const h=harness(),s=h.session;s.run('baseline');const w=h.workers[0],id=w.posted[0].id;
 h.deliver(w,{type:'refused',id,generation:1,reason:'invalid_setup',issues:[{code:'RANGE',path:'/horizon_tick',value:0,bound:[1,172800]}]});
 assert.equal(s.get().status,'refused');assert.equal(s.get().result,null);assert.ok(w.terminated);
 s.run('baseline');const w2=h.workers[1];w2.onerror();assert.equal(s.get().status,'failed');assert.ok(w2.terminated);
 s.run('baseline');const w3=h.workers[2];s.dispose();assert.ok(w3.terminated);
 const st=s.get();h.finish(w3);s.run('baseline');s.edit(target(90));assert.equal(s.get(),st);assert.equal(h.workers.length,3);
});

test('a superseding run terminates the previous worker; edits since the last run are counted',()=>{
 const h=harness(),s=h.session;s.edit(target(90));s.edit(target(70));assert.equal(s.get().edits_since_run,2);
 s.run('baseline');assert.equal(s.get().edits_since_run,0);s.run('baseline');
 assert.equal(h.workers.length,2);assert.ok(h.workers[0].terminated);assert.ok(!h.workers[1].terminated);
 h.finish(h.workers[0]);assert.equal(s.get().status,'running');h.finish(h.workers[1]);assert.equal(s.get().status,'verified');
 s.edit(target(80));assert.equal(s.get().status,'stale');assert.equal(s.get().history.length,1);assert.equal(s.get().edits_since_run,1);
});

test('the session keeps no browser persistence',()=>{
 const src=readFileSync(new URL('../src/runtime/depot-lab-session.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/localStorage|sessionStorage|indexedDB|document\.cookie|caches\b/);
});

test('job: shape-checks the request first, reports engine failure and a stalled engine, and verifies a fresh parse',()=>{
 for(const bad of [null,{type:'run'},{type:'run',id:'a b',generation:1,arms:{baseline:'{}',candidate:null}},{type:'run',id:'r',generation:0,arms:{baseline:'{}',candidate:null}},{type:'run',id:'r',generation:1,arms:{baseline:{},candidate:null}},{type:'run',id:'r',generation:1,arms:{baseline:'{}',candidate:null},extra:1}]){
  const r=runDepotJob(bad,fakeModel());assert.equal(r.type,'refused');assert.equal(r.reason,'invalid_request');assert.equal(r.id,null);
 }
 const h=harness();h.session.run('baseline');const req=h.workers[0].posted[0];
 const log={starts:0},boom=runDepotJob(req,{...fakeModel(log),stepDepotRun:()=>{throw new Error('guard');}});
 assert.deepEqual([boom.type,boom.stage,boom.message,log.starts],['failed','running_baseline','guard',1]);
 const stuck=runDepotJob(req,{...fakeModel(),stepDepotRun:()=>({done:false,tick:0,records:[]})});assert.equal(stuck.type,'failed');
 let seen=null;const m=fakeModel(),ok=runDepotJob(req,{...m,stepDepotRun:c=>({done:true,ledger:{schema:'fleetlab.depot.ledger.v1',scenario_digest:scenarioDigest(c.s),records:[]}}),verifyDepotRun:(s,ledger)=>{seen=ledger;return m.verifyDepotRun(s,ledger);}});
 assert.equal(ok.type,'result');assert.equal(jcs(seen),ok.ledger_texts.baseline);assert.ok(!Object.isFrozen(seen));
 assert.equal(runDepotJob(req,{...fakeModel(),stepDepotRun:()=>({done:true,ledger:{x:0.5}})}).type,'failed');
});

// SS-NEW-04: an import keeps a preset name by comparing the codec's scenario digests with that preset's memoized
// digests; it no longer revalidates and serializes the preset on every open.
test('SS-NEW-04: the preset label follows the codec scenario digests, with the arms digested only when none are given',()=>{
 const make=c=>createDepotSession({workerFactory:()=>({postMessage(){},terminate(){}}),codec:c});
 const src=make(codec);src.selectPreset('S200');const text=src.exportText().text;
 const via=f=>{const s=make({...codec,decodeShareText:t=>f(codec.decodeShareText(t))});s.importText(text);return [s.get().preset,s.get().presentation.preset];};
 assert.deepEqual(via(r=>r),['S200','S200']);
 assert.deepEqual(via(r=>({...r,digests:{baseline:'0'.repeat(64),candidate:null}})),[null,null],'the label uses the digests the codec computed');
 assert.deepEqual(via(r=>{const {digests,...rest}=r;return rest;}),['S200','S200'],'without codec digests the arms are digested');
});
