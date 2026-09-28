// Text that pages older than the Scale lab print, computed from a given pair of modules: the verdict card module and the
// teaching frames module. The shell test runs it on the modules of this tree and compares the result with the pins in
// test/scale-lab.legacy-text.pins.json, which hold the same text computed once from the modules as they were before the
// Scale lab. A card or readout is pinned as the SHA-256 of its serialized nodes, so the pins stay small; a line of text is
// pinned whole. The caller installs the fake DOM first.
import {createHash} from 'node:crypto';
import {serialize} from './fake-dom.mjs';
import * as format from '../../src/ui/format.js';
import {metricWords} from '../../src/ui/charts.js';

export const VALUES=[0,-0,2.7e-5,-1e-7,.0005,.0104,.01049136786188579,.017993456924754632,.02004,.020119956379498365,.04166666666666572,.00003417167851284857,.95,.9500000000000455,1.036363636363686,-29.96,-30.04,30.04,59.97,-484.95000000000016,-1565.6,1799.96,-1800.0000000000002,13.0000000000001,12345.678];
export const METRICS=['wait.p90_s','wait.p90_s{area=SF,window=111600-118800}','unserved.fraction{area=SF}','fleet.available_fraction','depot.diversions{depot=EB-1}','depot.bay_wait_p90_s{depot=SF-2}','idle weeks per ordered place','in-service fraction of plan','custom_s'];
const OPTIONS=[['none',()=>undefined],['empty',()=>({})],['plain',()=>({withSign:false})],['signed',()=>({withSign:true})]];
// Verdicts whose interval ends and harms sit within half a display unit of the threshold they are read against.
const NEAR=[[-180,-30.04,30,'IMPROVED'],[0,.9500000000000455,1,'UNCHANGED'],[0,1.036363636363686,1,'INCONCLUSIVE'],[-1800.0000000000002,1799.96,1800,'UNCHANGED'],[-1565.6,-735.9,60,'IMPROVED'],[30.04,180,30,'REGRESSED']];
const RAILS=[{metric:'unserved.fraction{area=SF}',direction:'lower_is_better',harm:.01049136786188579,max_harm:.01,status:'REGRESSED'},{metric:'depot.bay_wait_p90_s{depot=SF-2}',direction:'lower_is_better',harm:1799.96,max_harm:1800,status:'WITHIN'},{metric:'unserved.fraction',direction:'lower_is_better',harm:2.7e-5,max_harm:0,status:'REGRESSED'},{metric:'fleet.available_fraction',direction:'higher_is_better',harm:.017993456924754632,max_harm:.017995,status:'WITHIN'},{metric:'depot.diversions{depot=EB-1}',direction:'lower_is_better',harm:null,max_harm:2,status:'NOT_EVALUABLE'}];
const base={kind:'teaching',replications:10,label:'playground-spec:94fffc3f',invalidityDetail:null,descriptives:[],suppressed:[],deltas:[]};
export const VIEWS=[...NEAR.flatMap(([low,high,margin,outcome],i)=>['wait.p90_s{area=SF}','unserved.fraction','requests.served'].map((metric,j)=>({...base,validity:'VALID',invalidityReason:null,outcome,recommendation:['HOLD','NO_RECOMMENDATION','RUN_MORE_EXPERIMENTS','ADVANCE_TO_NEXT_TEST'][(i+j)%4],
  primary:{metric,direction:j===2?'higher_is_better':'lower_is_better',equivalence_margin:margin,baseline_mean:1565.6,candidate_mean:1565.6+(low+high)/2,mean_delta:(low+high)/2,median_delta:low/3+high/3,ci_low:low,ci_high:high},
  guardrails:(i+j)%3?RAILS:RAILS.slice(3),descriptives:[{metric:'requests.served',baseline_mean:2628,candidate_mean:2628.04,mean_delta:.04}]}))),
  {...base,validity:'INVALID_EXPERIMENT',invalidityReason:'REPLICATION_MISMATCH',outcome:'INCONCLUSIVE',recommendation:'NO_RECOMMENDATION',primary:null,guardrails:[]}];
const FRAMES=[['surface','workbench'],['lesson','OPS-06'],['lesson','OPS-18']];

const digest=node=>createHash('sha256').update(serialize(node)).digest('hex');

export function legacyText(experiment,frames){
  const texts={},views=[];
  for(const m of METRICS)for(const v of VALUES)for(const [name,options] of OPTIONS)
    texts[`${m} | ${Object.is(v,-0)?'-0':v} | ${name}`]=[experiment.metricValueText(m,v,options()),experiment.valueWithMinutes(m,v,options())];
  const strip=()=>{const n=document.createElement('figure');n.setAttribute('data-role','strip');return n;},row=()=>[document.createElement('p')];
  const tools={words:metricWords,number:format.number,signed:format.signed,nonzero:format.nonzero,metricValue:experiment.metricValueText,threshold:experiment.thresholdText};
  for(const view of VIEWS){
    const drawn=[()=>undefined,()=>({}),()=>({strip:strip(),rails:row()})];
    views.push({
      name:`${view.primary?.metric??'invalid'} ${view.primary?.ci_low??''} to ${view.primary?.ci_high??''}`,
      readouts:drawn.map(options=>digest(experiment.renderVerdictReadout(view,options()))),
      card:digest(experiment.renderVerdictCard(view,{strip:strip(),rails:row()})),
      lines:FRAMES.map(([kind,id])=>{const frame=(kind==='surface'?frames.SURFACE_FRAMES:frames.LESSON_FRAMES)[id];return [frames.runLine(frame,view,tools),frames.runLine(frame,view)];}),
    });
  }
  return {texts,views};
}
