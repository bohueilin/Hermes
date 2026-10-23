import {validateCohortScenario,COHORT_VERSIONS,FLOW_TRUST,COHORT_RULES,cohortObject,cohortArray} from './depot-cohort-contract.js';
// Independent reconstruction. No engine, scheduler, settlement or metric helpers are imported.
export function verifyCohort(record){
  const checks=[];
  const demand=(ok,message)=>{if(!ok)throw Error(message);};
  const passed=(name,rule)=>checks.push({name,status:'PASS',rule});
  try{
    cohortObject(record,['versions',...Object.keys(FLOW_TRUST),'scenario','rule','execution_status','policy_status','end_s','events','intervals','diagnostics','totals']);
    validateCohortScenario(record.scenario);const s=record.scenario,q=s.time_quantum_ms/1000,budget=s.uplink_bytes_s*q,ids=s.vehicles.map(v=>v.id);
    cohortObject(record.versions,Object.keys(COHORT_VERSIONS));
    demand(Object.entries(COHORT_VERSIONS).every(([k,v])=>record.versions[k]===v)&&Object.entries(FLOW_TRUST).every(([k,v])=>record[k]===v)&&COHORT_RULES.some(r=>r.id===record.rule),'Unknown version, trust state or policy.');
    passed('Record contract','Known separate NF-02 versions, quantum, scope and policy; no authority.');
    cohortArray(record.intervals,6000);cohortArray(record.events,100);cohortArray(record.diagnostics,1);
    demand(Number.isSafeInteger(record.end_s/q)&&record.end_s>=0&&record.end_s<=s.horizon_s&&record.intervals.length===record.end_s/q,'Ledger must cover exactly the bounded slot horizon.');
    const state=Object.fromEntries(s.vehicles.map(v=>[v.id,{bytes:0,post:0,finished:{},ready:null}])),events=[];
    const add=(t,type,vehicle,task=null)=>events.push({seq:events.length,time_s:t,type,vehicle,task});
    function boundary(t){
      for(const v of s.vehicles){const x=state[v.id];
        for(const task of ['upload','charge','post']){
          const complete=task==='upload'?x.bytes===v.upload_bytes:task==='charge'?true:x.finished.upload!==undefined&&x.post===v.post_s;
          if(complete&&x.finished[task]===undefined){x.finished[task]=t;add(t,'complete',v.id,task);}
        }
        if(x.ready===null&&['upload','charge','post'].every(task=>x.finished[task]!==undefined)){x.ready=t;add(t,'ready',v.id);}
      }
      for(const v of s.vehicles)if(v.deadline_s===t)add(t,'deadline',v.id);
    }
    s.vehicles.forEach(v=>add(0,'arrival',v.id));boundary(0);let holder=null;
    for(let k=0;k<record.intervals.length;k++){
      const i=record.intervals[k],label=`Slot ${k}`;
      cohortObject(i,['id','start_s','end_s','upload','charge','grants','unused']);
      demand(i.id===k&&i.start_s===k*q&&i.end_s===(k+1)*q,`${label}: noncontiguous slot boundary.`);
      const eligible=s.vehicles.filter(v=>state[v.id].bytes<v.upload_bytes),eligibleIds=eligible.map(v=>v.id);
      for(const key of ['grants','upload','unused']){
        cohortObject(i[key],eligibleIds,false);
        demand(Object.values(i[key]).every(n=>Number.isSafeInteger(n)&&n>=0),`${label}: invalid ${key}.`);
      }
      cohortObject(i.charge,[]);
      demand(Object.values(i.grants).reduce((sum,n)=>sum+n,0)<=budget,`${label}: grant exceeds capacity.`);
      // Independently select the holder and construct the exact eligible-ring grants.
      const expected={};
      if(budget&&eligible.length){
        if(record.rule==='cohort_equal_uplink'){
          const base=Math.floor(budget/eligible.length),remainder=budget-base*eligible.length;
          for(let position=0;position<eligible.length;position++)expected[eligible[position].id]=base+Number((position-k%eligible.length+eligible.length)%eligible.length<remainder);
        }else{
          if(!eligibleIds.includes(holder)){
            let best=eligible[0];
            for(const v of eligible.slice(1)){
              const a=record.rule==='cohort_departure_deadline'?v.deadline_s:record.rule==='cohort_shortest_upload'?v.upload_bytes:v.arrival_s;
              const b=record.rule==='cohort_departure_deadline'?best.deadline_s:record.rule==='cohort_shortest_upload'?best.upload_bytes:best.arrival_s;
              if(a<b||(a===b&&(v.arrival_s<best.arrival_s||(v.arrival_s===best.arrival_s&&v.id<best.id))))best=v;
            }
            holder=best.id;
          }
          expected[holder]=budget;
        }
      }
      demand(ids.every(id=>(i.grants[id]??0)===(expected[id]??0)),`${label}: grants do not implement declared policy.`);
      for(const v of s.vehicles){const x=state[v.id],grant=i.grants[v.id]??0,remaining=v.upload_bytes-x.bytes,bytes=grant<remaining?grant:remaining;
        demand((i.upload[v.id]??0)*q===bytes&&(i.unused[v.id]??0)===grant-bytes,`${label}: useful service or unused grant differs from reconstruction.`);
        if(x.finished.upload!==undefined&&x.finished.post===undefined){x.post+=q;demand(x.post<=v.post_s,`${label}: post step exceeds its work.`);}
        x.bytes+=bytes;
      }
      boundary(i.end_s);
    }
    passed('Slot coverage and capacity','Contiguous bounded slots; feasible integer-byte grants and no unknown work.');
    passed('Declared policy','Serial work is nonpreemptive; equal share rotates over currently eligible stable IDs.');
    passed('Useful service and dependencies','Useful service equals min(grant, remaining); unused bytes are recorded without within-slot reuse; post work follows upload.');
    for(const e of record.events)cohortObject(e,['seq','time_s','type','vehicle','task']);
    demand(events.length===record.events.length&&events.every((e,index)=>Object.entries(e).every(([key,value])=>record.events[index][key]===value)),'Completion inventory or event order differs from reconstruction.');
    passed('Completion inventory and order','Exact arrivals, completions, readiness and deadlines; completion precedes deadline assessment.');
    cohortObject(record.totals,['upload_bytes','energy_j']);for(const key of ['upload_bytes','energy_j'])cohortObject(record.totals[key],ids);
    demand(s.vehicles.every(v=>record.totals.upload_bytes[v.id]===state[v.id].bytes&&record.totals.energy_j[v.id]===0),'Recorded totals differ from reconstructed service.');
    passed('Recorded totals','Stored useful byte and energy totals equal independently integrated service.');
    for(const d of record.diagnostics){cohortObject(d,['time_s','code','message']);demand(d.time_s===record.end_s&&d.code==='POLICY_ERROR'&&typeof d.message==='string'&&d.message.length>0&&d.message.length<=240,'Invalid policy diagnostic.');}
    demand(['completed','cancelled','failed'].includes(record.execution_status)&&['ok','policy_error'].includes(record.policy_status),'Unknown execution state.');
    demand(record.execution_status==='failed'?record.policy_status==='policy_error'&&record.diagnostics.length===1&&record.end_s<s.horizon_s:record.policy_status==='ok'&&record.diagnostics.length===0,'Policy diagnostics and execution state disagree.');
    demand(record.execution_status==='completed'?record.end_s===s.horizon_s:record.end_s<s.horizon_s,'Execution state does not match its observed horizon.');
    passed('Execution state','Complete, cancelled and failed execution stay separate from comparison eligibility.');
    const visits=s.vehicles.map(v=>{const x=state[v.id],r=x.ready;return {vehicle:v.id,ready_s:r,deadline_s:v.deadline_s,outcome:r!==null?(r<=v.deadline_s?'on_time':'late'):(v.deadline_s<=record.end_s?'unfinished_due':'pending'),lateness_lower_bound_s:Math.max(0,(r??record.end_s)-v.deadline_s),tasks:{...x.finished},upload_bytes:x.bytes,energy_j:0};});
    const metrics={ready_s:Object.fromEntries(visits.map(v=>[v.vehicle,v.ready_s])),...Object.fromEntries(['on_time','late','unfinished_due','pending'].map(key=>[key,visits.filter(v=>v.outcome===key).length])),lateness_lower_bound_s:visits.reduce((n,v)=>n+v.lateness_lower_bound_s,0),final_lateness:visits.every(v=>v.ready_s!==null)};
    return {version:COHORT_VERSIONS.verifier,model_validity:'VALID',comparison_eligible:record.execution_status==='completed'&&record.policy_status==='ok',checks,metrics,visits,provenance:{formula_version:COHORT_VERSIONS.metrics,event_sequences:events.map(e=>e.seq),interval_ids:record.intervals.map(i=>i.id)}};
  }catch(error){return {version:COHORT_VERSIONS.verifier,model_validity:'INVALID',comparison_eligible:false,checks:[...checks,{name:'Required evidence',status:'FAIL',rule:String(error.message)}],metrics:null,visits:null};}
}
