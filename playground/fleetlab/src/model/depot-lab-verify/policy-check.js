// The fixed policy fcfs_eligible_fair_resources_v1 re-derived from the written rules (D1-05, D1-09, D1-10, note 8.4 and
// 8.5, BD-09, BD-10, BD-E9, BD-E10): worklist order, condition families 1 to 10, fixed choices and Q15 reason sets.
import {overlapAllowed,REASON_CODES} from '../depot-lab/profiles.js';
const ZONED=new Set(['waiting','charging','cleaning','garage']);
const BAY='vendor:bay:01',VW='vendor:worker:01';
const text=(a,b)=>a<b?-1:a>b?1:0;
// (prerequisite-ready tick, template rank, owner key with cache tasks first, task id).
export const byWorklist=([A,a],[B,b])=>a.ready-b.ready||A.rank-B.rank||text(A.visit??'',B.visit??'')||text(A.id,B.id);
export const holderOf=(M,task)=>{const v=M.tasks.get(task)?.visit;return v?`visit:${v}`:null;};
export const fits=(unions,t,d)=>unions.some(([a,b])=>a<=t&&t+d<=b);
// Solo independent workers by id, then supervised pairs by (trainee, supervisor) at the slower solo duration (BD-09).
export function workerOptions(M,cls){
 let o=M.options.get(cls);if(o)return o;
 const q=w=>w.quals[cls],solo=M.workerList.filter(w=>q(w).level==='independent');
 o=[...solo.map(w=>({ids:[w.ref],d:q(w).solo})),...M.workerList.filter(w=>q(w).level==='supervised_only').flatMap(a=>solo.filter(b=>q(b).may_supervise).map(b=>({ids:[a.ref,b.ref],d:Math.max(q(a).solo,q(b).solo)})))];
 M.options.set(cls,o);return o;
}
function locationFails(M,T,vs){
 const at=M.positions.get(vs.loc);
 if(T.kind==='move')return (T.template==='admit'?vs.loc==='outside':T.template==='vendor_reentry'?vs.loc==='offsite':!!at)?null:[];
 if(T.kind==='attended'){if(!at)return [];const ok=T.template==='connect'||T.template==='unplug'?M.ports.get(vs.portRef)?.pos===vs.loc:at.zone===T.zone;return ok?null:[`zone:${at.zone}`];}
 if(T.kind==='data')return !at?[]:M.covered.has(at.zone)?null:[`zone:${at.zone}`];
 if(T.kind==='timed')return at?null:[];
 return null;
}
// Families 1 to 4 (window, overlap with pausable transfers, location, service endpoint), shared by decisions and claims.
function basics(M,S,T,t){
 const vs=T.visit?S.vs.get(T.visit):null,b={early:t<T.earliestStart,blocked:[],pauses:[],loc:null,ep:[]};
 let moving=false;
 if(vs)for(const id of vs.running){
  if(id===T.id)continue;const P=M.tasks.get(id);
  if(P.cls==='MV'||P.cls==='VT'||P.cls==='VS')moving=true;
  if(overlapAllowed(T.cls,P.cls))continue;
  (P.kind==='data'&&T.kind!=='data'?b.pauses:b.blocked).push(id);
 }
 if(vs&&!moving)b.loc=locationFails(M,T,vs);
 const ep=T.kind==='data'?T.data.endpoint:T.endpoint;
 if(ep){const e=M.s.services[ep],id=`service:${ep}`;if(e.service_reachable!=='reachable')b.ep.push(['UNREACHABLE_SERVICE',id]);if(e.entitlement==='denied')b.ep.push(['DENIED_ENTITLEMENT',id]);if(e.entitlement==='unknown')b.ep.push(['UNKNOWN_MANDATORY_STATE',id]);}
 b.pauses.sort();b.blocked.sort();b.vs=vs;return b;
}
const stockShort=(M,S,T)=>{
 if(T.kind!=='data'||T.data.direction!=='down')return null;const n=BigInt(T.data.bytes);
 if(T.data.cacheFetch)return S.cacheUsed+n>M.cacheCap?'cache:depot':null;
 const st=S.storage.get(T.visit);return st.res+st.rsv+n>M.storageCap?`storage:${T.visit}`:null;
};
// Feasibility of task T at tick t against the current state, the fixed choice and the full reason set (BD-10).
export function evaluate(M,S,T,t,resume=false){
 const R=new Map(),put=(code,ids=[],hs=[])=>{let e=R.get(code);if(!e)R.set(code,e=[new Set(),new Set()]);for(const x of ids)e[0].add(x);for(const x of hs)if(x)e[1].add(x);};
 const held=u=>{const o=S.own.get(u);if(o)put('HELD_UNITS',[u],[holderOf(M,o.task)]);return !!o;};
 const b=basics(M,S,T,t),choice={workers:[],d:T.timed,lane:null,dest:null,port:null,vendor:false};
 if(b.early)put('SCHEDULED_WINDOW');
 if(b.blocked.length)put('OVERLAP_EXCLUSION',b.blocked,[b.vs.ref]);
 if(b.loc)put('ABSENT_INCOMPATIBLE_UNQUALIFIED',b.loc);
 for(const [c,id]of b.ep)put(c,[id]);
 if(!resume){
  if(T.attention){
   const opts=workerOptions(M,T.attention);
   if(!opts.length)put('ABSENT_INCOMPATIBLE_UNQUALIFIED');
   else{
    const ok=opts.find(o=>o.ids.every(w=>!S.own.has(w)&&fits(M.workers.get(w).unions,t,o.d)));
    if(ok){choice.workers=ok.ids.slice().sort();choice.d=ok.d;}
    else for(const o of opts)for(const w of o.ids)if(!held(w)&&!fits(M.workers.get(w).unions,t,o.d))put('INSUFFICIENT_SHIFT',[w]);
   }
  }
  if(T.kind==='move'){
   if(!M.lanes.length)put('ABSENT_INCOMPATIBLE_UNQUALIFIED');
   else{choice.lane=M.lanes.find(x=>!S.own.has(x))??null;if(!choice.lane)M.lanes.forEach(held);}
   const z=T.move.to;
   if(z==='charging'){
    if(!M.portOrder.length)put('ABSENT_INCOMPATIBLE_UNQUALIFIED',['zone:charging']);
    else{
     const cand=M.portOrder.filter(p=>p.enabled&&M.positions.get(p.pos).enabled);
     if(!cand.length)put('STATIC_OUT_OF_SERVICE',[...M.portOrder.filter(p=>!p.enabled).map(p=>p.ref),...M.portOrder.filter(p=>!M.positions.get(p.pos).enabled).map(p=>p.pos)]);
     else{const c=cand.find(p=>!S.own.has(p.ref)&&!S.own.has(p.pos));if(c){choice.port=c.ref;choice.dest=c.pos;}else for(const p of cand){held(p.ref);held(p.pos);}}
    }
   }else if(ZONED.has(z)){
    const all=M.zones[z],en=all.filter(p=>p.enabled);
    if(!all.length)put('ABSENT_INCOMPATIBLE_UNQUALIFIED',[`zone:${z}`]);
    else if(!en.length)put('STATIC_OUT_OF_SERVICE',all.map(p=>p.ref));
    else{choice.dest=en.find(p=>!S.own.has(p.ref))?.ref??null;if(!choice.dest)en.forEach(p=>held(p.ref));}
   }
  }
  if(T.kind==='vendor'){
   const V=M.vendor;
   if(!V.enabled)put('STATIC_OUT_OF_SERVICE',[BAY]);
   if(!V.hasBay||!V.hasWorker)put('ABSENT_INCOMPATIBLE_UNQUALIFIED',[...(V.hasBay?[]:[BAY]),...(V.hasWorker?[]:[VW])]);
   if(V.enabled&&V.bay&&V.worker&&![BAY,VW].map(held).some(Boolean)){if(fits(V.unions,t,T.timed))choice.vendor=true;else put('INSUFFICIENT_SHIFT',[VW]);}
  }
  // D1-09 explicit hold: a disabled or missing vendor unit also stops the departure move at the depot.
  if(T.template==='vendor_departure'){const V=M.vendor;if(!V.enabled)put('STATIC_OUT_OF_SERVICE',[BAY]);if(!V.hasBay||!V.hasWorker)put('ABSENT_INCOMPATIBLE_UNQUALIFIED',[...(V.hasBay?[]:[BAY]),...(V.hasWorker?[]:[VW])]);}
  const st=stockShort(M,S,T);if(st)put('FULL_STOCK_CACHE',[st]);
 }
 const reasons=REASON_CODES.filter(c=>R.has(c)).map(c=>({code:c,resource_ids:[...R.get(c)[0]].sort(),holder_visit_ids:[...R.get(c)[1]].sort()}));
 return {ok:!reasons.length,reasons,choice,pauses:b.pauses};
}
export const codeKey=reasons=>reasons.map(r=>r.code).join();
// Lifecycle checks of a claimed start (note 10.2): the claimed units against families 1 to 9; ownership and bundle shape
// are checked by the caller first. Returns a violation code or null.
export function checkClaim(M,S,T,t,claim,resume){
 const b=basics(M,S,T,t);
 if(b.early)return 'WINDOW_VIOLATION';
 if(b.blocked.length||b.pauses.join()!==claim.pauses.slice().sort().join())return 'OVERLAP_VIOLATION';
 if(b.loc)return 'LOCATION_VIOLATION';
 if(b.ep.length)return 'ENTITLEMENT_VIOLATION';
 if(resume)return null;
 if(T.attention){
  const o=workerOptions(M,T.attention).find(x=>x.ids.slice().sort().join()===claim.workers.join());
  if(!o)return 'WORKER_INELIGIBLE';
  if(!o.ids.every(w=>fits(M.workers.get(w).unions,t,o.d)))return 'SHIFT_VIOLATION';
  claim.d=o.d;
 }
 if(T.kind==='vendor'&&!fits(M.vendor.unions,t,T.timed))return 'SHIFT_VIOLATION';
 return stockShort(M,S,T)?'STOCK_VIOLATION':null;
}
// The complete candidate unit set of a task (BD-14): every option member, lane and enabled destination.
export function candidateUnits(M,T){
 const u=[];
 if(T.attention)for(const o of workerOptions(M,T.attention))u.push(...o.ids);
 if(T.kind==='move'){
  u.push(...M.lanes);const z=T.move.to;
  if(z==='charging'){for(const p of M.portOrder)if(p.enabled&&M.positions.get(p.pos).enabled)u.push(p.ref,p.pos);}
  else if(ZONED.has(z))u.push(...M.zones[z].filter(p=>p.enabled).map(p=>p.ref));
 }
 if(T.kind==='vendor'&&M.vendor.bay&&M.vendor.worker)u.push(BAY,VW);
 return [...new Set(u)].sort();
}
