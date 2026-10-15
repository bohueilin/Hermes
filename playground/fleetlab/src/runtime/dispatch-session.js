import {fixture,canonical,copy} from '../model/dispatch-contract.js';
import {verifyDispatch,verifyStudy} from '../model/dispatch-verify.js';
export function createDispatchSession({worker,onChange}){
 let state={fixture:null,study:null,manual:null,busy:false,error:null},next=0,pending=null,disposed=false;
 const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 const notify=()=>onChange(state);
 const send=m=>{pending={...m,id:++next};state={...state,busy:true,error:null};notify();worker.postMessage(pending);};
 worker.onmessage=({data})=>{
  if(disposed||!pending||data.id!==pending.id)return;
  try{if(data.type==='error')throw Error(data.error||'Calculation failed');if(data.type!==pending.type||data.fixture!==pending.fixture)throw Error('Response fixture or kind differs');const input=fixture(pending.fixture),manual=data.type==='study'?data.manual:data.record;
   if(!verifyDispatch(manual).ok||manual.policy!=='manual'||canonical(manual.input)!==canonical(input)||manual.end!==(pending.end??0)||canonical(manual.decisions)!==canonical(pending.decisions??[]))throw Error('Manual response workload, endpoint or actions differ');
   if(data.type==='study'){const result=verifyStudy(data.records,input);if(!result.ok)throw Error(result.errors.join('; '));state={fixture:pending.fixture,study:freeze(data.records),manual:freeze(manual),busy:false,error:null};}
   else state={...state,manual:freeze(manual),busy:false,error:null};
  }catch(error){state={...state,busy:false,error:String(error.message||error)};}pending=null;notify();
 };
 worker.onerror=()=>{pending=null;state={...state,busy:false,error:'Worker stopped. Reload to reconstruct the comparison.'};notify();};
 const load=id=>{fixture(id);send({type:'study',fixture:id});};load('default');
 return {get:()=>state,load,advance:pairs=>{if(state.busy||!state.manual||state.manual.end>=state.manual.input.horizon)return;const t=state.manual.end;send({type:'manual',fixture:state.fixture,end:t+30,decisions:[...state.manual.decisions,{t,pairs:copy(pairs).sort((a,b)=>canonical(a).localeCompare(canonical(b)))}]});},reset:()=>{if(!state.busy&&state.manual)send({type:'manual',fixture:state.fixture,end:0,decisions:[]});},dispose:()=>{disposed=true;worker.terminate();}};
}
