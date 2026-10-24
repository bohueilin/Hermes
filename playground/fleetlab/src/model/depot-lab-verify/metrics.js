// Verified projection depot_projection_v1 (note 13, note 10.4, D1-08, D1-11, D1-12, C1.6), derived only from the
// independent reconstruction: visit timelines, frontier waits, port and position partitions, resources, metrics and V.
// Exact values are safe integers or reduced "p/q" strings; the UI formats them and never recomputes.
import {Q,ZERO,add,mul,div,cmp,ceil,formatRational} from '../depot-lab/rational.js';
import {socEnergy,uncontendedChargeTicks} from '../depot-lab/units.js';
import {refs} from '../depot-lab/identity.js';
import {PROJECTION_VERSION,REASON_CODES,REASON_ACCOUNTING_ORDER} from '../depot-lab/profiles.js';
import {evaluate} from './policy-check.js';
export const PORT_CLASSES=Object.freeze(['unavailable','free','unconnected_position_blocked','reserved_inbound_connect','connected_drawing','connected_zero_draw','at_target_lifecycle_running','at_target_waiting','inspection','unplug_handling']);
export const POSITION_CLASSES=Object.freeze(['unavailable','free','inbound_exit_handling','zone_native_service_active','retained_other_work','inspection','finished_but_blocked','waiting_no_progress']);
const NATIVE={waiting:['intake'],cleaning:['cabin'],charging:['charge'],garage:['diagnosis','repair']};
const TIMED=new Set(['move','attended','timed','transit','vendor']);
const flowOf=T=>T.visit?refs.flow(T.visit,T.template):refs.cacheFlow(T.data.object);
const fmt=formatRational,num=x=>Number(x);
export function createRecorder(M){
 const H=M.H,segs=new Map(),waits=new Map(),tight={site:0,net:new Map()};let last=0,cur=null,peak=ZERO;
 const progressing=(S,T)=>{if(S.ts.get(T.id).st!=='RUNNING')return false;if(!TIMED.has(T.kind)&&T.kind!=='charge'&&T.kind!=='data')return false;if(TIMED.has(T.kind))return true;const F=S.flows.get(flowOf(T));return !!F?.rate&&F.rate.n>0n;};
 const runs=(S,vs,tpl)=>[...vs.running].some(id=>M.tasks.get(id).template===tpl);
 function posClass(S,P){
  if(!P.enabled)return ['unavailable',null];
  const o=S.own.get(P.ref);if(!o)return ['free',null];
  const v=M.tasks.get(o.task).visit,vs=S.vs.get(v),x=[vs.ref];
  if(o.mode==='R')return ['inbound_exit_handling',...x];
  for(const id of vs.running){const T=M.tasks.get(id);if(T.kind==='move'&&S.ts.get(id).origin===P.ref||(T.template==='connect'||T.template==='unplug')&&vs.loc===P.ref)return ['inbound_exit_handling',...x];}
  const mine=vs.plan.tasks.filter(T=>T.mandatory&&progressing(S,T));
  if(vs.loc===P.ref&&mine.some(T=>NATIVE[P.zone].includes(T.template)))return ['zone_native_service_active',...x];
  if(runs(S,vs,'inspection'))return ['inspection',...x];
  if(mine.length)return ['retained_other_work',...x];
  return [vs.workDone!==null?'finished_but_blocked':'waiting_no_progress',...x];
 }
 function portClass(S,p){
  if(!p.enabled||!M.positions.get(p.pos).enabled)return ['unavailable',null];
  const o=S.own.get(p.ref);
  if(!o){const q=S.own.get(p.pos);return q?['unconnected_position_blocked',`visit:${M.tasks.get(q.task).visit}`]:['free',null];}
  const vs=S.vs.get(M.tasks.get(o.task).visit),x=[vs.ref];
  if(o.mode==='R')return ['reserved_inbound_connect',...x];
  if(runs(S,vs,'unplug'))return ['unplug_handling',...x];
  if(runs(S,vs,'inspection'))return ['inspection',...x];
  const ch=vs.plan.charge;
  if(ch&&S.ts.get(ch).st!=='COMPLETE')return [progressing(S,M.tasks.get(ch))?'connected_drawing':'connected_zero_draw',...x];
  return [vs.plan.tasks.some(T=>T.mandatory&&(T.kind==='data'||T.kind==='timed'&&T.object)&&progressing(S,T))?'at_target_lifecycle_running':'at_target_waiting',...x];
 }
 // Visit-level accounting (note 10.4): servicing while any mandatory task progresses, else the frontier primary code.
 // With no mandatory frontier task, follow the earliest incomplete predecessor to its source (D1-12): a waiting source
 // lends its reasons; a running one is an actual unmet prerequisite.
 const pending=(S,T)=>['READY','RUNNING','PAUSED'].includes(S.ts.get(T.id).st);
 function source(S,T){for(let k=0;T&&k<64;k++){if(pending(S,T))return T;const p=[...T.prereqs,...T.anyPrereqs].map(id=>M.tasks.get(id)).filter(P=>S.ts.get(P.id).st!=='COMPLETE').sort((a,b)=>a.rank-b.rank||(a.id<b.id?-1:1));T=p[0];}return null;}
 const frontier=(S,vs)=>vs.plan.tasks.find(T=>T.mandatory&&pending(S,T))??source(S,vs.plan.tasks.find(T=>T.mandatory&&S.ts.get(T.id).st==='UNREADY'));
 function reasonsAt(S,vs,t){
  const f=frontier(S,vs),pre=[{code:'PREREQUISITE',resource_ids:[],holder_visit_ids:[]}];
  if(!f)return {task:null,reasons:pre};
  if(f.visit!==vs.plan.id&&S.ts.get(f.id).st==='RUNNING')return {task:f.id,reasons:pre};
  const st=S.ts.get(f.id).st;
  if(st==='RUNNING')return {task:f.id,reasons:progressing(S,f)?[]:[{code:'DIVISIBLE_CAPACITY_TIGHT',resource_ids:[...S.flows.get(flowOf(f))?.tight??[]],holder_visit_ids:[]}]};
  const r=evaluate(M,S,f,t,st==='PAUSED').reasons;
  if(vs.workDone!==null)r.push({code:'FINISHED_BUT_BLOCKED',resource_ids:[],holder_visit_ids:[]});
  return {task:f.id,reasons:REASON_CODES.map(c=>r.find(x=>x.code===c)).filter(Boolean)};
 }
 function status(S,vs,t){
  if(vs.plan.tasks.some(T=>T.mandatory&&progressing(S,T)))return null;
  const codes=reasonsAt(S,vs,t).reasons.map(r=>r.code);
  return REASON_ACCOUNTING_ORDER.find(c=>codes.includes(c))??'PREREQUISITE';
 }
 const put=(m,k,from,a,b)=>{let l=m.get(k);if(!l)m.set(k,l=[]);const z=l[l.length-1];if(!z||z[1]!==a||z[2]!==b)l.push([from,a,b]);};
 function sample(S,t){
  if(cur){const d=t-last;if(cur.site)tight.site+=d;for(const r of cur.net)tight.net.set(r,(tight.net.get(r)??0)+d);}
  last=t;
  for(const P of M.positions.values())put(segs,P.ref,t,...posClass(S,P));
  for(const p of M.ports.values())put(segs,p.ref,t,...portClass(S,p));
  for(const vs of S.vs.values())if(vs.arrived&&(vs.released===null||vs.released===t))put(waits,vs.ref,t,vs.released===null?status(S,vs,t):'released',null);
  let sum=ZERO;const net=new Set();let site=false;
  for(const F of S.flows.values()){if(!F.rate)continue;if(F.dom==='charge'){sum=add(sum,F.rate);if(F.tight.includes('site:supply'))site=true;}else for(const r of F.tight)if(r!==F.id)net.add(r);}
  if(cmp(sum,peak)>0)peak=sum;cur={site,net};
 }
 const close=l=>l.map(([from,a,b],i)=>[from,i+1<l.length?l[i+1][0]:H,a,b]).filter(x=>x[1]>x[0]);
 function project(S){
  const owned=u=>(S.busy.get(u)??0)+(S.own.has(u)?H-S.since.get(u):0);
  const visits=[],ref=new Map(),classes=new Set();let energyLeft=0n,bytesLeft=0n,optional=0n;
  for(const p of M.plans){
   const vs=S.vs.get(p.id),v=p.visit,a=v.arrival_tick,r=vs.released,e=r??H,d=v.due_tick,out={};
   const tasks=p.tasks.map(T=>{const ts=S.ts.get(T.id);return {template:T.template,mandatory:T.mandatory,state_at_h:ts.st,start:ts.first,end:ts.endAt,workers:ts.workers,position:ts.dest??ts.pos,port:ts.port};});
   const loc=close(vs.locSeg.map(([f,l])=>[f,l,null])).map(([f,to,l])=>[f,to,l]),dwell={};
   for(const [f,to,l]of loc){const P=M.positions.get(l);if(P)dwell[P.zone]=(dwell[P.zone]??0)+to-f;}
   const w=close(waits.get(vs.ref)??[]).filter(x=>x[2]!==null&&x[2]!=='released').map(([f,to,c])=>[f,to,c]),ws={};
   for(const [f,to,c]of w)ws[c]=(ws[c]??0)+to-f;
   const merged=[];for(const x of w){const z=merged[merged.length-1];if(z&&z[1]===x[0]&&z[2]===x[2])z[1]=x[1];else merged.push(x.slice());}
   const rem={},active=[];let eLeft=0n,bLeft=0n,credited=0n;
   for(const T of p.tasks){
    const ts=S.ts.get(T.id),run=ts.st==='RUNNING';
    if(T.mandatory)for(const [c,sec]of T.reference)classes.add(c);
    if(T.kind==='charge')credited+=ts.credited;
    if(T.mandatory&&ts.st!=='COMPLETE'){
     const frac=run&&TIMED.has(T.kind)?Q(BigInt(ts.end-H),BigInt(ts.d)):Q(1n);
     for(const [c,sec]of T.reference){rem[c]=add(rem[c]??ZERO,mul(Q(BigInt(sec)),frac));ref.set(c,add(ref.get(c)??ZERO,mul(Q(BigInt(sec)),frac)));}
     if(T.kind==='data')bLeft+=BigInt(T.data.bytes)-ts.credited;
    }
    if(T.kind==='data'&&!T.mandatory&&T.template==='upload'&&S.ts.get(refs.task(p.id,'acknowledgment'))?.st!=='COMPLETE')optional+=BigInt(T.data.bytes);
    if(run||ts.st==='PAUSED'){
     let unit='s',value=0,lb=null;
     if(TIMED.has(T.kind)){value=ts.end-H;lb=ts.d;}
     else if(T.kind==='charge'){unit='mJ';value=num(M.target-vs.energy);const port=M.ports.get(ts.port),w=Math.min(port.rating,M.s.site.supply_w-M.s.site.background_w);const x=uncontendedChargeTicks(v.initial_soc_pct,M.s.requirements.energy.target_soc_pct,M.bands,w,port.kind==='AC'?num(M.acCap/1000n):null);lb=x===null?null:num(x);}
     else{unit='bytes';value=num(BigInt(T.data.bytes)-ts.credited);const cap=ts.path.map(r=>M.caps.get(r)).reduce((m,c)=>cmp(c,m)<0?c:m);lb=cap&&cap.n>0n?num(ceil(div(Q(BigInt(T.data.bytes)),cap))):null;}
     active.push({template:T.template,cls:T.cls,start:ts.first,remaining:{unit,value},could_not_finish:true,minimum_duration_exceeded_time_left_at_start:lb===null?null:lb>H-ts.first,lower_bound_ticks:lb});
    }
   }
   if(p.charge&&S.ts.get(p.charge).st!=='COMPLETE')eLeft=M.target-vs.energy;
   energyLeft+=eLeft;bytesLeft+=bLeft;
   const mand=p.tasks.filter(T=>T.mandatory&&progressing(S,T)).length>0;
   const front=r!==null?{task:null,reasons:[]}:reasonsAt(S,vs,H);
   Object.assign(out,{id:vs.ref,arrival_tick:a,due_tick:d,released_at:r,work_complete_at:vs.workDone,observed_s:e-a,overdue_s:d===null?0:Math.max(0,e-d),censored:r===null,
    due_status:d===null?'no_due':d<=H?'past_due':'not_yet_due',on_time:d!==null&&d<=H?r!==null&&r<=d:null,
    state_at_h:r!==null?'released':vs.loc==='offsite'?'offsite':vs.loc==='moving'?'moving':mand?'servicing':vs.workDone!==null?'work_complete_not_released':vs.loc==='outside'?'queued_outside':'blocked_waiting',
    route:p.route,terminal_zone:p.terminalZone,tasks,location:loc,waits:merged,wait_seconds:ws,frontier_at_h:front,active_at_h:active,
    remaining:{reference:Object.fromEntries(Object.entries(rem).map(([c,x])=>[c,fmt(x)])),energy_mj:num(eLeft),bytes:num(bLeft)},
    energy:{initial_mj:num(socEnergy(v.initial_soc_pct)),target_mj:num(M.target),credited_mj:num(credited)},
    data:p.tasks.filter(T=>T.kind==='data').map(T=>({object:T.data.direction==='up'?refs.logs(p.id):refs.object(T.data.object),direction:T.data.direction,mandatory:T.mandatory,bytes:T.data.bytes,credited:num(S.ts.get(T.id).credited),state:S.ts.get(T.id).cs})),
    dwell_by_zone:dwell});
   visits.push(out);
  }
  const part=(u,list)=>{const o=Object.fromEntries(list.map(c=>[c,0]));for(const [f,to,c]of close(segs.get(u)??[]))o[c]+=to-f;return o;};
  const ports=[...M.ports.values()].map(p=>({id:p.ref,kind:p.kind,position:p.pos,rating_w:p.rating,enabled:p.enabled,partition:part(p.ref,PORT_CLASSES),owned_ticks:owned(p.ref)}));
  const positions=[...M.positions.values()].map(P=>{const port=[...M.ports.values()].find(p=>p.pos===P.ref);return {id:P.ref,zone:P.zone,enabled:P.enabled,partition:part(P.ref,POSITION_CLASSES),port_released_position_held_s:port?ports.find(x=>x.id===port.ref).partition.unconnected_position_blocked:0,owned_ticks:owned(P.ref)};});
  let avail=0,busy=0;
  const workers=M.workerList.map(w=>{const a=w.unions.reduce((n,[x,y])=>n+Math.min(y,H)-Math.min(x,H),0),b=owned(w.ref);avail+=a;busy+=b;return {id:w.ref,available_s:a,busy_s:b,attention:a?fmt(Q(BigInt(b),BigInt(a))):null};});
  const intervals={positions:[],ports:[]};
  for(const [k,list]of [['positions',M.positions.keys()],['ports',M.ports.keys()]])for(const u of list)for(const [f,to,c,v]of close(segs.get(u)??[]))intervals[k].push([u,f,to,v,c]);
  const due=visits.filter(v=>v.due_status==='past_due'),waitAll={};
  for(const v of visits)for(const [c,x]of Object.entries(v.wait_seconds))waitAll[c]=(waitAll[c]??0)+x;
  const cls=[...classes].sort(),refFmt=Object.fromEntries(cls.map(c=>[c,fmt(ref.get(c)??ZERO)]));
  const sum=k=>visits.reduce((n,v)=>n+v[k],0),on=due.filter(v=>v.on_time).length,unrel=visits.filter(v=>v.released_at===null).length;
  const metrics={'requirement.energy.target_soc_pct':M.s.requirements.energy.target_soc_pct,'release.on_time_count':on,'release.due_count':due.length,'release.unfinished_due_count':due.filter(v=>v.released_at===null).length,
   'release.released_count':visits.length-unrel,'release.unreleased_count':unrel,'visit.work_complete_count':visits.filter(v=>v.work_complete_at!==null).length,'visit.censored_count':unrel,
   'visit.overdue_s':sum('overdue_s'),'visit.turnaround_observed_s':sum('observed_s'),'work.remaining_reference_seconds':refFmt,'energy.remaining_required_mj':num(energyLeft),
   'data.remaining_required_bytes':num(bytesLeft),'data.optional_unfinished_bytes':num(optional),'charge.energy_credited_mj':num(S.credit.charge),'charge.peak_site_draw_w':fmt(div(peak,Q(1000n))),
   'network.useful_bytes_down':num(S.credit.down),'network.useful_bytes_up':num(S.credit.up),'resource.attention_fraction':avail?fmt(Q(BigInt(busy),BigInt(avail))):null,'wait.reason_seconds':waitAll};
  const vector={classes:cls,components:[{id:'on_time_count',direction:'up',value:on},{id:'overdue_seconds',direction:'down',value:metrics['visit.overdue_s']},{id:'observed_visit_seconds',direction:'down',value:metrics['visit.turnaround_observed_s']},{id:'unreleased_count',direction:'down',value:unrel},
   ...cls.map(c=>({id:`remaining_reference_seconds:${c}`,direction:'down',value:refFmt[c]})),{id:'remaining_required_kWh',direction:'down',value:num(energyLeft)},{id:'remaining_required_bytes',direction:'down',value:num(bytesLeft)}]};
  return {version:PROJECTION_VERSION,horizon_tick:H,arrival_window_tick:M.s.arrival_window_tick,target_soc_pct:M.s.requirements.energy.target_soc_pct,visits,
   resources:{ports,positions,workers,lanes:M.lanes.map(l=>({id:l,busy_s:owned(l)})),vendor:{bay_busy_s:M.vendor.bay?owned('vendor:bay:01'):0,worker_busy_s:M.vendor.worker?owned('vendor:worker:01'):0},
    site:{supply_w:M.s.site.supply_w,peak_draw_w:metrics['charge.peak_site_draw_w'],energy_credited_mj:metrics['charge.energy_credited_mj'],tight_s:tight.site},
    network:{useful_bytes_down:metrics['network.useful_bytes_down'],useful_bytes_up:metrics['network.useful_bytes_up'],tight_s:Object.fromEntries([...tight.net].filter(([,x])=>x>0).sort((a,b)=>a[0]<b[0]?-1:1))}},
   intervals,events:S.events,metrics,vector,blockage:S.blockage.map(b=>({classification:b.classification,member_visit_ids:b.member_visit_ids,held_resource_ids:b.held_resource_ids,terminal_holder_id:b.terminal_holder_id}))};
 }
 return {start:S=>sample(S,0),sample,project};
}
