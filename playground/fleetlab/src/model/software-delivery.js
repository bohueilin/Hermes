// Bounded whole-file software delivery. The verifier has an independent implementation.
import {DELIVERY_RECORD_SCHEMA,DELIVERY_POLICY_VERSION,DELIVERY_BOUNDS,normalizeDeliveryInput,
  canonicalDelivery,deliveryDigest} from './software-delivery-contract.js';

const ascii=(a,b)=>a<b?-1:a>b?1:0;
const fail=reason=>{throw new TypeError(`software-delivery engine: ${reason}`);};
function integer(value,name){if(!Number.isSafeInteger(value)||Object.is(value,-0)||value<0)fail(`invalid ${name}`);return value;}
function allocate(universe,eligible,cursor,budget_bytes){
  const rows=eligible.map(e=>({...e,grant_bytes:0})).sort((a,b)=>ascii(a.id,b.id));
  let active=rows.filter(e=>Math.min(e.remaining_bytes,e.cap_bytes)>0),unused_bytes=budget_bytes,next=cursor;
  while(unused_bytes>0&&active.length){
    const share=Math.floor(unused_bytes/active.length);
    if(share>0){
      // Freeze the complete round before spending it: cap exhaustion cannot alter a peer's share.
      const additions=active.map(e=>Math.min(share,Math.min(e.remaining_bytes,e.cap_bytes)-e.grant_bytes));
      active.forEach((e,i)=>{e.grant_bytes+=additions[i];unused_bytes-=additions[i];});
    }else{
      const start=universe.indexOf(next);
      const id=Array.from({length:universe.length},(_,i)=>universe[(start+i)%universe.length]).find(id=>active.some(e=>e.id===id));
      active.find(e=>e.id===id).grant_bytes++;unused_bytes--;
      next=universe[(universe.indexOf(id)+1)%universe.length];
    }
    active=active.filter(e=>e.grant_bytes<Math.min(e.remaining_bytes,e.cap_bytes));
  }
  return {cursor_in:cursor,cursor_out:next,budget_bytes,unused_bytes,eligible:rows};
}

/** Small allocator-only fixtures; the runtime calls the same core after validated input. */
export function allocateDelivery(raw){
  canonicalDelivery(raw,DELIVERY_BOUNDS.maxInputBytes);
  const {universe,eligible,cursor,budget_bytes}=raw;
  if(!Array.isArray(universe)||universe.length<1||universe.length>4||universe.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]{1,32}$/.test(id)))fail('universe');
  if(new Set(universe).size!==universe.length)fail('duplicate universe ID');
  if(!universe.includes(cursor))fail('cursor outside universe');
  if(!Array.isArray(eligible)||eligible.length>universe.length)fail('eligible bound');
  const seen=new Set();
  for(const row of eligible){
    if(!universe.includes(row.id))fail('eligible ID outside universe');
    if(seen.has(row.id))fail('duplicate eligible ID');seen.add(row.id);
    integer(row.remaining_bytes,'remaining_bytes');integer(row.cap_bytes,'cap_bytes');
  }
  integer(budget_bytes,'budget_bytes');return allocate([...universe].sort(ascii),eligible,cursor,budget_bytes);
}

const TYPES=['wan_received','local_received','check_started','check_passed','check_failed','activation_started','activation_completed','ready'];
const terminalTypes=new Set(['wan_received','local_received','check_passed','check_failed','activation_completed']);

