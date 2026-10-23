import {defaultInput,canonicalBatch,canonical,freeze,ZONES} from '../model/rebalancing-contract.js';
import {verifyRebalancing,verifyRebalancingStudy} from '../model/rebalancing-verify.js';
import {R1_STUDY} from '../model/rebalancing-study.js';
export function createR1Session({worker,onChange}){
 let state={study:null,manual:null,busy:true,error:null},identity=0,pending=null,disposed=false;
 const notify=()=>onChange(state);
 const send=message=>{pending={...message,id:++identity};state={...state,busy:true,error:null};notify();worker.postMessage(pending);};
 worker.onmessage=({data})=>{
  if(disposed||!pending||data.id!==pending.id)return;
  try{
   if(data.type==='error')throw Error(data.error||'Model job failed');
   if(data.type!==pending.type)throw Error('Response kind differs');
   if(data.type==='study'){
    const check=verifyRebalancingStudy(data.records);if(!check.ok)throw Error(check.errors.join('; '));
    for(const r of data.records)if(r.digest!==R1_STUDY.records[r.policy.id]?.digest)throw Error('Recorded identity differs');
    if(!verifyRebalancing(data.manual).ok||data.manual.end!==0||data.manual.policy.id!=='manual'||canonical(data.manual.input)!==canonical(defaultInput()))throw Error('Initial manual record invalid');
    state={study:freeze(data.records),manual:freeze(data.manual),busy:false,error:null};
   }else{
    const r=data.record,check=verifyRebalancing(r);if(!check.ok)throw Error(check.errors.join('; '));
    if(r.policy.id!=='manual'||r.end!==pending.end||canonical(r.input)!==canonical(defaultInput())||canonical(r.decisions)!==canonical(pending.decisions))throw Error('Manual response identity differs');
    state={...state,manual:freeze(r),busy:false,error:null};
   }
  }catch(error){state={...state,busy:false,error:String(error.message||error)};}
  pending=null;notify();
 };
 worker.onerror=()=>{pending=null;state={...state,busy:false,error:'The model worker stopped. Reload to reconstruct the checked study.'};notify();};
 send({type:'study'});
 return {
  get:()=>state,
  preview:moves=>{if(!state.manual)return null;const vehicles=state.manual.boundaries.at(-1).vehicles,batch=canonicalBatch(moves,vehicles);return ZONES.map(zone=>({zone,remaining:vehicles.filter(v=>v.zone===zone&&v.activity==='idle').length-batch.filter(m=>m.from===zone).reduce((n,m)=>n+m.count,0),moving:batch.some(m=>m.from===zone)}));},
  advance:moves=>{if(state.busy||!state.manual)return;try{const t=state.manual.end;if(t>=7200)throw Error('The 120-minute observation is complete. Reset to try another plan.');const batch=canonicalBatch(moves,state.manual.boundaries.at(-1).vehicles);send({type:'manual',end:t+600,decisions:[...state.manual.decisions,{t,moves:batch}]});}catch(error){state={...state,error:String(error.message||error)};notify();}},
  reset:()=>{if(!state.busy&&state.study)send({type:'manual',end:0,decisions:[]});},
  dispose:()=>{disposed=true;worker.terminate();},
 };
}
