import {CAPACITY_VERSIONS,CAPACITY_RULES,FLOW_TRUST,capacityScenario,validateCapacityScenario,cohortObject,recordDigest} from './depot-capacity-contract.js';
import {verifyCapacity} from './depot-capacity-verify.js';
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const byArrival=(a,b)=>a.arrival_s-b.arrival_s||(a.id<b.id?-1:a.id>b.id?1:0);

/**
 * NF-03 slot engine: whole-byte upload grants on one shared link, whole-joule charging on shared ports under one
 * site feed, and a local step after each upload. Policies see only arrived visits and their upload work.
 */
export function simulateCapacity(input,rule,{propose=null,shouldCancel=()=>false}={}){
  validateCapacityScenario(input);if(!CAPACITY_RULES.some(r=>r.id===rule))throw Error('Unknown NF-03 rule.');
  const s=structuredClone(input),q=s.time_quantum_ms/1000;
  const slotBytes=s.uplink_bytes_s*q,capBytes=s.vehicle_uplink_cap_bytes_s*q,siteJ=s.site_power_j_s*q,portJ=s.port_cap_j_s*q;
  const order=[...s.vehicles].sort(byArrival);
  const state=Object.fromEntries(order.map(v=>[v.id,{present:false,bytes:0,joules:0,post:0,done:{},ready:null,port:null}]));
  const events=[],intervals=[],diagnostics=[];let time=0,holder=null,status='completed',policyStatus='ok';
  const add=(type,vehicle,task=null)=>events.push({seq:events.length,time_s:time,type,vehicle,task});
  const finish=(v,task)=>{state[v.id].done[task]=time;add('complete',v.id,task);};
  // Boundary order: close the previous slot (completions, port releases), arrivals, readiness, then deadlines.
  function settle(){
    for(const v of order){const x=state[v.id];if(!x.present)continue;
      if(x.done.upload===undefined&&x.bytes===v.upload_bytes)finish(v,'upload');
      if(x.done.charge===undefined&&x.joules===v.energy_j){finish(v,'charge');x.port=null;}
      if(x.done.upload!==undefined&&x.done.post===undefined&&x.post===v.post_s)finish(v,'post');
    }
    for(const v of order)if(v.arrival_s===time){
      state[v.id].present=true;add('arrival',v.id);
      if(v.upload_bytes===0)finish(v,'upload');
      if(v.energy_j===0)finish(v,'charge');
    }
    for(const v of order){const x=state[v.id];if(x.ready===null&&['upload','charge','post'].every(task=>x.done[task]!==undefined)){x.ready=time;add('ready',v.id);}}
    for(const v of order)if(v.deadline_s===time)add('deadline',v.id);
  }
  settle();
  for(let k=0;time<s.horizon_s;k++){
    if(shouldCancel()){status='cancelled';break;}
    const eligible=order.filter(v=>state[v.id].present&&state[v.id].done.upload===undefined);
    const remaining=v=>v.upload_bytes-state[v.id].bytes;
    let grants={};
    try{
      if(propose)grants=propose(freeze({slot_index:k,time_s:time,time_quantum_ms:s.time_quantum_ms,slot_bytes:slotBytes,uplink_bytes_s:s.uplink_bytes_s,vehicle_cap_bytes:capBytes,eligible:eligible.map(v=>({id:v.id,arrival_s:v.arrival_s,deadline_s:v.deadline_s,remaining_bytes:remaining(v)}))}));
      else if(slotBytes&&eligible.length){
        if(rule==='capacity_equal_uplink'){
          const n=eligible.length;
          grants=Object.fromEntries(eligible.map(v=>[v.id,Math.floor(slotBytes/n)]));
          for(let j=0;j<slotBytes%n;j++)grants[eligible[(k+j)%n].id]++;
          for(const id of Object.keys(grants))grants[id]=Math.min(grants[id],capBytes);
        }else{
          if(!eligible.some(v=>v.id===holder)){
            const rank=v=>rule==='capacity_departure_deadline'?v.deadline_s:rule==='capacity_shortest_upload'?remaining(v):0;
            holder=[...eligible].sort((a,b)=>rank(a)-rank(b)||byArrival(a,b))[0].id;
          }
          grants={[holder]:Math.min(slotBytes,capBytes)};
        }
      }
      cohortObject(grants,eligible.map(v=>v.id),false);
      let total=0;
      for(const n of Object.values(grants)){
        if(!Number.isSafeInteger(n)||n<0)throw Error('Grants must be nonnegative integer bytes.');
        if(n>capBytes)throw Error('A grant exceeds the per-vehicle upload cap.');
        total+=n;
      }
      if(total>slotBytes)throw Error('Grants exceed the slot capacity.');
      if(slotBytes&&eligible.length&&total===0)throw Error('Grants make no progress on available upload work.');
      grants={...grants};
    }catch(error){
      let message='Invalid policy allocation.';try{message=String(error?.message??error).slice(0,240)||message;}catch{/* Unprintable thrown values still end the run with a diagnostic. */}
      status='failed';policyStatus='policy_error';diagnostics.push({time_s:time,code:'POLICY_ERROR',message});break;
    }
    const upload={},unused={};
    for(const v of order){const x=state[v.id],grant=grants[v.id]??0,useful=Math.min(grant,v.upload_bytes-x.bytes);
      if(x.done.upload!==undefined&&x.done.post===undefined)x.post+=q;
      x.bytes+=useful;if(useful)upload[v.id]=useful/q;if(grant>useful)unused[v.id]=grant-useful;
    }
    // Ports admit waiting visits in arrival then ID order, lowest free port first; occupied ports split the site feed.
    const free=Array.from({length:s.charge_ports},(_,n)=>n+1).filter(p=>!order.some(v=>state[v.id].port===p));
    for(const v of order){const x=state[v.id];if(free.length&&x.present&&x.done.charge===undefined&&x.port===null)x.port=free.shift();}
    const holders=order.filter(v=>state[v.id].port!==null),share=holders.length?Math.min(portJ,siteJ/holders.length):0;
    const charge={},power={},powerUnused={},ports={};
    for(const v of holders){const x=state[v.id],useful=Math.min(share,v.energy_j-x.joules);
      x.joules+=useful;ports[v.id]=x.port;power[v.id]=share;if(useful)charge[v.id]=useful/q;if(share>useful)powerUnused[v.id]=share-useful;
    }
    intervals.push({id:k,start_s:time,end_s:time+q,upload,grants,unused,charge,power,power_unused:powerUnused,ports});
    time+=q;settle();
  }
  return {versions:{...CAPACITY_VERSIONS},...FLOW_TRUST,scenario:s,rule,execution_status:status,policy_status:policyStatus,end_s:time,events,intervals,diagnostics,
    totals:{upload_bytes:Object.fromEntries(s.vehicles.map(v=>[v.id,state[v.id].bytes])),energy_j:Object.fromEntries(s.vehicles.map(v=>[v.id,state[v.id].joules]))}};
}

export function runCapacityCell({regime,treatment,rule,time_quantum_ms=1000},runtime={}){
  const scenario=capacityScenario({regime,treatment,time_quantum_ms}),record=simulateCapacity(scenario,rule,runtime);
  return {scenario,record,verification:verifyCapacity(record),digest:recordDigest(record)};
}
export function* capacityCellSteps(cells,runtime={}){
  const results=[];
  for(const [index,cell] of cells.entries()){
    if(runtime.shouldCancel?.())break;
    const result={index,cell,...runCapacityCell(cell,runtime)};results.push(result);yield result;
  }
  return results;
}
