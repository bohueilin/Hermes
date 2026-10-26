// Deterministic expansion of the frozen D12-02 task grammar into a per-visit catalog (contract C1.4, D12-02, Q24).
// Static structure only: no time, resource, eligibility or policy logic. Engine and verifier share it like the schema
// (engineering note BD-01); separate tests pin every edge against the written rules.
import {TEMPLATE_RANK,TEMPLATE_CLASS,REFERENCE_EFFORT} from './profiles.js';
import {requiredChargeMj,socEnergy} from './units.js';
import {refs} from './identity.js';
export const MAX_TASKS_PER_VISIT=32;
export class TaskGraphError extends Error{
 constructor(code,path,value=null,bound=null){super(`${code} at ${path}`);this.code=code;this.path=path;this.value=value;this.bound=bound;}
}
// Fault class and garage level choose the repair route before any diagnosis (D1-09).
export function repairRoute(fault,level){
 if(fault==='none')return 'none';
 if(fault==='mechanical')return level==='none'?'vendor':'onsite';
 return level==='specialist'?'onsite':'vendor';
}
const MOVE_TO={admit:'waiting',to_garage:'garage',vendor_departure:'outside',vendor_reentry:'waiting',to_cleaning:'cleaning',to_charging:'charging',egress:'outside'};
const ref=(cls,seconds=REFERENCE_EFFORT[cls])=>[[cls,seconds]];
export function compileScenario(s){
 const objects=new Map(s.content_objects.map(o=>[o.id,o]));
 const cache=s.network.cache,cacheRoute=cache.state!=='off';
 const warm=new Set(cache.state==='warm'?cache.initial_object_ids:[]);
 const targetPct=s.requirements.energy.target_soc_pct,globalCabin=s.task_windows.cabin_earliest_start_tick;
 const cacheDemand=new Map(),byId=new Map();
 const visits=s.visits.map((v,vi)=>{
  const tasks=[],windows=new Map(v.task_windows.map(w=>[w.task_template,w.earliest_start_tick]));
  const add=(template,kind,extra={})=>{
   const t={id:refs.task(v.id,template),visit:v.id,template,rank:TEMPLATE_RANK[template],cls:TEMPLATE_CLASS[template],kind,mandatory:true,prereqs:[],anyPrereqs:[],earliestStart:windows.get(template)??0,attention:null,zone:null,move:null,data:null,timed:null,charge:null,reference:[],...extra};
   tasks.push(t);return t;
  };
  const move=(template,prev)=>add(template,'move',{attention:'move',move:{to:MOVE_TO[template]},prereqs:prev?[prev.id]:[],reference:ref('move')});
  const admit=move('admit',null),intake=add('intake','attended',{attention:'intake',zone:'waiting',prereqs:[admit.id],reference:ref('intake')});
  let routeEnd=intake,terminalZone='waiting';
  const route=repairRoute(v.fault,s.site.garage_level),repairClass=v.fault==='specialist_electrical'?'specialist_repair':'mechanical_repair';
  if(route==='onsite'){
   const g=move('to_garage',intake);
   const d=add('diagnosis','attended',{attention:'diagnosis',zone:'garage',prereqs:[g.id],reference:ref('diagnosis')});
   routeEnd=add('repair','attended',{attention:repairClass,zone:'garage',prereqs:[d.id],reference:ref(repairClass),fault:v.fault});
   terminalZone='garage';
  }else if(route==='vendor'){
   const dep=move('vendor_departure',intake);
   const out=add('vendor_outbound','transit',{prereqs:[dep.id],timed:s.vendor.outbound_ticks});
   // Vendor service carries the same common diagnosis + repair reference work; it never adds elapsed vendor time.
   const svc=add('vendor_service','vendor',{prereqs:[out.id],timed:s.vendor.service_ticks,reference:[['diagnosis',REFERENCE_EFFORT.diagnosis],[repairClass,REFERENCE_EFFORT[repairClass]]],fault:v.fault});
   const ret=add('vendor_return','transit',{prereqs:[svc.id],timed:s.vendor.return_ticks});
   routeEnd=move('vendor_reentry',ret);terminalZone='waiting';
  }
  if(v.cabin_required){
   const cabinWindow=Math.max(globalCabin,windows.get('cabin')??0);
   const c=move('to_cleaning',routeEnd);c.earliestStart=Math.max(cabinWindow,windows.get('to_cleaning')??0);
   routeEnd=add('cabin','attended',{attention:'cabin',zone:'cleaning',prereqs:[c.id],reference:ref('cabin'),earliestStart:cabinWindow});
   terminalZone='cleaning';
  }
  const need=requiredChargeMj(v.initial_soc_pct,targetPct);
  let charge=null,connect=null;
  if(need>0n){
   const to=move('to_charging',routeEnd);to.move.withPort=true;
   connect=add('connect','attended',{attention:'connect',zone:'charging',prereqs:[to.id],reference:ref('connect')});
   charge=add('charge','charge',{prereqs:[connect.id],charge:{initial_mj:socEnergy(v.initial_soc_pct),target_mj:socEnergy(targetPct),need_mj:need}});
   routeEnd=charge;terminalZone='charging';
  }
  const installed=new Set(v.installed_object_ids),postchecks=[];
  const required=v.required_object_ids.map(id=>objects.get(id)).filter(o=>!installed.has(o.id)).sort((a,b)=>a.kind<b.kind?-1:a.kind>b.kind?1:0);
  let mapPost=null;
  for(const o of required){
   const k=o.kind,endpoint=k==='map'?'maps':'software';
   let dl=null;
   if(o.size_bytes>0){
    const pre=[intake.id];
    if(cacheRoute&&!warm.has(o.id)){pre.push(refs.cacheTask(o.id,'check'));if(!cacheDemand.has(o.id))cacheDemand.set(o.id,[]);cacheDemand.get(o.id).push(intake.id);}
    dl=add(`${k}_download`,'data',{prereqs:pre,data:{object:o.id,kind:k,direction:'down',bytes:o.size_bytes,endpoint,cacheRoute}});
   }
   const ck=add(`${k}_check`,'timed',{prereqs:[(dl??intake).id],timed:o.check_ticks,reference:ref('check'),object:o.id});
   const acPre=[ck.id];if(charge)acPre.push(charge.id);if(k==='software'&&mapPost)acPre.push(mapPost.id);
   const ac=add(`${k}_activation`,'timed',{prereqs:acPre,timed:o.activation_ticks,reference:ref('activation'),object:o.id,endpoint});
   const pc=add(`${k}_postcheck`,'timed',{prereqs:[ac.id],timed:o.postcheck_ticks,reference:ref('postcheck'),object:o.id});
   postchecks.push(pc);if(k==='map')mapPost=pc;
  }
  let ack=null;
  if(v.initial_log_bytes>0){
   const up=add('upload','data',{mandatory:v.upload_required,prereqs:[intake.id],data:{object:refs.logs(v.id),kind:'logs',direction:'up',bytes:v.initial_log_bytes,endpoint:'uploads',cacheRoute:false}});
   ack=add('acknowledgment','zero',{mandatory:v.upload_required,prereqs:[up.id]});
  }
  const inspPre=[routeEnd.id,...postchecks.map(p=>p.id)];if(ack&&ack.mandatory)inspPre.push(ack.id);
  const insp=add('inspection','attended',{attention:'inspection',zone:terminalZone,prereqs:inspPre,reference:ref('inspection')});
  let last=insp;
  if(charge)last=add('unplug','attended',{attention:'unplug',zone:'charging',prereqs:[insp.id],reference:ref('unplug')});
  const egress=move('egress',insp);if(last!==insp)egress.prereqs.push(last.id);
  if(tasks.length>MAX_TASKS_PER_VISIT)throw new TaskGraphError('TASK_LIMIT',`/visits/${vi}`,tasks.length,MAX_TASKS_PER_VISIT);
  tasks.sort((a,b)=>a.rank-b.rank);
  for(const t of tasks){t.prereqs.sort();byId.set(t.id,t);}
  return {id:v.id,ref:refs.visit(v.id),visit:v,tasks,terminalZone,route,need_mj:need,charge:charge?.id??null,connect:connect?.id??null};
 });
 const cacheTasks=[];
 for(const [obj,intakes]of [...cacheDemand].sort((a,b)=>a[0]<b[0]?-1:1)){
  const o=objects.get(obj),k=o.kind,endpoint=k==='map'?'maps':'software';
  const pull={id:refs.cacheTask(obj,'fetch'),visit:null,template:`${k}_download`,rank:TEMPLATE_RANK[`${k}_download`],cls:'DL',kind:'data',mandatory:true,prereqs:[],anyPrereqs:intakes.slice().sort(),earliestStart:0,attention:null,zone:null,move:null,data:{object:obj,kind:k,direction:'down',bytes:o.size_bytes,endpoint,cacheRoute:false,cacheFetch:true},timed:null,charge:null,reference:[]};
  const check={id:refs.cacheTask(obj,'check'),visit:null,template:`${k}_check`,rank:TEMPLATE_RANK[`${k}_check`],cls:'CK',kind:'timed',mandatory:true,prereqs:[pull.id],anyPrereqs:[],earliestStart:0,attention:null,zone:null,move:null,data:null,timed:60,charge:null,reference:[],object:obj,cacheCheck:true};
  cacheTasks.push(pull,check);byId.set(pull.id,pull);byId.set(check.id,check);
 }
 for(const t of byId.values())for(const p of [...t.prereqs,...t.anyPrereqs])if(!byId.has(p))throw new TaskGraphError('UNRESOLVED_PREREQUISITE',t.id,p);
 assertAcyclic(byId);
 return Object.freeze({visits,cacheTasks,byId,cacheRoute,warm});
}
function assertAcyclic(byId){
 const state=new Map();
 const visit=id=>{const s=state.get(id);if(s===2)return;if(s===1)throw new TaskGraphError('CYCLE',id);state.set(id,1);const t=byId.get(id);for(const p of [...t.prereqs,...t.anyPrereqs])visit(p);state.set(id,2);};
 for(const id of byId.keys())visit(id);
}
// Test-only internal harness (engineering note BD-15): initial placements and completed work at tick 0.
// It is never part of fleetlab.depot.scenario.v1 and binds a separate scenario digest.
export function harnessInitialState(s,compiled,harness){
 const out=new Map();if(!harness)return out;
 const positions=new Map(s.site.positions.map(p=>[p.id,p])),ports=new Map(s.site.ports.map(p=>[p.id,p]));
 for(const [vid,init]of Object.entries(harness.initial??{})){
  const plan=compiled.visits.find(v=>v.id===vid);
  if(!plan||plan.visit.arrival_tick!==0)throw new TaskGraphError('HARNESS_VISIT','/harness/initial/'+vid,vid);
  const pos=positions.get(init.position);if(!pos)throw new TaskGraphError('HARNESS_POSITION','/harness/initial/'+vid+'/position',init.position);
  const completed=new Set((init.completed??[]).map(t=>refs.task(vid,t)));
  for(const id of completed)if(!compiled.byId.has(id))throw new TaskGraphError('HARNESS_TASK','/harness/initial/'+vid+'/completed',id);
  const moves=plan.tasks.filter(t=>t.kind==='move'&&completed.has(t.id)&&t.move.to!=='outside');
  const owner=moves.length?moves[moves.length-1].id:refs.task(vid,'admit');completed.add(refs.task(vid,'admit'));
  let port=null;
  if(init.connected_port){port=ports.get(init.connected_port);if(!port||port.position_id!==pos.id)throw new TaskGraphError('HARNESS_PORT','/harness/initial/'+vid+'/connected_port',init.connected_port);}
  out.set(vid,{position:pos.id,positionOwner:owner,completed,connectedPort:port?.id??null,portOwner:port?refs.task(vid,'to_charging'):null,content:{...(init.content??{})}});
 }
 return out;
}
