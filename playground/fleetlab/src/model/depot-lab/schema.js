// Closed shape and semantic validation of fleetlab.depot.scenario.v1 (contract C1.1, C1.3).
// Editor origin materializes the documented defaults before validation; import origin never fills a field.
// Passing validation proves nothing about feasibility, comparison compatibility or evidence validity.
import {parseStrict,jcs,deepFreeze,MAX_INPUT_BYTES,utf8Length} from './canonical.js';
import {SCENARIO_SCHEMA,MODEL_VERSION,PROFILE_VERSION,POLICY_ID,OVERLAP_PROFILE,REFERENCE_EFFORT_VERSION,VEHICLE_PROFILE,ATTENDED_CLASSES,PROFICIENCY_LEVELS,proficiencyTicks,ZONES,TEMPLATES} from './profiles.js';
import {compileScenario,TaskGraphError} from './task-graph.js';
const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const TOP=['schema','model_version','profile_version','policy_id','overlap_profile','reference_effort_version','horizon_tick','arrival_window_tick','requirements','task_windows','vehicle_profile','site','workers','network','services','content_objects','visits','vendor'];
const WINDOW_TEMPLATES=new Set(TEMPLATES);
export const LIMITS=Object.freeze({positions:200,ports:20,workers:20,visits:200,objects:4,intervals:64,windows:28,tick:172800,due:345600,lanes:20,watts:1000000,pool:625000000,client:125000000,wan:250000000,cacheRead:625000000,cacheBytes:500000000000,objectBytes:20000000000,logBytes:50000000000});
export function editorDefaults(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return raw;
 const s={...raw};
 const energy={...(s.requirements?.energy??{})};if(energy.target_soc_pct===undefined)energy.target_soc_pct=80;
 s.requirements={...(s.requirements??{}),energy};
 s.task_windows={cabin_earliest_start_tick:0,...(s.task_windows??{})};
 if(Array.isArray(s.visits))s.visits=s.visits.map(v=>v&&typeof v==='object'&&!Array.isArray(v)&&v.task_windows===undefined?{...v,task_windows:[]}:v);
 return s;
}
// An object input is checked before anything reads it: accessors, sparse arrays, symbol keys and non-plain values
// could otherwise show validation one value and normalization another (C1.1 closed plain data).
function nonPlain(v,path,depth){
 if(v===null||typeof v!=='object')return null;
 if(depth>32)return path||'/';
 const proto=Object.getPrototypeOf(v),list=Array.isArray(v);
 if(list?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)return path||'/';
 if(list)for(let k=0;k<v.length;k++)if(!Object.prototype.hasOwnProperty.call(v,k))return `${path}/${k}`;
 for(const k of Reflect.ownKeys(v)){
  if(typeof k==='symbol')return path||'/';
  if(list&&k==='length')continue;
  const d=Object.getOwnPropertyDescriptor(v,k);if(!('value' in d))return `${path}/${k}`;
  const bad=nonPlain(d.value,`${path}/${k}`,depth+1);if(bad)return bad;
 }
 return null;
}
export function validateScenario(raw,{origin='import'}={}){
 const issues=[];
 const issue=(code,path,value=null,bound=null)=>{if(issues.length<200)issues.push({code,path,value:value===undefined?null:value,bound});return false;};
 let input=raw;
 if(typeof raw!=='string'){const bad=nonPlain(raw,'',0);if(bad)return {ok:false,issues:[{code:'NOT_PLAIN_DATA',path:bad,value:null,bound:'plain data'}]};}
 if(typeof raw==='string'){const parsed=parseStrict(raw,{maxBytes:MAX_INPUT_BYTES});if(!parsed.ok)return {ok:false,issues:parsed.issues};input=parsed.value;}
 if(origin==='editor')input=editorDefaults(input);
 const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
 const closed=(v,path,keys)=>{
  if(!isObj(v))return issue('TYPE',path,null,'object');
  let ok=true;
  for(const k of Object.keys(v))if(!keys.includes(k)){issue('UNKNOWN_FIELD',`${path}/${k}`);ok=false;}
  for(const k of keys)if(!(k in v)){issue('MISSING_FIELD',`${path}/${k}`);ok=false;}
  return ok;
 };
 const int=(v,path,lo,hi)=>Number.isSafeInteger(v)&&!Object.is(v,-0)?(v>=lo&&v<=hi?true:issue('RANGE',path,v,[lo,hi])):issue('TYPE',path,typeof v,'integer');
 const bool=(v,path)=>typeof v==='boolean'||issue('TYPE',path,typeof v,'boolean');
 const oneOf=(v,path,set)=>set.includes(v)||issue('ENUM',path,typeof v==='string'?v:null,set);
 const id=(v,path)=>typeof v==='string'&&ID.test(v)||issue('PATTERN',path,typeof v==='string'?v.slice(0,40):null,'id');
 const arr=(v,path,lo,hi)=>Array.isArray(v)?(v.length>=lo&&v.length<=hi?true:issue('LENGTH',path,v.length,[lo,hi])):issue('TYPE',path,null,'array');
 const constant=(v,path,c)=>v===c||issue('CONST',path,typeof v==='string'?v.slice(0,60):null,c);
 const intervals=(v,path)=>{if(!arr(v,path,0,LIMITS.intervals))return;v.forEach((x,i)=>{if(closed(x,`${path}/${i}`,['start_tick','end_tick'])){int(x.start_tick,`${path}/${i}/start_tick`,0,LIMITS.tick);int(x.end_tick,`${path}/${i}/end_tick`,0,LIMITS.tick);}});};
 const endpoint=(v,path)=>{if(closed(v,path,['service_reachable','entitlement'])){oneOf(v.service_reachable,`${path}/service_reachable`,['reachable','unreachable']);oneOf(v.entitlement,`${path}/entitlement`,['valid','denied','unknown']);}};
 const s=input;
 if(!closed(s,'',TOP))return {ok:false,issues};
 constant(s.schema,'/schema',SCENARIO_SCHEMA);constant(s.model_version,'/model_version',MODEL_VERSION);constant(s.profile_version,'/profile_version',PROFILE_VERSION);
 constant(s.policy_id,'/policy_id',POLICY_ID);constant(s.overlap_profile,'/overlap_profile',OVERLAP_PROFILE);constant(s.reference_effort_version,'/reference_effort_version',REFERENCE_EFFORT_VERSION);
 int(s.horizon_tick,'/horizon_tick',1,LIMITS.tick);int(s.arrival_window_tick,'/arrival_window_tick',1,LIMITS.tick);
 if(closed(s.requirements,'/requirements',['energy'])&&closed(s.requirements.energy,'/requirements/energy',['target_soc_pct']))int(s.requirements.energy.target_soc_pct,'/requirements/energy/target_soc_pct',20,100);
 if(closed(s.task_windows,'/task_windows',['cabin_earliest_start_tick']))int(s.task_windows.cabin_earliest_start_tick,'/task_windows/cabin_earliest_start_tick',0,LIMITS.tick);
 let profileOk=false;try{profileOk=jcs(s.vehicle_profile)===jcs(VEHICLE_PROFILE);}catch{profileOk=false;}
 if(!profileOk)issue('CONST','/vehicle_profile',null,'fixed vehicle profile');
 if(closed(s.site,'/site',['positions','ports','lane_count','supply_w','background_w','garage_level'])){
  const site=s.site;
  if(arr(site.positions,'/site/positions',1,LIMITS.positions))site.positions.forEach((p,i)=>{const q=`/site/positions/${i}`;if(closed(p,q,['id','zone','enabled'])){id(p.id,`${q}/id`);oneOf(p.zone,`${q}/zone`,ZONES);bool(p.enabled,`${q}/enabled`);}});
  if(arr(site.ports,'/site/ports',0,LIMITS.ports))site.ports.forEach((p,i)=>{const q=`/site/ports/${i}`;if(closed(p,q,['id','position_id','kind','rating_w','enabled'])){id(p.id,`${q}/id`);id(p.position_id,`${q}/position_id`);oneOf(p.kind,`${q}/kind`,['AC','DC']);int(p.rating_w,`${q}/rating_w`,0,LIMITS.watts);bool(p.enabled,`${q}/enabled`);}});
  int(site.lane_count,'/site/lane_count',0,LIMITS.lanes);int(site.supply_w,'/site/supply_w',0,LIMITS.watts);int(site.background_w,'/site/background_w',0,LIMITS.watts);
  oneOf(site.garage_level,'/site/garage_level',['none','basic','specialist']);
 }
 if(arr(s.workers,'/workers',0,LIMITS.workers))s.workers.forEach((w,i)=>{
  const q=`/workers/${i}`;if(!closed(w,q,['id','qualifications','availability']))return;
  id(w.id,`${q}/id`);intervals(w.availability,`${q}/availability`);
  if(arr(w.qualifications,`${q}/qualifications`,9,9))w.qualifications.forEach((r,k)=>{const p=`${q}/qualifications/${k}`;if(closed(r,p,['task_class','level','proficiency','may_supervise','solo_duration_ticks'])){oneOf(r.task_class,`${p}/task_class`,ATTENDED_CLASSES);oneOf(r.level,`${p}/level`,['unqualified','supervised_only','independent']);oneOf(r.proficiency,`${p}/proficiency`,PROFICIENCY_LEVELS);bool(r.may_supervise,`${p}/may_supervise`);int(r.solo_duration_ticks,`${p}/solo_duration_ticks`,1,LIMITS.tick);}});
 });
 if(closed(s.network,'/network',['generation','pool_bytes_per_tick','client_bytes_per_tick','wan_down_bytes_per_tick','wan_up_bytes_per_tick','cache_read_bytes_per_tick','covered_zones','cache'])){
  const n=s.network;oneOf(n.generation,'/network/generation',['wifi6','wifi7']);
  int(n.pool_bytes_per_tick,'/network/pool_bytes_per_tick',0,LIMITS.pool);int(n.client_bytes_per_tick,'/network/client_bytes_per_tick',0,LIMITS.client);
  int(n.wan_down_bytes_per_tick,'/network/wan_down_bytes_per_tick',0,LIMITS.wan);int(n.wan_up_bytes_per_tick,'/network/wan_up_bytes_per_tick',0,LIMITS.wan);
  int(n.cache_read_bytes_per_tick,'/network/cache_read_bytes_per_tick',0,LIMITS.cacheRead);
  if(arr(n.covered_zones,'/network/covered_zones',0,4))n.covered_zones.forEach((z,i)=>oneOf(z,`/network/covered_zones/${i}`,ZONES));
  if(closed(n.cache,'/network/cache',['state','capacity_bytes','initial_object_ids'])){oneOf(n.cache.state,'/network/cache/state',['off','cold','warm']);int(n.cache.capacity_bytes,'/network/cache/capacity_bytes',0,LIMITS.cacheBytes);if(arr(n.cache.initial_object_ids,'/network/cache/initial_object_ids',0,4))n.cache.initial_object_ids.forEach((x,i)=>id(x,`/network/cache/initial_object_ids/${i}`));}
 }
 if(closed(s.services,'/services',['maps','software','uploads']))for(const k of ['maps','software','uploads'])endpoint(s.services[k],`/services/${k}`);
 if(arr(s.content_objects,'/content_objects',0,LIMITS.objects))s.content_objects.forEach((o,i)=>{const q=`/content_objects/${i}`;if(closed(o,q,['id','kind','size_bytes','check_ticks','activation_ticks','postcheck_ticks'])){id(o.id,`${q}/id`);oneOf(o.kind,`${q}/kind`,['map','software']);int(o.size_bytes,`${q}/size_bytes`,0,LIMITS.objectBytes);constant(o.check_ticks,`${q}/check_ticks`,60);constant(o.activation_ticks,`${q}/activation_ticks`,600);constant(o.postcheck_ticks,`${q}/postcheck_ticks`,60);}});
 if(arr(s.visits,'/visits',1,LIMITS.visits))s.visits.forEach((v,i)=>{
  const q=`/visits/${i}`;if(!closed(v,q,['id','arrival_tick','due_tick','initial_soc_pct','fault','cabin_required','installed_object_ids','required_object_ids','initial_log_bytes','upload_required','task_windows']))return;
  id(v.id,`${q}/id`);int(v.arrival_tick,`${q}/arrival_tick`,0,LIMITS.tick);if(v.due_tick!==null)int(v.due_tick,`${q}/due_tick`,0,LIMITS.due);
  int(v.initial_soc_pct,`${q}/initial_soc_pct`,0,100);oneOf(v.fault,`${q}/fault`,['none','mechanical','specialist_electrical']);bool(v.cabin_required,`${q}/cabin_required`);
  for(const k of ['installed_object_ids','required_object_ids'])if(arr(v[k],`${q}/${k}`,0,2))v[k].forEach((x,j)=>id(x,`${q}/${k}/${j}`));
  int(v.initial_log_bytes,`${q}/initial_log_bytes`,0,LIMITS.logBytes);bool(v.upload_required,`${q}/upload_required`);
  if(arr(v.task_windows,`${q}/task_windows`,0,LIMITS.windows))v.task_windows.forEach((w,j)=>{const p=`${q}/task_windows/${j}`;if(closed(w,p,['task_template','earliest_start_tick'])){if(!WINDOW_TEMPLATES.has(w.task_template))issue('ENUM',`${p}/task_template`,typeof w.task_template==='string'?w.task_template.slice(0,40):null,'template');int(w.earliest_start_tick,`${p}/earliest_start_tick`,0,LIMITS.tick);}});
 });
 if(closed(s.vendor,'/vendor',['enabled','bay_count','worker_count','outbound_ticks','service_ticks','return_ticks','traction_energy_mj','availability'])){
  const v=s.vendor;bool(v.enabled,'/vendor/enabled');int(v.bay_count,'/vendor/bay_count',0,1);int(v.worker_count,'/vendor/worker_count',0,1);
  for(const k of ['outbound_ticks','service_ticks','return_ticks'])int(v[k],`/vendor/${k}`,1,LIMITS.tick);constant(v.traction_energy_mj,'/vendor/traction_energy_mj',0);intervals(v.availability,'/vendor/availability');
 }
 if(issues.length)return {ok:false,issues};
 // Normalization (C1.1): sort ID-keyed collections and set-valued arrays; never repair semantics.
 const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
 const sortIv=a=>a.slice().sort((x,y)=>x.start_tick-y.start_tick||x.end_tick-y.end_tick).map(x=>({start_tick:x.start_tick,end_tick:x.end_tick}));
 const sorted=a=>a.slice().sort();
 const norm={
  schema:s.schema,model_version:s.model_version,profile_version:s.profile_version,policy_id:s.policy_id,overlap_profile:s.overlap_profile,reference_effort_version:s.reference_effort_version,
  horizon_tick:s.horizon_tick,arrival_window_tick:s.arrival_window_tick,
  requirements:{energy:{target_soc_pct:s.requirements.energy.target_soc_pct}},
  task_windows:{cabin_earliest_start_tick:s.task_windows.cabin_earliest_start_tick},
  vehicle_profile:JSON.parse(jcs(VEHICLE_PROFILE)),
  site:{positions:s.site.positions.map(p=>({id:p.id,zone:p.zone,enabled:p.enabled})).sort(byId),ports:s.site.ports.map(p=>({id:p.id,position_id:p.position_id,kind:p.kind,rating_w:p.rating_w,enabled:p.enabled})).sort(byId),lane_count:s.site.lane_count,supply_w:s.site.supply_w,background_w:s.site.background_w,garage_level:s.site.garage_level},
  workers:s.workers.map(w=>({id:w.id,qualifications:w.qualifications.map(r=>({task_class:r.task_class,level:r.level,proficiency:r.proficiency,may_supervise:r.may_supervise,solo_duration_ticks:r.solo_duration_ticks})).sort((a,b)=>a.task_class<b.task_class?-1:1),availability:sortIv(w.availability)})).sort(byId),
  network:{generation:s.network.generation,pool_bytes_per_tick:s.network.pool_bytes_per_tick,client_bytes_per_tick:s.network.client_bytes_per_tick,wan_down_bytes_per_tick:s.network.wan_down_bytes_per_tick,wan_up_bytes_per_tick:s.network.wan_up_bytes_per_tick,cache_read_bytes_per_tick:s.network.cache_read_bytes_per_tick,covered_zones:sorted(s.network.covered_zones),cache:{state:s.network.cache.state,capacity_bytes:s.network.cache.capacity_bytes,initial_object_ids:sorted(s.network.cache.initial_object_ids)}},
  services:{maps:{...s.services.maps},software:{...s.services.software},uploads:{...s.services.uploads}},
  content_objects:s.content_objects.map(o=>({...o})).sort(byId),
  visits:s.visits.map(v=>({id:v.id,arrival_tick:v.arrival_tick,due_tick:v.due_tick,initial_soc_pct:v.initial_soc_pct,fault:v.fault,cabin_required:v.cabin_required,installed_object_ids:sorted(v.installed_object_ids),required_object_ids:sorted(v.required_object_ids),initial_log_bytes:v.initial_log_bytes,upload_required:v.upload_required,task_windows:v.task_windows.map(w=>({task_template:w.task_template,earliest_start_tick:w.earliest_start_tick})).sort((a,b)=>a.task_template<b.task_template?-1:1)})).sort(byId),
  vendor:{enabled:s.vendor.enabled,bay_count:s.vendor.bay_count,worker_count:s.vendor.worker_count,outbound_ticks:s.vendor.outbound_ticks,service_ticks:s.vendor.service_ticks,return_ticks:s.vendor.return_ticks,traction_energy_mj:0,availability:sortIv(s.vendor.availability)},
 };
 semantic(norm,issue);
 if(issues.length)return {ok:false,issues};
 try{compileScenario(norm);}catch(error){if(!(error instanceof TaskGraphError))throw error;issue(error.code,error.path,error.value,error.bound);return {ok:false,issues};}
 const text=jcs(norm);
 if(utf8Length(text)>MAX_INPUT_BYTES)return {ok:false,issues:[{code:'INCOMPLETE_RESOURCE_LIMIT',path:'',value:utf8Length(text),bound:MAX_INPUT_BYTES}]};
 return {ok:true,scenario:deepFreeze(norm),issues:[]};
}
function semantic(s,issue){
 const H=s.horizon_tick,A=s.arrival_window_tick;
 if(A>H)issue('ARRIVAL_WINDOW_EXCEEDS_HORIZON','/arrival_window_tick',A,H);
 const dup=(list,path)=>{const seen=new Set();list.forEach((x,i)=>{if(seen.has(x.id))issue('DUPLICATE_ID',`${path}/${i}/id`,x.id);seen.add(x.id);});return seen;};
 const positions=dup(s.site.positions,'/site/positions');dup(s.site.ports,'/site/ports');dup(s.workers,'/workers');const objects=dup(s.content_objects,'/content_objects');dup(s.visits,'/visits');
 const zoneOf=new Map(s.site.positions.map(p=>[p.id,p.zone]));const reached=new Set();
 s.site.ports.forEach((p,i)=>{
  if(!positions.has(p.position_id))issue('REFERENCE','/site/ports/'+i+'/position_id',p.position_id);
  else if(zoneOf.get(p.position_id)!=='charging')issue('PORT_POSITION_NOT_CHARGING','/site/ports/'+i+'/position_id',p.position_id);
  if(reached.has(p.position_id))issue('PORT_POSITION_SHARED','/site/ports/'+i+'/position_id',p.position_id);reached.add(p.position_id);
 });
 if(s.site.background_w>s.site.supply_w)issue('BACKGROUND_EXCEEDS_SUPPLY','/site/background_w',s.site.background_w,s.site.supply_w);
 const zones=new Set();s.network.covered_zones.forEach((z,i)=>{if(zones.has(z))issue('DUPLICATE_ZONE','/network/covered_zones/'+i,z);zones.add(z);});
 const sizeOf=new Map(s.content_objects.map(o=>[o.id,o]));
 const cache=s.network.cache,seenCache=new Set();
 cache.initial_object_ids.forEach((x,i)=>{if(seenCache.has(x))issue('DUPLICATE_ID','/network/cache/initial_object_ids/'+i,x);seenCache.add(x);if(!objects.has(x))issue('REFERENCE','/network/cache/initial_object_ids/'+i,x);});
 if(cache.state!=='warm'&&cache.initial_object_ids.length)issue('CACHE_STATE_OBJECTS','/network/cache/initial_object_ids',cache.initial_object_ids.length,0);
 if(cache.state==='warm'){const total=cache.initial_object_ids.reduce((n,x)=>n+(sizeOf.get(x)?.size_bytes??0),0);if(total>cache.capacity_bytes)issue('CACHE_CAPACITY','/network/cache/initial_object_ids',total,cache.capacity_bytes);}
 const intervalRules=(list,path)=>{let last=-1;list.forEach((x,i)=>{if(x.start_tick>=x.end_tick)issue('EMPTY_INTERVAL',`${path}/${i}`,x.start_tick,x.end_tick);if(x.end_tick>H)issue('INTERVAL_OUTSIDE_HORIZON',`${path}/${i}/end_tick`,x.end_tick,H);if(x.start_tick<last)issue('OVERLAPPING_INTERVALS',`${path}/${i}`,x.start_tick,last);last=Math.max(last,x.end_tick);});};
 s.workers.forEach((w,i)=>{
  const q=`/workers/${i}`,classes=new Set();
  w.qualifications.forEach((r,k)=>{
   if(classes.has(r.task_class))issue('DUPLICATE_QUALIFICATION',`${q}/qualifications/${k}/task_class`,r.task_class);classes.add(r.task_class);
   if(r.may_supervise&&r.level!=='independent')issue('SUPERVISION_REQUIRES_INDEPENDENT',`${q}/qualifications/${k}/may_supervise`,r.level,'independent');
   const ticks=proficiencyTicks(r.task_class,r.proficiency);if(r.solo_duration_ticks!==ticks)issue('PROFICIENCY_DURATION',`${q}/qualifications/${k}/solo_duration_ticks`,r.solo_duration_ticks,ticks);
  });
  intervalRules(w.availability,`${q}/availability`);
 });
 intervalRules(s.vendor.availability,'/vendor/availability');
 s.visits.forEach((v,i)=>{
  const q=`/visits/${i}`;
  if(v.arrival_tick>=A)issue('ARRIVAL_OUTSIDE_WINDOW',`${q}/arrival_tick`,v.arrival_tick,A);
  if(v.due_tick!==null&&v.due_tick<v.arrival_tick)issue('DUE_BEFORE_ARRIVAL',`${q}/due_tick`,v.due_tick,v.arrival_tick);
  let residency=v.initial_log_bytes;
  for(const k of ['installed_object_ids','required_object_ids']){
   const kinds=new Set(),seen=new Set();
   v[k].forEach((x,j)=>{if(seen.has(x))issue('DUPLICATE_ID',`${q}/${k}/${j}`,x);seen.add(x);const o=sizeOf.get(x);if(!o){issue('REFERENCE',`${q}/${k}/${j}`,x);return;}if(kinds.has(o.kind))issue('ONE_OBJECT_PER_KIND',`${q}/${k}/${j}`,o.kind);kinds.add(o.kind);if(k==='installed_object_ids')residency+=o.size_bytes;});
  }
  if(residency>50000000000)issue('VEHICLE_STORAGE',`${q}/installed_object_ids`,residency,50000000000);
  const templates=new Set();v.task_windows.forEach((w,j)=>{if(templates.has(w.task_template))issue('DUPLICATE_TASK_WINDOW',`${q}/task_windows/${j}`,w.task_template);templates.add(w.task_template);});
 });
}
