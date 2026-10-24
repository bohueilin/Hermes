// Runtime integration (reconciliation 11.5 Task 7) with the real engine and verifier: runDepotJob on the B pair and the
// S200 baseline, the session end to end with a fake worker that runs the job synchronously, and the worker module
// under a simulated WorkerGlobalScope.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runDepotJob,JOB_STAGES} from '../src/runtime/depot-lab-job.js';
import {createDepotSession} from '../src/runtime/depot-lab-session.js';
import {createDepotRun,stepDepotRun} from '../src/model/depot-lab/engine.js';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
import {checkPairCompatibility,compareDepotRuns} from '../src/model/depot-lab/compare.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {scenarioDigest,runDigest,DIGEST} from '../src/model/depot-lab/identity.js';
import {ENGINE_VERSION,VERIFIER_VERSION} from '../src/model/depot-lab/profiles.js';
import {jcs} from '../src/model/depot-lab/canonical.js';
import {preset} from '../src/model/depot-lab/presets.js';
import * as codec from '../src/ui/depot-lab-share.js';
const MODEL=Object.freeze({createDepotRun,stepDepotRun,verifyDepotRun,compareDepotRuns});
const valid=raw=>{const v=validateScenario(raw,{origin:'editor'});assert.ok(v.ok);return v.scenario;};
const request=(id,baseline,candidate=null)=>({type:'run',id,generation:1,arms:{baseline:jcs(valid(baseline)),candidate:candidate===null?null:jcs(valid(candidate))}});
const stagesOf=progress=>progress.map(m=>m.stage).filter((x,i,a)=>a.indexOf(x)===i);
function job(req){const progress=[],reply=runDepotJob(req,{...MODEL,onProgress:m=>progress.push(m)});return {reply,progress};}
// The envelope binds the run digest of exactly the returned canonical ledger text.
function boundEnvelope(env,text,scenario){
 assert.equal(env.status,'VERIFIED',JSON.stringify(env.primary_violation));assert.equal(env.consistency,'INTERNALLY_CONSISTENT');
 assert.equal(env.digests.scenario,scenarioDigest(scenario));assert.equal(jcs(JSON.parse(text)),text,'the ledger text is canonical');
 assert.equal(env.digests.run,runDigest({scenario_digest:env.digests.scenario,engine_version:ENGINE_VERSION,verifier_version:VERIFIER_VERSION,ledger:JSON.parse(text)}));
 assert.equal(env.ledger.terminal_status,'COMPLETE');assert.equal(env.ledger.bytes,new TextEncoder().encode(text).length);
}
let B_PAIR=null;
test('job: the real B pair gives two VERIFIED envelopes bound to their ledgers and a digest-bound comparison',()=>{
 const p=preset('B'),{reply,progress}=job(request('it-b',p.baseline,p.candidate));
 assert.equal(reply.type,'result');assert.deepEqual(Object.keys(reply),['type','id','generation','scenario_digests','envelopes','comparison','ledger_texts']);
 assert.deepEqual(stagesOf(progress),JOB_STAGES);
 assert.ok(progress.every(m=>m.id==='it-b'&&m.generation===1&&Number.isSafeInteger(m.done)&&m.done>=0&&m.done<=m.total));
 for(const arm of ['baseline','candidate']){const s=valid(p[arm]);assert.equal(reply.scenario_digests[arm],scenarioDigest(s));boundEnvelope(reply.envelopes[arm],reply.ledger_texts[arm],s);}
 const c=reply.comparison;
 assert.ok(['improvement','worse','tie','mixed'].includes(c.classification));assert.match(c.digest,DIGEST);
 assert.equal(c.treatment.intervention_count,1);assert.equal(c.treatment.fields.length,2);
 // An independent second computation reproduces the comparison exactly.
 const t=checkPairCompatibility(valid(p.baseline),valid(p.candidate)).treatment;
 assert.deepEqual(compareDepotRuns(reply.envelopes.baseline,reply.envelopes.candidate,t),c);
 assert.deepEqual(structuredClone(reply),reply,'the reply survives structured cloning');
 B_PAIR=reply;
});
test('job: the real S200 baseline verifies within the 156 physical-release ceiling',t=>{
 const {reply,progress}=job(request('it-s200',preset('S200').baseline));
 assert.equal(reply.type,'result');assert.equal(reply.comparison,null);assert.equal(reply.envelopes.candidate,null);assert.equal(reply.ledger_texts.candidate,null);
 boundEnvelope(reply.envelopes.baseline,reply.ledger_texts.baseline,valid(preset('S200').baseline));
 assert.deepEqual(stagesOf(progress),['checking_setup','running_baseline','checking_results']);
 const running=progress.filter(m=>m.stage==='running_baseline').map(m=>m.done);
 assert.ok(running.every((x,i)=>i===0||x>=running[i-1]),'engine progress never goes backwards');
 const m=reply.envelopes.baseline.projection.metrics;
 assert.equal(m['release.released_count']+m['release.unreleased_count'],200);assert.ok(m['release.released_count']<=156);
 t.diagnostic(JSON.stringify({released:m['release.released_count'],records:reply.envelopes.baseline.ledger.records,bytes:reply.envelopes.baseline.ledger.bytes,progress_messages:progress.length}));
});
// Fake worker: the real job runs synchronously on flush(); a terminated worker delivers nothing unless `zombie`.
function workers(){
 const made=[];
 const factory=()=>{
  const w={posted:[],terminated:false,
   postMessage(m){this.posted.push(m);},
   terminate(){this.terminated=true;},
   flush({zombie=false}={}){const out=[],reply=runDepotJob(this.posted[0],{...MODEL,onProgress:m=>out.push(m)});out.push(reply);for(const m of out)if(zombie||!this.terminated)this.onmessage({data:m});return reply;}};
  made.push(w);return w;
 };
 return {made,factory};
}
const target=pct=>s=>{s.requirements.energy.target_soc_pct=pct;};
test('session: a pair run on the real model verifies, binds the draft digests and terminates its worker',()=>{
 const W=workers(),s=createDepotSession({workerFactory:W.factory,codec,preset:'B'});
 s.run('pair');assert.equal(s.get().status,'running');assert.equal(W.made.length,1);
 W.made[0].flush();
 const st=s.get();assert.equal(st.status,'verified');assert.ok(W.made[0].terminated);
 assert.deepEqual(st.result.scenario_digests,st.digests);
 assert.equal(st.result.envelopes.baseline.status,'VERIFIED');assert.equal(st.result.envelopes.candidate.status,'VERIFIED');
 if(B_PAIR){assert.equal(st.result.comparison.digest,B_PAIR.comparison.digest);assert.equal(st.result.envelopes.candidate.digests.run,B_PAIR.envelopes.candidate.digests.run);}
 assert.ok(Object.isFrozen(st.result.envelopes.baseline.projection.visits[0]));
});
test('session: cancel terminates the worker at once; its late messages change nothing',()=>{
 const W=workers(),s=createDepotSession({workerFactory:W.factory,codec,preset:'B'});
 s.run('pair');s.cancel();
 const st=s.get();assert.equal(st.status,'cancelled');assert.ok(W.made[0].terminated);assert.equal(st.result,null);assert.equal(st.pending,null);
 W.made[0].flush({zombie:true});assert.equal(s.get(),st,'a late result after cancel is ignored');
});
test('session: an edit while the run is pending marks it stale; the late result goes to history only; a new run binds the edit',()=>{
 const W=workers(),s=createDepotSession({workerFactory:W.factory,codec,preset:'B'});
 s.run('pair');const before=s.get().digests;
 s.edit(target(90),{scope:'both'});
 const edited=s.get();assert.equal(edited.generation,2);assert.notEqual(edited.digests.baseline,before.baseline);
 W.made[0].flush();
 const st=s.get();assert.equal(st.status,'stale');assert.equal(st.result,null);assert.deepEqual(st.digests,edited.digests);
 assert.equal(st.history.at(-1).label,'stale');assert.equal(st.history.at(-1).generation,1);assert.deepEqual(st.history.at(-1).scenario_digests,before);
 assert.equal(st.history.at(-1).envelopes.baseline.status,'VERIFIED');
 s.run('pair');W.made[1].flush();
 const now=s.get();assert.equal(now.status,'verified');assert.equal(now.result.generation,2);
 assert.equal(now.result.envelopes.baseline.projection.target_soc_pct,90);assert.equal(now.result.envelopes.candidate.projection.target_soc_pct,90);
});
test('session: an exported configuration reproduces with matching digests; a changed claim cannot reproduce',()=>{
 const W=workers(),a=createDepotSession({workerFactory:W.factory,codec,preset:'B'});
 a.run('pair');W.made[0].flush();
 const first=a.get().result,file=a.exportText();assert.ok(file.ok);
 const claim=JSON.parse(file.text).expected;
 assert.deepEqual(claim,{baseline_run_digest:first.envelopes.baseline.digests.run,candidate_run_digest:first.envelopes.candidate.digests.run});
 const b=createDepotSession({workerFactory:W.factory,codec});b.importText(file.text);
 assert.equal(W.made.length,1,'import never runs');assert.equal(b.get().status,'draft');
 b.run('pair');W.made[1].flush();
 const st=b.get();assert.equal(st.status,'verified');
 assert.equal(st.result.envelopes.baseline.digests.run,claim.baseline_run_digest);assert.equal(st.result.envelopes.candidate.digests.run,claim.candidate_run_digest);
 assert.equal(st.result.comparison.digest,first.comparison.digest);
 const forged=JSON.parse(file.text);forged.expected.baseline_run_digest=forged.expected.baseline_run_digest.replace(/^./,ch=>ch==='0'?'1':'0');
 const c=createDepotSession({workerFactory:W.factory,codec});c.importText(JSON.stringify(forged));c.run('pair');W.made[2].flush();
 assert.equal(c.get().status,'could_not_reproduce');assert.equal(c.get().result.envelopes,undefined);
});
test('session: a baseline-only share link reproduces the same run digest',()=>{
 const W=workers(),a=createDepotSession({workerFactory:W.factory,codec});
 a.run('baseline');W.made[0].flush();assert.equal(a.get().status,'verified');
 const link=a.shareFragment();assert.ok(link.ok);
 const b=createDepotSession({workerFactory:W.factory,codec});b.openFragment(link.fragment);assert.equal(W.made.length,1);
 b.run('baseline');W.made[1].flush();
 assert.equal(b.get().status,'verified');assert.equal(b.get().result.envelopes.baseline.digests.run,a.get().result.envelopes.baseline.digests.run);
});
// The worker module binds only inside a worker scope; each distinct import URL is a fresh module instance.
test('worker: outside a worker scope nothing binds; under a simulated WorkerGlobalScope it runs one real job, then refuses reuse',async()=>{
 const outside=await import('../src/runtime/depot-lab-worker.js?scope=none');
 assert.deepEqual(Object.keys(outside.DEPOT_MODEL).sort(),['compareDepotRuns','createDepotRun','stepDepotRun','verifyDepotRun']);
 assert.equal(typeof globalThis.onmessage,'undefined');
 class WorkerGlobalScope{}
 const posted=[],scope=new WorkerGlobalScope();scope.postMessage=m=>posted.push(structuredClone(m));
 globalThis.WorkerGlobalScope=WorkerGlobalScope;globalThis.self=scope;
 try{
  await import('../src/runtime/depot-lab-worker.js?scope=1');
  assert.equal(typeof scope.onmessage,'function');
  const p=preset('B'),req=request('worker-1',p.baseline,p.candidate);
  scope.onmessage({data:req});
  const reply=posted.at(-1),progress=posted.slice(0,-1);
  assert.equal(reply.type,'result');assert.equal(reply.id,'worker-1');
  assert.ok(progress.length>0&&progress.every(m=>m.type==='progress'));assert.deepEqual(stagesOf(progress),JOB_STAGES);
  assert.equal(reply.envelopes.baseline.status,'VERIFIED');assert.equal(reply.envelopes.candidate.status,'VERIFIED');
  if(B_PAIR)assert.equal(reply.comparison.digest,B_PAIR.comparison.digest);
  const n=posted.length;scope.onmessage({data:req});
  assert.equal(posted.length,n+1);assert.deepEqual(posted.at(-1),{type:'refused',id:null,generation:null,reason:'worker_already_used',issues:[]});
  await import('../src/runtime/depot-lab-worker.js?scope=2');
  for(const data of [undefined,null,'run',{type:'run'},{...req,extra:1},{...req,generation:0}]){
   const k=posted.length;scope.onmessage({data});await import(`../src/runtime/depot-lab-worker.js?scope=r${k}`);
   assert.equal(posted.length,k+1);assert.equal(posted.at(-1).type,'refused');assert.equal(posted.at(-1).reason,'invalid_request');
  }
 }finally{delete globalThis.WorkerGlobalScope;delete globalThis.self;}
});