/** Returns a full-horizon record. It never reruns a simulator or makes a deployment decision. */
export function runDelivery(raw,policy){
  if(policy!=='repeated'&&policy!=='cold')fail('unsupported policy');
  const input=normalizeDeliveryInput(raw),q=input.quantum_ms,H=input.H_ms,S=input.artifact.size_bytes;
  const slots=H/q,N=input.requests.length;
  if((slots+1)*3+slots*N+N*8+1>DELIVERY_BOUNDS.maxEntries)fail('record entry bound');
  const outcomes=input.requests.map(r=>({id:r.id,arrival_applied_ms:null,wan_completed_ms:null,local_completed_ms:null,
    check_started_ms:null,check_completed_ms:null,activation_started_ms:null,ready_ms:null,failed_ms:null,
    deadline_ms:r.deadline_ms,wan_bytes:0,local_bytes:0}));
  const states=input.requests.map((request,i)=>({request,outcome:outcomes[i],checkDue:null,activationDue:null,activationDone:null}));
  const byRequest=new Map(states.map(s=>[s.request.id,s]));
  const universe=[...input.requests.map(r=>({id:`loc-${r.id}`,resource:'local',owner_kind:'request',request_id:r.id})),
    ...(policy==='cold'?[{id:'depot-fetch',resource:'wan',owner_kind:'depot_cache',request_id:null}]:
      input.requests.map(r=>({id:`wan-${r.id}`,resource:'wan',owner_kind:'request',request_id:r.id})))].sort((a,b)=>ascii(a.id,b.id));
  const transfers=universe.map(u=>({...u,remaining:S,completed:null}));
  const ids=Object.fromEntries(['wan','local'].map(resource=>[resource,universe.filter(u=>u.resource===resource).map(u=>u.id)]));
  const cursors={wan:ids.wan[0],local:ids.local[0]};
  const record={schema:DELIVERY_RECORD_SCHEMA,policy_version:DELIVERY_POLICY_VERSION,input,input_digest:deliveryDigest(input),policy,
    universe,boundaries:[],resources:[],tasks:[],inventory:[],outcomes,metrics:null};
  let cacheComplete=null,entryCount=0;
  const emit=(t_ms,phase,owner_kind,request_id,type)=>record.tasks.push({t_ms,phase,owner_kind,request_id,type});
  const task=(t_ms,phase,state,type)=>emit(t_ms,phase,'request',state.request.id,type);
  const finishCheck=(t,phase,state)=>{
    state.outcome.check_completed_ms=t;
    if(state.request.check_outcome==='fail'){state.outcome.failed_ms=t;task(t,phase,state,'check_failed');}
    else task(t,phase,state,'check_passed');
  };
  for(let t=0;t<=H;t+=q){
    const taskStart=record.tasks.length;
    // Phase 1: bytes and positive-duration completions from the preceding interval.
    for(const transfer of transfers)if(transfer.remaining===0&&transfer.completed===null){
      transfer.completed=t;emit(t,1,transfer.owner_kind,transfer.request_id,transfer.resource==='wan'?'wan_received':'local_received');
      if(transfer.owner_kind==='depot_cache'){cacheComplete=t;record.inventory.push({t_ms:t,type:'commit',artifact_id:input.artifact.id});}
      else byRequest.get(transfer.request_id).outcome[transfer.resource==='wan'?'wan_completed_ms':'local_completed_ms']=t;
    }
    for(const state of states){
      if(state.checkDue===t)finishCheck(t,1,state);
      if(state.activationDue===t){state.activationDone=t;task(t,1,state,'activation_completed');}
    }
    // Phase 2: the first boundary at or after each raw arrival/source time.
    const arrivals=[];
    for(const state of states)if(state.outcome.arrival_applied_ms===null&&state.request.arrival_ms<=t){state.outcome.arrival_applied_ms=t;arrivals.push(state.request.id);}
    const source_available=input.artifact.available_at_ms<=t;
    record.boundaries.push({t_ms:t,arrivals,source_available});
    // Phase 3: the fixed chain is acyclic; zero tasks close once even at H.
    for(const state of states){
      const o=state.outcome,r=state.request;
      if(o.local_completed_ms!==null&&o.check_started_ms===null&&r.check_ms===0){o.check_started_ms=t;task(t,3,state,'check_started');finishCheck(t,3,state);}
      if(o.check_completed_ms!==null&&o.failed_ms===null&&o.activation_started_ms===null&&r.activation_ms===0){
        o.activation_started_ms=t;state.activationDone=t;task(t,3,state,'activation_started');task(t,3,state,'activation_completed');
      }
    }
    // Phase 4: readiness uses completed state and the raw inclusive deadline.
    for(const state of states)if(state.activationDone!==null&&state.outcome.ready_ms===null){state.outcome.ready_ms=t;task(t,4,state,'ready');}
    // Phase 5: positive tasks can begin only when an interval remains.
    if(t<H)for(const state of states){
      const o=state.outcome,r=state.request;
      if(o.local_completed_ms!==null&&o.check_started_ms===null){o.check_started_ms=t;state.checkDue=t+Math.ceil(r.check_ms/q)*q;integer(state.checkDue,'check completion');task(t,5,state,'check_started');}
      if(o.check_completed_ms!==null&&o.failed_ms===null&&o.activation_started_ms===null){o.activation_started_ms=t;state.activationDue=t+Math.ceil(r.activation_ms/q)*q;integer(state.activationDue,'activation completion');task(t,5,state,'activation_started');}
    }
    const newTasks=record.tasks.slice(taskStart);
    if(newTasks.filter(e=>terminalTypes.has(e.type)).length>32)fail('boundary terminal transition bound');
    for(const resource of ['wan','local']){
      const config=input.resources[resource],cap_bytes=integer(config.transfer_cap_Bps*q/1000,'slot cap');
      const eligible=[];
      if(t<H)for(const transfer of transfers){
        if(transfer.resource!==resource||transfer.completed!==null)continue;
        const state=transfer.request_id===null?null:byRequest.get(transfer.request_id),arrived=state?.outcome.arrival_applied_ms!==null;
        const permitted=resource==='wan'?
          source_available&&(policy==='cold'?states.some(s=>s.outcome.arrival_applied_ms!==null):arrived):
          arrived&&(policy==='cold'?cacheComplete!==null:state.outcome.wan_completed_ms!==null);
        if(permitted)eligible.push({id:transfer.id,remaining_bytes:transfer.remaining,cap_bytes});
      }
      const slot=allocate(ids[resource],eligible,cursors[resource],t<H?integer(config.aggregate_Bps*q/1000,'slot budget'):0);
      cursors[resource]=slot.cursor_out;record.resources.push({t_ms:t,resource,...slot});
      for(const grant of slot.eligible){
        const transfer=transfers.find(x=>x.id===grant.id);transfer.remaining-=grant.grant_bytes;
        if(transfer.owner_kind==='request')byRequest.get(transfer.request_id).outcome[resource==='wan'?'wan_bytes':'local_bytes']+=grant.grant_bytes;
      }
      entryCount+=1+slot.eligible.length;
    }
    entryCount+=1+newTasks.length;
    if(entryCount+record.inventory.length>DELIVERY_BOUNDS.maxEntries)fail('record entry bound');
  }
  record.tasks.sort((a,b)=>a.t_ms-b.t_ms||a.phase-b.phase||
    (a.owner_kind==='depot_cache'?0:1)-(b.owner_kind==='depot_cache'?0:1)||ascii(a.request_id??'',b.request_id??'')||TYPES.indexOf(a.type)-TYPES.indexOf(b.type));
  const allReady=outcomes.every(o=>o.ready_ms!==null),allTerminal=outcomes.every(o=>o.ready_ms!==null||o.failed_ms!==null);
  const ledger=resource=>integer(transfers.filter(t=>t.resource===resource).reduce((sum,t)=>sum+S-t.remaining,0),`${resource} ledger`);
  record.metrics={request_count:N,on_time_count:outcomes.filter(o=>o.ready_ms!==null&&o.ready_ms<=o.deadline_ms).length,
    all_ready_ms:allReady?Math.max(...outcomes.map(o=>o.ready_ms)):null,
    terminal_ms:allTerminal?Math.max(...outcomes.map(o=>o.ready_ms??o.failed_ms)):H,
    wan_bytes:ledger('wan'),local_bytes:ledger('local'),unique_artifact_bytes:S,storage_provision_bytes:integer(policy==='cold'?S:N*S,'storage provision')};
  // Reserve the exact 83 UTF-8 bytes added by the digest member before accepting a record.
  record.record_digest=deliveryDigest(record,DELIVERY_BOUNDS.maxRecordBytes-83);
  return record;
}
