// Independent reconstruction of a depot lab run from its bound inputs and ledger (D1-06, C1.5, C2.2, note 10): location,
// ownership, task lifecycle, content, credits, allocations, decisions and observations, replayed group by group with
// fail-fast precedence. Shares only the contract modules with the engine; never imports it.
import {compileScenario,harnessInitialState} from '../depot-lab/task-graph.js';
import {refs,H as digestOf} from '../depot-lab/identity.js';
import {jcs} from '../depot-lab/canonical.js';
import {Q,eq,formatRational} from '../depot-lab/rational.js';
import {socEnergy,bandAt,nextBandEdge,PACK_MJ} from '../depot-lab/units.js';
import {evaluate,checkClaim,codeKey,byWorklist} from './policy-check.js';
import {maxMin,characterize,creditAt,slackAt,undrawnAt,closeTick} from './allocation-check.js';
import {horizonRecords,checkHorizonAccounting} from './blockage.js';
export class Violation extends Error{constructor(code,detail,at=null){super(`${code}: ${detail}`);this.code=code;this.detail=detail;this.at=at;}}
const text=(a,b)=>a<b?-1:a>b?1:0;
const push=(m,k,v)=>(m.get(k)??m.set(k,[]).get(k)).push(v);
const ZONES=new Set(['waiting','charging','cleaning','garage']);
export function buildModel(s,harness=null){
 const compiled=compileScenario(s),prof=harness?.vehicle_profile??s.vehicle_profile,dep=new Map(),any=new Map();
 for(const T of compiled.byId.values()){for(const p of T.prereqs)push(dep,p,T.id);for(const p of T.anyPrereqs)push(any,p,T.id);}
 const positions=new Map(s.site.positions.map(p=>[`position:${p.id}`,{ref:`position:${p.id}`,zone:p.zone,enabled:p.enabled}]));
 const zones={waiting:[],charging:[],cleaning:[],garage:[]};for(const p of positions.values())zones[p.zone].push(p);
 const ports=new Map(s.site.ports.map(p=>[`port:${p.id}`,{ref:`port:${p.id}`,kind:p.kind,rating:p.rating_w,enabled:p.enabled,pos:`position:${p.position_id}`}]));
 const list=[...ports.values()],union=iv=>{const u=[];for(const x of iv){const l=u[u.length-1];if(l&&x.start_tick<=l[1])l[1]=Math.max(l[1],x.end_tick);else u.push([x.start_tick,x.end_tick]);}return u;};
 const workerList=s.workers.map(w=>({ref:`worker:${w.id}`,quals:Object.fromEntries(w.qualifications.map(q=>[q.task_class,{level:q.level,may_supervise:q.may_supervise,solo:q.solo_duration_ticks}])),unions:union(w.availability)}));
 const V=s.vendor,vendor={enabled:V.enabled,bay:V.enabled&&V.bay_count===1,worker:V.enabled&&V.worker_count===1,hasBay:V.bay_count===1,hasWorker:V.worker_count===1,unions:union(V.availability)};
 const shifts=new Map(),at=k=>shifts.get(k)??shifts.set(k,{ends:[],starts:[]}).get(k);
 for(const w of [...(vendor.worker?[{ref:'vendor:worker:01',unions:vendor.unions}]:[]),...workerList])for(const [a,b]of w.unions){at(a).starts.push(w.ref);at(b).ends.push(w.ref);}
 for(const x of shifts.values()){x.ends.sort();x.starts.sort();}
 const arrivals=new Map(),windows=new Map();
 for(const v of s.visits)push(arrivals,v.arrival_tick,`visit:${v.id}`);
 const arrivalOf=new Map(compiled.visits.map(p=>[p.id,p.visit.arrival_tick]));
 // A window counts only when later than its own visit's arrival (A27 non-anticipativity).
 for(const T of compiled.byId.values())if(T.earliestStart>0&&T.earliestStart>(T.visit?arrivalOf.get(T.visit):0))push(windows,T.earliestStart,T.id);
 for(const l of windows.values())l.sort();
 const lanes=Array.from({length:s.site.lane_count},(_,i)=>refs.lane(i+1)),n=s.network,big=x=>Q(BigInt(x));
 const caps=new Map([['site:supply',Q(BigInt(s.site.supply_w-s.site.background_w)*1000n)],['network:pool',big(n.pool_bytes_per_tick)],['network:wan_down',big(n.wan_down_bytes_per_tick)],['network:wan_up',big(n.wan_up_bytes_per_tick)],['cache:read',big(n.cache_read_bytes_per_tick)],...list.map(p=>[p.ref,Q(BigInt(p.rating)*1000n)]),...s.visits.map(v=>[`client:${v.id}`,big(n.client_bytes_per_tick)])]);
 const keys=m=>[...m.keys()].sort((a,b)=>a-b);
 return {s,H:s.horizon_tick,compiled,tasks:compiled.byId,plans:compiled.visits,dep,any,positions,zones,ports,portOrder:[...list.filter(p=>p.kind==='DC'),...list.filter(p=>p.kind==='AC')],
  lanes,workers:new Map(workerList.map(w=>[w.ref,w])),workerList,vendor,shifts,arrivals,windows,ticks:{shift:keys(shifts),arrival:keys(arrivals),opens:keys(windows)},
  units:new Set([...positions.keys(),...ports.keys(),...lanes,...workerList.map(w=>w.ref),...(vendor.bay?['vendor:bay:01']:[]),...(vendor.worker?['vendor:worker:01']:[])]),
  caps,covered:new Set(n.covered_zones),bands:prof.dc_bands,acCap:BigInt(prof.ac_cap_w)*1000n,storageCap:BigInt(prof.storage_capacity_bytes),cacheCap:BigInt(n.cache.state==='off'?0:n.cache.capacity_bytes),
  objects:new Map(s.content_objects.map(o=>[o.id,o])),options:new Map(),init:harnessInitialState(s,compiled,harness),target:socEnergy(s.requirements.energy.target_soc_pct)};
}
const TIMED=new Set(['move','attended','timed','transit','vendor']);
const STEP={check:'CHECK_COMPLETE',activation:'ACTIVATION_COMPLETE',postcheck:'POSTCHECK_COMPLETE'};
const stepOf=T=>STEP[T.template.slice(T.template.lastIndexOf('_')+1)]??null;
const isContent=T=>T.kind==='data'&&T.data.direction==='down'||T.kind==='timed'&&!!T.object;
// Violation precedence for findings deferred to the end of a tick (note 10.2): lifecycle before information.
const LATE={MISSING_COMPLETION:0,OBSERVATION_REFERENCE_INVALID:1,OBSERVATION_MISMATCH:2};
// partial: false for COMPLETE, else the prefix's status. A CANCELLED prefix is whole event ticks (the engine cancels
// between steps). An INCOMPLETE_RESOURCE_LIMIT prefix ends where its confirmed guard refused the next step (cut):
// 'event', the first read past the last record at its tick; 'quantum', phase 5 of the last tick, whose sub-quantum
// interval the replay derives (S.cut); 'horizon', the BLOCKAGE record at H that the replay expects next (S.cut).
export function replay(M,groups,rec,{partial=false,cut=null}={}){
 const CUT={},end=groups.length?groups[groups.length-1].tick:-1,cutTick=cut==='event'?end:null;
 const S={ts:new Map(),vs:new Map(),own:new Map(),flows:new Map(),storage:new Map(),cacheUsed:0n,facts:new Map(),pub:new Map(),dirty:new Set(),obs:{seq:null,digest:null,any:false},
  queue:new Set(),running:new Set(),cand:new Set(),events:[],busy:new Map(),since:new Map(),closing:[],dirtyDom:{charge:false,data:false},horizon:null,blockage:[],credit:{charge:0n,down:0n,up:0n}};
 const H=M.H,s=M.s;let gi=0,t=-1,late=null;
 const fail=(code,detail,g=groups[gi])=>{throw new Violation(code,detail,g??{seq:groups[gi-1]?.last??null,tick:t});};
 const defer=(code,detail,g)=>{if(!late||LATE[code]<LATE[late.code])late={code,detail,g};};
 const peekIn=ph=>{const g=groups[gi];return g&&g.tick===t&&(ph===undefined||g.phase===ph)?g:null;};
 // A read for the first record of a new engine event (each event is committed whole); past the last record at the cut
 // tick it is the refused step. Reads inside one event, and trailing checks, use peekIn.
 const peek=ph=>{if(gi>=groups.length&&t===cutTick)throw CUT;return peekIn(ph);};
 const T_=id=>M.tasks.get(id),V_=T=>T.visit?S.vs.get(T.visit):null;
 // ----- facts (depot_observation_v1, BD-12) -----
 const fact=(e,f,v)=>{const k=`${e}|${f}`,o=S.facts.get(k);if(o&&o[2]===v)return;S.facts.set(k,[e,f,v]);S.dirty.add(k);};
 const shown=new Set(),visible=T=>T.visit?S.vs.get(T.visit).arrived:shown.has(T.id);
 const tfact=(T,f,v)=>{if(visible(T))fact(T.id,f,v);};
 const taskFacts=T=>{const ts=S.ts.get(T.id);fact(T.id,'mandatory',T.mandatory);fact(T.id,'prerequisite_ready_tick',ts.ready);fact(T.id,'task_state',ts.st);if(T.kind==='data')fact(T.id,'content_state',ts.cs);};
 const setState=(T,st)=>{S.ts.get(T.id).st=st;tfact(T,'task_state',st);};
 const setCs=(T,cs)=>{S.ts.get(T.id).cs=cs;tfact(T,'content_state',cs);};
 const setLoc=(vs,loc)=>{vs.loc=loc;vs.locSeg.push([t<0?0:t,loc]);fact(vs.ref,'location_id',loc);};
 const ownFact=(u,task)=>fact(u,u.startsWith('position:')?'position_owner_task_id':'resource_owner_task_id',task);
 const take=(u,task,mode,k)=>{
  const o=S.own.get(u),v=T_(task)?.visit;
  if(o)o.mode=mode;else{S.own.set(u,{task,mode,since:k});S.since.set(u,Math.max(k,0));ownFact(u,task);}
  if(v&&u.startsWith('position:'))S.vs.get(v).pos.set(u,mode);
 };
 const drop=u=>{const o=S.own.get(u);S.own.delete(u);S.busy.set(u,(S.busy.get(u)??0)+t-S.since.get(u));ownFact(u,null);const v=T_(o.task)?.visit;if(v)S.vs.get(v).pos.delete(u);};
 const applyChanges=cs=>{for(const c of cs){if(c.change==='RELEASE')drop(c.resource_id);else take(c.resource_id,c.owner_task_id,c.change==='RESERVE'?'R':'A',t);}};
 const event=(T,tr)=>S.events.push([t,T.visit?`visit:${T.visit}`:null,T.template,tr]);
 // ----- initial state -----
 for(const T of M.tasks.values())S.ts.set(T.id,{st:'UNREADY',ready:null,first:null,start:null,end:null,endAt:null,action:null,firstAction:null,workers:[],lane:null,dest:null,port:null,pos:null,origin:null,mem:null,credited:0n,pend:T.prereqs.length,cs:null});
 for(const p of M.plans){
  const v=p.visit;let res=BigInt(v.initial_log_bytes);for(const o of v.installed_object_ids)res+=BigInt(M.objects.get(o).size_bytes);
  S.vs.set(p.id,{ref:p.ref,plan:p,arrived:false,loc:null,locSeg:[],energy:socEnergy(v.initial_soc_pct),e0:socEnergy(v.initial_soc_pct),portRef:null,connected:false,running:new Set(),pos:new Map(),workDone:null,released:null,hpos:null});
  S.storage.set(p.id,{res,rsv:0n});
 }
 const life=new Map();
 if(s.network.cache.state==='warm')for(const o of s.network.cache.initial_object_ids){S.cacheUsed+=BigInt(M.objects.get(o).size_bytes);life.set(`cache:depot|object:${o}`,'CHECK_COMPLETE');}
 const unlock=id=>{for(const d of M.dep.get(id)??[]){const x=S.ts.get(d);if(--x.pend===0&&x.st==='UNREADY')S.cand.add(d);}for(const d of M.any.get(id)??[])if(S.ts.get(d).st==='UNREADY')S.cand.add(d);};
 for(const [vid,h]of M.init){
  const vs=S.vs.get(vid),pos=`position:${h.position}`,port=h.connectedPort&&`port:${h.connectedPort}`;vs.hpos=pos;
  for(const id of h.completed){const x=S.ts.get(id);x.st='COMPLETE';x.ready=0;x.endAt=0;unlock(id);}
  take(pos,h.positionOwner,'A',-1);
  if(port){take(port,h.portOwner,'A',-1);vs.portRef=port;vs.connected=true;}
  for(const o of Object.keys(h.content)){
   const obj=M.objects.get(o),dl=refs.task(vid,`${obj.kind}_download`),x=S.ts.get(dl);
   if(x&&x.st!=='COMPLETE'){x.st='COMPLETE';x.ready=0;x.endAt=0;x.cs='object_complete';unlock(dl);}
   S.storage.get(vid).res+=BigInt(obj.size_bytes);life.set(`${vs.ref}|object:${o}`,'OBJECT_COMPLETE');
  }
 }
 for(const w of M.workerList)fact(w.ref,'worker_available',false);
 if(M.vendor.worker)fact('vendor:worker:01','worker_available',false);
 for(const u of M.units)ownFact(u,S.own.get(u)?.task??null);
 for(const k of ['maps','software','uploads']){const e=s.services[k];fact(`service:${k}`,'endpoint_reachable',e.service_reachable==='reachable');fact(`service:${k}`,'entitlement',e.entitlement);}
 for(const o of s.content_objects)fact(`object:${o.id}`,'size_bytes',o.size_bytes);
 if(rec)rec.start(S);
 // ----- ownership, location and bundle checks (note 10.2: ownership before lifecycle before policy) -----
 function ownCheck(g,owner){
  const seen=new Set();let prev='';
  for(const c of g.p.changes){
   const u=c.resource_id;if(seen.has(u)||u<prev)fail('RECORD_ORDER_INVALID','resource changes not sorted and unique',g);seen.add(u);prev=u;
   if(!M.units.has(u))fail('UNKNOWN_REFERENCE',u,g);if(!M.tasks.has(c.owner_task_id))fail('UNKNOWN_REFERENCE',c.owner_task_id,g);
   if(owner&&c.owner_task_id!==owner)fail('RESOURCE_BUNDLE_MISMATCH',`${u} owner ${c.owner_task_id}`,g);
   const o=S.own.get(u);
   if(c.change==='RELEASE'){if(!o||o.task!==c.owner_task_id)fail('RESOURCE_NOT_OWNED',u,g);}
   else if(o&&!(c.change==='ACQUIRE'&&o.task===c.owner_task_id&&o.mode==='R'))fail(o.since===t?'DOUBLE_RESOURCE_ACQUISITION_SAME_TICK':'RESOURCE_ALREADY_OWNED',`${u} held by ${o.task}`,g);
  }
 }
 // One vehicle holds at most one occupied and one reserved position and at most one port (D1-08 Q2).
 function locCheck(g){
  const per=new Map();
  for(const c of g.p.changes){const v=T_(c.owner_task_id).visit;if(!v||!/^(position|port):/.test(c.resource_id))continue;if(!per.has(v))per.set(v,new Map([...S.vs.get(v).pos,...(S.vs.get(v).portRef?[[S.vs.get(v).portRef,'P']]:[])]));const m=per.get(v);if(c.change==='RELEASE')m.delete(c.resource_id);else m.set(c.resource_id,c.resource_id.startsWith('port:')?'P':c.change==='RESERVE'?'R':'A');}
  for(const [v,m]of per){const n=x=>[...m.values()].filter(y=>y===x).length;if(n('A')>1||n('R')>1||n('P')>1)fail('LOCATION_VIOLATION',`visit ${v} in two places`,g);}
 }
 function delta(g,expected,owner){ownCheck(g,owner);locCheck(g);if(jcs(g.p.changes)!==jcs(expected))fail('RESOURCE_BUNDLE_MISMATCH',`changes for ${g.p.action_id}`,g);}
 const change=(change,u,task)=>({change,owner_task_id:task,resource_id:u});
 // ----- lifecycle -----
 function prereqFail(T,g){
  const ts=S.ts.get(T.id);
  if(T.visit&&!S.vs.get(T.visit).arrived)fail('TASK_STATE_INVALID',`${T.id} before arrival`,g);
  const open=T.prereqs.filter(p=>S.ts.get(p).st!=='COMPLETE'),cacheOpen=T.anyPrereqs.length&&!T.anyPrereqs.some(p=>S.ts.get(p).st==='COMPLETE');
  if(!open.length&&!cacheOpen)fail('TASK_STATE_INVALID',`${T.id} ${ts.st}`,g);
  if(T.template==='egress')fail('RELEASE_CONDITION_UNMET',`${open[0]} incomplete`,g);
  if(T.kind==='data'&&T.data.cacheRoute&&open.some(p=>T_(p).cacheCheck))fail('UNAUTHORIZED_CACHE_EVICTION_OR_BYPASS',`${T.id} bypasses the cache`,g);
  if(stepOf(T)&&open.some(p=>isContent(T_(p))))fail('UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE',`${T.id} before ${open[0]}`,g);
  fail('PREREQUISITE_UNSATISFIED',`${T.id} before ${open[0]??'intake'}`,g);
 }
 function ready(T){
  const ts=S.ts.get(T.id);if(ts.st!=='UNREADY')return false;
  if(T.visit&&!S.vs.get(T.visit).arrived)return false;
  if(ts.pend>0||T.anyPrereqs.length&&!T.anyPrereqs.some(p=>S.ts.get(p).st==='COMPLETE'))return false;
  ts.ready=t;ts.mem=null;setState(T,'READY');tfact(T,'prerequisite_ready_tick',t);if(T.kind!=='zero')S.queue.add(T.id);return true;
 }
 // ----- flows (C2.1): interval anchor, remainder clipped at the target and, for DC only, the next band edge -----
 const flowId=T=>T.visit?refs.flow(T.visit,T.template):refs.cacheFlow(T.data.object);
 function open(F){
  const T=F.T,ts=S.ts.get(T.id);F.anchor=t;F.before=0n;F.from=t;
  if(F.dom==='charge'){
   const vs=V_(T),E=vs.energy,tr=M.target-E,port=M.ports.get(vs.portRef);F.Ea=E;
   if(port.kind==='DC'){const edge=nextBandEdge(E,M.bands),er=edge===null?tr:edge-E;F.cap=Q(BigInt(bandAt(E,M.bands).cap_w)*1000n);F.R=er<tr?er:tr;F.toTarget=!(er<tr);}
   else{F.cap=Q(M.acCap);F.R=tr;F.toTarget=true;}
  }else{F.R=BigInt(T.data.bytes)-ts.credited;F.toTarget=true;}
  F.close=Infinity;S.dirtyDom[F.dom]=true;
 }
 function credit(F,amount){
  const T=F.T,ts=S.ts.get(T.id),vs=V_(T);ts.credited+=amount;
  if(F.dom==='charge'){vs.energy+=amount;S.credit.charge+=amount;}else S.credit[T.data.direction==='up'?'up':'down']+=amount;
  // Replay invariants (D1-04): credit never exceeds the task remainder; energy never exceeds max(initial, target) or the pack.
  if(amount<0n||(F.dom==='charge'?vs.energy>(M.target>vs.e0?M.target:vs.e0)||vs.energy>PACK_MJ:ts.credited>BigInt(T.data.bytes)))fail('PROGRESS_MISMATCH',`${F.id} credited beyond its remainder`,groups[gi-1]);
 }
 const item=(F,after,slack,undrawn,to)=>({allocation_anchor_tick:F.anchor,anchor_credited_after:Number(after),anchor_credited_before:Number(F.before),credited:Number(after-F.before),flow_id:F.id,from_tick:F.from,quantization_slack:slack,to_tick:to,undrawn_final_tick:undrawn});
 function matchProgress(g,items){
  const got=g.p.changes;
  for(let i=0;i<Math.max(got.length,items.length);i++)if(!got[i]||!items[i]||jcs(got[i])!==jcs(items[i]))fail('PROGRESS_MISMATCH',`credit for ${(items[i]??got[i]).flow_id}`,g);
 }
 // ----- phase 0: closures and completions -----
 function phase0(){
  const closing=[...S.flows.values()].filter(F=>F.close===t).sort((a,b)=>text(a.id,b.id)),due=[];
  let g=peek(0);
  if(closing.length){
   if(!g||g.kind!=='PROGRESS')fail('PROGRESS_MISMATCH','missing closure credit',g);
   matchProgress(g,closing.map(F=>item(F,F.R,'0/1',formatRational(undrawnAt(F.rate,F.anchor,t,F.R)),t)));gi++;
   // A closed interval is never credited again. A flow at its target leaves both allocation domains and its task must
   // complete in this phase (note 8.3 phase 0); a band edge reopens at once, except at H, where no H item exists (F4).
   for(const F of closing){
    credit(F,F.R-F.before);F.before=F.R;F.from=t;F.close=Infinity;
    if(F.toTarget){S.flows.delete(F.id);S.dirtyDom[F.dom]=true;S.ts.get(F.T.id).end=t;due.push(F.T.id);}else if(t<H)open(F);else F.anchor=null;
   }
  }else if(g&&g.kind==='PROGRESS')fail('PROGRESS_MISMATCH','unexpected closure credit',g);
  let prev='';S.p0={due,prev:'',done:false};
  while((g=peek(0))){
   if(g.kind==='TASK_TRANSITION'&&g.p.transition==='COMPLETE'){complete(g,prev);prev=g.p.task_id;S.p0.prev=prev;continue;}
   if(g.kind==='CONTENT_TRANSITION')fail(contentCode(g.p),`${g.p.transition} for ${g.p.object_id} without its completion`,g);
   if(g.kind==='RESOURCE_DELTA'){ownCheck(g,null);fail('RESOURCE_BUNDLE_MISMATCH','delta without completion',g);}
   if(g.kind==='PROGRESS')fail('PROGRESS_MISMATCH','credit after completions',g);
   fail('TASK_STATE_INVALID',`${g.p.transition??g.kind} in completion phase`,g);
  }
  // Deferred to the end of the tick (note 10.2): a later same-tick lifecycle violation reports first.
  S.p0.done=true;
  for(const id of due)if(S.ts.get(id).st!=='COMPLETE')defer('MISSING_COMPLETION',`${id} reached its target at ${t}`,groups[gi-1]);
 }
 const contentCode=p=>p.owner_id==='cache:depot'&&(p.transition==='RECLAIMED'||p.transition==='RECEIVED_PROVISIONAL')?'UNAUTHORIZED_CACHE_EVICTION_OR_BYPASS':'UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE';
 const content=(owner,object,transition,bytes)=>({bytes:Number(bytes),object_id:object,owner_id:owner,transition});
 function expectContent(c){
  const g=peekIn();
  if(!g||g.kind!=='CONTENT_TRANSITION'||g.phase!==groups[gi-1].phase)fail('UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE',`missing ${c.transition} for ${c.object_id}`,g);
  if(jcs(g.p)!==jcs(c))fail(contentCode(g.p),`${g.p.transition} for ${g.p.object_id}`,g);
  gi++;life.set(`${c.owner_id}|${c.object_id}`,c.transition);
 }
 function complete(g,prev){
  const id=g.p.task_id,T=T_(id);if(!T)fail('UNKNOWN_REFERENCE',id,g);
  const ts=S.ts.get(id),vs=V_(T);
  if(ts.st==='COMPLETE')fail('DUPLICATE_COMPLETION',id,g);
  if(ts.st!=='RUNNING')fail('TASK_STATE_INVALID',`${id} completes from ${ts.st}`,g);
  if(ts.end!==t)fail('COMPLETION_TIME_MISMATCH',`${id} due at ${ts.end}`,g);
  if(id<=prev)fail('RECORD_ORDER_INVALID','completions out of task order',g);
  if(g.p.action_id!==ts.firstAction)fail('UNKNOWN_REFERENCE',`${id} completes ${g.p.action_id}`,g);
  if(g.p.observation_seq!==null)fail('OBSERVATION_REFERENCE_INVALID',id,g);
  gi++;
  const ch=[],rel=u=>ch.push(change('RELEASE',u,S.own.get(u)?.task??id));
  for(const w of ts.workers)ch.push(change('RELEASE',w,id));
  if(T.kind==='move'){ch.push(change('RELEASE',ts.lane,id));if(ts.origin)rel(ts.origin);if(ts.dest)ch.push(change('ACQUIRE',ts.dest,id));}
  if(T.template==='connect')ch.push(change('ACQUIRE',vs.portRef,S.own.get(vs.portRef)?.task??id));
  if(T.template==='unplug')rel(vs.portRef);
  if(T.kind==='vendor')ch.push(change('RELEASE','vendor:bay:01',id),change('RELEASE','vendor:worker:01',id));
  ch.sort((a,b)=>text(a.resource_id,b.resource_id));
  const d=peekIn(0);
  if(ch.length){if(!d||d.kind!=='RESOURCE_DELTA'||d.p.action_id!==ts.firstAction)fail('RESOURCE_BUNDLE_MISMATCH',`${id} completion without its release`,d);delta(d,ch,null);gi++;applyChanges(ch);}
  else if(d&&d.kind==='RESOURCE_DELTA'&&d.p.action_id===ts.firstAction){ownCheck(d,null);fail('RESOURCE_BUNDLE_MISMATCH',`${id} completion changes no unit`,d);}
  const own=vs?vs.ref:'cache:depot';
  if(T.kind==='data'){const obj=T.data.direction==='up'?refs.logs(T.visit):`object:${T.data.object}`;expectContent(content(own,obj,'OBJECT_COMPLETE',T.data.bytes));}
  const step=stepOf(T);
  if(T.kind==='timed'&&step&&T.object)expectContent(content(own,`object:${T.object}`,step,M.objects.get(T.object).size_bytes));
  // apply
  setState(T,'COMPLETE');ts.endAt=t;S.running.delete(id);vs?.running.delete(id);event(T,'COMPLETE');unlock(id);
  if(T.kind==='charge'||T.kind==='data'){S.flows.delete(flowId(T));S.dirtyDom[T.kind==='charge'?'charge':'data']=true;}
  if(T.kind==='data'){
   if(!T.data.cacheFetch&&T.data.direction==='down'){const st=S.storage.get(T.visit),n=BigInt(T.data.bytes);st.rsv-=n;st.res+=n;}
   setCs(T,'object_complete');
  }
  if(T.kind==='move'){
   if(T.template==='egress'){setLoc(vs,'released');vs.released=t;}
   else if(T.template==='vendor_departure')setLoc(vs,'offsite');
   else setLoc(vs,ts.dest);
  }
  if(T.template==='connect')vs.connected=true;
  if(T.template==='unplug'){vs.connected=false;vs.portRef=null;}
  if(T.template==='inspection')vs.workDone=t;
  if(T.template==='egress')for(const U of vs.plan.tasks){
   const us=S.ts.get(U.id);if(U.template!=='upload'||U.mandatory||us.st==='COMPLETE'||us.st==='CANCELLED'||us.st==='UNREADY')continue;
   const c=peekIn(0);
   if(!c||c.kind!=='TASK_TRANSITION'||c.p.transition!=='CANCEL'||c.p.task_id!==U.id||c.p.action_id!==ts.firstAction||c.p.observation_seq!==null)fail('TASK_STATE_INVALID',`optional ${U.id} not cancelled at release`,c);
   gi++;setState(U,'CANCELLED');us.endAt=t;S.queue.delete(U.id);S.running.delete(U.id);vs.running.delete(U.id);S.flows.delete(flowId(U));event(U,'CANCEL');
   if(us.credited>0n){expectContent(content(vs.ref,refs.logs(T.visit),'RECEIVED_PROVISIONAL',us.credited));setCs(U,'received_provisional');}
  }
 }
 // ----- phase 1: exogenous shift changes and arrivals (ranks 0, 1, 2) -----
 function phase1(){
  const sh=M.shifts.get(t)??{ends:[],starts:[]};
  for(const [w,av]of [...sh.ends.map(w=>[w,false]),...sh.starts.map(w=>[w,true])]){const g=peek(1);if(!g||g.kind!=='SHIFT_CHANGE'||g.p.worker_id!==w||g.p.available!==av)fail('SHIFT_VIOLATION',`${w} availability ${av} at ${t}`,g);gi++;fact(w,'worker_available',av);}
  for(const v of M.arrivals.get(t)??[]){
   const g=peek(1);if(!g||g.kind!=='ARRIVAL'||g.p.visit_id!==v)fail('LOCATION_VIOLATION',`arrival of ${v} at ${t}`,g);gi++;
   const vs=S.vs.get(v.slice(6));vs.arrived=true;
   fact(v,'arrived',true);fact(v,'arrival_tick',vs.plan.visit.arrival_tick);fact(v,'due_tick',vs.plan.visit.due_tick);setLoc(vs,vs.hpos??'outside');
   for(const T of vs.plan.tasks){taskFacts(T);if(S.ts.get(T.id).st==='UNREADY'&&S.ts.get(T.id).pend===0)S.cand.add(T.id);}
   const intake=`task:${vs.plan.id}:intake`;for(const T of M.compiled.cacheTasks)if(!shown.has(T.id)&&T.anyPrereqs.includes(intake)){shown.add(T.id);taskFacts(T);}
  }
  const g=peekIn(1);if(g)fail(g.kind==='ARRIVAL'?'LOCATION_VIOLATION':'SHIFT_VIOLATION',`unexpected ${g.kind}`,g);
 }
 // ----- phase 2: window boundaries, readiness and zero-duration acknowledgments -----
 function phase2(){
  for(const id of M.windows.get(t)??[]){
   const T=T_(id),st=S.ts.get(id).st;if(!visible(T)||st==='COMPLETE'||st==='CANCELLED')continue;
   const g=peek(2);if(!g||g.kind!=='WINDOW_OPEN'||g.p.task_id!==id)fail('WINDOW_VIOLATION',`window of ${id} at ${t}`,g);gi++;
  }
  if(peekIn(2)?.kind==='WINDOW_OPEN')fail('WINDOW_VIOLATION','unexpected window',peekIn(2));
  const acks=[];
  for(const id of [...S.cand]){S.cand.delete(id);const T=T_(id);if(ready(T)&&T.kind==='zero')acks.push(id);}
  for(const id of acks.sort()){
   const T=T_(id),ts=S.ts.get(id),vs=V_(T),a=peek(2);
   if(!a||a.kind!=='TASK_TRANSITION'||a.p.transition!=='START'||a.p.task_id!==id)fail('TASK_STATE_INVALID',`${id} not closed at ${t}`,a);
   const action=refs.action(t,1,a.ord);if(a.p.action_id!==action)fail('UNKNOWN_REFERENCE',`${id} action`,a);if(a.p.observation_seq!==null)fail('OBSERVATION_REFERENCE_INVALID',id,a);gi++;
   const c=peekIn(2);if(!c||c.kind!=='TASK_TRANSITION'||c.p.transition!=='COMPLETE'||c.p.task_id!==id||c.p.action_id!==action||c.p.observation_seq!==null)fail('TASK_STATE_INVALID',`${id} closure`,c);gi++;
   const logs=refs.logs(T.visit),n=BigInt(vs.plan.visit.initial_log_bytes);
   if(life.get(`${vs.ref}|${logs}`)!=='OBJECT_COMPLETE')fail('UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE',`${logs} acknowledged before complete`,a);
   expectContent(content(vs.ref,logs,'DURABLE_ACKNOWLEDGED',n));expectContent(content(vs.ref,logs,'RECLAIMED',n));
   ts.first=ts.start=t;ts.endAt=t;ts.action=ts.firstAction=action;setState(T,'COMPLETE');event(T,'START');event(T,'COMPLETE');unlock(id);
   S.storage.get(T.visit).res-=n;setCs(T_(refs.task(T.visit,'upload')),'reclaimed');
  }
  for(const id of [...S.cand]){S.cand.delete(id);ready(T_(id));}
  const g=peekIn(2);if(g)fail(g.kind==='CONTENT_TRANSITION'?contentCode(g.p):'TASK_STATE_INVALID',`unexpected ${g.kind} at ${t}`,g);
 }
 // ----- phase 3: observation group, net deltas and the state digest chain (BD-12, BD-13) -----
 function phase3(){
  const keys=(S.obs.any?[...S.dirty].filter(k=>!S.pub.has(k)||S.pub.get(k)!==S.facts.get(k)[2]):[...S.facts.keys()]);
  const facts=keys.map(k=>S.facts.get(k)).sort((a,b)=>text(a[0],b[0])||text(a[1],b[1])).map(([entity_id,field,value])=>({entity_id,field,value}));
  const g=peek(3);
  if(!facts.length){if(g){defer('OBSERVATION_MISMATCH','observation without a changed fact',g);gi++;S.obs.seq=g.last;}return;}
  const d=digestOf('fleetlab.depot.observation-state.v1',{previous:S.obs.digest,facts});
  if(!g)defer('OBSERVATION_MISMATCH',`changed facts not published at ${t}`,groups[gi]);
  else{
   if(g.kind!=='OBSERVATION')fail('RECORD_ORDER_INVALID','observation phase',g);
   if(jcs(g.p.facts)!==jcs(facts))defer('OBSERVATION_MISMATCH',`facts differ at ${t}`,g);
   else if(g.p.base_observation_seq!==S.obs.seq)defer('OBSERVATION_REFERENCE_INVALID','base observation',g);
   else if(g.p.state_digest!==d)defer('OBSERVATION_MISMATCH','state digest',g);
   gi++;S.obs.seq=g.last;
  }
  S.obs.digest=d;S.obs.any=true;for(const k of keys)S.pub.set(k,S.facts.get(k)[2]);S.dirty.clear();
 }
 // ----- phase 4: the fixed policy worklist (note 8.4, BD-08) -----
 function readGroup(g){const out=[g];gi++;let r;while((r=peekIn(4))&&r.kind!=='POLICY_DECISION'){out.push(r);gi++;if(r.kind==='TASK_TRANSITION'&&(r.p.transition==='START'||r.p.transition==='RESUME'))break;}return out;}
 function header(d){
  if(d.p.action_id!==refs.action(t,1,d.ord))fail('UNKNOWN_REFERENCE',`decision action ${d.p.action_id}`,d);
  if(d.p.observation_seq!==S.obs.seq)fail('OBSERVATION_REFERENCE_INVALID',`decision references ${d.p.observation_seq}`,d);
  if(d.p.blockage_group_id!==null)fail('BLOCKAGE_MISMATCH','decision linked to a blockage group',d);
 }
 // Accepted action group: integrity, ownership, location, bundle, lifecycle, then policy (note 10.2 precedence).
 function accepted(grp,need,ev){
  const d=grp[0],T=T_(d.p.task_id);header(d);
  if(!T)fail('UNKNOWN_REFERENCE',d.p.task_id,d);
  if(d.p.reasons.length)fail('REASON_MISMATCH','accepted decision with reasons',d);
  const last=grp[grp.length-1],ts=S.ts.get(T.id),vs=V_(T);
  if(grp.length<2||last.kind!=='TASK_TRANSITION'||last.p.task_id!==T.id||!['START','RESUME'].includes(last.p.transition))fail('TASK_STATE_INVALID',`${T.id} accepted without a start`,last);
  const parts={pauses:[],delta:null,content:null};let stage=0;
  for(const r of grp.slice(1)){
   if(r.kind!=='CONTENT_TRANSITION'&&r.p.action_id!==d.p.action_id)fail('UNKNOWN_REFERENCE',`action ${r.p.action_id}`,r);
   if(r.kind==='TASK_TRANSITION'&&r.p.observation_seq!==d.p.observation_seq)fail('OBSERVATION_REFERENCE_INVALID',r.p.task_id,r);
   if(r===last)break;
   if(r.kind==='TASK_TRANSITION'&&r.p.transition==='PAUSE'&&!stage){if(r.p.task_id<=(parts.pauses.at(-1)??''))fail('RECORD_ORDER_INVALID','pauses not in ascending task order',r);parts.pauses.push(r.p.task_id);}
   else if(r.kind==='RESOURCE_DELTA'&&stage<1){stage=1;parts.delta=r;}
   else if(r.kind==='CONTENT_TRANSITION'&&stage<2){stage=2;parts.content=r;}
   else fail('TASK_STATE_INVALID',`action group order at ${r.kind}`,r);
  }
  // A paused transfer still has its flow; one closed at its target this tick cannot be paused (FD-01).
  for(const id of parts.pauses){const P=T_(id);if(!P||P.visit!==T.visit||S.ts.get(id).st!=='RUNNING'||P.kind!=='data'||!S.flows.has(flowId(P)))fail('OVERLAP_VIOLATION',`pause of ${id}`,grp[1]);}
  const ch=parts.delta?.p.changes??[];
  if(parts.delta){ownCheck(parts.delta,T.id);locCheck(parts.delta);}
  // bundle shape
  const of=pre=>ch.filter(c=>c.resource_id.startsWith(pre)),claim={workers:of('worker:').map(c=>c.resource_id),lane:of('lane:')[0]?.resource_id??null,dest:of('position:')[0]?.resource_id??null,port:of('port:')[0]?.resource_id??null,vendor:of('vendor:').length===2,pauses:parts.pauses};
  const z=T.kind==='move'?T.move.to:null,P=M.positions.get(claim.dest);
  const shape=(T.attention?claim.workers.length>=1&&claim.workers.length<=2:!claim.workers.length)&&of('lane:').length===(T.kind==='move'?1:0)
   &&of('position:').length===(ZONES.has(z)?1:0)&&(!claim.dest||P.zone===z&&P.enabled)&&of('port:').length===(z==='charging'?1:0)&&(!claim.port||M.ports.get(claim.port).pos===claim.dest&&M.ports.get(claim.port).enabled)
   &&of('vendor:').length===(T.kind==='vendor'?2:0)&&ch.every(c=>c.change===(/^(position|port):/.test(c.resource_id)?'RESERVE':'ACQUIRE'));
  if(last.p.transition==='START'&&!shape||last.p.transition==='RESUME'&&parts.delta)fail('RESOURCE_BUNDLE_MISMATCH',`units for ${T.id}`,parts.delta??d);
  const resume=last.p.transition==='RESUME',down=T.kind==='data'&&T.data.direction==='down'&&!resume;
  const want=down?content(T.data.cacheFetch?'cache:depot':vs.ref,`object:${T.data.object}`,'RESERVED',T.data.bytes):null;
  if(jcs(parts.content?.p??null)!==jcs(want))fail('STOCK_VIOLATION',`reservation for ${T.id}`,parts.content??last);
  // lifecycle
  if(resume?ts.st!=='PAUSED':ts.st!=='READY'){if(ts.st==='UNREADY')prereqFail(T,d);fail('TASK_STATE_INVALID',`${T.id} ${last.p.transition} from ${ts.st}`,last);}
  const code=checkClaim(M,S,T,t,claim,resume);if(code)fail(code,T.id,parts.delta??d);
  // policy
  if(need!=='accept')fail('POLICY_NONCONFORMANCE',`${T.id} started out of the fixed order or while infeasible`,d);
  const c=ev.choice;
  if(!resume&&(claim.workers.join()!==c.workers.join()||claim.lane!==c.lane||claim.dest!==c.dest||claim.port!==c.port||claim.vendor!==c.vendor))fail('POLICY_NONCONFORMANCE',`${T.id} choice differs from the fixed rule`,parts.delta??d);
  // apply
  for(const id of parts.pauses){const U=T_(id),us=S.ts.get(id),F=S.flows.get(flowId(U));setState(U,'PAUSED');us.mem=null;S.running.delete(id);vs.running.delete(id);S.queue.add(id);event(U,'PAUSE');S.flows.delete(F.id);if(F.anchor!==null&&F.anchor<t)S.closing.push(F);S.dirtyDom.data=true;}
  applyChanges(ch);
  if(down){const n=BigInt(T.data.bytes);if(T.data.cacheFetch)S.cacheUsed+=n;else S.storage.get(T.visit).rsv+=n;life.set(`${want.owner_id}|${want.object_id}`,'RESERVED');}
  ts.start=t;ts.first??=t;ts.action=d.p.action_id;ts.firstAction??=d.p.action_id;setState(T,'RUNNING');S.running.add(T.id);vs?.running.add(T.id);S.queue.delete(T.id);event(T,last.p.transition);
  if(!resume){ts.workers=claim.workers;ts.lane=claim.lane;ts.dest=claim.dest;ts.port=claim.port??(['connect','charge','unplug'].includes(T.template)?vs.portRef:null);ts.pos=M.positions.has(vs?.loc)?vs.loc:null;}
  if(TIMED.has(T.kind)){ts.d=claim.d??T.timed;ts.end=t+ts.d;}
  if(T.kind==='move'){ts.origin=M.positions.has(vs.loc)?vs.loc:null;setLoc(vs,'moving');if(claim.port)vs.portRef=claim.port;}
  if(T.kind==='charge'||T.kind==='data'){
   const dom=T.kind==='charge'?'charge':'data',v=T.visit,c2=`client:${v}`;
   const path=dom==='charge'?[vs.portRef,'site:supply']:T.data.cacheFetch?['network:wan_down']:T.data.direction==='up'?[c2,'network:pool','network:wan_up']:T.data.cacheRoute?['cache:read',c2,'network:pool']:[c2,'network:pool','network:wan_down'];
   ts.path=path.sort();S.flows.set(flowId(T),{id:flowId(T),T,dom,path:ts.path,cap:null,rate:null,tight:null,anchor:null,isNew:true,close:Infinity});S.dirtyDom[dom]=true;
  }
 }
 function phase4(){
  const list=[...S.queue].map(id=>[T_(id),S.ts.get(id)]).sort(byWorklist),pos=new Map(list.map(([T],i)=>[T.id,i]));
  for(let i=0;i<list.length;i++){
   const [T,ts]=list[i];if(ts.st!=='READY'&&ts.st!=='PAUSED')continue;
   const ev=evaluate(M,S,T,t,ts.st==='PAUSED'),need=ev.ok?'accept':codeKey(ev.reasons)!==ts.mem?'reject':null;
   let g=peek(4);
   while(g&&g.kind==='POLICY_DECISION'&&g.p.task_id!==T.id&&!(pos.get(g.p.task_id)>i)){stray(g);g=peek(4);}
   if(g&&g.kind!=='POLICY_DECISION')fail('TASK_STATE_INVALID',`${g.kind} outside an action group`,g);
   if(!g||g.p.task_id!==T.id){if(need==='accept')fail('POLICY_MISSED_FEASIBLE_START',T.id,g);if(need==='reject')fail('REASON_MISMATCH',`changed rejection of ${T.id} not recorded`,g);continue;}
   if(g.p.accepted){accepted(readGroup(g),need,ev);continue;}
   header(g);
   if(need==='accept')fail('POLICY_MISSED_FEASIBLE_START',`${T.id} feasible`,g);
   if(need===null)fail('REASON_MISMATCH',`unchanged rejection of ${T.id} recorded`,g);
   if(jcs(g.p.reasons)!==jcs(ev.reasons))fail('REASON_MISMATCH',`reasons of ${T.id}: expected ${jcs(ev.reasons).slice(0,300)}`,g);
   gi++;ts.mem=codeKey(ev.reasons);
  }
  let g;while((g=peek(4))){if(g.kind!=='POLICY_DECISION')fail('TASK_STATE_INVALID',`${g.kind} outside an action group`,g);stray(g);}
 }
 function stray(g){
  if(!g.p.accepted){header(g);fail('REASON_MISMATCH',`decision for ${g.p.task_id} outside the worklist order`,g);}
  accepted(readGroup(g),'stray',null);
 }
 // ----- phase 5: both allocation domains, closures by reallocation or pause, changed flows (C2.1, BD-11) -----
 function allocate(){
  const act=[...S.flows.values()],alloc=new Map();
  for(const F of act)if(F.anchor===null)open(F);
  for(const dom of ['charge','data'])if(S.dirtyDom[dom]){const fl=act.filter(F=>F.dom===dom);for(const [k,v]of maxMin(fl,M.caps))alloc.set(k,v);}
  const want=[],closes=[...S.closing];
  for(const F of act){
   const n=alloc.get(F.id)??{rate:F.rate,tight:F.tight};F.next=n;
   F.rc=F.rate===null||!eq(n.rate,F.rate);
   if(F.isNew||F.rc||F.tight.join()!==n.tight.join())want.push(F);
   if(F.anchor!==null&&F.anchor<t&&F.rc)closes.push(F);
  }
  want.sort((a,b)=>text(a.id,b.id));closes.sort((a,b)=>text(a.id,b.id));
  return {act,want,closes};
 }
 const credits=closes=>closes.map(F=>item(F,creditAt(F.rate,F.anchor,t,F.R),formatRational(slackAt(F.rate,F.anchor,t)),'0/1',t));
 const reopen=closes=>{for(const F of closes){credit(F,creditAt(F.rate,F.anchor,t,F.R)-F.before);if(S.flows.has(F.id))open(F);}};
 // The engine's phase 5 up to its sub-quantum refusal, which precedes every phase-5 record (C2.1, note 19): the first
 // interval opened at t, charge then data by id, whose positive share cannot credit by H; null when there is none.
 function subQuantum(){
  const {act,closes}=allocate();reopen(closes);
  for(const dom of ['charge','data'])for(const F of act.filter(F=>F.dom===dom).sort((a,b)=>text(a.id,b.id)))
   if(F.anchor===t&&F.next.rate.n>0n&&F.R>0n&&creditAt(F.next.rate,t,H,F.R)===0n)return {anchor_tick:t,flow_id:F.id,horizon_tick:H,rate:formatRational(F.next.rate),remainder:F.R.toString()};
  return null;
 }
 function phase5(){
  const {act,want,closes}=allocate();
  let gp=peek(5);if(gp&&gp.kind==='PROGRESS')gi++;else gp=null;
  // PROGRESS and ALLOCATION_DELTA are separate commits: a cut between them still checks the credit.
  if(gp&&gi>=groups.length&&t===cutTick){matchProgress(gp,credits(closes));reopen(closes);throw CUT;}
  let ga=peek(5);if(ga&&ga.kind==='ALLOCATION_DELTA')gi++;else ga=null;
  if(peekIn(5))fail('RECORD_ORDER_INVALID',`unexpected ${peekIn(5).kind}`,peekIn(5));
  const listed=ga?.p.changes??[],by=new Map();let prev='';
  for(const c of listed){
   const F=S.flows.get(c.flow_id);if(!F)fail('UNKNOWN_REFERENCE',`allocation for inactive ${c.flow_id}`,ga);
   if(c.flow_id<=prev)fail('RECORD_ORDER_INVALID','allocation changes not sorted',ga);prev=c.flow_id;by.set(c.flow_id,c);
   if(c.resource_path.join()!==F.path.join())fail(F.T.kind==='data'&&F.T.data.cacheRoute&&!c.resource_path.includes('cache:read')?'UNAUTHORIZED_CACHE_EVICTION_OR_BYPASS':'ALLOCATION_INFEASIBLE',`path of ${F.id}`,ga);
   if(c.unit!==(F.dom==='charge'?'mJ_per_tick':'bytes_per_tick'))fail('ALLOCATION_INFEASIBLE',`unit of ${F.id}`,ga);
  }
  for(const F of want)if(!by.has(F.id))fail('ALLOCATION_DELTA_INCOMPLETE',`${F.id} changed but not listed`,ga??gp??groups[gi]);
  const rates=new Map(act.map(F=>[F.id,by.has(F.id)?Q(...ratio(by.get(F.id).rate)):F.rate]));
  for(const dom of ['charge','data']){const fl=act.filter(F=>F.dom===dom);if(fl.length){const c=characterize(fl,rates,M.caps);if(c)fail(c,`${dom} allocation at ${t}`,ga);}}
  for(const [id,c]of by){const F=S.flows.get(id);if(!eq(rates.get(id),F.next.rate)||c.tight_resource_ids.join()!==F.next.tight.join())fail('ALLOCATION_NOT_MAX_MIN',`bottleneck witness of ${id}`,ga);if(!want.includes(F))fail('ALLOCATION_DELTA_INCOMPLETE',`${id} listed without a change`,ga);}
  const items=credits(closes);
  if(items.length){if(!gp)fail('PROGRESS_MISMATCH','missing reallocation credit',ga??groups[gi]);matchProgress(gp,items);}else if(gp)fail('PROGRESS_MISMATCH','unexpected reallocation credit',gp);
  reopen(closes);
  for(const F of act){
   F.rate=F.next.rate;F.tight=F.next.tight;F.isNew=false;
   if(F.anchor===t){
    F.close=closeTick(F.rate,t,F.R);
    // Sub-quantum guard (C2.1): a positive share that cannot credit by H ends the run as a resource limit.
    if(F.rate.n>0n&&F.R>0n&&creditAt(F.rate,t,H,F.R)===0n)fail('TERMINAL_STATUS_MISMATCH',`${F.id} sub-quantum share in a complete run`,ga);
   }
  }
  S.closing=[];S.dirtyDom={charge:false,data:false};
 }
 const ratio=r=>{const [p,q]=r.split('/');return [BigInt(p),BigInt(q)];};
 // ----- phase 6 at H: horizon reports, provisional bytes, blockage and all-arrivals accounting -----
 function phase6(){
  let g=peekIn();if(g&&(g.phase===4||g.phase===5))fail('START_AT_HORIZON',`${g.kind} at H`,g);
  const act=[...S.flows.values()].filter(F=>F.anchor!==null).sort((a,b)=>text(a.id,b.id));
  g=peek(6);
  if(act.length){
   if(!g||g.kind!=='PROGRESS')fail('PROGRESS_MISMATCH','missing horizon report',g);
   matchProgress(g,act.map(F=>item(F,creditAt(F.rate,F.anchor,H,F.R),'0/1','0/1',H)));gi++;
   for(const F of act){const after=creditAt(F.rate,F.anchor,H,F.R);credit(F,after-F.before);F.before=after;F.from=H;}
  }else if(g&&g.kind==='PROGRESS')fail('PROGRESS_MISMATCH','unexpected horizon report',g);
  const prov=[];
  for(const T of M.tasks.values()){const ts=S.ts.get(T.id);if(T.kind==='data'&&(ts.st==='RUNNING'||ts.st==='PAUSED')&&ts.credited>0n)prov.push([T,content(T.visit?`visit:${T.visit}`:'cache:depot',T.data.direction==='up'?refs.logs(T.visit):`object:${T.data.object}`,'RECEIVED_PROVISIONAL',ts.credited)]);}
  prov.sort((a,b)=>text(a[1].owner_id,b[1].owner_id)||text(a[1].object_id,b[1].object_id));
  for(const [T,c]of prov){const x=peek(6);if(!x||x.kind!=='CONTENT_TRANSITION'||jcs(x.p)!==jcs(c))fail(x?.kind==='CONTENT_TRANSITION'?contentCode(x.p):'UNSATISFIED_CONTENT_LIFECYCLE_PREREQUISITE',`provisional bytes of ${T.id}`,x);gi++;life.set(`${c.owner_id}|${c.object_id}`,c.transition);setCs(T,'received_provisional');}
  if(peekIn(6)?.kind==='CONTENT_TRANSITION')fail(contentCode(peekIn(6).p),'unexpected content at H',peekIn(6));
  const want=horizonRecords(M,S,H);
  // A VECTOR_LIMIT or BLOCKAGE RECORD_BYTES prefix ends exactly before the record the replay expects next.
  for(const e of want){const x=peek(6);if(!x&&cut==='horizon'&&gi>=groups.length){S.cut=e;throw CUT;}if(!x||x.kind!=='BLOCKAGE'||jcs(x.p)!==jcs(e))fail(x?.kind==='BLOCKAGE'&&x.p.classification==='DEADLOCK_DECLARED'&&e.classification!=='DEADLOCK_DECLARED'?'UNPROVEN_DEADLOCK':'BLOCKAGE_MISMATCH',`blockage of ${e.member_visit_ids[0]}`,x);gi++;}
  if(peekIn(6)?.kind==='BLOCKAGE'){const x=peekIn(6);fail(x.p.classification==='DEADLOCK_DECLARED'?'UNPROVEN_DEADLOCK':'BLOCKAGE_MISMATCH','unsupported blockage record',x);}
  if(cut==='horizon')fail('TERMINAL_STATUS_MISMATCH','the replay reaches the horizon accounting with no refused blockage record',peekIn(6));
  S.blockage=want;
  const h=peek(6);
  const acc=checkHorizonAccounting({horizon_tick:H,visits:M.plans.map(p=>({id:p.ref,arrival_tick:p.visit.arrival_tick,released_at:S.vs.get(p.id).released})),claim:h&&h.kind==='HORIZON'?{tick:h.tick,...h.p}:null});
  if(!acc.ok)fail(acc.code,acc.detail,h);
  // The derived digest restates the observation chain; a completion owed at H reports first (note 10.2).
  for(const id of S.running){const e=S.ts.get(id).end;if(e!==null&&e<=t)defer('MISSING_COMPLETION',`${id} due at ${e}`,groups[gi-1]);}
  if(late?.code==='MISSING_COMPLETION')throw new Violation(late.code,late.detail,late.g??null);
  if(h.p.derived_state_digest!==digestOf('fleetlab.depot.horizon-state.v1',{observation:S.obs.digest,released:acc.released,unreleased:acc.unreleased}))fail('INCOMPLETE_HORIZON_ACCOUNTING','derived state digest',h);
  gi++;S.horizon=acc;
 }
 // ----- driver: one event tick at a time; nothing between event ticks (BD-07) -----
 const nextAfter=(arr,a)=>{for(const x of arr)if(x>a)return x;return Infinity;};
 function skipped(a,b){
  let best=Infinity,code=null;const see=(x,c)=>{if(x>a&&x<b&&x<best){best=x;code=c;}};
  for(const id of S.running){const e=S.ts.get(id).end;if(e!==null)see(e,'MISSING_COMPLETION');}
  for(const F of S.flows.values())see(F.close,'MISSING_COMPLETION');
  see(nextAfter(M.ticks.shift,a),'SHIFT_VIOLATION');see(nextAfter(M.ticks.arrival,a),'LOCATION_VIOLATION');
  for(const k of M.ticks.opens)if(k>a&&k<b&&M.windows.get(k).some(id=>{const st=S.ts.get(id).st;return visible(T_(id))&&st!=='COMPLETE'&&st!=='CANCELLED';})){see(k,'WINDOW_VIOLATION');break;}
  see(H,'INCOMPLETE_HORIZON_ACCOUNTING');
  if(code)fail(code,`event at ${best} has no records`,groups[gi]);
 }
 // The verifier owns the event-tick set (BD-07 as revised in note section 21): due and window ticks count only after
 // their visit arrives. A silent event tick still runs every phase, so a missing record fails; records elsewhere fail.
 const dues=[...new Set(M.plans.flatMap(p=>{const d=p.visit.due_tick;return d!==null&&d>p.visit.arrival_tick&&d<=H?[d]:[];}))].sort((x,y)=>x-y);
 function eventAfter(a){
  let e=H;const see=x=>{if(x>a&&x<e)e=x;};
  for(const id of S.running){const x=S.ts.get(id).end;if(x!==null)see(x);}
  for(const F of S.flows.values())see(F.close);
  see(nextAfter(M.ticks.shift,a));see(nextAfter(M.ticks.arrival,a));see(nextAfter(M.ticks.opens,a));see(nextAfter(dues,a));
  return a<0?0:e;
 }
 const lateChecks=()=>{
  for(const id of S.running){const e=S.ts.get(id).end;if(e!==null&&e<=t)defer('MISSING_COMPLETION',`${id} due at ${e}`,groups[gi-1]);}
  for(const F of S.flows.values())if(F.close<=t)defer('MISSING_COMPLETION',`${F.id} due at ${F.close}`,groups[gi-1]);
  if(late)throw new Violation(late.code,late.detail,late.g??null);
 };
 const offTick=x=>fail('RECORD_ORDER_INVALID',`records at ${t} where no event tick falls`,x);
 // A horizon cut replays the silent event ticks after the last record up to H.
 while((gi<groups.length||cut==='horizon'&&t<H)&&!S.horizon){
  const gt=gi<groups.length?groups[gi].tick:Infinity,e=eventAfter(t),extra=gt<e?groups[gi]:null;
  // Records at a tick that is not an event tick are replayed first, so a fabricated record reports its own
  // semantic violation (A38/A39); if they are otherwise consistent, the extra tick itself fails below.
  const nt=extra?gt:e;
  skipped(t,nt);t=nt;late=null;
  try{
   phase0();phase1();phase2();phase3();
   if(t<H){
    phase4();
    if(cut==='quantum'&&t===end){const g=peekIn();if(g)fail('TERMINAL_STATUS_MISMATCH',`${g.kind} after a sub-quantum stop`,g);lateChecks();if(extra)offTick(extra);S.cut=subQuantum();return S;}
    phase5();
   }else phase6();
   const g=peekIn();if(g)fail({HORIZON:'INCOMPLETE_HORIZON_ACCOUNTING',BLOCKAGE:'BLOCKAGE_MISMATCH'}[g.kind]??'RECORD_ORDER_INVALID',`unexpected ${g.kind} in phase ${g.phase} at ${t}`,g);
   lateChecks();
  }catch(x){
   // The refused step: findings deferred on present records stand; the end-of-tick checks are not owed.
   if(x!==CUT)throw x;
   // Phase 0 completes in ascending task id in one pass: an owed completion below the last recorded one (or any, once
   // phase 0 is over) was not refused.
   if(S.p0)for(const id of [...S.running,...S.p0.due]){const ts=S.ts.get(id);if(ts.st!=='COMPLETE'&&ts.end===t&&(S.p0.done||id<S.p0.prev))defer('MISSING_COMPLETION',`${id} due at ${t}`,groups[gi-1]);}
   if(late)throw new Violation(late.code,late.detail,late.g??null);
   if(extra)offTick(extra);
   return S;
  }
  if(extra)offTick(extra);
  if(rec)rec.sample(S,t);
 }
 if(partial)return S;
 if(!S.horizon)fail('INCOMPLETE_HORIZON_ACCOUNTING','the ledger ends before H',groups[groups.length-1]);
 if(gi<groups.length)fail('RECORD_ORDER_INVALID','records after the horizon accounting',groups[gi]);
 S.life=life;return S;
}
