/** Shared paired contract of the Scale lab models: frozen spec, digest, replay check, then the site's one instrument. */
import {sha256Hex} from '../core/sha256.js';
import {pairedMetricSteps} from './experiment.js';
import {deepFreeze} from './schema.js';
export const SCALE_FORMAT='fleetlab-scale-lab';
/** Sorted keys and finite numbers only. The hash is identity, not authentication. */
export function scaleJson(value,depth=0){
  if(depth>16)throw new RangeError('Scale lab JSON nesting exceeds 16 levels.');
  if(value===null||typeof value==='boolean'||typeof value==='string'||(typeof value==='number'&&Number.isFinite(value)))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(v=>scaleJson(v,depth+1)).join(',')+']';
  if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+scaleJson(value[k],depth+1)).join(',')+'}';
  throw new TypeError('Scale lab JSON requires finite numbers and plain values.');
}
const rail=g=>typeof g?.metric==='string'&&['lower_is_better','higher_is_better'].includes(g.direction);
/** One declared comparison. `change` says in words what differs between the arms; `control` names a shipped control or is null. */
export function freezeScale({lab,version,change,baseline,candidate,seeds,primary,guardrails=[],descriptives=[],resamples=2000,control=null}){
  if(!Array.isArray(seeds)||seeds.length<1||seeds.length>40||new Set(seeds).size!==seeds.length||!seeds.every(s=>Number.isInteger(s)&&s>=0&&s<=4294967295))throw new RangeError('Use 1 to 40 distinct whole-number seeds.');
  if(!Number.isInteger(resamples)||resamples<1000||resamples>10000)throw new RangeError('Use 1,000 to 10,000 bootstrap resamples.');
  if(!rail({...primary,metric:primary?.name})||!(primary.equivalence_margin>0))throw new RangeError('Declare one primary measure with a direction and a margin greater than zero.');
  if(!guardrails.every(g=>rail(g)&&g.max_harm>=0))throw new RangeError('Every guardrail needs a measure, a direction and an allowance that is not negative.');
  const spec=deepFreeze(JSON.parse(scaleJson({format:SCALE_FORMAT,format_version:1,lab,model_version:version,change,control,baseline,candidate,seeds,margin:primary.equivalence_margin,resamples,primary,guardrails,descriptives})));
  const digest=sha256Hex(scaleJson(spec));
  return Object.freeze({spec,digest,label:'scale-spec:'+digest.slice(0,8)});
}
const finite=map=>Object.fromEntries(Object.entries(map).filter(([,v])=>Number.isFinite(v)));
/** `measure(arm, seed)` is a generator that returns one metric map per whole run. An absent value is left out, never zero. */
export function* scalePairSteps(frozen,measure,label='Paired runs'){
  const {spec,digest}=frozen;
  if(digest!==sha256Hex(scaleJson(spec)))throw new RangeError('The frozen digest does not match its declared test.');
  const per_seed=[],total=spec.seeds.length;
  const out={format:SCALE_FORMAT,format_version:1,lab:spec.lab,version:spec.model_version,evidence_status:'NOT_EVIDENCE',decision_authority:'NONE',spec,digest,label:frozen.label,replications:total,per_seed,validity:'VALID',reason:null,analysis:null,descriptive:total===1};
  let matched=true;
  for(const [i,seed] of spec.seeds.entries()){
    yield {done:i,total,label};
    const baseline=finite(yield* measure(spec.baseline,seed));
    yield;
    const candidate=finite(yield* measure(spec.candidate,seed));
    if(i===0){yield;matched=scaleJson(finite(yield* measure(spec.baseline,seed)))===scaleJson(baseline);}
    per_seed.push({seed,baseline,candidate});
  }
  if(out.descriptive)return out;
  yield {done:total,total,label:'Paired bootstrap'};
  out.analysis=yield* pairedMetricSteps({primary:spec.primary,guardrails:spec.guardrails,descriptiveNames:spec.descriptives,baselineRuns:per_seed.map(p=>p.baseline),candidateRuns:per_seed.map(p=>p.candidate),resamples:spec.resamples,key:digest,precheckMatched:matched});
  if(out.analysis.validity!=='VALID'){out.validity='INVALID_EXPERIMENT';out.reason=out.analysis.invalidity_detail;}
  return out;
}
