// Deterministic depot lab engine (contract D1-04, C1.5, C2.2; engineering note 8, 12): an event loop over phases 0 to 6
// with exact interval credit, the fixed policy and an atomic bounded ledger. The caller's step budget never changes results.
import {createState,setFact,setState,setContent,taskFacts,own,free,locate,splitFact,byStr,visible} from './state.js';
import {evaluate,newCache,reasonList,codeKey,workKey,blockageRecords} from './policy.js';
import {maxMin,creditAt,closureTick,undrawnAt,slackAt,subQuantum} from './allocation.js';
import {createWriter,guardLimits,GuardStop,one,vec} from './ledger.js';
import {RationalGuardError,formatRational,eq,ZERO} from './rational.js';
import {computeIdentities,refs,SYNTHETIC,H as hashOf} from './identity.js';
import {ENGINE_VERSION,VERIFIER_VERSION,LEDGER_SCHEMA} from './profiles.js';
import {bandAt,nextBandEdge,MJ_PER_W_TICK} from './units.js';
const byId=(a,b)=>byStr(a.t.id,b.t.id),byFlow=(a,b)=>byStr(a.flow_id,b.flow_id);
const ct=(owner,obj,transition,bytes)=>({bytes,object_id:obj,owner_id:owner,transition});
const tt=(action,obs,task,transition)=>({action_id:action,observation_seq:obs,task_id:task,transition});
const rc=(change,owner,id)=>({change,owner_task_id:owner.t.id,resource_id:id});
const VENDOR_UNITS=[SYNTHETIC.vendorBay,SYNTHETIC.vendorWorker];
// Record vectors hold at most 64 ids (C1.5); a longer exact set refuses the run instead of truncating it.
function ids64(list,what){if(list.length>64)throw new GuardStop('VECTOR_LIMIT',{field:what,entries:list.length,bound:64});return list;}
const hpush=(h,x)=>{h.push(x);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p]<=h[i])break;[h[p],h[i]]=[h[i],h[p]];i=p;}};
const hpop=h=>{const last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<h.length&&h[l]<h[m])m=l;if(r<h.length&&h[r]<h[m])m=r;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m;}}};
// scenario: the validated (normalized) scenario. harness and guardOverrides exist only for tests (BD-15).
export function createDepotRun(scenario,{harness=null,guardOverrides=null}={}){
 if(!Object.isFrozen(scenario))throw new TypeError('createDepotRun expects the frozen scenario returned by validateScenario');
 const guards=guardLimits(guardOverrides),S=createState(scenario,harness),ids=computeIdentities(scenario,harness);
 const w=createWriter({engine_version:ENGINE_VERSION,policy_digest:ids.policy_digest,scenario_digest:ids.scenario_digest,schema:LEDGER_SCHEMA,verifier_version:VERIFIER_VERSION,workload_digest:ids.workload_digest},guards);
 return {S,w,t:0,si:0,heap:[],ends:new Map(),obsSeq:null,digest:null,cancelled:false,result:null};
}
export function cancelDepotRun(R){if(!R.result)R.cancelled=true;}
export function stepDepotRun(R,{maxTicks=Infinity}={}){
 if(R.result)return R.result;
 if(R.cancelled)return finish(R,'CANCELLED',null);
 try{
  for(let n=0;n<maxTicks;n++){
   tick(R,R.t);
   if(R.t===R.S.H)return finish(R,'COMPLETE',null);
   R.t=nextTick(R);
  }
 }catch(e){
  if(e instanceof GuardStop)return finish(R,'INCOMPLETE_RESOURCE_LIMIT',{guard:e.guard,detail:e.detail});
  if(e instanceof RationalGuardError)return finish(R,'INCOMPLETE_RESOURCE_LIMIT',{guard:'RATIONAL_GUARD',detail:e.detail});
  throw e;
 }
 return {done:false,tick:R.t,records:R.w.records.length};
}
export function runDepot(scenario,options={}){const R=createDepotRun(scenario,options);return stepDepotRun(R);}
function finish(R,status,guard){
 const w=R.w;
 return R.result={done:true,ledger:w.ledger(status),terminal_status:status,guard,bytes:w.bytes(status),records:w.records.length};
}
function tick(R,t){
 phase0(R,t);phase1(R,t);phase2(R,t);phase3(R,t);
 // No positive-duration start and no reallocation at H; completions at H count.
 if(t<R.S.H){phase4(R,t);phase5(R,t);}else phase6(R,t);
}
// Next event tick (BD-07): static exogenous/window/due ticks, timed completions, flow closures, H.
function nextTick(R){
 const S=R.S,t=R.t;let n=S.H;
 while(R.si<S.ticks.length&&S.ticks[R.si]<=t)R.si++;
 if(R.si<S.ticks.length)n=Math.min(n,S.ticks[R.si]);
 while(R.heap.length&&R.heap[0]<=t)hpop(R.heap);
 if(R.heap.length)n=Math.min(n,R.heap[0]);
 for(const f of S.flows.values())if(f.iv&&f.iv.c!==null&&f.iv.c<n)n=f.iv.c;
 return n;
}
function progress(f,t,after,slack,undrawn){
 const iv=f.iv,before=iv.before,item={allocation_anchor_tick:iv.a,anchor_credited_after:Number(after),anchor_credited_before:Number(before),credited:Number(after-before),flow_id:f.id,from_tick:iv.from,quantization_slack:formatRational(slack),to_tick:t,undrawn_final_tick:formatRational(undrawn)};
 f.ts.credited+=after-before;iv.before=after;iv.from=t;
 return item;
}
const markDirty=(S,f)=>{S.dirtyDomain[f.dom]=true;};
// Phase 0: prior-interval closures at target or band edge, then completions in task-id order.
function phase0(R,t){
 const S=R.S,w=R.w,done=R.ends.get(t)??[],closing=[];R.ends.delete(t);
 for(const f of S.flows.values())if(f.iv&&f.iv.c===t)closing.push(f);
 if(closing.length){
  closing.sort((a,b)=>byStr(a.id,b.id));
  const items=closing.map(f=>{const iv=f.iv,item=progress(f,t,iv.R,ZERO,undrawnAt(iv.rate,iv.a,t,iv.R));f.iv=null;markDirty(S,f);if(iv.kind==='target')done.push(f.ts);return item;});
  const ev=w.event(t,0,0);vec(ev,'PROGRESS',[items],([c])=>({changes:c}));w.commit(ev);
 }
 for(const ts of done.sort(byId))complete(R,ts,t);
}
function complete(R,ts,t){
 const S=R.S,T=ts.t,v=ts.v,ev=R.w.event(t,0,0),act=ts.action,ch=[];
 one(ev,'TASK_TRANSITION',tt(act,null,T.id,'COMPLETE'));
 for(const id of ts.held){ch.push(rc('RELEASE',ts,id));free(S,id);}
 if(T.kind==='move'){
  // Retained origin is released only now; the reserved destination becomes acquired (D1-08, Q2).
  if(ts.origin){const o=S.owner.get(ts.origin.ref);ch.push(rc('RELEASE',o.task,ts.origin.ref));free(S,ts.origin.ref);}
  if(ts.dest){ch.push(rc('ACQUIRE',ts,ts.dest.ref));own(S,ts.dest.ref,ts,'ACQUIRE');locate(S,v,ts.dest.ref,ts.dest);}
  else if(T.template==='egress'){locate(S,v,'released');v.releasedAt=t;}
  else locate(S,v,'offsite');
 }
 if(T.template==='connect'){const o=S.owner.get(v.port.ref);ch.push(rc('ACQUIRE',o.task,v.port.ref));o.mode='ACQUIRE';}
 if(T.template==='unplug'){const o=S.owner.get(v.port.ref);ch.push(rc('RELEASE',o.task,v.port.ref));free(S,v.port.ref);v.port=null;}
 if(ch.length)one(ev,'RESOURCE_DELTA',{action_id:act,changes:ch.sort((a,b)=>byStr(a.resource_id,b.resource_id))});
 if(T.kind==='data'){
  const d=T.data,b=BigInt(d.bytes);
  one(ev,'CONTENT_TRANSITION',ct(d.cacheFetch?SYNTHETIC.cache:v.ref,d.kind==='logs'?d.object:refs.object(d.object),'OBJECT_COMPLETE',d.bytes));
  setContent(S,ts,'object_complete');
  if(d.direction==='down'&&!d.cacheFetch){v.reserved-=b;v.residency+=b;}
 }
 const tr={CK:'CHECK_COMPLETE',AC:'ACTIVATION_COMPLETE',PC:'POSTCHECK_COMPLETE'}[T.cls];
 if(T.kind==='timed'&&tr)one(ev,'CONTENT_TRANSITION',ct(T.cacheCheck?SYNTHETIC.cache:v.ref,refs.object(T.object),tr,S.objects.get(T.object).size_bytes));
 setState(S,ts,'COMPLETE');ts.end=t;if(v)v.running.delete(ts);
 if(ts.flow){S.flows.delete(ts.flow.id);markDirty(S,ts.flow);}
 for(const d of ts.deps)S.pending.add(d);
 // Completed egress cancels every unfinished optional upload, keeping its received bytes provisional (D12-02).
 if(T.template==='egress')for(const u of v.tasks)if(u.t.template==='upload'&&!u.t.mandatory&&(u.state==='READY'||u.state==='PAUSED')){
  one(ev,'TASK_TRANSITION',tt(act,null,u.t.id,'CANCEL'));
  if(u.credited>0n)one(ev,'CONTENT_TRANSITION',ct(v.ref,u.t.data.object,'RECEIVED_PROVISIONAL',Number(u.credited)));
  setState(S,u,'CANCELLED');if(u.credited>0n)setContent(S,u,'received_provisional');
 }
 R.w.commit(ev);
}
// Phase 1: exogenous changes once per tick; shift ends (rank 0), shift starts (rank 1), arrivals (rank 2).
function phase1(R,t){
 const S=R.S,w=R.w,sh=S.shifts.get(t)??[];
 for(const rank of [0,1])for(const x of sh.filter(y=>y.available===(rank===1)).sort((a,b)=>byStr(a.ref,b.ref))){
  const ev=w.event(t,0,1,rank);one(ev,'SHIFT_CHANGE',{available:x.available,worker_id:x.ref});w.commit(ev);
  setFact(S,x.ref,'worker_available',x.available);
 }
 for(const v of S.arrivals.get(t)??[]){
  const ev=w.event(t,0,1,2);one(ev,'ARRIVAL',{visit_id:v.ref});w.commit(ev);
  v.arrived=true;
  setFact(S,v.ref,'arrived',true);setFact(S,v.ref,'arrival_tick',v.x.arrival_tick);setFact(S,v.ref,'due_tick',v.x.due_tick);setFact(S,v.ref,'location_id',v.location);
  for(const ts of v.tasks){taskFacts(S,ts);S.pending.add(ts);}
  const intake=refs.task(v.id,'intake');
  for(const ts of S.cacheTasks)if(!ts.shown&&ts.t.anyPrereqs.includes(intake)){ts.shown=true;taskFacts(S,ts);}
 }
}
function ready(S,t){
 const list=[...S.pending],acks=[];S.pending.clear();
 for(const ts of list){
  const T=ts.t;
  if(ts.state!=='UNREADY'||(ts.v&&!ts.v.arrived))continue;
  if(!T.prereqs.every(p=>S.tasks.get(p).state==='COMPLETE'))continue;
  if(T.anyPrereqs.length&&!T.anyPrereqs.some(p=>{const x=S.tasks.get(p);return x.state==='COMPLETE'&&x.v.arrived;}))continue;
  ts.readyTick=t;setState(S,ts,'READY');if(visible(ts))setFact(S,T.id,'prerequisite_ready_tick',t);
  if(T.kind==='zero')acks.push(ts);
 }
 return acks;
}
// Phase 2 (microstep 1): window boundaries, readiness, then zero-duration acknowledgments with reclaim.
function phase2(R,t){
 const S=R.S,w=R.w;
 for(const ts of (S.windows.get(t)??[]).filter(x=>x.v.arrived&&x.state!=='COMPLETE'&&x.state!=='CANCELLED').sort(byId)){
  const ev=w.event(t,1,2);one(ev,'WINDOW_OPEN',{task_id:ts.t.id});w.commit(ev);
 }
 let acks=ready(S,t);
 while(acks.length){
  for(const ts of acks.sort(byId)){
   const v=ts.v,b=v.x.initial_log_bytes,obj=refs.logs(v.id),act=refs.action(t,1,w.ordinal(t,1)),ev=w.event(t,1,2);
   one(ev,'TASK_TRANSITION',tt(act,null,ts.t.id,'START'));one(ev,'TASK_TRANSITION',tt(act,null,ts.t.id,'COMPLETE'));
   one(ev,'CONTENT_TRANSITION',ct(v.ref,obj,'DURABLE_ACKNOWLEDGED',b));one(ev,'CONTENT_TRANSITION',ct(v.ref,obj,'RECLAIMED',b));
   w.commit(ev);
   ts.action=act;ts.start=t;ts.end=t;setState(S,ts,'COMPLETE');v.residency-=BigInt(b);
   setContent(S,v.tasks.find(x=>x.t.template==='upload'),'reclaimed');
   for(const d of ts.deps)S.pending.add(d);
  }
  acks=ready(S,t);
 }
}
// Phase 3: one observation group of changed facts (the first is the full snapshot), hash-chained (BD-12, BD-13).
function phase3(R,t){
 const S=R.S,keys=[...S.dirty].filter(k=>!S.pub.has(k)||S.pub.get(k)!==S.facts.get(k)).sort(byStr);S.dirty.clear();
 if(!keys.length&&R.obsSeq!==null)return;
 const facts=keys.map(k=>{const [entity_id,field]=splitFact(k);return {entity_id,field,value:S.facts.get(k)};});
 const dg=hashOf('fleetlab.depot.observation-state.v1',{previous:R.digest,facts}),ev=R.w.event(t,1,3),base=R.obsSeq;
 vec(ev,'OBSERVATION',[facts],([c])=>({base_observation_seq:base,facts:c,state_digest:dg}));
 R.obsSeq=R.w.commit(ev).last;R.digest=dg;
 for(const k of keys)S.pub.set(k,S.facts.get(k));
}
// Phase 4: one pass over the ranked worklist, each proposal checked against prior acceptances of this microstep.
function phase4(R,t){
 const S=R.S,w=R.w,list=[...S.work].sort((a,b)=>workKey(a)-workKey(b));let C=newCache();
 for(const ts of list){
  if(ts.state!=='READY'&&ts.state!=='PAUSED')continue;
  const r=evaluate(S,C,ts,t);
  if(r.ok){accept(R,ts,r,t);C=newCache();continue;}
  const key=codeKey(r.f);if(key===ts.lastKey)continue;
  ts.lastKey=key;
  // Id vectors over 64 entries become a chunk group: chunk k carries the k-th slice of every reason's vectors (BD-E12).
  const reasons=reasonList(r.f),base={accepted:false,action_id:refs.action(t,1,w.ordinal(t,1)),blockage_group_id:null,observation_seq:R.obsSeq,task_id:ts.t.id},ev=w.event(t,1,4);
  vec(ev,'POLICY_DECISION',reasons.flatMap(x=>[x.resource_ids,x.holder_visit_ids]),sl=>({accepted:false,action_id:base.action_id,blockage_group_id:null,observation_seq:base.observation_seq,reasons:reasons.map((x,i)=>({code:x.code,holder_visit_ids:sl[2*i+1],resource_ids:sl[2*i]})),task_id:base.task_id}));
  w.commit(ev);
 }
}
function accept(R,ts,r,t){
 const S=R.S,w=R.w,T=ts.t,v=ts.v,act=refs.action(t,1,w.ordinal(t,1)),ev=w.event(t,1,4),obs=R.obsSeq,resume=ts.state==='PAUSED',ch=[],{opt,lane,dest}=r.pick;
 one(ev,'POLICY_DECISION',{accepted:true,action_id:act,blockage_group_id:null,observation_seq:obs,reasons:[],task_id:T.id});
 for(const p of r.pauses){
  one(ev,'TASK_TRANSITION',tt(act,obs,p.t.id,'PAUSE'));
  setState(S,p,'PAUSED');v.running.delete(p);S.flows.delete(p.flow.id);markDirty(S,p.flow);if(p.flow.iv)S.pendingClose.push(p.flow);
 }
 const held=[];
 if(opt)for(const m of opt.members)held.push(m.ref);
 if(lane)held.push(lane);
 if(T.kind==='vendor')held.push(...VENDOR_UNITS);
 for(const id of held){ch.push(rc('ACQUIRE',ts,id));own(S,id,ts,'ACQUIRE');}
 if(!resume)ts.held=held;
 if(T.kind==='move'){
  // Reserve the destination (and its port) at move start; the origin stays owned until completion.
  ts.origin=v.pos;ts.dest=dest?dest.pos:null;
  if(dest){ch.push(rc('RESERVE',ts,dest.pos.ref));own(S,dest.pos.ref,ts,'RESERVE');if(dest.port){ch.push(rc('RESERVE',ts,dest.port.ref));own(S,dest.port.ref,ts,'RESERVE');v.port=dest.port;}}
  locate(S,v,'moving');
 }
 if(ch.length)one(ev,'RESOURCE_DELTA',{action_id:act,changes:ch.sort((a,b)=>byStr(a.resource_id,b.resource_id))});
 if(!resume&&T.kind==='data'&&T.data.direction==='down'){
  const d=T.data,b=BigInt(d.bytes);
  one(ev,'CONTENT_TRANSITION',ct(d.cacheFetch?SYNTHETIC.cache:v.ref,refs.object(d.object),'RESERVED',d.bytes));
  if(d.cacheFetch)S.cacheUsed+=b;else v.reserved+=b;
 }
 one(ev,'TASK_TRANSITION',tt(act,obs,T.id,resume?'RESUME':'START'));
 w.commit(ev);
 if(!resume){ts.action=act;ts.start=t;}
 setState(S,ts,'RUNNING');if(v)v.running.add(ts);
 if(T.kind==='data'||T.kind==='charge'){const f=ts.flow??(ts.flow=makeFlow(S,ts));f.isNew=true;S.flows.set(f.id,f);markDirty(S,f);}
 else{const d=opt?opt.d:T.timed;ts.end=t+d;if(!R.ends.has(ts.end)){R.ends.set(ts.end,[]);hpush(R.heap,ts.end);}R.ends.get(ts.end).push(ts);}
}
function makeFlow(S,ts){
 const T=ts.t,v=ts.v,c=SYNTHETIC;
 if(T.kind==='charge'){const p=v.port;return {id:refs.flow(v.id,'charge'),ts,dom:'charge',unit:'mJ_per_tick',path:[p.ref,c.site].sort(byStr),port:p,dc:p.kind==='DC',target:T.charge.need_mj,iv:null,tuple:null,isNew:true};}
 const d=T.data,path=d.cacheFetch?[c.wanDown]:d.direction==='up'?[refs.client(v.id),c.pool,c.wanUp]:d.cacheRoute?[c.cacheRead,refs.client(v.id),c.pool]:[refs.client(v.id),c.pool,c.wanDown];
 return {id:d.cacheFetch?refs.cacheFlow(d.object):refs.flow(v.id,T.template),ts,dom:'net',unit:'bytes_per_tick',path:path.sort(byStr),dc:false,target:BigInt(d.bytes),iv:null,tuple:null,isNew:true};
}
const energy=f=>f.ts.t.charge.initial_mj+f.ts.credited;
// Own cap: vehicle acceptance at the current energy (DC band at an exact edge uses the higher-SOC band; AC cap).
const ownCap=(S,f)=>f.dom==='charge'?BigInt(f.dc?bandAt(energy(f),S.profile.dc_bands).cap_w:S.profile.ac_cap_w)*MJ_PER_W_TICK:null;
function capacities(S,dom,flows){
 const m=new Map(),n=S.s.network,c=SYNTHETIC;
 if(dom==='charge'){for(const f of flows)m.set(f.port.ref,BigInt(f.port.rating_w)*MJ_PER_W_TICK);m.set(c.site,BigInt(S.s.site.supply_w-S.s.site.background_w)*MJ_PER_W_TICK);}
 else{
  m.set(c.pool,BigInt(n.pool_bytes_per_tick));m.set(c.wanDown,BigInt(n.wan_down_bytes_per_tick));m.set(c.wanUp,BigInt(n.wan_up_bytes_per_tick));m.set(c.cacheRead,BigInt(n.cache_read_bytes_per_tick));
  for(const f of flows)if(f.ts.v)m.set(refs.client(f.ts.v.id),BigInt(n.client_bytes_per_tick));
 }
 return m;
}
// A fresh interval: remainder clipped by the target and, for DC charging, the next band edge (C2.1).
function openInterval(S,f,t,rate){
 let R=f.target-f.ts.credited,kind='target';
 if(f.dc){const e=energy(f),edge=nextBandEdge(e,S.profile.dc_bands);if(edge!==null&&edge-e<R){R=edge-e;kind='edge';}}
 f.iv={a:t,rate,R,c:closureTick(rate,t,R,S.H),kind,from:t,before:0n};
}
const closeNow=(f,t)=>{const iv=f.iv,after=creditAt(iv.rate,iv.a,t,iv.R),item=progress(f,t,after,slackAt(iv.rate,iv.a,t,after),ZERO);f.iv=null;return item;};
// Phase 5: recompute changed allocation domains; close intervals ended by pause or reallocation, open new ones.
function phase5(R,t){
 const S=R.S,w=R.w,prog=S.pendingClose.map(f=>closeNow(f,t)),alloc=[],opened=[];S.pendingClose=[];
 for(const dom of ['charge','net']){
  if(!S.dirtyDomain[dom])continue;S.dirtyDomain[dom]=false;
  const flows=[...S.flows.values()].filter(f=>f.dom===dom).sort((a,b)=>byStr(a.id,b.id));
  if(!flows.length)continue;
  const res=maxMin(flows.map(f=>({id:f.id,path:f.path,cap:ownCap(S,f)})),capacities(S,dom,flows));
  for(const f of flows){
   const n=res.get(f.id),old=f.tuple,changed=!old||!eq(old.rate,n.rate)||old.tight.join()!==n.tight.join();
   if(f.iv&&!eq(f.iv.rate,n.rate))prog.push(closeNow(f,t));
   if(!f.iv){openInterval(S,f,t,n.rate);opened.push(f);}
   if(f.isNew||changed)alloc.push({flow_id:f.id,rate:formatRational(n.rate),resource_path:f.path,tight_resource_ids:n.tight,unit:f.unit});
   f.tuple=n;f.isNew=false;
  }
 }
 for(const f of opened){const iv=f.iv;if(subQuantum(iv.rate,iv.a,iv.R,S.H))throw new GuardStop('SUB_QUANTUM_POSITIVE_SHARE',{flow_id:f.id,rate:formatRational(iv.rate),anchor_tick:iv.a,horizon_tick:S.H,remainder:iv.R.toString()});}
 if(prog.length){const ev=w.event(t,1,5);vec(ev,'PROGRESS',[prog.sort(byFlow)],([c])=>({changes:c}));w.commit(ev);}
 if(alloc.length){const ev=w.event(t,1,5);vec(ev,'ALLOCATION_DELTA',[alloc.sort(byFlow)],([c])=>({changes:c}));w.commit(ev);}
}
// Phase 6 at H: report open intervals, provisional bytes, blockage, then all-arrivals horizon accounting.
function phase6(R,t){
 const S=R.S,w=R.w,open=[...S.flows.values()].filter(f=>f.iv).sort((a,b)=>byStr(a.id,b.id));
 if(open.length){
  const items=open.map(f=>{const iv=f.iv;return progress(f,t,creditAt(iv.rate,iv.a,t,iv.R),ZERO,ZERO);});
  const ev=w.event(t,1,6);vec(ev,'PROGRESS',[items],([c])=>({changes:c}));w.commit(ev);
 }
 const prov=[];
 for(const ts of S.tasks.values())if(ts.t.kind==='data'&&ts.state!=='COMPLETE'&&ts.state!=='CANCELLED'&&ts.credited>0n){
  const d=ts.t.data;prov.push(ct(d.cacheFetch?SYNTHETIC.cache:ts.v.ref,d.kind==='logs'?d.object:refs.object(d.object),'RECEIVED_PROVISIONAL',Number(ts.credited)));
 }
 for(const p of prov.sort((a,b)=>byStr(a.owner_id,b.owner_id)||byStr(a.object_id,b.object_id))){const ev=w.event(t,1,6);one(ev,'CONTENT_TRANSITION',p);w.commit(ev);}
 for(const b of blockageRecords(S,t)){
  const alts=ids64(b.unmet_alternatives,'unmet_alternatives'),ev=w.event(t,1,6);
  vec(ev,'BLOCKAGE',[b.member_visit_ids,b.held_resource_ids,...alts.flatMap(a=>[a.all_required_resources,a.blocking_holder_visit_ids])],sl=>({...b,member_visit_ids:sl[0],held_resource_ids:sl[1],unmet_alternatives:alts.map((a,i)=>({...a,all_required_resources:sl[2+2*i],blocking_holder_visit_ids:sl[3+2*i]}))}));w.commit(ev);
 }
 const vs=[...S.visits.values()].filter(v=>v.arrived),arrived=vs.map(v=>v.ref),released=vs.filter(v=>v.releasedAt!==null).map(v=>v.ref),unreleased=vs.filter(v=>v.releasedAt===null).map(v=>v.ref);
 const dg=hashOf('fleetlab.depot.horizon-state.v1',{observation:R.digest,released,unreleased}),ev=w.event(t,1,6);
 vec(ev,'HORIZON',[arrived,released,unreleased],([a,r,u])=>({arrived_visit_ids:a,derived_state_digest:dg,released_visit_ids:r,unreleased_visit_ids:u}));
 w.commit(ev);
}
