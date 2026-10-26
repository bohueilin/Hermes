// Pair compatibility and component-wise comparison (contract C1.2, C1.6, D1-03, D1-11, A36; engineering note §11).
// Compatibility is decided over validated scenarios before any run; classification reads only VERIFIED envelopes.
// Nothing here runs a model, and no scalar winner is ever formed.
import {jcs,deepFreeze} from './canonical.js';
import {comparisonDigest,DIGEST} from './identity.js';
import {validateScenario} from './schema.js';
import {Q,parseRational,formatRational,sub,cmp} from './rational.js';
import {REFERENCE_EFFORT,METRIC_VERSION,PROJECTION_VERSION} from './profiles.js';
import {AUTHORITATIVE_POINTERS} from './registry.js';
export const COMPARISON_SCHEMA='fleetlab.depot.comparison.v1',VERIFICATION_SCHEMA='fleetlab.depot.verification.v1';
// C1.2 authoritative treatment paths, as the registry maps them. Every other path must be identical in both arms.
export const TREATMENT_POINTERS=Object.freeze([...AUTHORITATIVE_POINTERS].sort());
// ID-keyed collections are addressed by member key, never by array index; other arrays are compared whole.
const KEYED=[[/^\/(site\/positions|site\/ports|workers|content_objects|visits)$/,'id'],[/^\/workers\/[^/]+\/qualifications$/,'task_class'],[/^\/visits\/[^/]+\/task_windows$/,'task_template']];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const byText=(a,b)=>a<b?-1:a>b?1:0;
const token=k=>String(k).replaceAll('~','~0').replaceAll('/','~1');
const copy=v=>v===undefined?null:JSON.parse(jcs(v));
const safe=v=>{try{return copy(v);}catch{return null;}};
const under=(pointer,field)=>pointer===field||pointer.startsWith(`${field}/`);
function diff(a,b,path,out){
 if(a!==undefined&&b!==undefined&&jcs(a)===jcs(b))return out;
 const key=KEYED.find(([re])=>re.test(path))?.[1];
 if(key&&Array.isArray(a)&&Array.isArray(b)){
  const ma=new Map(a.map(x=>[x[key],x])),mb=new Map(b.map(x=>[x[key],x]));
  for(const k of [...new Set([...ma.keys(),...mb.keys()])].sort(byText))diff(ma.get(k),mb.get(k),`${path}/${token(k)}`,out);
  return out;
 }
 if(plain(a)&&plain(b)){for(const k of [...new Set([...Object.keys(a),...Object.keys(b)])].sort(byText))diff(a[k],b[k],`${path}/${token(k)}`,out);return out;}
 out.push({pointer:path,old:copy(a),new:copy(b)});return out;
}
// Both arms already validated. One compatible pair is one intervention; `fields` is the authoritative field counter.
export function checkPairCompatibility(baseline,candidate){
 if(!plain(baseline)||!plain(candidate))return deepFreeze({compatible:false,treatment:null,issues:[{code:'NOT_VALIDATED',path:'',value:null,bound:'validated scenario'}]});
 const leaves=diff(baseline,candidate,'',[]).sort((x,y)=>byText(x.pointer,y.pointer)),fields=new Set(),allowed=[],issues=[];
 for(const leaf of leaves){
  const field=TREATMENT_POINTERS.find(p=>under(leaf.pointer,p));
  if(field){fields.add(field);allowed.push(leaf);}
  else issues.push({code:'NON_TREATMENT_DIFFERENCE',path:leaf.pointer,value:leaf.new,bound:leaf.old});
 }
 if(issues.length)return deepFreeze({compatible:false,treatment:null,issues});
 const list=[...fields].sort(byText);
 return deepFreeze({compatible:true,treatment:{intervention_count:list.length?1:0,fields:list,leaves:allowed},issues:[]});
}
// Import-origin validation first: a schema-invalid arm (overlap profile, policy id, versions) never reaches a run.
export function checkRawPairCompatibility(rawBaseline,rawCandidate){
 const v={baseline:validateScenario(rawBaseline,{origin:'import'}),candidate:validateScenario(rawCandidate,{origin:'import'})};
 const issues=['baseline','candidate'].flatMap(arm=>v[arm].ok?[]:v[arm].issues.map(i=>({...i,arm})));
 if(issues.length)return deepFreeze({compatible:false,treatment:null,issues,scenarios:null});
 return deepFreeze({...checkPairCompatibility(v.baseline.scenario,v.candidate.scenario),scenarios:{baseline:v.baseline.scenario,candidate:v.candidate.scenario}});
}
// The frozen vector V (D1-11): presentation order only, never a lexicographic priority.
export const VECTOR_HEAD=Object.freeze(['on_time_count','overdue_seconds','observed_visit_seconds','unreleased_count']);
export const VECTOR_TAIL=Object.freeze(['remaining_required_kWh','remaining_required_bytes']),REFERENCE_PREFIX='remaining_reference_seconds:';
const CLASS_ID=/^[a-z][a-z0-9_]{0,63}$/;
function rank(id){
 const h=VECTOR_HEAD.indexOf(id);if(h>=0)return h;
 if(id.startsWith(REFERENCE_PREFIX)&&CLASS_ID.test(id.slice(REFERENCE_PREFIX.length)))return 4;
 const t=VECTOR_TAIL.indexOf(id);return t>=0?5+t:-1;
}
export const componentDirection=id=>id==='on_time_count'?'up':'down';
const exact=v=>Number.isSafeInteger(v)&&v>=0?Q(BigInt(v)):typeof v==='string'?parseRational(v):null;
function delta(a,b,ra,rb){
 if(typeof a==='number'&&typeof b==='number')return b-a;
 const d=sub(rb,ra);return d.n<0n?`-${formatRational(Q(-d.n,d.d))}`:formatRational(d);
}
// Component-wise C1.6 rule. Any missing, unknown or misdirected component blocks classification.
export function classifyVector(baseline,candidate){
 const index=list=>{if(!Array.isArray(list))return null;const m=new Map();for(const c of list){if(!plain(c)||typeof c.id!=='string'||m.has(c.id))return null;m.set(c.id,c);}return m;};
 const A=index(baseline),B=index(candidate);
 if(!A||!B)return deepFreeze({classification:'NOT_AVAILABLE',components:[],issues:[{code:'VECTOR_INVALID',path:'',value:null,bound:null}]});
 const issues=new Map(),flag=(code,id)=>{if(!issues.has(id))issues.set(id,{code,path:id,value:null,bound:null});};
 const ids=[...new Set([...A.keys(),...B.keys()])];
 for(const id of ids)if(rank(id)<0)flag('UNKNOWN_COMPONENT',id);
 for(const id of [...VECTOR_HEAD,...VECTOR_TAIL])if(!A.has(id)&&!B.has(id))flag('COMPONENT_NOT_AVAILABLE',id);
 const components=ids.filter(id=>rank(id)>=0).sort((x,y)=>rank(x)-rank(y)||byText(x,y)).map(id=>{
  const x=A.get(id),y=B.get(id),direction=componentDirection(id),rx=x?exact(x.value):null,ry=y?exact(y.value):null;
  if(!rx||!ry||x.direction!==direction||y.direction!==direction){
   flag('COMPONENT_NOT_AVAILABLE',id);
   return {id,direction,baseline:x?safe(x.value):null,candidate:y?safe(y.value):null,delta:null,relation:null};
  }
  const s=cmp(ry,rx);
  return {id,direction,baseline:x.value,candidate:y.value,delta:delta(x.value,y.value,rx,ry),relation:s===0?'equal':(s>0)===(direction==='up')?'better':'worse'};
 });
 const has=r=>components.some(c=>c.relation===r);
 const classification=issues.size?'NOT_AVAILABLE':has('better')?(has('worse')?'mixed':'improvement'):has('worse')?'worse':'tie';
 return deepFreeze({classification,components,issues:[...issues.values()]});
}
function envelopeIssue(e){
 if(!plain(e)||e.schema!==VERIFICATION_SCHEMA||!plain(e.digests)||!plain(e.versions))return 'ENVELOPE_INVALID';
 if(e.status!=='VERIFIED'||e.consistency!=='INTERNALLY_CONSISTENT'||!plain(e.projection))return 'NOT_VERIFIED';
 if(!['run','scenario','workload','policy'].every(k=>typeof e.digests[k]==='string'&&DIGEST.test(e.digests[k])))return 'ENVELOPE_INVALID';
 return e.versions.projection===PROJECTION_VERSION&&e.versions.metric===METRIC_VERSION?null:'VERSION_MISMATCH';
}
function treatmentOk(t){
 try{
  if(!plain(t)||!Array.isArray(t.fields)||!Array.isArray(t.leaves))return false;
  const f=t.fields,p=t.leaves.map(l=>plain(l)&&typeof l.pointer==='string'&&'old' in l&&'new' in l?l.pointer:null);
  if(t.intervention_count!==(f.length?1:0)||!f.every((x,i)=>TREATMENT_POINTERS.includes(x)&&(i===0||f[i-1]<x)))return false;
  if(p.some((x,i)=>x===null||(i>0&&p[i-1]>=x)))return false;
  jcs(t.leaves);return f.every(x=>p.some(y=>under(y,x)))&&p.every(y=>f.some(x=>under(y,x)));
 }catch{return false;}
}
// Classes absent from a verified arm carry no obligation there: an explicit exact zero, never a missing value.
function expand(vector,classes){
 if(!plain(vector)||!Array.isArray(vector.classes)||!Array.isArray(vector.components))return null;
 const out=[...vector.components];
 for(const c of classes)if(!vector.classes.includes(c)&&!out.some(x=>plain(x)&&x.id===REFERENCE_PREFIX+c))out.push({id:REFERENCE_PREFIX+c,direction:'down',value:'0/1'});
 return out;
}
export function compareDepotRuns(baseline,candidate,treatment){
 const refuse=code=>deepFreeze({schema:COMPARISON_SCHEMA,classification:'NOT_AVAILABLE',components:[],digest:null,treatment:treatmentOk(treatment)?copy(treatment):null,issues:[{code,path:'',value:null,bound:null}]});
 const bad=envelopeIssue(baseline)??envelopeIssue(candidate);if(bad)return refuse(bad);
 const b=baseline,c=candidate;
 if(b.digests.workload!==c.digests.workload||b.digests.policy!==c.digests.policy||['engine','verifier','projection','metric'].some(k=>b.versions[k]!==c.versions[k]))return refuse('INCOMPATIBLE');
 if(!treatmentOk(treatment))return refuse('TREATMENT_INVALID');
 if((treatment.intervention_count===0)!==(b.digests.scenario===c.digests.scenario))return refuse('TREATMENT_MISMATCH');
 const vb=b.projection.vector,vc=c.projection.vector,classes=[...new Set([vb?.classes,vc?.classes].flatMap(x=>Array.isArray(x)?x.filter(y=>typeof y==='string'):[]))].sort(byText);
 const v=classifyVector(expand(vb,classes),expand(vc,classes));
 const digest=comparisonDigest({baseline_run_digest:b.digests.run,candidate_run_digest:c.digests.run,treatment_deltas:treatment.leaves,common_reference_effort:REFERENCE_EFFORT,metric_version:METRIC_VERSION,projection_version:PROJECTION_VERSION});
 return deepFreeze({schema:COMPARISON_SCHEMA,classification:v.classification,components:v.components,digest,treatment:copy(treatment),run_digests:{baseline:b.digests.run,candidate:c.digests.run},issues:v.issues});
}
