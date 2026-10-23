import {validateFlowScenario,FLOW_VERSIONS,FLOW_TRUST,FLOW_RULES} from './depot-flow-contract.js';
// Independent read-only reconstruction: no simulator, scheduler, settlement or metric helper imports.
export function verifyFlow(record){
  const checks=[];
  const check=(name,ok,rule)=>{checks.push({name,status:ok?'PASS':'FAIL',rule});if(!ok)throw Error(name);};
  try{
    validateFlowScenario(record.scenario);const s=record.scenario;
    check('Record contract',Object.entries(FLOW_VERSIONS).every(([k,v])=>record.versions?.[k]===v)&&Object.entries(FLOW_TRUST).every(([k,v])=>record[k]===v)&&FLOW_RULES.some(r=>r.id===record.rule),'Known versions, scope and rule; no authority.');
    check('Bounded ledger',Array.isArray(record.intervals)&&record.intervals.length<=1000&&Array.isArray(record.events)&&record.events.length<=10000&&Number.isSafeInteger(record.end_s)&&record.end_s>=0&&record.end_s<=s.horizon_s,'0 ≤ record end ≤ horizon; ≤1,000 service intervals.');
    const states=Object.fromEntries(s.vehicles.map(v=>[v.id,{bytes:0,joules:0,postSeconds:0,finished:{},ready:null}])),expected=[];
    const add=(t,type,vehicle,task=null)=>expected.push({seq:expected.length,time_s:t,type,vehicle,task});
    const boundary=t=>{
      for(const v of s.vehicles){const x=states[v.id];
        if(x.bytes===v.upload_bytes&&x.finished.upload===undefined){x.finished.upload=t;add(t,'complete',v.id,'upload');}
        if(x.joules===v.energy_j&&x.finished.charge===undefined){x.finished.charge=t;add(t,'complete',v.id,'charge');}
        if(x.finished.upload!==undefined&&x.postSeconds===v.post_s&&x.finished.post===undefined){x.finished.post=t;add(t,'complete',v.id,'post');}
        if(Object.keys(x.finished).length===3&&x.ready===null){x.ready=t;add(t,'ready',v.id);}
      }
      for(const v of s.vehicles)if(v.deadline_s===t)add(t,'deadline',v.id);
    };
    s.vehicles.forEach(v=>add(0,'arrival',v.id));boundary(0);let previous=0,serialHolder=null;
    for(const [index,i] of record.intervals.entries()){
      check(`Interval ${index} continuity`,i.id===index&&i.start_s===previous&&Number.isSafeInteger(i.end_s)&&i.end_s>i.start_s&&i.end_s<=record.end_s,'Positive contiguous integer-second intervals.');
      const dt=i.end_s-i.start_s;
      for(const [key,cap] of [['upload',s.uplink_bytes_s],['charge',s.charger_j_s]]){
        check(`Interval ${index} ${key} allocation`,i[key]&&typeof i[key]==='object'&&!Array.isArray(i[key])&&Object.entries(i[key]).every(([id,r])=>Object.hasOwn(states,id)&&Number.isSafeInteger(r)&&r>=0)&&Object.values(i[key]).reduce((a,b)=>a+b,0)<=cap&&(key!=='charge'||Object.values(i[key]).filter(r=>r>0).length<=1),`Sum of ${key} rates ≤ ${cap} ${key==='upload'?'bytes/s':'J/s'}; charger has one port.`);
      }
      const eligible=s.vehicles.filter(v=>states[v.id].bytes<v.upload_bytes);
      if(!eligible.some(v=>v.id===serialHolder))serialHolder=[...eligible].sort((a,b)=>(record.rule==='nf_departure_deadline'?a.deadline_s-b.deadline_s:0)||a.arrival_s-b.arrival_s||a.id.localeCompare(b.id))[0]?.id??null;
      const charging=s.vehicles.find(v=>states[v.id].joules<v.energy_j)?.id;
      check(`Interval ${index} declared rule`,s.vehicles.every(v=>(i.upload[v.id]??0)===(record.rule==='nf_equal_uplink'?(eligible.some(e=>e.id===v.id)?s.uplink_bytes_s/eligible.length:0):(v.id===serialHolder?s.uplink_bytes_s:0)))&&s.vehicles.every(v=>(i.charge[v.id]??0)===(v.id===charging?s.charger_j_s:0)),'Accepted allocations match the declared rule; serial transfers retain their holder; one charger uses arrival and ID order.');
      for(const v of s.vehicles){const x=states[v.id],bytes=(i.upload[v.id]??0)*dt,joules=(i.charge[v.id]??0)*dt;
        check(`Interval ${index} ${v.id} conservation`,Number.isSafeInteger(bytes)&&Number.isSafeInteger(joules)&&x.bytes+bytes<=v.upload_bytes&&x.joules+joules<=v.energy_j,'Accepted service never exceeds required work.');
        // A producer cannot hide earlier completion inside a longer interval.
        if(i.upload[v.id])check(`Interval ${index} ${v.id} upload boundary`,(v.upload_bytes-x.bytes)/i.upload[v.id]>=dt,'No upload completion before interval end.');
        if(i.charge[v.id])check(`Interval ${index} ${v.id} charge boundary`,(v.energy_j-x.joules)/i.charge[v.id]>=dt,'No charge completion before interval end.');
        if(x.finished.upload!==undefined&&x.finished.post===undefined){check(`Interval ${index} ${v.id} dependency`,x.postSeconds+dt<=v.post_s,'Independent post step starts after upload and finishes at an event boundary.');x.postSeconds+=dt;}
        check(`Interval ${index} ${v.id} deadline`,!(v.deadline_s>i.start_s&&v.deadline_s<i.end_s),'Deadline is an explicit boundary.');
        x.bytes+=bytes;x.joules+=joules;
      }
      previous=i.end_s;boundary(previous);
    }
    check('End coverage',previous===record.end_s,'Ledger covers exactly the observed interval.');
    check('Completion inventory and order',JSON.stringify(expected)===JSON.stringify(record.events),'Exact reconstructed arrivals, completions, readiness and deadlines; completions precede deadline assessment.');
    check('Recorded totals',s.vehicles.every(v=>record.totals?.upload_bytes?.[v.id]===states[v.id].bytes&&record.totals?.energy_j?.[v.id]===states[v.id].joules),'Totals equal reconstructed bytes and joules.');
    check('Execution state',['completed','cancelled','failed'].includes(record.execution_status)&&['ok','policy_error'].includes(record.policy_status)&&(record.execution_status!=='completed'||record.end_s===s.horizon_s)&&(record.policy_status==='policy_error'?record.execution_status==='failed'&&record.diagnostics?.length>0:record.execution_status!=='failed'),'Completed reaches declared horizon; a policy error ends the arm with diagnostics.');
    const visits=s.vehicles.map(v=>{const x=states[v.id],r=x.ready;return {vehicle:v.id,ready_s:r,deadline_s:v.deadline_s,outcome:r!==null?(r<=v.deadline_s?'on_time':'late'):(v.deadline_s<=record.end_s?'unfinished_due':'pending'),lateness_lower_bound_s:Math.max(0,(r??record.end_s)-v.deadline_s),tasks:{...x.finished},upload_bytes:x.bytes,energy_j:x.joules};});
    const metrics={ready_s:Object.fromEntries(visits.map(v=>[v.vehicle,v.ready_s])),...Object.fromEntries(['on_time','late','unfinished_due','pending'].map(key=>[key,visits.filter(v=>v.outcome===key).length])),lateness_lower_bound_s:visits.reduce((n,v)=>n+v.lateness_lower_bound_s,0),final_lateness:visits.every(v=>v.ready_s!==null)};
    return {version:FLOW_VERSIONS.verifier,model_validity:'VALID',comparison_eligible:record.execution_status==='completed'&&record.policy_status==='ok',checks,metrics,visits,provenance:{formula_version:FLOW_VERSIONS.metrics,event_sequences:expected.map(e=>e.seq),interval_ids:record.intervals.map(i=>i.id)}};
  }catch(error){return {version:FLOW_VERSIONS.verifier,model_validity:'INVALID',comparison_eligible:false,checks:[...checks,...(checks.at(-1)?.status==='FAIL'?[]:[{name:'Required evidence',status:'FAIL',rule:String(error.message)}])],metrics:null,visits:null};}
}
