// Supported-resource blockage (C3, BD-14, BD-E15) and all-arrivals horizon accounting (C1.5, A40). The classifier works
// on an abstract AND-OR graph: OR alternatives of AND unit bundles, held units and future enabling events. A cycle alone
// is never a deadlock; an unrelated event never turns a closed set into a stall.
import {evaluate,candidateUnits,holderOf} from './policy-check.js';
const text=(a,b)=>a<b?-1:a>b?1:0;
// graph {t, H, visits:[{id, owns:[unit], alternatives:[{task, units:[unit]}]|null}], events:[{key, tick, visit, releases}]}
export function classifyBlockage({t=0,H,visits,events=[]}){
 const holder=new Map(),by=new Map(visits.map(v=>[v.id,v]));
 for(const v of visits)for(const u of v.owns??[])holder.set(u,v.id);
 const unmet=(v,a)=>a.units.filter(u=>holder.has(u)&&holder.get(u)!==v.id);
 const blocked=new Map();
 for(const v of visits)if(v.alternatives?.length&&v.alternatives.every(a=>unmet(v,a).length))blocked.set(v.id,v);
 // An enabling event is relevant to v when it lies in (t, H] and releases a unit v needs from its holder.
 const relevant=v=>events.filter(e=>e.tick>t&&e.tick<=H&&v.alternatives.some(a=>unmet(v,a).some(u=>holder.get(u)===e.visit&&e.releases.includes(u)))).sort((a,b)=>a.tick-b.tick||text(a.key,b.key));
 // A holder can release by H when it can progress now, has its own release event in (t, H], or is itself stalled.
 const canRelease=h=>{const v=by.get(h);if(!v)return false;if(t<H&&!blocked.has(h)&&v.alternatives?.length)return true;return events.some(e=>e.visit===h&&e.tick>t&&e.tick<=H)||blocked.has(h)&&relevant(blocked.get(h)).length>0;};
 const sccs=ids=>{
  let n=0;const idx=new Map(),low=new Map(),stack=[],on=new Set(),out=[];
  const go=x=>{idx.set(x,n);low.set(x,n++);stack.push(x);on.add(x);
   for(const a of blocked.get(x).alternatives)for(const u of unmet(blocked.get(x),a)){const y=holder.get(u);if(!ids.has(y))continue;if(!idx.has(y)){go(y);low.set(x,Math.min(low.get(x),low.get(y)));}else if(on.has(y))low.set(x,Math.min(low.get(x),idx.get(y)));}
   if(low.get(x)===idx.get(x)){const c=[];let y;do{y=stack.pop();on.delete(y);c.push(y);}while(y!==x);if(c.length>1)out.push(c.sort());}};
  for(const x of [...ids].sort())if(!idx.has(x))go(x);
  return out;
 };
 // Closed candidates: cyclic SCCs pruned to a fixed point; a member escapes when one alternative needs nothing held in C.
 let pool=new Set(blocked.keys()),closed=[];
 for(;;){
  const comps=sccs(pool),keep=new Set();let pruned=false;
  for(const c of comps){const C=new Set(c);for(const m of c){const v=blocked.get(m);if(v.alternatives.some(a=>!unmet(v,a).some(u=>C.has(holder.get(u)))))pruned=true;else keep.add(m);}}
  if(!pruned){closed=comps;break;}
  pool=keep;
 }
 const out=[],inC=new Set();
 for(const c of closed){
  c.forEach(m=>inC.add(m));const ev=c.flatMap(m=>relevant(blocked.get(m))).sort((a,b)=>a.tick-b.tick||text(a.key,b.key));
  if(ev.length){out.push({classification:'STALL',member_visit_ids:c,enabling_event_key:ev[0].key,next_tick:ev[0].tick});continue;}
  const held=[...new Set(c.flatMap(m=>blocked.get(m).alternatives.flatMap(a=>unmet(blocked.get(m),a))))].sort();
  out.push({classification:'DEADLOCK_DECLARED',member_visit_ids:c,held_resource_ids:held,unmet_alternatives:c.flatMap(m=>blocked.get(m).alternatives.map(a=>({visit_id:m,task_id:a.task,units:a.units.slice()}))),terminal_holder_id:null});
 }
 for(const [id,v]of [...blocked].sort((a,b)=>text(a[0],b[0]))){
  if(inC.has(id))continue;
  const ev=relevant(v);
  if(ev.length){out.push({classification:'STALL',member_visit_ids:[id],enabling_event_key:ev[0].key,next_tick:ev[0].tick});continue;}
  const hs=[...new Set(v.alternatives.flatMap(a=>unmet(v,a).map(u=>holder.get(u))))].sort();
  if(hs.some(canRelease))continue;
  const late=events.filter(e=>hs.includes(e.visit)&&e.tick>H).map(e=>e.tick);
  out.push({classification:'TERMINAL_BLOCKAGE_BEFORE_H',member_visit_ids:[id],terminal_holder_id:hs[0],lower_bound_tick:late.length?Math.min(...late):null});
 }
 return out.sort((a,b)=>text(a.member_visit_ids[0],b.member_visit_ids[0]));
}
// A proposed certificate is accepted only when it equals a derived one (C3 step 5); a deadlock claimed while a relevant
// enabling event exists is premature, and one with no derived closed set is unproven.
export function verifyCertificates(graph,proposed){
 const derived=classifyBlockage(graph),key=c=>`${c.classification}|${c.member_visit_ids.join()}`;
 for(const p of proposed){
  const d=derived.find(x=>x.member_visit_ids.join()===p.member_visit_ids.join());
  if(p.classification==='DEADLOCK_DECLARED'&&d?.classification!=='DEADLOCK_DECLARED'){
   const stall=derived.some(x=>x.classification==='STALL'&&p.member_visit_ids.some(m=>x.member_visit_ids.includes(m)));
   return {ok:false,code:stall?'PREMATURE_DEADLOCK_DURING_ACTIVE_STALL':'UNPROVEN_DEADLOCK',derived};
  }
  if(!d||key(d)!==key(p)||p.classification==='STALL'&&(p.enabling_event_key!==d.enabling_event_key||p.next_tick!==d.next_tick)||p.classification==='TERMINAL_BLOCKAGE_BEFORE_H'&&p.terminal_holder_id!==d.terminal_holder_id)return {ok:false,code:'BLOCKAGE_MISMATCH',derived};
 }
 if(derived.some(d=>!proposed.some(p=>key(p)===key(d))))return {ok:false,code:'BLOCKAGE_MISMATCH',derived};
 return {ok:true,code:null,derived};
}
// Expected BLOCKAGE records at H (BD-14, BD-E15): frontier waits on held candidate units, classified by C3 with no
// enabling event after H. Holders exclude the member itself.
export function horizonRecords(M,S,H){
 const members=[];
 for(const p of M.plans){
  const vs=S.vs.get(p.id);if(!vs.arrived||vs.released!==null)continue;
  const front=p.tasks.filter(T=>T.mandatory&&['READY','RUNNING','PAUSED'].includes(S.ts.get(T.id).st));
  if(!front.length||S.ts.get(front[0].id).st==='RUNNING')continue;
  const alts=[];let first=true,hit=false;
  for(const T of front){
   const st=S.ts.get(T.id).st;if(st==='RUNNING'){first=false;continue;}
   const ev=evaluate(M,S,T,H,st==='PAUSED'),hu=ev.reasons.some(r=>r.code==='HELD_UNITS');
   if(first)hit=hu;first=false;
   if(!hu)continue;
   const all=candidateUnits(M,T),held=all.filter(u=>{const o=S.own.get(u);return o&&M.tasks.get(o.task).visit!==p.id;});
   alts.push({visit_id:vs.ref,task_id:T.id,all_required_resources:all,blocking_holder_visit_ids:[...new Set(held.map(u=>holderOf(M,S.own.get(u).task)).filter(Boolean))].sort(),held});
  }
  if(hit)members.push({id:vs.ref,alts});
 }
 const owns=new Map();for(const [u,o]of S.own){const v=holderOf(M,o.task);if(v)(owns.get(v)??owns.set(v,[]).get(v)).push(u);}
 const graph={t:H,H,events:[],visits:[...members.map(m=>({id:m.id,owns:owns.get(m.id)??[],alternatives:m.alts.flatMap(a=>a.held.map(u=>({task:a.task_id,units:[u]})))})),...[...owns].filter(([v])=>!members.some(m=>m.id===v)).map(([v,u])=>({id:v,owns:u,alternatives:null}))]};
 const pub=a=>({visit_id:a.visit_id,task_id:a.task_id,all_required_resources:a.all_required_resources,blocking_holder_visit_ids:a.blocking_holder_visit_ids});
 const rec=(cls,ms,holder)=>{const alts=ms.flatMap(id=>members.find(m=>m.id===id).alts);return {classification:cls,enabling_event_key:null,enabling_event_seq:null,held_resource_ids:[...new Set(alts.flatMap(a=>a.held))].sort(),member_visit_ids:ms,next_tick:null,terminal_holder_id:holder,unmet_alternatives:alts.map(pub)};};
 return classifyBlockage(graph).map(c=>c.classification==='DEADLOCK_DECLARED'?rec(c.classification,c.member_visit_ids,null):rec('TERMINAL_BLOCKAGE_BEFORE_H',c.member_visit_ids,c.terminal_holder_id));
}
// Complete all-arrivals accounting at H (C1.5, C1.6): released and unreleased partition every arrival and observed time
// is censored at H. A missing horizon, an early stop or an omitted arrival is INCOMPLETE_HORIZON_ACCOUNTING.
export function checkHorizonAccounting({horizon_tick:H,visits,claim}){
 const bad=detail=>({ok:false,code:'INCOMPLETE_HORIZON_ACCOUNTING',detail});
 if(!claim)return bad('no horizon accounting');
 if(claim.tick!==H)return bad(`accounting closed at ${claim.tick}, not H ${H}`);
 const arrived=visits.filter(v=>v.arrival_tick<H).map(v=>v.id).sort(),released=visits.filter(v=>v.released_at!==null&&v.released_at<=H).map(v=>v.id).sort();
 const unreleased=arrived.filter(id=>!released.includes(id)),same=(a,b)=>Array.isArray(a)&&a.join()===b.join();
 if(!same(claim.arrived_visit_ids,arrived))return bad('arrived set');
 if(!same(claim.released_visit_ids,released))return bad('released set');
 if(!same(claim.unreleased_visit_ids,unreleased))return bad('unreleased set');
 const observed_s=visits.filter(v=>v.arrival_tick<H).reduce((n,v)=>n+Math.min(v.released_at??H,H)-v.arrival_tick,0);
 return {ok:true,code:null,arrived,released,unreleased,observed_s};
}
