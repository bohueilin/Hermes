import {COHORT_VERSIONS,COHORT_RULES,FLOW_TRUST,cohortScenario,validateCohortScenario,cohortObject} from './depot-cohort-contract.js';
import {verifyCohort} from './depot-cohort-verify.js';
export {COHORT_VERSIONS,COHORT_RULES,cohortScenario};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

/** Integer-byte grants per slot. Any valid spare grant is recorded, never reused inside a slot. */
export function simulateCohort(input,rule,{propose=null,shouldCancel=()=>false}={}){
  validateCohortScenario(input);if(!COHORT_RULES.some(r=>r.id===rule))throw Error('Unknown NF-02 rule.');
  const s=structuredClone(input),q=s.time_quantum_ms/1000,capacity=s.uplink_bytes_s*q;
  const state=Object.fromEntries(s.vehicles.map(v=>[v.id,{bytes:0,post:0,done:{},ready:null}]));
  const events=[],intervals=[],diagnostics=[];let time=0,holder=null,status='completed',policyStatus='ok';
  const add=(type,vehicle,task=null)=>events.push({seq:events.length,time_s:time,type,vehicle,task});
  function settle(){
    for(const v of s.vehicles){const x=state[v.id];
      if(x.bytes===v.upload_bytes&&x.done.upload===undefined){x.done.upload=time;add('complete',v.id,'upload');}
      if(x.done.charge===undefined){x.done.charge=time;add('complete',v.id,'charge');}
      if(x.done.upload!==undefined&&x.post===v.post_s&&x.done.post===undefined){x.done.post=time;add('complete',v.id,'post');}
      if(Object.keys(x.done).length===3&&x.ready===null){x.ready=time;add('ready',v.id);}
    }
    for(const v of s.vehicles)if(v.deadline_s===time)add('deadline',v.id);
  }
  s.vehicles.forEach(v=>add('arrival',v.id));settle();
  for(let k=0;time<s.horizon_s;k++){
    if(shouldCancel()){status='cancelled';break;}
    const eligible=s.vehicles.filter(v=>state[v.id].done.upload===undefined);
    let grants={};
    try{
      if(propose)grants=propose(freeze({slot_index:k,time_s:time,time_quantum_ms:s.time_quantum_ms,slot_bytes:capacity,uplink_bytes_s:s.uplink_bytes_s,eligible:eligible.map(v=>({id:v.id,arrival_s:v.arrival_s,deadline_s:v.deadline_s,remaining_bytes:v.upload_bytes-state[v.id].bytes}))}));
      else if(capacity&&eligible.length){
        if(rule==='cohort_equal_uplink'){
          grants=Object.fromEntries(eligible.map(v=>[v.id,Math.floor(capacity/eligible.length)]));
          for(let j=0;j<capacity%eligible.length;j++)grants[eligible[(k+j)%eligible.length].id]++;
        }else{
          if(!eligible.some(v=>v.id===holder))holder=[...eligible].sort((a,b)=>(rule==='cohort_departure_deadline'?a.deadline_s-b.deadline_s:rule==='cohort_shortest_upload'?a.upload_bytes-b.upload_bytes:0)||a.arrival_s-b.arrival_s||a.id.localeCompare(b.id))[0].id;
          grants={[holder]:capacity};
        }
      }
      cohortObject(grants,eligible.map(v=>v.id),false);
      let total=0;for(const n of Object.values(grants)){if(!Number.isSafeInteger(n)||n<0)throw Error('Grants must be nonnegative integer bytes.');total+=n;}
      if(total>capacity)throw Error('Grants exceed the slot capacity.');
      if(capacity&&eligible.length&&total===0)throw Error('Grants make no progress on available upload work.');
      grants={...grants};
    }catch(error){
      let message='Invalid policy allocation.';try{message=String(error?.message??error).slice(0,240)||message;}catch{/* Unprintable thrown values still terminate with a diagnostic. */}
      status='failed';policyStatus='policy_error';diagnostics.push({time_s:time,code:'POLICY_ERROR',message});break;
    }
    const upload={},unused={};
    for(const v of s.vehicles){const x=state[v.id],grant=grants[v.id]??0,useful=Math.min(grant,v.upload_bytes-x.bytes);
      if(x.done.upload!==undefined&&x.done.post===undefined)x.post+=q;
      x.bytes+=useful;if(useful)upload[v.id]=useful/q;if(grant>useful)unused[v.id]=grant-useful;
    }
    intervals.push({id:k,start_s:time,end_s:time+q,upload,charge:{},grants,unused});time+=q;settle();
  }
  return {versions:{...COHORT_VERSIONS},...FLOW_TRUST,scenario:s,rule,execution_status:status,policy_status:policyStatus,end_s:time,events,intervals,diagnostics,totals:{upload_bytes:Object.fromEntries(s.vehicles.map(v=>[v.id,state[v.id].bytes])),energy_j:Object.fromEntries(s.vehicles.map(v=>[v.id,0]))}};
}

// Bounds are scenario arithmetic, outside the playback clock and confined to these assumptions.
export function cohortBounds(s){
  validateCohortScenario(s);
  const duration=bytes=>s.uplink_bytes_s?bytes/s.uplink_bytes_s:bytes?null:0;
  const bounds=s.vehicles.map(v=>{const d=duration(v.upload_bytes),earliest=d===null?null:d+v.post_s;return {vehicle:v.id,earliest_s:earliest,deadline_s:v.deadline_s,individually_impossible:earliest===null||earliest>v.deadline_s};});
  const pair=s.vehicles.filter(v=>['A','D'].includes(v.id)),required_bytes=pair.reduce((n,v)=>n+v.upload_bytes,0),upload_by_s=Math.max(...pair.map(v=>v.deadline_s-v.post_s)),available_bytes=Math.max(0,upload_by_s)*s.uplink_bytes_s,d=duration(required_bytes);
  const last_vehicle_lateness_s=Object.fromEntries(pair.map(v=>[v.id,d===null?null:Math.max(0,d+v.post_s-v.deadline_s)]));
  return {bounds,shared_bound:{vehicles:pair.map(v=>v.id),upload_by_s,required_bytes,available_bytes,jointly_impossible:required_bytes>available_bytes,last_vehicle_lateness_s,minimum_lateness_s:d===null?null:Math.min(...Object.values(last_vehicle_lateness_s))}};
}
export function runCohortComparison(options={},runtime={}){
  const steps=cohortComparisonSteps(options,runtime);let next;do{next=steps.next();}while(!next.done);return next.value;
}
export function* cohortComparisonSteps(options={},runtime={}){
  const scenario=cohortScenario(options),arms=[];
  for(const rule of COHORT_RULES){if(runtime.shouldCancel?.())break;const record=simulateCohort(scenario,rule.id,runtime);arms.push({record,verification:verifyCohort(record)});yield {scenario,arms:[...arms]};if(record.execution_status!=='completed')break;}
  return {versions:{...COHORT_VERSIONS},...FLOW_TRUST,scenario,arms,comparison_eligible:arms.length===4&&arms.every(a=>a.verification.comparison_eligible),...cohortBounds(scenario)};
}
