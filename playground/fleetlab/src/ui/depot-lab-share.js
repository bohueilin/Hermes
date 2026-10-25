// Depot lab share, import and export codec (engineering note §15; contract C2.3, D1-03, D1-11, A41). Pure: no DOM,
// storage or network. The gates run in a fixed order and every refusal happens before any model start. Opening a
// share never runs anything; a recipient reruns and verifies before any result can match the shared digests.
import {parseStrict,jcs,utf8Length,deepFreeze} from '../model/depot-lab/canonical.js';
import {DIGEST,scenarioDigest} from '../model/depot-lab/identity.js';
import {validateScenario,LIMITS} from '../model/depot-lab/schema.js';
import {checkPairCompatibility} from '../model/depot-lab/compare.js';
import {PRESET_IDS} from '../model/depot-lab/presets.js';
import {HONESTY,term} from '../model/depot-lab/registry.js';
import {componentKind,signedText} from './depot-lab-format.js';
export const SHARE_SCHEMA='fleetlab.depot.share.v1',SHARE_KEY='#share=',MAX_SHARE_CHARS=32768,MAX_ENVELOPE_BYTES=524288;
export const EXPORT_FILENAME='fleetlab-depot-configuration.json',READING_LEVELS=Object.freeze(['overview','technical']);
// The three D1-11 strings come from the registry, the single copy that holds the route's one permitted dash.
export {HONESTY};
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',SELECTION=/^[A-Za-z0-9:_-]{1,96}$/;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const closed=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const refuse=(gate,code,issues=[])=>deepFreeze({ok:false,gate,code,issues});
const limit=(code,value,bound)=>[{code,path:'',value,bound}];
export function toBase64url(bytes){
 let out='';
 for(let i=0;i<bytes.length;i+=3){
  const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0),k=Math.min(3,bytes.length-i)+1;
  for(let j=0;j<k;j++)out+=ALPHABET[(n>>(18-6*j))&63];
 }
 return out;
}
// Strict unpadded base64url: any other character, a dangling sextet or nonzero spare bits refuses.
export function fromBase64url(text){
 if(text.length%4===1)return null;
 const out=new Uint8Array(Math.floor(text.length*3/4));let o=0;
 for(let i=0;i<text.length;i+=4){
  let n=0,k=0;
  for(;k<4&&i+k<text.length;k++){const v=ALPHABET.indexOf(text[i+k]);if(v<0)return null;n|=v<<(18-6*k);}
  for(let j=0;j<k-1;j++)out[o++]=(n>>(16-8*j))&255;
 }
 return toBase64url(out)===text?out:null;
}
function shapeIssues(e){
 const out=[],bad=(path,bound)=>out.push({code:'SHARE_SHAPE',path,value:null,bound});
 if(!closed(e,['schema','arms','presentation','expected','honesty'])){bad('','closed share envelope');return out;}
 if(e.schema!==SHARE_SCHEMA)bad('/schema',SHARE_SCHEMA);
 const arms=closed(e.arms,['baseline','candidate'])&&plain(e.arms.baseline)&&(e.arms.candidate===null||plain(e.arms.candidate));
 if(!arms)bad('/arms','baseline scenario and candidate scenario or null');
 const p=e.presentation;
 if(!closed(p,['reading_level','preset','cursor','selection']))bad('/presentation','closed presentation');
 else{
  if(!READING_LEVELS.includes(p.reading_level))bad('/presentation/reading_level',READING_LEVELS.join(' or '));
  if(!(p.preset===null||PRESET_IDS.includes(p.preset)))bad('/presentation/preset','preset id or null');
  if(!(p.cursor===null||Number.isSafeInteger(p.cursor)&&p.cursor>=0&&p.cursor<=LIMITS.tick))bad('/presentation/cursor','tick or null');
  if(!(p.selection===null||typeof p.selection==='string'&&SELECTION.test(p.selection)))bad('/presentation/selection','reference or null');
 }
 const x=e.expected,digest=d=>d===null||typeof d==='string'&&DIGEST.test(d);
 if(!closed(x,['baseline_run_digest','candidate_run_digest'])||!digest(x.baseline_run_digest)||!digest(x.candidate_run_digest))bad('/expected','run digests or null');
 else if(arms&&e.arms.candidate===null&&x.candidate_run_digest!==null)bad('/expected/candidate_run_digest','null without a candidate');
 if(!Array.isArray(e.honesty)||e.honesty.length!==HONESTY.length||e.honesty.some((s,i)=>s!==HONESTY[i]))bad('/honesty','the three honesty strings, verbatim');
 return out;
}
// Text gates: whole-envelope UTF-8 bytes (exact, before parsing), strict parse, closed shape, each arm as an import,
// then pair compatibility. The configuration file import uses this directly.
export function decodeShareText(text){
 if(typeof text!=='string')return refuse('size','INPUT_NOT_TEXT');
 const bytes=utf8Length(text);
 if(bytes>MAX_ENVELOPE_BYTES)return refuse('size','INCOMPLETE_RESOURCE_LIMIT',limit('INCOMPLETE_RESOURCE_LIMIT',bytes,MAX_ENVELOPE_BYTES));
 const parsed=parseStrict(text,{maxBytes:MAX_ENVELOPE_BYTES});
 if(!parsed.ok)return refuse('parse',parsed.issues[0]?.code??'PARSE',parsed.issues);
 const shape=shapeIssues(parsed.value);
 if(shape.length)return refuse('shape','SHARE_SHAPE',shape);
 const e=parsed.value,v={baseline:validateScenario(e.arms.baseline,{origin:'import'}),candidate:e.arms.candidate===null?null:validateScenario(e.arms.candidate,{origin:'import'})};
 const invalid=['baseline','candidate'].flatMap(arm=>v[arm]&&!v[arm].ok?v[arm].issues.map(i=>({...i,arm})):[]);
 if(invalid.length)return refuse('scenario','INVALID_SETUP',invalid);
 const compatibility=v.candidate?checkPairCompatibility(v.baseline.scenario,v.candidate.scenario):null;
 if(compatibility&&!compatibility.compatible)return refuse('compatibility','INCOMPATIBLE',compatibility.issues);
 const arms={baseline:v.baseline.scenario,candidate:v.candidate?.scenario??null};
 return deepFreeze({ok:true,arms,presentation:{...e.presentation},expected:{...e.expected},digests:{baseline:scenarioDigest(arms.baseline),candidate:arms.candidate&&scenarioDigest(arms.candidate)},compatibility,bytes});
}
// Fragment gates: the transport limit on base64url characters (route and key excluded) comes first.
export function decodeShare(fragment){
 if(typeof fragment!=='string')return refuse('transport','SHARE_NOT_TEXT');
 const payload=fragment.startsWith(SHARE_KEY)?fragment.slice(SHARE_KEY.length):fragment;
 if(payload.length>MAX_SHARE_CHARS)return refuse('transport','TRANSPORT_LIMIT',limit('TRANSPORT_LIMIT',payload.length,MAX_SHARE_CHARS));
 const bytes=fromBase64url(payload);
 if(!bytes)return refuse('transport','SHARE_ENCODING');
 if(bytes.length>MAX_ENVELOPE_BYTES)return refuse('size','INCOMPLETE_RESOURCE_LIMIT',limit('INCOMPLETE_RESOURCE_LIMIT',bytes.length,MAX_ENVELOPE_BYTES));
 let text;
 try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return refuse('transport','SHARE_ENCODING');}
 return decodeShareText(text);
}
// The producer applies the recipient's gates, so it never emits a link or file that would be refused.
export function buildShareEnvelope({arms,presentation={},expected={}}={}){
 const e={schema:SHARE_SCHEMA,arms:{baseline:arms?.baseline??null,candidate:arms?.candidate??null},
  presentation:{reading_level:'overview',preset:null,cursor:null,selection:null,...presentation},
  expected:{baseline_run_digest:null,candidate_run_digest:null,...expected},honesty:[...HONESTY]};
 let text;
 try{text=jcs(e);}catch{return refuse('shape','SHARE_SHAPE',[{code:'SHARE_SHAPE',path:'',value:null,bound:'canonical JSON values'}]);}
 const check=decodeShareText(text);
 return check.ok?deepFreeze({ok:true,text,bytes:check.bytes}):check;
}
export function encodeShare(parts){
 const r=buildShareEnvelope(parts);if(!r.ok)return r;
 const payload=toBase64url(new TextEncoder().encode(r.text));
 if(payload.length>MAX_SHARE_CHARS)return deepFreeze({ok:false,gate:'transport',code:'SHARE_TOO_LARGE',issues:limit('SHARE_TOO_LARGE',payload.length,MAX_SHARE_CHARS),offer:'export'});
 return deepFreeze({ok:true,fragment:SHARE_KEY+payload,length:payload.length});
}
// The local configuration file is the same canonical envelope, so it always carries the honesty strings.
export function buildConfigurationExport(parts){
 const r=buildShareEnvelope(parts);
 return r.ok?deepFreeze({ok:true,text:r.text,filename:EXPORT_FILENAME,bytes:r.bytes}):r;
}
const shown=v=>{if(v===null||v===undefined)return 'not available';if(typeof v!=='object')return String(v);try{return jcs(v);}catch{return 'not available';}};
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
// Exact value with its unit; energy and data add their kWh or GB display (note 18, C1.6).
const unitText=(id,v,sign)=>{const [f,u]=componentKind(id);return v===null||v===undefined?'not available':`${shown(v)} ${u}${u==='mJ'||u==='bytes'?` (${sign?signedText(v,f):f(v)})`:''}`;};
// Plain-text summary of a session state. The status carries its registry qualifier and the trust axes stay separate
// (D1-11, reconciliation 11.2); only a verified result contributes metrics; every summary ends with the honesty strings.
export function buildResultSummary(state){
 const status=typeof state?.status==='string'?state.status:'draft',r=plain(state?.result)?state.result:null,q=term(`run.state.${status}`);
 const lines=['FleetLab depot lab run summary',`Status: ${q?`${q.label_plain} (run state ${status}). ${q.definition}`:status}`,`Trust: ${['authenticity','authorization','deployment_permission','evidence','scope'].map(k=>`${term(`trust.${k}`).label_plain} ${term(`trust.${k}`).value}`).join('; ')}`];
 for(const arm of ['baseline','candidate'])if(typeof r?.scenario_digests?.[arm]==='string')lines.push(`Scenario digest, ${arm}: ${r.scenario_digests[arm]}`);
 if(status==='verified'&&r?.envelopes){
  for(const arm of ['baseline','candidate']){
   const e=r.envelopes[arm];if(!e)continue;
   lines.push(`Internal consistency, ${arm}: ${e.consistency} from the independent verifier; ${Object.entries(e.trust??{}).map(([k,x])=>`${k} ${x}`).join('; ')}`,`Run digest, ${arm}: ${e.digests.run}`,`Versions, ${arm}: engine ${e.versions.engine}; verifier ${e.versions.verifier}; projection ${e.versions.projection}; metrics ${e.versions.metric}`,`Exact metrics, ${arm}:`);
   for(const k of Object.keys(e.projection?.metrics??{}).sort())lines.push(`  ${k}: ${shown(e.projection.metrics[k])}`);
  }
  const c=r.comparison;
  if(c){
   const t=c.treatment;
   if(t){lines.push(`Treatment: ${plural(t.intervention_count,'intervention')} · ${plural(t.fields.length,'authoritative field')}`);for(const l of t.leaves)lines.push(`  ${l.pointer}: ${shown(l.old)} to ${shown(l.new)}`);}
   lines.push(`Comparison: ${c.classification} (component by component; no single winner)`);
   if(c.digest)lines.push(`Comparison digest: ${c.digest}`);
   for(const x of c.components)lines.push(`  ${x.id} (${x.direction}): baseline ${unitText(x.id,x.baseline)}; candidate ${unitText(x.id,x.candidate)}; change ${unitText(x.id,x.delta,1)}; ${x.relation??'not available'}`);
  }
 }else{
  if(status==='could_not_reproduce'){
   lines.push('Could not reproduce');
   for(const arm of ['baseline','candidate']){const want=r?.expected?.[`${arm}_run_digest`];if(want)lines.push(`Shared run digest, ${arm}: ${want}`,`Rerun digest, ${arm}: ${shown(r?.observed?.[`${arm}_run_digest`])}`);}
  }
  lines.push('No metrics are included: only a verified result carries metrics.');
 }
 lines.push('',...HONESTY);
 return lines.join('\n');
}
