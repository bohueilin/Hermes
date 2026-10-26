// Bounded depot lab job (engineering note §14). It validates each arm as an import, checks pair compatibility before
// any run, runs baseline then candidate to completion, verifies each canonical ledger independently and compares
// only verified results. Pure: the worker, or a test, supplies the model functions.
import {jcs} from '../model/depot-lab/canonical.js';
import {scenarioDigest} from '../model/depot-lab/identity.js';
import {validateScenario} from '../model/depot-lab/schema.js';
import {checkPairCompatibility} from '../model/depot-lab/compare.js';
export const JOB_STAGES=Object.freeze(['checking_setup','running_baseline','running_candidate','checking_results']);
export const RUN_ID=/^[A-Za-z0-9:_-]{1,64}$/,DEFAULT_MAX_TICKS=4096,MAX_REPLY_ISSUES=200,MAX_GUARD_CHARS=1024;
// The engine's {guard, detail} travels beside its ledger text as bounded canonical data (C2.3 item 4); anything else is null.
export function guardCopy(g){
 if(g===null||g===undefined)return null;
 try{const t=jcs({detail:g.detail??null,guard:typeof g.guard==='string'?g.guard.slice(0,64):null});return t.length<=MAX_GUARD_CHARS?JSON.parse(t):null;}catch{return null;}
}
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
export const closedObject=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
// Shape check before any field is read; returns an issue code or null.
export function checkRunRequest(m){
 if(!closedObject(m,['type','id','generation','arms'])||m.type!=='run')return 'REQUEST_SHAPE';
 if(typeof m.id!=='string'||!RUN_ID.test(m.id)||!Number.isSafeInteger(m.generation)||m.generation<1)return 'REQUEST_IDENTITY';
 if(!closedObject(m.arms,['baseline','candidate'])||typeof m.arms.baseline!=='string'||!(m.arms.candidate===null||typeof m.arms.candidate==='string'))return 'REQUEST_ARMS';
 return null;
}
export function runDepotJob(request,{createDepotRun,stepDepotRun,verifyDepotRun,compareDepotRuns,onProgress=()=>{},maxTicks=DEFAULT_MAX_TICKS}={}){
 const bad=checkRunRequest(request),id=bad?null:request.id,generation=bad?null:request.generation;
 const refuse=(reason,issues)=>({type:'refused',id,generation,reason,issues:issues.slice(0,MAX_REPLY_ISSUES)});
 if(bad)return refuse('invalid_request',[{code:bad,path:'',value:null,bound:null}]);
 const pair=request.arms.candidate!==null,arms=pair?['baseline','candidate']:['baseline'],total=arms.length;
 let stage='checking_setup';
 const progress=(s,done,of)=>{stage=s;onProgress({type:'progress',id,generation,stage:s,done,total:of});};
 try{
  progress(stage,0,total);
  const scenarios={},issues=[];
  for(const arm of arms){const v=validateScenario(request.arms[arm],{origin:'import'});if(v.ok)scenarios[arm]=v.scenario;else issues.push(...v.issues.map(i=>({...i,arm})));}
  if(issues.length)return refuse('invalid_setup',issues);
  let treatment=null;
  if(pair){const c=checkPairCompatibility(scenarios.baseline,scenarios.candidate);if(!c.compatible)return refuse('incompatible',c.issues);treatment=c.treatment;}
  progress(stage,total,total);
  const scenario_digests={baseline:scenarioDigest(scenarios.baseline),candidate:pair?scenarioDigest(scenarios.candidate):null};
  const ledger_texts={baseline:null,candidate:null},ledger_guards={baseline:null,candidate:null},envelopes={baseline:null,candidate:null};
  for(const arm of arms){
   const s=`running_${arm}`,H=scenarios[arm].horizon_tick,cursor=createDepotRun(scenarios[arm]);
   progress(s,0,H);
   // Each step processes at least one of at most H+1 event ticks; more steps mean the engine stalled.
   for(let steps=0;;steps++){
    if(steps>H+1)throw new Error('the engine stopped advancing');
    const r=stepDepotRun(cursor,{maxTicks});
    if(r.done){ledger_texts[arm]=jcs(r.ledger);ledger_guards[arm]=guardCopy(r.guard);break;}
    progress(s,Math.min(Math.max(0,Number.isSafeInteger(r.tick)?r.tick:0),H),H);
   }
   progress(s,H,H);
  }
  // The verifier reads a fresh parse of the retained canonical text, never the engine's own objects, and confirms the
  // claimed guard against that prefix.
  for(const [k,arm] of arms.entries()){progress('checking_results',k,total);envelopes[arm]=verifyDepotRun(scenarios[arm],JSON.parse(ledger_texts[arm]),{claimedGuard:ledger_guards[arm]});}
  progress('checking_results',total,total);
  const comparison=pair?compareDepotRuns(envelopes.baseline,envelopes.candidate,treatment):null;
  return {type:'result',id,generation,scenario_digests,envelopes,comparison,ledger_texts,ledger_guards};
 }catch(error){return {type:'failed',id,generation,stage,message:String(error?.message??error).slice(0,200)};}
}
