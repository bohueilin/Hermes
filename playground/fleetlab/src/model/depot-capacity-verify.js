import {validateCapacityScenario,CAPACITY_VERSIONS,CAPACITY_RULES,FLOW_TRUST,cohortObject,cohortArray} from './depot-capacity-contract.js';
// Independent read-only reconstruction of an NF-03 record. No engine, scheduler, settlement or metric helper is imported.
export function verifyCapacity(record){
  const checks=[];
  const demand=(ok,message)=>{if(!ok)throw Error(message);};
  const passed=(name,rule)=>checks.push({name,status:'PASS',rule});
  const wholeValues=(object,label)=>demand(Object.values(object).every(n=>Number.isSafeInteger(n)&&n>=0),`${label}: values must be nonnegative integers.`);
  try{
    cohortObject(record,['versions',...Object.keys(FLOW_TRUST),'scenario','rule','execution_status','policy_status','end_s','events','intervals','diagnostics','totals']);
    validateCapacityScenario(record.scenario);
    const s=record.scenario,q=s.time_quantum_ms/1000,ids=s.vehicles.map(v=>v.id);
    const slotBytes=s.uplink_bytes_s*q,capBytes=s.vehicle_uplink_cap_bytes_s*q,siteJ=s.site_power_j_s*q,portJ=s.port_cap_j_s*q;
    cohortObject(record.versions,Object.keys(CAPACITY_VERSIONS));
    demand(Object.entries(CAPACITY_VERSIONS).every(([k,v])=>record.versions[k]===v)&&Object.entries(FLOW_TRUST).every(([k,v])=>record[k]===v)&&CAPACITY_RULES.some(r=>r.id===record.rule),'Unknown version, trust state or rule.');
    passed('Record contract','Known NF-03 versions, frozen workload, scope and rule; no authority.');
    cohortArray(record.intervals,s.horizon_s/q);cohortArray(record.events,6*ids.length);cohortArray(record.diagnostics,1);
    demand(Number.isSafeInteger(record.end_s/q)&&record.end_s>=0&&record.end_s<=s.horizon_s&&record.intervals.length===record.end_s/q,'Ledger must cover exactly the bounded slot horizon.');

    // Arrival then stable ID, the order of every queue and ring in the protocol.
    const queue=[...s.vehicles].sort((a,b)=>a.arrival_s!==b.arrival_s?a.arrival_s-b.arrival_s:a.id<b.id?-1:1);
    const state=Object.fromEntries(ids.map(id=>[id,{bytes:0,joules:0,post:0,finished:{},ready:null,port:null}]));
    const events=[],served={bytes:0,joules:0,portSlots:0};
    const add=(t,type,vehicle,task=null)=>events.push({seq:events.length,time_s:t,type,vehicle,task});
    function boundary(t){
      for(const v of queue){
        if(v.arrival_s>=t)continue;
        const x=state[v.id];
        for(const task of ['upload','charge','post']){
          const complete=task==='upload'?x.bytes===v.upload_bytes:task==='charge'?x.joules===v.energy_j:x.finished.upload!==undefined&&x.post===v.post_s;
          if(complete&&x.finished[task]===undefined){x.finished[task]=t;add(t,'complete',v.id,task);if(task==='charge')x.port=null;}
        }
      }
      for(const v of queue){
        if(v.arrival_s!==t)continue;
        add(t,'arrival',v.id);
        if(v.upload_bytes===0){state[v.id].finished.upload=t;add(t,'complete',v.id,'upload');}
        if(v.energy_j===0){state[v.id].finished.charge=t;add(t,'complete',v.id,'charge');}
      }
      for(const v of queue){const x=state[v.id];if(x.ready===null&&['upload','charge','post'].every(task=>x.finished[task]!==undefined)){x.ready=t;add(t,'ready',v.id);}}
      for(const v of queue)if(v.deadline_s===t)add(t,'deadline',v.id);
    }
    boundary(0);let holder=null;
    for(let k=0;k<record.intervals.length;k++){
      const i=record.intervals[k],label=`Slot ${k}`,t=k*q;
      cohortObject(i,['id','start_s','end_s','upload','grants','unused','charge','power','power_unused','ports']);
      demand(i.id===k&&i.start_s===t&&i.end_s===t+q,`${label}: noncontiguous slot boundary.`);

      // Upload: the eligible ring is every arrived visit with bytes left.
      const eligible=queue.filter(v=>v.arrival_s<=t&&state[v.id].bytes<v.upload_bytes),eligibleIds=eligible.map(v=>v.id);
      for(const key of ['grants','upload','unused']){cohortObject(i[key],eligibleIds,false);wholeValues(i[key],`${label} ${key}`);}
      demand(Object.values(i.grants).reduce((a,b)=>a+b,0)<=slotBytes&&Object.values(i.grants).every(n=>n<=capBytes),`${label}: grants exceed the link or the per-vehicle cap.`);
      const expected={};
      if(slotBytes&&eligible.length){
        if(record.rule==='capacity_equal_uplink'){
          const n=eligible.length,base=Math.floor(slotBytes/n),remainder=slotBytes-base*n;
          eligible.forEach((v,position)=>{const share=base+Number((position-k%n+n)%n<remainder);expected[v.id]=share<capBytes?share:capBytes;});
        }else{
          if(!eligibleIds.includes(holder)){
            const key=v=>record.rule==='capacity_departure_deadline'?v.deadline_s:record.rule==='capacity_shortest_upload'?v.upload_bytes-state[v.id].bytes:v.arrival_s;
            let best=eligible[0];
            for(const v of eligible.slice(1))if(key(v)<key(best))best=v;
            holder=best.id;
          }
          expected[holder]=slotBytes<capBytes?slotBytes:capBytes;
        }
      }
      demand(ids.every(id=>(i.grants[id]??0)===(expected[id]??0)),`${label}: grants do not implement the declared rule.`);
      for(const v of eligible){
        const x=state[v.id],grant=i.grants[v.id]??0,left=v.upload_bytes-x.bytes,bytes=grant<left?grant:left;
        demand((i.upload[v.id]??0)*q===bytes&&(i.unused[v.id]??0)===grant-bytes,`${label}: ${v.id} useful upload or unused grant differs from reconstruction.`);
        x.bytes+=bytes;served.bytes+=bytes;
      }

      // Charging: release happened at the boundary; admit in queue order to the lowest free port.
      const taken=new Set(ids.map(id=>state[id].port).filter(p=>p!==null));
      for(const v of queue){
        const x=state[v.id];
        if(v.arrival_s>t||x.joules>=v.energy_j||x.port!==null)continue;
        let port=1;while(port<=s.charge_ports&&taken.has(port))port++;
        if(port>s.charge_ports)break;
        x.port=port;taken.add(port);
      }
      const occupied=queue.filter(v=>state[v.id].port!==null),occupiedIds=occupied.map(v=>v.id);
      cohortObject(i.ports,occupiedIds);cohortObject(i.power,occupiedIds);
      for(const key of ['charge','power_unused'])cohortObject(i[key],occupiedIds,false);
      for(const key of ['charge','power','power_unused','ports'])wholeValues(i[key],`${label} ${key}`);
      const portNumbers=Object.values(i.ports);
      demand(portNumbers.length<=s.charge_ports&&new Set(portNumbers).size===portNumbers.length&&portNumbers.every(p=>p>=1&&p<=s.charge_ports),`${label}: a port serves two visits or does not exist.`);
      const split=occupied.length?siteJ/occupied.length:0,share=split<portJ?split:portJ;
      for(const v of occupied){
        const x=state[v.id],left=v.energy_j-x.joules,joules=share<left?share:left;
        demand(i.ports[v.id]===x.port,`${label}: ${v.id} holds a port the admission order did not give it.`);
        demand(i.power[v.id]===share&&i.power[v.id]<=portJ,`${label}: ${v.id} power differs from the port and site share.`);
        demand((i.charge[v.id]??0)*q===joules&&(i.power_unused[v.id]??0)===share-joules,`${label}: ${v.id} useful charge or unused power differs from reconstruction.`);
        x.joules+=joules;served.joules+=joules;
      }
      served.portSlots+=occupied.length;

      // The local step runs only after the upload completed at an earlier boundary.
      for(const v of queue){
        const x=state[v.id];
        if(x.finished.upload!==undefined&&x.finished.post===undefined){x.post+=q;demand(x.post<=v.post_s,`${label}: ${v.id} local step exceeds its work.`);}
      }
      boundary(i.end_s);
    }
    passed('Slot coverage and capacity','Contiguous bounded slots; whole-byte grants within the link and per-vehicle cap; no service before arrival.');
    passed('Declared upload rule','Serial rules keep a started upload; equal share rotates remainder bytes over arrived visits in arrival then ID order.');
    passed('Ports and site feed','Ports admit by arrival then ID, one visit per port, held until the energy target; each gets min(port cap, site feed / occupied ports).');
    passed('Useful service and dependencies','Useful service equals min(grant, remaining); unused bytes and joules are recorded, never reused; the local step follows upload.');
    for(const e of record.events)cohortObject(e,['seq','time_s','type','vehicle','task']);
    demand(events.length===record.events.length&&events.every((e,index)=>Object.entries(e).every(([key,value])=>record.events[index][key]===value)),'Event inventory or order differs from reconstruction.');
    passed('Event inventory and order','Exact completions, arrivals, readiness and deadlines in boundary order.');
    cohortObject(record.totals,['upload_bytes','energy_j']);for(const key of ['upload_bytes','energy_j'])cohortObject(record.totals[key],ids);
    demand(ids.every(id=>record.totals.upload_bytes[id]===state[id].bytes&&record.totals.energy_j[id]===state[id].joules),'Recorded totals differ from reconstructed service.');
    passed('Recorded totals','Stored byte and joule totals equal independently integrated useful service.');
    for(const d of record.diagnostics){cohortObject(d,['time_s','code','message']);demand(d.time_s===record.end_s&&d.code==='POLICY_ERROR'&&typeof d.message==='string'&&d.message.length>0&&d.message.length<=240,'Invalid policy diagnostic.');}
    demand(['completed','cancelled','failed'].includes(record.execution_status)&&['ok','policy_error'].includes(record.policy_status),'Unknown execution state.');
    demand(record.execution_status==='failed'?record.policy_status==='policy_error'&&record.diagnostics.length===1&&record.end_s<s.horizon_s:record.policy_status==='ok'&&record.diagnostics.length===0,'Policy diagnostics and execution state disagree.');
    demand(record.execution_status==='completed'?record.end_s===s.horizon_s:record.end_s<s.horizon_s,'Execution state does not match its observed horizon.');
    passed('Execution state','Completed, cancelled and failed runs stay separate from comparison eligibility.');

    const visits=s.vehicles.map(v=>{
      const x=state[v.id],r=x.ready,tasks={upload:x.finished.upload??null,charge:x.finished.charge??null,post:x.finished.post??null};
      const last=r===null?[]:Object.keys(tasks).filter(task=>tasks[task]===r);
      return {vehicle:v.id,wave:v.wave,arrival_s:v.arrival_s,deadline_s:v.deadline_s,ready_s:r,
        outcome:r!==null?(r<=v.deadline_s?'on_time':'late'):(v.deadline_s<=record.end_s?'unfinished_due':'pending'),
        lateness_s:r===null?null:Math.max(0,r-v.deadline_s),lateness_lower_bound_s:Math.max(0,(r??record.end_s)-v.deadline_s),
        tasks,last_prerequisite:last,unfinished:{upload_bytes:v.upload_bytes-x.bytes,energy_j:v.energy_j-x.joules,post_s:v.post_s-x.post}};
    });
    const count=outcome=>visits.filter(v=>v.outcome===outcome).length,final=visits.every(v=>v.ready_s!==null);
    const metrics={ready_s:Object.fromEntries(visits.map(v=>[v.vehicle,v.ready_s])),on_time:count('on_time'),late:count('late'),unfinished_due:count('unfinished_due'),pending:count('pending'),
      missed:count('late')+count('unfinished_due'),lateness_s:final?visits.reduce((n,v)=>n+v.lateness_s,0):null,final_lateness:final,
      lateness_lower_bound_s:visits.reduce((n,v)=>n+v.lateness_lower_bound_s,0),
      utilization:{uplink_bytes_served:served.bytes,uplink_bytes_available:s.uplink_bytes_s*record.end_s,site_j_served:served.joules,site_j_available:s.site_power_j_s*record.end_s,port_slots_used:served.portSlots,port_slots_available:s.charge_ports*record.intervals.length}};
    return {version:CAPACITY_VERSIONS.verifier,model_validity:'VALID',comparison_eligible:record.execution_status==='completed'&&record.policy_status==='ok',checks,metrics,visits,provenance:{formula_version:CAPACITY_VERSIONS.metrics,event_sequences:events.map(e=>e.seq),interval_ids:record.intervals.map(i=>i.id)}};
  }catch(error){return {version:CAPACITY_VERSIONS.verifier,model_validity:'INVALID',comparison_eligible:false,checks:[...checks,{name:'Required evidence',status:'FAIL',rule:String(error.message)}],metrics:null,visits:null};}
}
