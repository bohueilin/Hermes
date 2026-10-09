import {FLOW_VERSIONS,FLOW_RULES,FLOW_TRUST,flowScenario,validateFlowScenario} from './depot-flow-contract.js';
import {verifyFlow} from './depot-flow-verify.js';
export {flowScenario,FLOW_RULES};
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};

/** Event-driven, integer-second NF-01. Policies get a frozen present observation, never a future ledger. */
export function simulateFlow(input,rule,{propose=null,shouldCancel=()=>false}={}){
  validateFlowScenario(input);if(!FLOW_RULES.some(r=>r.id===rule))throw Error('Unknown upload rule.');
  const scenario=structuredClone(input),s=scenario,events=[],intervals=[],diagnostics=[];
  const state=Object.fromEntries(s.vehicles.map(v=>[v.id,{upload:0,charge:0,post:0,done:{},ready:null}]));
  let time=0,holder=null,status='completed',policyStatus='ok';
  const event=(type,vehicle,task=null)=>events.push({seq:events.length,time_s:time,type,vehicle,task});
  function settle(){
    for(const v of s.vehicles){const x=state[v.id];
      for(const [task,need] of [['upload',v.upload_bytes],['charge',v.energy_j],['post',v.post_s]])if(x.done[task]===undefined&&x[task]===need&&(task!=='post'||x.done.upload!==undefined)){x.done[task]=time;event('complete',v.id,task);}
      if(x.ready===null&&Object.keys(x.done).length===3){x.ready=time;event('ready',v.id);}
    }
    for(const v of s.vehicles)if(v.deadline_s===time)event('deadline',v.id);
  }
  s.vehicles.forEach(v=>event('arrival',v.id));settle();
  while(time<s.horizon_s){
    if(shouldCancel()){status='cancelled';break;}
    const eligible=s.vehicles.filter(v=>state[v.id].done.upload===undefined);
    const observation=frozen({time_s:time,uplink_bytes_s:s.uplink_bytes_s,eligible:eligible.map(v=>({id:v.id,arrival_s:v.arrival_s,deadline_s:v.deadline_s,remaining_bytes:v.upload_bytes-state[v.id].upload}))});
    let upload={};
    try{
      if(propose)upload=propose(observation);
      else if(s.uplink_bytes_s&&eligible.length){
        if(rule==='nf_equal_uplink')upload=Object.fromEntries(eligible.map(v=>[v.id,s.uplink_bytes_s/eligible.length]));
        else{if(!eligible.some(v=>v.id===holder))holder=[...eligible].sort((a,b)=>(rule==='nf_departure_deadline'?a.deadline_s-b.deadline_s:0)||a.arrival_s-b.arrival_s||a.id.localeCompare(b.id))[0].id;upload={[holder]:s.uplink_bytes_s};}
      }
      if(!upload||typeof upload!=='object'||Array.isArray(upload))throw Error('Allocation must name eligible vehicles and integer bytes/s.');
      upload={...upload};let total=0;
      for(const [id,rate] of Object.entries(upload)){if(!eligible.some(v=>v.id===id)||!Number.isSafeInteger(rate)||rate<0)throw Error('Allocation has unknown work or an invalid rate.');total+=rate;}
      if(total>s.uplink_bytes_s)throw Error('Allocation exceeds uplink capacity.');
      if(eligible.length&&s.uplink_bytes_s>0&&total===0)throw Error('Allocation makes no progress on available upload work.');
      for(const v of eligible)if(upload[v.id]&&(v.upload_bytes-state[v.id].upload)%upload[v.id]!==0)throw Error('Allocation requires unsupported subsecond precision.');
    }catch(error){status='failed';policyStatus='policy_error';diagnostics.push({time_s:time,code:'POLICY_ERROR',message:String(error.message??error).slice(0,240)});break;}
    const charge={};const charging=s.vehicles.find(v=>state[v.id].done.charge===undefined);
    if(charging&&s.charger_j_s){charge[charging.id]=s.charger_j_s;if((charging.energy_j-state[charging.id].charge)%s.charger_j_s!==0)throw Error('Charging requires unsupported subsecond precision.');}
    let next=s.horizon_s;
    for(const v of s.vehicles){const x=state[v.id];
      if(v.deadline_s>time)next=Math.min(next,v.deadline_s);
      if(upload[v.id])next=Math.min(next,time+(v.upload_bytes-x.upload)/upload[v.id]);
      if(charge[v.id])next=Math.min(next,time+(v.energy_j-x.charge)/charge[v.id]);
      if(x.done.upload!==undefined&&x.done.post===undefined)next=Math.min(next,time+v.post_s-x.post);
    }
    if(!Number.isSafeInteger(next)||next<=time||intervals.length>=1000)throw Error('No bounded future event.');
    intervals.push({id:intervals.length,start_s:time,end_s:next,upload,charge});
    for(const v of s.vehicles){const x=state[v.id],dt=next-time;x.upload+=(upload[v.id]??0)*dt;x.charge+=(charge[v.id]??0)*dt;if(x.done.upload!==undefined&&x.done.post===undefined)x.post+=dt;}
    time=next;settle();
  }
  return {versions:{...FLOW_VERSIONS},...FLOW_TRUST,scenario:s,rule,execution_status:status,policy_status:policyStatus,end_s:time,events,intervals,diagnostics,totals:{upload_bytes:Object.fromEntries(s.vehicles.map(v=>[v.id,state[v.id].upload])),energy_j:Object.fromEntries(s.vehicles.map(v=>[v.id,state[v.id].charge]))}};
}

export function runFlowComparison(options={},runtime={}){
  const steps=flowComparisonSteps(options,runtime);let next;do{next=steps.next();}while(!next.done);return next.value;
}
export function* flowComparisonSteps(options={},runtime={}){
  const scenario=flowScenario(options),arms=[];
  for(const rule of FLOW_RULES){if(runtime.shouldCancel?.())break;const record=simulateFlow(scenario,rule.id,runtime);arms.push({record,verification:verifyFlow(record)});yield {scenario,arms:[...arms]};if(record.execution_status!=='completed')break;}
  return {versions:{...FLOW_VERSIONS},...FLOW_TRUST,scenario,arms,comparison_eligible:arms.length===3&&arms.every(a=>a.verification.comparison_eligible),bounds:scenario.vehicles.map(v=>{const earliest=Math.max(v.energy_j/scenario.charger_j_s,v.upload_bytes/scenario.uplink_bytes_s+v.post_s);return {vehicle:v.id,earliest_s:earliest,deadline_s:v.deadline_s,individually_impossible:earliest>v.deadline_s};})};
}
