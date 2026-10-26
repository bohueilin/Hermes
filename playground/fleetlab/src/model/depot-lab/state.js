// Mutable state of one depot lab run (engineering note 8.1, 8.7, 9): visits, tasks, unit ownership, flows,
// availability unions and the incremental observation fact store. Bookkeeping only; policy and allocation are separate modules.
import {compileScenario,harnessInitialState} from './task-graph.js';
import {refs,SYNTHETIC} from './identity.js';
import {ATTENDED_CLASSES} from './profiles.js';
export const byStr=(a,b)=>a<b?-1:a>b?1:0;
const SEP='\u0000';
// Maximal unions of adjacent half-open intervals (C1.1 derived availability union).
export function unionOf(list){
 const out=[];
 for(const x of list){const l=out[out.length-1];if(l&&x.start_tick<=l[1])l[1]=Math.max(l[1],x.end_tick);else out.push([x.start_tick,x.end_tick]);}
 return out;
}
export const availableAt=(u,t)=>u.some(([a,b])=>a<=t&&t<b);
// [t, t+d) inside one maximal union interval (D1-09: no attended task crosses a break or shift end).
export const fitsAt=(u,t,d)=>u.some(([a,b])=>a<=t&&t+d<=b);
export function setFact(S,entity,field,value){
 const k=entity+SEP+field;
 if(!S.facts.has(k)||S.facts.get(k)!==value){S.facts.set(k,value);S.dirty.add(k);}
}
export const splitFact=k=>{const i=k.indexOf(SEP);return [k.slice(0,i),k.slice(i+1)];};
// Visit tasks are visible once their visit arrives; a depot cache task once a visit that needs it arrives (A27).
export const visible=ts=>ts.v?ts.v.arrived:!!ts.shown;
// Becoming READY or PAUSED restarts the rejection-recording memory (BD-08).
export function setState(S,ts,state){
 ts.state=state;
 if(state==='READY'||state==='PAUSED'){ts.lastKey=null;if(ts.t.kind!=='zero')S.work.add(ts);}else S.work.delete(ts);
 if(visible(ts))setFact(S,ts.t.id,'task_state',state);
}
export function setContent(S,ts,content){ts.content=content;if(visible(ts))setFact(S,ts.t.id,'content_state',content);}
export function taskFacts(S,ts){
 const id=ts.t.id;
 setFact(S,id,'task_state',ts.state);setFact(S,id,'prerequisite_ready_tick',ts.readyTick);setFact(S,id,'mandatory',ts.t.mandatory);
 if(ts.t.kind==='data')setFact(S,id,'content_state',ts.content);
}
const ownerField=rid=>rid.startsWith('position:')?'position_owner_task_id':'resource_owner_task_id';
export function own(S,rid,ts,mode){S.owner.set(rid,{task:ts,mode});setFact(S,rid,ownerField(rid),ts.t.id);}
export function free(S,rid){S.owner.delete(rid);setFact(S,rid,ownerField(rid),null);}
export function locate(S,v,loc,pos=null){v.location=loc;v.pos=pos;if(v.arrived)setFact(S,v.ref,'location_id',loc);}
export const holderOf=own=>own.task.v?own.task.v.ref:null;
export function createState(s,harness=null){
 const H=s.horizon_tick,profile=harness?.vehicle_profile??s.vehicle_profile,compiled=compileScenario(s);
 const S={s,H,profile,compiled,visits:new Map(),tasks:new Map(),owner:new Map(),work:new Set(),facts:new Map(),pub:new Map(),dirty:new Set(),
  flows:new Map(),dirtyDomain:{charge:false,net:false},pendingClose:[],pending:new Set(),cacheUsed:0n,cacheCap:BigInt(s.network.cache.capacity_bytes)};
 const objects=new Map(s.content_objects.map(o=>[o.id,o]));S.objects=objects;
 for(const id of compiled.warm)S.cacheUsed+=BigInt(objects.get(id).size_bytes);
 const mk=(T,v)=>{const ts={t:T,v,state:'UNREADY',readyTick:null,start:null,end:null,action:null,held:[],dest:null,origin:null,credited:0n,flow:null,content:null,lastKey:null,ord:0,deps:[],key:0};S.tasks.set(T.id,ts);return ts;};
 for(const plan of compiled.visits){
  const x=plan.visit;let residency=BigInt(x.initial_log_bytes);
  for(const id of x.installed_object_ids)residency+=BigInt(objects.get(id).size_bytes);
  const v={id:x.id,ref:plan.ref,plan,x,arrived:false,location:'outside',pos:null,port:null,releasedAt:null,running:new Set(),residency,reserved:0n,tasks:[]};
  S.visits.set(x.id,v);
  for(const T of plan.tasks)v.tasks.push(mk(T,v));
 }
 S.cacheTasks=compiled.cacheTasks.map(T=>mk(T,null));
 for(const ts of S.tasks.values())for(const p of [...ts.t.prereqs,...ts.t.anyPrereqs])S.tasks.get(p).deps.push(ts);
 // Static worklist order: template rank, owner key ('' for cache tasks), task id (D1-05, C1.4).
 const all=[...S.tasks.values()].sort((a,b)=>a.t.rank-b.t.rank||byStr(a.v?a.v.id:'',b.v?b.v.id:'')||byStr(a.t.id,b.t.id));
 all.forEach((ts,i)=>{ts.ord=i;});
 S.workers=s.workers.map(w=>({id:w.id,ref:refs.worker(w.id),q:new Map(w.qualifications.map(r=>[r.task_class,r])),u:unionOf(w.availability)}));
 S.options=new Map(ATTENDED_CLASSES.map(c=>{
  const lv=(w,l)=>w.q.get(c).level===l,d=w=>w.q.get(c).solo_duration_ticks;
  const solo=S.workers.filter(w=>lv(w,'independent')).map(w=>({members:[w],d:d(w)}));
  const sups=S.workers.filter(w=>lv(w,'independent')&&w.q.get(c).may_supervise),pairs=[];
  for(const tr of S.workers.filter(w=>lv(w,'supervised_only')))for(const sp of sups)pairs.push({members:[tr,sp],d:Math.max(d(tr),d(sp))});
  return [c,[...solo,...pairs]];
 }));
 S.lanes=Array.from({length:s.site.lane_count},(_,i)=>refs.lane(i+1));
 S.positions=new Map(s.site.positions.map(p=>[p.id,{...p,ref:refs.position(p.id)}]));
 S.zonePos=new Map();for(const p of S.positions.values()){if(!S.zonePos.has(p.zone))S.zonePos.set(p.zone,[]);S.zonePos.get(p.zone).push(p);}
 const ports=s.site.ports.map(p=>({...p,ref:refs.port(p.id),pos:S.positions.get(p.position_id)}));
 // DC ports ascending id, then AC ports ascending id; never decline a feasible AC port (D1-05).
 S.portOrder=[...ports.filter(p=>p.kind==='DC'),...ports.filter(p=>p.kind==='AC')];
 const ven=s.vendor;S.vendor={on:ven.enabled,bay:ven.bay_count===1,worker:ven.worker_count===1,u:unionOf(ven.availability)};
 S.covered=new Set(s.network.covered_zones);
 // Static event ticks (engineering note BD-07) and exogenous changes keyed by tick.
 const ticks=new Set([H]),add=(m,t,x)=>{if(t>H)return;ticks.add(t);if(!m.has(t))m.set(t,[]);m.get(t).push(x);};
 S.shifts=new Map();S.arrivals=new Map();S.windows=new Map();
 const shiftUnits=S.workers.map(w=>[w.ref,w.u]);if(S.vendor.on&&S.vendor.worker)shiftUnits.push([SYNTHETIC.vendorWorker,S.vendor.u]);
 for(const [ref,u]of shiftUnits)for(const [a,b]of u){add(S.shifts,a,{ref,available:true});add(S.shifts,b,{ref,available:false});}
 // A visit's due and window ticks count only when later than its own arrival, so no tick reveals a future visit (A27).
 for(const v of S.visits.values()){const a=v.x.arrival_tick;add(S.arrivals,a,v);if(v.x.due_tick!==null&&v.x.due_tick>a&&v.x.due_tick<=H)ticks.add(v.x.due_tick);for(const ts of v.tasks)if(ts.t.earliestStart>a)add(S.windows,ts.t.earliestStart,ts);}
 S.ticks=[...ticks].sort((a,b)=>a-b);
 // Static facts visible from the first observation (BD-12).
 for(const w of S.workers){setFact(S,w.ref,'worker_available',false);setFact(S,w.ref,'resource_owner_task_id',null);}
 if(S.vendor.on&&S.vendor.worker){setFact(S,SYNTHETIC.vendorWorker,'worker_available',false);setFact(S,SYNTHETIC.vendorWorker,'resource_owner_task_id',null);}
 if(S.vendor.on&&S.vendor.bay)setFact(S,SYNTHETIC.vendorBay,'resource_owner_task_id',null);
 for(const l of S.lanes)setFact(S,l,'resource_owner_task_id',null);
 for(const p of ports)setFact(S,p.ref,'resource_owner_task_id',null);
 for(const p of S.positions.values())setFact(S,p.ref,'position_owner_task_id',null);
 for(const k of ['maps','software','uploads']){const e=s.services[k];setFact(S,refs.service(k),'endpoint_reachable',e.service_reachable==='reachable');setFact(S,refs.service(k),'entitlement',e.entitlement);}
 for(const o of s.content_objects)setFact(S,refs.object(o.id),'size_bytes',o.size_bytes);
 // Test-only harness placements and completed work at t=0 (BD-15).
 for(const [vid,init]of harnessInitialState(s,compiled,harness)){
  const v=S.visits.get(vid),pos=S.positions.get(init.position);
  for(const id of init.completed){const ts=S.tasks.get(id);ts.state='COMPLETE';ts.readyTick=0;}
  own(S,pos.ref,S.tasks.get(init.positionOwner),'ACQUIRE');v.location=pos.ref;v.pos=pos;
  if(init.connectedPort){const p=ports.find(x=>x.id===init.connectedPort);own(S,p.ref,S.tasks.get(init.portOwner),'ACQUIRE');v.port=p;}
  for(const [obj,st]of Object.entries(init.content))if(st==='object_complete'){
   const ts=v.tasks.find(x=>x.t.kind==='data'&&x.t.data.object===obj);
   if(ts){ts.state='COMPLETE';ts.readyTick=0;ts.content='object_complete';ts.credited=BigInt(ts.t.data.bytes);v.residency+=BigInt(ts.t.data.bytes);}
  }
  for(const ts of v.tasks)S.pending.add(ts);
 }
 for(const ts of S.cacheTasks)S.pending.add(ts);
 return S;
}
