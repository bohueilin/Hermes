// The fixed policy fcfs_eligible_fair_resources_v1 (contract D1-05, C1.4; engineering note 8.4, 8.5, 8.8):
// feasibility families with complete reason sets, lowest-id choices and the horizon wait-for blockage records.
import {overlapAllowed,REASON_CODES} from './profiles.js';
import {refs,SYNTHETIC} from './identity.js';
import {byStr,fitsAt,holderOf} from './state.js';
const ORDER=new Map(REASON_CODES.map((c,i)=>[c,i])),byCode=(a,b)=>ORDER.get(a)-ORDER.get(b);
const ABSENT='ABSENT_INCOMPATIBLE_UNQUALIFIED',HELD='HELD_UNITS',MOVING=new Set(['MV','VT','VS']);
// Worklist key (readyTick, template rank, owner key, task id); ord is the static rank/owner/id position.
export const workKey=ts=>ts.readyTick*100000+ts.ord;
export const newCache=()=>({w:new Map(),lane:null,dest:new Map(),ven:null});
// Solo independent workers by id, then supervised pairs by (trainee, supervisor); pair duration = max (D1-09, BD-09).
export const workerOptions=(S,cls)=>S.options.get(cls).map(o=>({worker_ids:o.members.map(w=>w.ref),duration_ticks:o.d}));
// Merge failures to one entry per code in Q15 order with sorted unique ids (BD-10).
export function reasonList(fails){
 const m=new Map();
 for(const [code,res,hold]of fails){let e=m.get(code);if(!e)m.set(code,e={r:new Set(),h:new Set()});for(const x of res)e.r.add(x);for(const x of hold)e.h.add(x);}
 return [...m.keys()].sort(byCode).map(code=>({code,holder_visit_ids:[...m.get(code).h].sort(byStr),resource_ids:[...m.get(code).r].sort(byStr)}));
}
export const codeKey=fails=>[...new Set(fails.map(f=>f[0]))].sort(byCode).join(',');
const holders=(S,ids)=>{const h=new Set();for(const id of ids){const o=S.owner.get(id);const x=o&&holderOf(o);if(x)h.add(x);}return [...h];};
function workers(S,C,cls,t){
 let r=C.w.get(cls);if(r)return r;
 const opts=S.options.get(cls);
 if(!opts.length)r={fails:[[ABSENT,[],[]]]};
 else{
  const held=new Set(),hold=new Set(),shift=new Set();
  for(const o of opts){
   let ok=true;
   for(const w of o.members){const own=S.owner.get(w.ref);if(own){ok=false;held.add(w.ref);const h=holderOf(own);if(h)hold.add(h);}else if(!fitsAt(w.u,t,o.d)){ok=false;shift.add(w.ref);}}
   if(ok){r={pick:o};break;}
  }
  if(!r){r={fails:[]};if(held.size)r.fails.push([HELD,[...held],[...hold]]);if(shift.size)r.fails.push(['INSUFFICIENT_SHIFT',[...shift],[]]);}
 }
 C.w.set(cls,r);return r;
}
function lane(S,C){
 if(C.lane)return C.lane;
 if(!S.lanes.length)return C.lane={fails:[[ABSENT,[],[]]]};
 const l=S.lanes.find(x=>!S.owner.has(x));
 return C.lane=l?{pick:l}:{fails:[[HELD,S.lanes,holders(S,S.lanes)]]};
}
function destination(S,C,T){
 const zone=T.move.to;if(zone==='outside')return {pick:null};
 let r=C.dest.get(zone);if(r)return r;
 const absent={fails:[[ABSENT,[refs.zone(zone)],[]]]};
 if(T.move.withPort){
  const c=S.portOrder,en=c.filter(p=>p.enabled&&p.pos.enabled);
  if(!c.length)r=absent;
  else if(!en.length)r={fails:[['STATIC_OUT_OF_SERVICE',c.flatMap(p=>[...(p.enabled?[]:[p.ref]),...(p.pos.enabled?[]:[p.pos.ref])]),[]]]};
  else{
   const p=en.find(x=>!S.owner.has(x.ref)&&!S.owner.has(x.pos.ref));
   if(p)r={pick:{pos:p.pos,port:p}};else{const held=en.flatMap(x=>[x.ref,x.pos.ref]).filter(x=>S.owner.has(x));r={fails:[[HELD,held,holders(S,held)]]};}
  }
 }else{
  const list=S.zonePos.get(zone)??[],en=list.filter(p=>p.enabled);
  if(!list.length)r=absent;
  else if(!en.length)r={fails:[['STATIC_OUT_OF_SERVICE',list.map(p=>p.ref),[]]]};
  else{const p=en.find(x=>!S.owner.has(x.ref)),ids=en.map(x=>x.ref);r=p?{pick:{pos:p,port:null}}:{fails:[[HELD,ids,holders(S,ids)]]};}
 }
 C.dest.set(zone,r);return r;
}
// A disabled or missing vendor unit is an explicit hold before departure as well as at service (D1-09).
function vendorStatic(S){
 const V=S.vendor,f=[],bay=SYNTHETIC.vendorBay,vw=SYNTHETIC.vendorWorker;
 if(!V.on)f.push(['STATIC_OUT_OF_SERVICE',[bay],[]]);
 const abs=[...(V.bay?[]:[bay]),...(V.worker?[]:[vw])];if(abs.length)f.push([ABSENT,abs,[]]);
 return f;
}
function vendor(S,C,T,t){
 if(C.ven)return C.ven;
 const V=S.vendor,f=vendorStatic(S),bay=SYNTHETIC.vendorBay,vw=SYNTHETIC.vendorWorker;
 if(!f.length){const held=[bay,vw].filter(x=>S.owner.has(x));if(held.length)f.push([HELD,held,holders(S,held)]);else if(!fitsAt(V.u,t,T.timed))f.push(['INSUFFICIENT_SHIFT',[vw],[]]);}
 return C.ven=f.length?{fails:f}:{pick:true};
}
// Location (family 3). Skipped while the vehicle moves or travels: those running classes already exclude by overlap.
function location(S,T,v,f){
 const k=T.kind;
 if(k==='move'){const need=T.template==='admit'?'outside':T.template==='vendor_reentry'?'offsite':null;if(need?v.location!==need:!v.pos)f.push([ABSENT,[],[]]);return;}
 if(k==='transit'||k==='vendor'){if(v.location!=='offsite')f.push([ABSENT,[],[]]);return;}
 if(!v.pos){f.push([ABSENT,[],[]]);return;}
 if(k==='data'&&!S.covered.has(v.pos.zone))f.push([ABSENT,[refs.zone(v.pos.zone)],[]]);
 if(k==='attended'&&v.pos.zone!==T.zone)f.push([ABSENT,[],[]]);
}
function endpoint(S,name,f){
 const e=S.s.services[name],id=refs.service(name);
 if(e.entitlement==='unknown')f.push(['UNKNOWN_MANDATORY_STATE',[id],[]]);else if(e.entitlement==='denied')f.push(['DENIED_ENTITLEMENT',[id],[]]);
 if(e.service_reachable==='unreachable')f.push(['UNREACHABLE_SERVICE',[id],[]]);
}
// Feasibility of one worklist task at tick t against the current state (engineering note 8.4). A paused transfer
// re-checks families 1 to 4 only. Returns {ok:true, pick, pauses} or {ok:false, f} with raw failure triples.
export function evaluate(S,C,ts,t){
 const T=ts.t,v=ts.v,f=[],pauses=[];
 if(t<T.earliestStart)f.push(['SCHEDULED_WINDOW',[],[]]);
 if(v){
  const conf=[];let moving=false;
  for(const r of v.running){
   if(MOVING.has(r.t.cls))moving=true;
   if(overlapAllowed(T.cls,r.t.cls))continue;
   if(r.t.kind==='data'&&T.kind!=='data')pauses.push(r);else conf.push(r.t.id);
  }
  if(conf.length)f.push(['OVERLAP_EXCLUSION',conf,[v.ref]]);
  if(!moving)location(S,T,v,f);
 }
 const ep=T.data?T.data.endpoint:T.endpoint;
 if(ep)endpoint(S,ep,f);
 const pick={};
 if(ts.state!=='PAUSED'){
  const fam=[];
  if(T.kind==='move'){const a=workers(S,C,'move',t),b=lane(S,C),c=destination(S,C,T);fam.push(a,b,c);pick.opt=a.pick;pick.lane=b.pick;pick.dest=c.pick;if(T.template==='vendor_departure')f.push(...vendorStatic(S));}
  else if(T.kind==='attended'){const a=workers(S,C,T.attention,t);fam.push(a);pick.opt=a.pick;}
  else if(T.kind==='vendor')fam.push(vendor(S,C,T,t));
  for(const r of fam)if(r.fails)f.push(...r.fails);
  if(T.kind==='data'&&T.data.direction==='down'){
   const size=BigInt(T.data.bytes);
   if(T.data.cacheFetch){if(S.cacheUsed+size>S.cacheCap)f.push(['FULL_STOCK_CACHE',[SYNTHETIC.cache],[]]);}
   else if(v.residency+v.reserved+size>BigInt(S.profile.storage_capacity_bytes))f.push(['FULL_STOCK_CACHE',[refs.storage(v.id)],[]]);
  }
 }
 return f.length?{ok:false,f}:{ok:true,pick,pauses:pauses.sort((a,b)=>byStr(a.t.id,b.t.id))};
}
// Every unit any admissible alternative of the task could use (C3.1 candidate set, families 5 to 8).
export function candidateUnits(S,ts){
 const T=ts.t,u=new Set(),opts=cls=>{for(const o of S.options.get(cls))for(const w of o.members)u.add(w.ref);};
 if(T.kind==='move'){
  opts('move');for(const l of S.lanes)u.add(l);
  if(T.move.withPort){for(const p of S.portOrder)if(p.enabled&&p.pos.enabled){u.add(p.ref);u.add(p.pos.ref);}}
  else if(T.move.to!=='outside')for(const p of S.zonePos.get(T.move.to)??[])if(p.enabled)u.add(p.ref);
 }else if(T.kind==='attended')opts(T.attention);
 else if(T.kind==='vendor'){if(S.vendor.on&&S.vendor.bay)u.add(SYNTHETIC.vendorBay);if(S.vendor.on&&S.vendor.worker)u.add(SYNTHETIC.vendorWorker);}
 return [...u].sort(byStr);
}
// BLOCKAGE payloads at H (BD-14): wait-for edges from visits whose frontier task waits on held units.
export function blockageRecords(S,t){
 const C=newCache(),node=new Map();
 for(const v of S.visits.values()){
  if(!v.arrived||v.releasedAt!==null)continue;
  const front=v.tasks.filter(x=>x.t.mandatory&&(x.state==='READY'||x.state==='RUNNING'||x.state==='PAUSED')).sort((a,b)=>a.t.rank-b.t.rank||byStr(a.t.id,b.t.id));
  if(!front.length||front[0].state==='RUNNING')continue;
  const entries=[];
  for(const ts of front){
   if(ts.state==='RUNNING')continue;
   const r=evaluate(S,C,ts,t);if(r.ok||!r.f.some(x=>x[0]===HELD)){if(ts===front[0])break;continue;}
   const units=candidateUnits(S,ts),held=units.filter(x=>S.owner.has(x)),hs=holders(S,held).filter(x=>x!==v.ref).sort(byStr);
   entries.push({held,hs,alt:{all_required_resources:units,blocking_holder_visit_ids:hs,task_id:ts.t.id,visit_id:v.ref}});
  }
  const hs=[...new Set(entries.flatMap(e=>e.hs))].sort(byStr);
  if(hs.length)node.set(v.ref,{entries,hs,held:[...new Set(entries.flatMap(e=>e.held))].sort(byStr)});
 }
 // Closed components: strongly connected sets of two or more whose every holder lies inside (C3; unreachable on the forward route).
 const comp=scc([...node.keys()],x=>node.get(x).hs.filter(h=>node.has(h))),out=[],inDeadlock=new Set();
 for(const c of comp){
  if(c.length<2)continue;const set=new Set(c);
  if(!c.every(x=>node.get(x).hs.every(h=>set.has(h))))continue;
  c.sort(byStr);c.forEach(x=>inDeadlock.add(x));
  out.push(record('DEADLOCK_DECLARED',c,[...new Set(c.flatMap(x=>node.get(x).held))].sort(byStr),c.flatMap(x=>node.get(x).entries.map(e=>e.alt)),null));
 }
 for(const [ref,n]of node)if(!inDeadlock.has(ref))out.push(record('TERMINAL_BLOCKAGE_BEFORE_H',[ref],n.held,n.entries.map(e=>e.alt),n.hs[0]));
 return out.sort((a,b)=>byStr(a.member_visit_ids[0],b.member_visit_ids[0]));
}
const record=(classification,members,held,alts,holder)=>({classification,enabling_event_key:null,enabling_event_seq:null,held_resource_ids:held,member_visit_ids:members,next_tick:null,terminal_holder_id:holder,unmet_alternatives:alts});
function scc(nodes,next){
 let i=0;const idx=new Map(),low=new Map(),stack=[],on=new Set(),out=[];
 const go=n=>{
  idx.set(n,i);low.set(n,i);i++;stack.push(n);on.add(n);
  for(const m of next(n)){if(!idx.has(m)){go(m);low.set(n,Math.min(low.get(n),low.get(m)));}else if(on.has(m))low.set(n,Math.min(low.get(n),idx.get(m)));}
  if(low.get(n)===idx.get(n)){const c=[];let m;do{m=stack.pop();on.delete(m);c.push(m);}while(m!==n);out.push(c);}
 };
 for(const n of nodes)if(!idx.has(n))go(n);
 return out;
}
