import {validateCapacityScenario,CAPACITY_VERSIONS,CAPACITY_RULES,FLOW_TRUST,cohortObject,cohortArray} from './depot-capacity-contract.js';
// Independent read-only reconstruction of an NF-03 record. No engine, scheduler, settlement or metric helper is imported.
const INTERVAL_KEYS=['id','start_s','end_s','upload','grant_bytes','unused_bytes','charge','grant_j','unused_j','ports'];
export function verifyCapacity(record){
  const checks=[];let where='record';
  const demand=(ok,message)=>{if(!ok)throw Error(message);};
  const passed=(name,rule)=>checks.push({name,status:'PASS',rule});
  try{
    cohortObject(record,['versions',...Object.keys(FLOW_TRUST),'scenario','rule','execution_status','policy_status','end_s','events','intervals','diagnostics','totals']);
    validateCapacityScenario(record.scenario);
    const s=record.scenario,q=s.time_quantum_ms/1000,ids=s.vehicles.map(v=>v.id);
    const slotBytes=s.uplink_bytes_s*q,capBytes=s.vehicle_uplink_cap_bytes_s*q,siteJ=s.site_power_j_s*q,portJ=s.port_cap_j_s*q;
    cohortObject(record.versions,Object.keys(CAPACITY_VERSIONS));
    demand(Object.entries(CAPACITY_VERSIONS).every(([k,v])=>record.versions[k]===v)&&Object.entries(FLOW_TRUST).every(([k,v])=>record[k]===v)&&CAPACITY_RULES.some(r=>r.id===record.rule),'Unknown version, trust state or rule.');
    passed('Record contract','Known NF-03 versions, frozen workload, scope and rule; no authority.');
    // At most six events per visit: arrival, three completions, ready and deadline.
    cohortArray(record.intervals,s.horizon_s/q);cohortArray(record.events,6*ids.length);cohortArray(record.diagnostics,1);
    demand(Object.is(record.end_s,record.intervals.length*q),'Ledger must cover exactly the bounded slot horizon.');

    // Arrival then stable ID, the order of every queue and ring in the protocol.
    const queue=[...s.vehicles].sort((a,b)=>a.arrival_s!==b.arrival_s?a.arrival_s-b.arrival_s:a.id<b.id?-1:1);
    const state=Object.fromEntries(ids.map(id=>[id,{bytes:0,joules:0,post:0,finished:{},ready:null,port:null}]));
    const events=[],served={bytes:0,joules:0,portSlots:0};
    const add=(t,type,vehicle,task=null)=>events.push({seq:events.length,time_s:t,type,vehicle,task});
    const finish=(v,task,t)=>{state[v.id].finished[task]=t;add(t,'complete',v.id,task);};
    function boundary(t){
      for(const v of queue){
        if(v.arrival_s>=t)continue;
        const x=state[v.id];
        if(x.finished.upload===undefined&&x.bytes===v.upload_bytes)finish(v,'upload',t);
        if(x.finished.charge===undefined&&x.joules===v.energy_j){finish(v,'charge',t);x.port=null;}
        if(x.finished.post===undefined&&x.finished.upload!==undefined&&x.post===v.post_s)finish(v,'post',t);
      }
      for(const v of queue){
        if(v.arrival_s!==t)continue;
        add(t,'arrival',v.id);
        if(v.upload_bytes===0)finish(v,'upload',t);
        if(v.energy_j===0)finish(v,'charge',t);
      }
      for(const v of queue){const x=state[v.id];if(x.ready===null&&['upload','charge','post'].every(task=>x.finished[task]!==undefined)){x.ready=t;add(t,'ready',v.id);}}
      for(const v of queue)if(v.deadline_s===t)add(t,'deadline',v.id);
    }
    // upload and charge are useful rates per second; grant_bytes, unused_bytes, grant_j and unused_j are amounts per slot.
    // Each per-slot object holds exactly the reconstructed entries, all positive, so a zero, -0 or extra entry fails.
    const exactly=(object,expected,message)=>{
      cohortObject(object,ids,false);
      const differs=ids.find(id=>!Object.is(Object.hasOwn(object,id)?object[id]:undefined,expected[id]));
      demand(differs===undefined,`${message}; first difference at ${differs}.`);
    };
    const rank=v=>{
      if(record.rule==='capacity_departure_deadline')return v.deadline_s;
      if(record.rule==='capacity_shortest_upload')return v.upload_bytes-state[v.id].bytes;
      return v.arrival_s;
    };
    boundary(0);let holder=null;
    for(let k=0;k<record.intervals.length;k++){
      const i=record.intervals[k],t=k*q,slot=`slot ${k}`;where=slot;
      cohortObject(i,INTERVAL_KEYS);
      demand(Object.is(i.id,k)&&Object.is(i.start_s,t)&&Object.is(i.end_s,t+q),'noncontiguous slot boundary.');

      // Upload: the eligible ring is every arrived visit with bytes left.
      const eligible=queue.filter(v=>v.arrival_s<=t&&state[v.id].bytes<v.upload_bytes),grants={};
      if(eligible.length){
        if(record.rule==='capacity_equal_uplink'){
          const n=eligible.length,base=Math.floor(slotBytes/n),remainder=slotBytes-base*n;
          // +1 for the `remainder` positions starting at k mod n.
          eligible.forEach((v,position)=>{grants[v.id]=Math.min(base+Number((position-k%n+n)%n<remainder),capBytes);});
        }else{
          if(!eligible.some(v=>v.id===holder)){
            // Strict < keeps the earlier visit in arrival then ID order when ranks tie.
            let best=eligible[0];
            for(const v of eligible.slice(1))if(rank(v)<rank(best))best=v;
            holder=best.id;
          }
          grants[holder]=Math.min(slotBytes,capBytes);
        }
      }
      where=`${slot} grant_bytes`;cohortObject(i.grant_bytes,ids,false);
      const granted=Object.values(i.grant_bytes);
      // Specific message: the exact comparison below would also fail.
      demand(granted.reduce((a,b)=>a+b,0)<=slotBytes&&granted.every(n=>n<=capBytes),'grants exceed the link or the per-vehicle cap.');
      exactly(i.grant_bytes,grants,'grants do not implement the declared rule');
      const upload={},unusedBytes={};
      for(const v of eligible){
        const x=state[v.id],grant=grants[v.id]??0,bytes=Math.min(grant,v.upload_bytes-x.bytes);
        if(bytes>0)upload[v.id]=bytes/q;
        if(grant>bytes)unusedBytes[v.id]=grant-bytes;
        x.bytes+=bytes;served.bytes+=bytes;
      }
      where=`${slot} upload`;exactly(i.upload,upload,'useful upload differs from reconstruction');
      where=`${slot} unused_bytes`;exactly(i.unused_bytes,unusedBytes,'unused bytes differ from reconstruction');

      // Charging: release happened at the boundary; admit in queue order to the lowest free port.
      const taken=new Set(ids.map(id=>state[id].port).filter(p=>p!==null));
      for(const v of queue){
        const x=state[v.id];
        if(v.arrival_s>t||x.joules>=v.energy_j||x.port!==null)continue;
        let port=1;while(port<=s.charge_ports&&taken.has(port))port++;
        if(port>s.charge_ports)break;
        x.port=port;taken.add(port);
      }
      const occupied=queue.filter(v=>state[v.id].port!==null),share=occupied.length?Math.min(portJ,siteJ/occupied.length):0;
      const ports={},grantJ={},charge={},unusedJ={};
      for(const v of occupied){
        const x=state[v.id],joules=Math.min(share,v.energy_j-x.joules);
        ports[v.id]=x.port;grantJ[v.id]=share;
        if(joules>0)charge[v.id]=joules/q;
        if(share>joules)unusedJ[v.id]=share-joules;
        x.joules+=joules;served.joules+=joules;
      }
      served.portSlots+=occupied.length;
      where=`${slot} ports`;cohortObject(i.ports,ids,false);
      const portNumbers=Object.values(i.ports);
      // Specific message: the exact comparison below would also fail.
      demand(new Set(portNumbers).size===portNumbers.length&&portNumbers.every(p=>p>=1&&p<=s.charge_ports),'a port serves two visits or does not exist.');
      exactly(i.ports,ports,'ports differ from the admission order');
      where=`${slot} grant_j`;exactly(i.grant_j,grantJ,'power differs from min(port cap, site feed / occupied ports)');
      where=`${slot} charge`;exactly(i.charge,charge,'useful charge differs from reconstruction');
      where=`${slot} unused_j`;exactly(i.unused_j,unusedJ,'unused energy differs from reconstruction');

      // The local step runs only after the upload completed at an earlier boundary.
      for(const v of queue){const x=state[v.id];if(x.finished.upload!==undefined&&x.finished.post===undefined)x.post+=q;}
      boundary(t+q);
    }
    passed('Slot coverage and capacity','Contiguous bounded slots; whole-byte grants within the link and per-vehicle cap; no service before arrival.');
    passed('Declared upload rule','Serial rules keep a started upload; equal share rotates remainder bytes over arrived visits in arrival then ID order.');
    passed('Ports and site feed','Ports admit by arrival then ID, one visit per port, held until the energy target; each gets min(port cap, site feed / occupied ports).');
    passed('Useful service and dependencies','Useful service equals min(grant, remaining); unused bytes and joules are recorded, never reused; the local step follows upload.');
    where='events';
    for(const e of record.events)cohortObject(e,['seq','time_s','type','vehicle','task']);
    const firstEvent=Array.from({length:Math.max(events.length,record.events.length)},(_,n)=>n)
      .find(n=>!events[n]||!record.events[n]||Object.entries(events[n]).some(([key,value])=>!Object.is(record.events[n][key],value)));
    demand(firstEvent===undefined,`inventory or order differs from reconstruction at seq ${firstEvent}.`);
    passed('Event inventory and order','Exact completions, arrivals, readiness and deadlines in boundary order.');
    where='totals';
    cohortObject(record.totals,['upload_bytes','energy_j']);for(const key of ['upload_bytes','energy_j'])cohortObject(record.totals[key],ids);
    const wrongTotal=ids.find(id=>!Object.is(record.totals.upload_bytes[id],state[id].bytes)||!Object.is(record.totals.energy_j[id],state[id].joules));
    demand(wrongTotal===undefined,`${wrongTotal} differs from the integrated useful service.`);
    passed('Recorded totals','Stored byte and joule totals equal independently integrated useful service.');
    where='execution state';
    for(const d of record.diagnostics){cohortObject(d,['time_s','code','message']);demand(Object.is(d.time_s,record.end_s)&&d.code==='POLICY_ERROR'&&typeof d.message==='string'&&d.message.length>0&&d.message.length<=240,'Invalid policy diagnostic.');}
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
  }catch(error){return {version:CAPACITY_VERSIONS.verifier,model_validity:'INVALID',comparison_eligible:false,checks:[...checks,{name:'Required evidence',status:'FAIL',rule:`${where}: ${String(error?.message??error)}`}],metrics:null,visits:null};}
}
