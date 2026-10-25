// Depot lab session (engineering note §14; contract A41, A42). One draft serves both reading levels. Runs start only
// on request, each on a fresh worker, and cancel terminates that worker. A reply attaches only when its id,
// generation and both scenario digests equal the pending request and the current draft. Nothing is persisted.
import {validateScenario} from '../model/depot-lab/schema.js';
import {jcs,deepFreeze,utf8Length} from '../model/depot-lab/canonical.js';
import {scenarioDigest,DIGEST} from '../model/depot-lab/identity.js';
import {checkPairCompatibility,COMPARISON_SCHEMA,VERIFICATION_SCHEMA} from '../model/depot-lab/compare.js';
import {preset as presetConfig,defaultScenario} from '../model/depot-lab/presets.js';
import {JOB_STAGES,MAX_REPLY_ISSUES,MAX_GUARD_CHARS,closedObject as closed} from './depot-lab-job.js';
export const MAX_REPLY_BYTES=33554432,HISTORY_LIMIT=4,READING_LEVELS=Object.freeze(['overview','technical']);
// Each preset's validated scenario digests, computed once per id (SS-NEW-04); null for a missing arm.
const PRESET_DIGESTS=new Map();
function presetDigests(id){
 if(!PRESET_DIGESTS.has(id)){const p=presetConfig(id),d=x=>x===null?null:scenarioDigest(validateScenario(x,{origin:'import'}).scenario);PRESET_DIGESTS.set(id,{baseline:d(p.baseline),candidate:d(p.candidate)});}
 return PRESET_DIGESTS.get(id);
}
const STATUS=['VERIFIED','INVALID','INCOMPLETE_RESOURCE_LIMIT','CANCELLED'],CONSISTENCY=['INTERNALLY_CONSISTENT','INVALID_EVIDENCE','NOT_AVAILABLE'];
const TRUST={authenticity:'NOT_AUTHENTICATED',authorization:'NOT_EVALUATED',deployment_permission:'NONE',evidence:'NOT_EVIDENCE'};
const CLASSIFICATION=['improvement','worse','tie','mixed','NOT_AVAILABLE'],SELECTION=/^[A-Za-z0-9:_-]{1,96}$/;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const editable=v=>v===null?null:JSON.parse(JSON.stringify(v));
const digestText=d=>typeof d==='string'&&DIGEST.test(d);
// Bounded deep copy inside the canonical JSON domain: floats, holes and foreign prototypes refuse.
function bounded(v,max){try{const t=jcs(v);return utf8Length(t)<=max?JSON.parse(t):null;}catch{return null;}}
const ledgerText=t=>typeof t==='string'&&t.length<=MAX_REPLY_BYTES&&utf8Length(t)<=MAX_REPLY_BYTES;
function envelopeOk(e,digest){
 if(!closed(e,['schema','status','consistency','primary_violation','digests','versions','trust','ledger','projection'])||e.schema!==VERIFICATION_SCHEMA)return false;
 if(!STATUS.includes(e.status)||!CONSISTENCY.includes(e.consistency))return false;
 const d=e.digests,verified=e.status==='VERIFIED',prefix=plain(d)&&Object.hasOwn(d,'prefix');
 if(!closed(d,['scenario','workload','policy','run',...(prefix?['prefix']:[])])||d.scenario!==digest||!digestText(d.workload)||!digestText(d.policy)||!(d.run===null?!verified:digestText(d.run)))return false;
 // A prefix digest identifies an INCOMPLETE_RESOURCE_LIMIT or CANCELLED prefix only.
 if(prefix&&d.prefix!==null&&(verified||e.status==='INVALID'||!digestText(d.prefix)))return false;
 if(!closed(e.trust,Object.keys(TRUST))||Object.keys(TRUST).some(k=>e.trust[k]!==TRUST[k]))return false;
 if(!closed(e.versions,['engine','verifier','projection','metric'])||!Object.values(e.versions).every(x=>typeof x==='string')||!plain(e.ledger))return false;
 return verified?e.consistency==='INTERNALLY_CONSISTENT'&&e.primary_violation===null&&plain(e.projection):e.projection===null;
}
const guardOk=g=>g===null||closed(g,['detail','guard'])&&typeof g.guard==='string'&&g.guard.length<=64;
const comparisonOk=c=>plain(c)&&c.schema===COMPARISON_SCHEMA&&CLASSIFICATION.includes(c.classification)&&Array.isArray(c.components)&&(c.digest===null||digestText(c.digest));
// Inbound worker messages: closed shapes, bound to the pending request, size-bounded; anything else is null.
function checkReply(m,p){
 if(!plain(m)||m.id!==p.id||m.generation!==p.generation)return null;
 if(m.type==='progress'){
  if(!closed(m,['type','id','generation','stage','done','total'])||!JOB_STAGES.includes(m.stage)||!Number.isSafeInteger(m.done)||!Number.isSafeInteger(m.total)||m.done<0||m.done>m.total)return null;
  return {kind:'progress',value:{stage:m.stage,done:m.done,total:m.total}};
 }
 if(m.type==='result'){
  if(!closed(m,['type','id','generation','scenario_digests','envelopes','comparison','ledger_texts','ledger_guards']))return null;
  const pair=p.mode==='pair',d=m.scenario_digests,t=m.ledger_texts,g=bounded(m.ledger_guards,2*MAX_GUARD_CHARS+64);
  if(!closed(g,['baseline','candidate'])||!guardOk(g.baseline)||!(pair?guardOk(g.candidate):g.candidate===null))return null;
  if(!closed(d,['baseline','candidate'])||d.baseline!==p.digests.baseline||d.candidate!==p.digests.candidate)return null;
  if(!closed(t,['baseline','candidate'])||!ledgerText(t.baseline)||!(pair?ledgerText(t.candidate):t.candidate===null))return null;
  const body=bounded({envelopes:m.envelopes,comparison:m.comparison},MAX_REPLY_BYTES);
  if(!body||!closed(body.envelopes,['baseline','candidate'])||!envelopeOk(body.envelopes.baseline,d.baseline))return null;
  if(pair?!envelopeOk(body.envelopes.candidate,d.candidate)||!comparisonOk(body.comparison):body.envelopes.candidate!==null||body.comparison!==null)return null;
  return {kind:'result',value:{scenario_digests:{...d},envelopes:body.envelopes,comparison:body.comparison,ledger_texts:{baseline:t.baseline,candidate:t.candidate},ledger_guards:g}};
 }
 if(m.type==='refused'){
  if(!closed(m,['type','id','generation','reason','issues'])||typeof m.reason!=='string'||m.reason.length>64||!Array.isArray(m.issues)||m.issues.length>MAX_REPLY_ISSUES)return null;
  const issues=bounded(m.issues,65536);
  return issues&&issues.every(i=>plain(i)&&typeof i.code==='string')?{kind:'refused',value:{reason:m.reason,issues}}:null;
 }
 if(m.type==='failed'){
  if(!closed(m,['type','id','generation','stage','message'])||!JOB_STAGES.includes(m.stage)||typeof m.message!=='string'||m.message.length>500)return null;
  return {kind:'failed',value:{stage:m.stage,message:m.message}};
 }
 return null;
}
function outcome(v,expected,pair){
 const envs=[v.envelopes.baseline,v.envelopes.candidate].filter(Boolean),has=s=>envs.some(e=>e.status===s);
 if(has('INVALID'))return 'invalid';
 if(has('INCOMPLETE_RESOURCE_LIMIT'))return 'incomplete';
 if(has('CANCELLED'))return 'cancelled';
 const miss=(want,e)=>want!==null&&want!==e.digests.run;
 return expected&&(miss(expected.baseline_run_digest,v.envelopes.baseline)||pair&&miss(expected.candidate_run_digest,v.envelopes.candidate))?'could_not_reproduce':'verified';
}
function derive(draft){
 const check=arm=>arm===null?null:validateScenario(arm,{origin:'editor'});
 const checks={baseline:check(draft.baseline),candidate:check(draft.candidate)};
 const digests={baseline:checks.baseline.ok?scenarioDigest(checks.baseline.scenario):null,candidate:checks.candidate?.ok?scenarioDigest(checks.candidate.scenario):null};
 const compatibility=checks.candidate&&checks.baseline.ok&&checks.candidate.ok?checkPairCompatibility(checks.baseline.scenario,checks.candidate.scenario):null;
 return {checks,digests,compatibility};
}
const unavailable=()=>deepFreeze({ok:false,gate:'codec',code:'CODEC_UNAVAILABLE',issues:[]});
// `workerFactory()` returns a fresh worker-like object; `codec` is the share module (runtime never imports UI files).
export function createDepotSession({workerFactory,onChange=()=>{},codec=null,preset=null}={}){
 if(typeof workerFactory!=='function')throw new TypeError('createDepotSession needs a workerFactory');
 let disposed=false,serial=0,job=null;
 const start=preset?presetConfig(preset):{baseline:defaultScenario(),candidate:null};
 const draft0=deepFreeze({baseline:editable(start.baseline),candidate:editable(start.candidate)});
 let state=deepFreeze({generation:1,preset,draft:draft0,...derive(draft0),presentation:{reading_level:'overview',preset,cursor:null,selection:null},
  expected:null,status:'draft',progress:null,pending:null,result:null,history:[],edits_since_run:0,refusal:null});
 const set=patch=>{state=deepFreeze({...state,...patch});onChange(state);};
 const stop=()=>{if(!job)return;const w=job.worker;job=null;try{w.terminate();}catch{}};
 const need=name=>typeof codec?.[name]==='function'?codec[name]:unavailable;
 const stale=r=>r?.envelopes?{label:'stale',generation:r.generation,mode:r.mode,scenario_digests:r.scenario_digests,envelopes:r.envelopes,comparison:r.comparison}:null;
 const remember=entry=>entry?[...state.history,entry].slice(-HISTORY_LIMIT):state.history;
 // Every draft change bumps the generation, clears the shared expectation and never starts a run.
 const replaceDraft=(draft,extra={})=>{
  const history=remember(stale(state.result)),d=deepFreeze(draft);
  set({generation:state.generation+1,draft:d,...derive(d),result:null,history,expected:null,refusal:null,edits_since_run:state.edits_since_run+1,status:history.length||job?'stale':'draft',...extra});
 };
 const lost=worker=>{
  if(disposed||!job||worker!==job.worker)return;
  const current=job.generation===state.generation;stop();
  set(current?{pending:null,progress:null,status:'failed',refusal:{source:'run',code:'WORKER_STOPPED',issues:[]}}:{pending:null,progress:null});
 };
 const receive=(worker,data)=>{
  if(disposed||!job||worker!==job.worker)return;
  const r=checkReply(data,job);if(!r)return;
  if(r.kind==='progress'){set({progress:r.value});return;}
  const p=job;stop();
  const current=p.generation===state.generation&&p.digests.baseline===state.digests.baseline&&(p.mode!=='pair'||p.digests.candidate===state.digests.candidate);
  const base={pending:null,progress:null};
  if(!current){set(r.kind==='result'?{...base,history:remember(stale({generation:p.generation,mode:p.mode,...r.value}))}:base);return;}
  if(r.kind==='refused'){set({...base,status:r.value.reason==='incompatible'?'incompatible':'refused',refusal:{source:'run',code:r.value.reason,issues:r.value.issues}});return;}
  if(r.kind==='failed'){set({...base,status:'failed',refusal:{source:'run',code:'FAILED',issues:[{code:'FAILED',path:r.value.stage,value:r.value.message,bound:null}]}});return;}
  const status=outcome(r.value,state.expected,p.mode==='pair');
  const observed={baseline_run_digest:r.value.envelopes.baseline.digests.run,candidate_run_digest:r.value.envelopes.candidate?.digests.run??null};
  // A mismatch with a shared claim shows only the refusal: no metrics, comparison or narration.
  const result=status==='could_not_reproduce'?{status,scenario_digests:r.value.scenario_digests,expected:state.expected,observed}:{status,generation:p.generation,mode:p.mode,...r.value};
  set({...base,status,result});
 };
 const refuseRun=(status,code,issues)=>{set({status,progress:null,pending:job?state.pending:null,refusal:{source:'run',code,issues}});return state;};
 const shareParts=()=>{
  const c=state.checks;
  if(!c.baseline.ok||c.candidate&&!c.candidate.ok)return {ok:false,gate:'scenario',code:'INVALID_SETUP',issues:[]};
  if(state.compatibility&&!state.compatibility.compatible)return {ok:false,gate:'compatibility',code:'INCOMPATIBLE',issues:state.compatibility.issues};
  const r=state.status==='verified'?state.result:null,ok=r&&(!c.candidate||r.mode==='pair');
  const expected=ok?{baseline_run_digest:r.envelopes.baseline.digests.run,candidate_run_digest:r.envelopes.candidate?.digests.run??null}:{};
  return {ok:true,value:{arms:{baseline:c.baseline.scenario,candidate:c.candidate?.scenario??null},presentation:state.presentation,expected}};
 };
 // A shared preset name, and with it the preset's declared regime, stays only on that preset's exact validated inputs
 // (D1-03: never trusted narration); any other configuration opens as the visitor's own setup.
 // The codec's scenario digests cover every authoritative field (identity.js), so equal digests mean equal arms.
 const named=(id,arms,digests)=>{
  if(id===null)return null;
  try{const p=presetDigests(id),d=digests??{baseline:scenarioDigest(arms.baseline),candidate:arms.candidate&&scenarioDigest(arms.candidate)};return d.baseline===p.baseline&&(d.candidate??null)===p.candidate?id:null;}catch{return null;}
 };
 const open=(r,source)=>{
  if(disposed)return r;
  if(!r?.ok){set({refusal:{source,gate:r?.gate??'codec',code:r?.code??'REFUSED',issues:r?.issues??[]}});return r;}
  const claim=r.expected.baseline_run_digest!==null||r.expected.candidate_run_digest!==null,preset=named(r.presentation.preset,r.arms,r.digests);
  replaceDraft({baseline:editable(r.arms.baseline),candidate:editable(r.arms.candidate)},{preset,presentation:{...r.presentation,preset},expected:claim?{...r.expected}:null});
  return r;
 };
 return {
  get:()=>state,
  edit(fn,{scope='both'}={}){
   if(disposed)return state;
   if(typeof fn!=='function'||!['both','candidate'].includes(scope))throw new TypeError('edit needs a function and a scope of both or candidate');
   const apply=arm=>{const next=editable(arm),out=fn(next);return out===undefined?next:out;},d=state.draft;
   const draft=scope==='both'?{baseline:apply(d.baseline),candidate:d.candidate===null?null:apply(d.candidate)}:{baseline:d.baseline,candidate:apply(d.candidate??d.baseline)};
   if(!plain(draft.baseline))throw new TypeError('the baseline setup cannot be removed');
   replaceDraft({baseline:editable(draft.baseline),candidate:editable(draft.candidate??null)});
   return state;
  },
  selectPreset(id){
   if(disposed)return state;
   const p=presetConfig(id);
   replaceDraft({baseline:editable(p.baseline),candidate:editable(p.candidate)},{preset:id,presentation:{...state.presentation,preset:id,cursor:null,selection:null}});
   return state;
  },
  // Reading level, cursor and selection are presentation only: no generation change, no run.
  setPresentation(patch={}){
   if(disposed)return state;
   const next={...state.presentation,...patch};
   const ok=closed(next,['reading_level','preset','cursor','selection'])&&READING_LEVELS.includes(next.reading_level)&&next.preset===state.presentation.preset&&(next.cursor===null||Number.isSafeInteger(next.cursor)&&next.cursor>=0)&&(next.selection===null||typeof next.selection==='string'&&SELECTION.test(next.selection));
   if(!ok)throw new TypeError('presentation accepts reading_level, cursor and selection only');
   set({presentation:next});return state;
  },
  run(mode='pair'){
   if(disposed)return state;
   if(!['baseline','pair'].includes(mode))throw new TypeError('run mode is baseline or pair');
   const c=state.checks,pair=mode==='pair',tag=arm=>c[arm].issues.map(i=>({...i,arm}));
   if(!c.baseline.ok)return refuseRun('refused','INVALID_SETUP',tag('baseline'));
   if(pair&&!c.candidate)return refuseRun('refused','NO_CANDIDATE',[]);
   if(pair&&!c.candidate.ok)return refuseRun('refused','INVALID_SETUP',tag('candidate'));
   if(pair&&!state.compatibility.compatible)return refuseRun('incompatible','INCOMPATIBLE',state.compatibility.issues);
   stop();
   const id=`depot-run-${++serial}`,generation=state.generation,digests={baseline:state.digests.baseline,candidate:pair?state.digests.candidate:null};
   const arms={baseline:jcs(c.baseline.scenario),candidate:pair?jcs(c.candidate.scenario):null};
   let worker;
   try{worker=workerFactory();}catch{return refuseRun('failed','WORKER_UNAVAILABLE',[]);}
   job={id,generation,mode,digests,worker};
   worker.onmessage=event=>receive(worker,event?.data);
   worker.onerror=()=>lost(worker);worker.onmessageerror=()=>lost(worker);
   set({status:'running',pending:{id,generation,mode},progress:{stage:'checking_setup',done:0,total:pair?2:1},result:null,refusal:null,edits_since_run:0});
   try{worker.postMessage({type:'run',id,generation,arms});}catch{lost(worker);}
   return state;
  },
  // Immediate: the worker is terminated, so no partial result can arrive or attach.
  cancel(){if(disposed||!job)return state;stop();set({status:'cancelled',pending:null,progress:null,result:null});return state;},
  dispose(){stop();disposed=true;},
  importText:text=>open(need('decodeShareText')(text),'import'),
  openFragment:fragment=>open(need('decodeShare')(fragment),'share'),
  exportText(){const p=shareParts();return p.ok?need('buildConfigurationExport')(p.value):deepFreeze(p);},
  shareFragment(){const p=shareParts();return p.ok?need('encodeShare')(p.value):deepFreeze(p);},
 };
}
