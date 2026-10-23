/** Pure, bounded configuration and mock-action contract; no independent simulator. */
import {BAY_AREA_PLACES,bayAreaRoute} from './bay-area.js';
export const LAUNCH_VERSION='depot-launch-1.0.0';
export const REGION_VERSION='region-config-1.0.0';
export const DEPOT_VERSION='depot-config-1.0.0';
export const COMMISSIONING_VERSION='mock-commissioning-1.0.0';
export const LAUNCH_METRICS_VERSION='depot-launch-metrics-1.0.0';
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=160;
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(x);
const number=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
const integer=(x,min,max)=>Number.isInteger(x)&&number(x,min,max);
export const launchDepot=(c,id)=>c.launch?.depots.find(d=>d.id===id);
export const stageCapacity=(c,depot,stage)=>{const d=launchDepot(c,depot);return d?(stage==='charging'?d.ports.length:d[`${stage}_bays`]):c[stage==='charging'?'chargers':`${stage}_bays`];};
export function siteOpen(c,depot,minute){const d=launchDepot(c,depot);if(!d)return true;const local=(Math.round(c.start_hour*60)+minute)%1440;return local>=d.calendar.open_minute&&local<d.calendar.close_minute;}
export const sitePower=(c,depot,minute)=>siteOpen(c,depot,minute)?(launchDepot(c,depot)?.site_power_kw??c.site_power_kw):0;

/** Structural failure blocks execution. Pending owned tasks remain visible and rehearseable. */
export function validateLaunchStructure(c){
  const checks=[],check=(name,ok,detail)=>checks.push({name,status:ok?'PASS':'FAIL',detail});
  const l=c?.launch,r=l?.region;
  check('LAUNCH_VERSION',object(l)&&l.version===LAUNCH_VERSION,'Supported explicit depot launch version required.');
  if(!object(l))return {ok:false,checks,summary:null};
  check('REGION_CONFIG',object(r)&&r.version===REGION_VERSION&&id(r.id)&&text(r.label)&&text(r.timezone)&&/^\d{4}-\d{2}-\d{2}$/.test(r.local_date??'')&&['frozen_bay_routes','synthetic_km'].includes(r.geography),'Region version, identity, local date/timezone label and declared geography required.');
  check('PICKUP_TARGET',integer(l.pickup_target_min,1,240),'All-request pickup target must be 1–240 minutes.');
  check('REQUIRED_EXTENSIONS',!!c.readiness&&!!c.charging&&!!c.resources&&!c.airport,'Launch uses readiness, charging and resource contracts; airport extension is outside this version.');
  check('RESOURCE_TRUTH_SOURCE',['planned_ports','uncommissioned_ports','outage_ports'].every(k=>c.resources?.[k]===0),'Launch resource truth comes from explicit depot ports and mock actions; legacy aggregate planned, uncommissioned and outage counts must remain zero.');
  const places=Array.isArray(r?.places)?r.places:[];
  check('REGION_PLACES',places.length>=2&&places.length<=18&&places.every(p=>object(p)&&id(p.id)&&text(p.label)&&number(p.x,-100,100)&&number(p.y,-100,100))&&new Set(places.map(p=>p.id)).size===places.length,'Use 2–18 unique labeled places in a bounded kilometer plane.');
  check('REGION_SELECTION',Array.isArray(c.place_ids)&&JSON.stringify(c.place_ids)===JSON.stringify(places.map(p=>p?.id)),'Selected places must match the explicit region order.');
  if(r?.geography==='frozen_bay_routes')check('FROZEN_ANCHORS',places.every(p=>{const known=BAY_AREA_PLACES.find(a=>a.id===p?.id);return known&&p.x===known.x&&p.y===known.y;}),'Frozen Bay anchors must match the bundled geography.');
  const depots=Array.isArray(l.depots)?l.depots:[],allIds=new Set(),taskIds=new Set();
  check('DEPOT_IDENTITIES',depots.length>=1&&depots.length<=6&&depots.length===c.depot_count&&new Set(depots.map(d=>d?.id)).size===depots.length,'One to six fixed, distinct depot identities must match depot_count.');
  let totalPorts=0,installed=0,commissioned=0,pending=0,unowned=0;
  for(const d of depots){
    if(!object(d)){check('DEPOT_CONFIG',false,'Depot must be a versioned object.');continue;}
    check('DEPOT_CONFIG',d.version===DEPOT_VERSION&&id(d.id)&&text(d.label)&&places.some(p=>p?.id===d.place_id)&&!places.some(p=>p?.id===d.id),`Depot ${d.id}: version, stable ID, label and selected anchor required.`);
    check('SITE_CAPACITY',number(d.site_power_kw,0,10000)&&['cleaning_bays','software_bays','upload_bays','cleaning_workers'].every(k=>integer(d[k],0,120)),`Depot ${d.id}: finite per-site power, bay and worker capacities required.`);
    check('LOCAL_CALENDAR',object(d.calendar)&&integer(d.calendar.open_minute,0,1439)&&integer(d.calendar.close_minute,1,1440)&&d.calendar.open_minute<d.calendar.close_minute,`Depot ${d.id}: local opening inclusive, closing exclusive; one daily window, no DST conversion.`);
    const tasks=Array.isArray(d.tasks)?d.tasks:[],byTask=new Map(tasks.map(t=>[t?.id,t]));
    check('SETUP_TASKS',tasks.length>0&&tasks.length<=72&&tasks.every(t=>object(t)&&id(t.id)&&text(t.label)&&['completed','pending'].includes(t.status)&&Array.isArray(t.depends_on)&&t.depends_on.length<=72&&new Set(t.depends_on).size===t.depends_on.length&&t.depends_on.every(dep=>byTask.has(dep))),`Depot ${d.id}: bounded tasks require existing dependencies and explicit status.`);
    for(const t of tasks){if(!object(t))continue;pending+=t.status==='pending'?1:0;unowned+=text(t.owner)?0:1;check('TASK_OWNER',text(t.owner),`Task ${t.id}: explicit owner required.`);check('TASK_IDENTITY',id(t.id)&&!taskIds.has(t.id),`Task ${t.id}: stable globally unique ID required.`);taskIds.add(t.id);}
    const visiting=new Set(),done=new Set();
    const acyclic=t=>{if(done.has(t))return true;if(visiting.has(t))return false;const deps=byTask.get(t)?.depends_on;if(!Array.isArray(deps))return false;visiting.add(t);if(!deps.every(acyclic))return false;visiting.delete(t);done.add(t);return true;};
    check('TASK_DEPENDENCIES',tasks.length<=72&&tasks.every(t=>acyclic(t?.id)),`Depot ${d.id}: setup dependencies must be acyclic.`);
    const completedMemo=new Map(),completing=new Set();
    const completed=taskId=>{if(completedMemo.has(taskId))return completedMemo.get(taskId);const t=byTask.get(taskId);if(!t||t.status!=='completed'||!Array.isArray(t.depends_on)||completing.has(taskId)||completing.size>72)return false;completing.add(taskId);const value=t.depends_on.every(completed);completing.delete(taskId);completedMemo.set(taskId,value);return value;};
    check('TASK_COMPLETION_DEPENDENCIES',tasks.every(t=>t?.status!=='completed'||completed(t.id)),`Depot ${d.id}: completed setup tasks require completed dependencies.`);
    const ports=Array.isArray(d.ports)?d.ports:[];totalPorts+=ports.length;
    check('PORT_INVENTORY',Array.isArray(d.ports)&&ports.length<=72,`Depot ${d.id}: finite named port inventory required.`);
    for(const p of ports){
      if(!object(p)){check('PORT_CONFIG',false,'Port must be an object.');continue;}
      installed+=p.installed===true?1:0;commissioned+=p.commissioned===true?1:0;
      check('PORT_CONFIG',id(p.id)&&!allIds.has(p.id)&&['installed','commissioned','healthy'].every(k=>typeof p[k]==='boolean')&&(!p.commissioned||p.installed)&&number(p.cap_kw,0.01,500)&&Array.isArray(p.compatible_vehicle_types)&&p.compatible_vehicle_types.length<=2&&new Set(p.compatible_vehicle_types).size===p.compatible_vehicle_types.length&&p.compatible_vehicle_types.every(t=>['ipace','ojai'].includes(t))&&byTask.has(p.commissioning_task_id),`Port ${p.id}: unique ID, physical state, acceptance, compatibility and commissioning task required.`);allIds.add(p.id);
      check('INITIAL_COMMISSIONING_DEPENDENCIES',!p.commissioned||completed(p.commissioning_task_id),`Port ${p.id}: initially commissioned resources require a completed commissioning task and all dependencies.`);
    }
  }
  check('TOTAL_PORT_BOUND',totalPorts<=72,'At most 72 configured ports across all launch sites.');
  check('MOCK_EVENT_BOUND',Array.isArray(l.events)&&l.events.length<=144,'At most 144 mock actions; malformed actions are rejected by the action contract.');
  if(pending)checks.push({name:'PENDING_SETUP',status:'WARN',detail:`${pending} pending setup tasks; installed but uncommissioned infrastructure is unavailable until an accepted mock action.`});
  return {ok:checks.every(q=>q.status!=='FAIL'),checks,summary:{depots:depots.length,ports:totalPorts,installed_ports:installed,commissioned_ports:commissioned,pending_tasks:pending,unowned_tasks:unowned}};
}
export function prepareLaunchNetwork(c){
  const r=c.launch.region,places=r.places.map(p=>r.geography==='frozen_bay_routes'?structuredClone(BAY_AREA_PLACES.find(a=>a.id===p.id)):{...p,kind:'synthetic-place',road_anchor:{x:p.x,y:p.y}}),routes={};
  const key=(a,b)=>`${r.id}:${a}->${b}`;
  for(const a of places)for(const b of places){
    const route=r.geography==='frozen_bay_routes'?{...bayAreaRoute(a.id,b.id),id:key(a.id,b.id)}:{id:key(a.id,b.id),from:a.id,to:b.id,source:'synthetic-kilometer-geometry',available:true,distance_km:Math.hypot(b.x-a.x,b.y-a.y),points:a.id===b.id?[[a.x,a.y]]:[[a.x,a.y],[b.x,b.y]],limitations:['Fictional straight-line kilometer links, not roads or navigation. No external geography or company expansion provenance.']};
    if(!route.available)throw new RangeError('Configured region contains an unavailable route.');routes[route.id]=route;
  }
  return {places,routes,key};
}
/** Sequenced mock setup events mutate only private run truth, never the submitted config. */
export function createLaunchState(c){
  const depots=structuredClone(c.launch.depots),ports=depots.flatMap(d=>d.ports.map(p=>({...p,depot_id:d.id,compatible:p.compatible_vehicle_types.length>0,owner:null,expires_minute:null}))),actions=[],scheduled=[],seen=new Set();
  const capacity=()=>depots.map(d=>{const ps=ports.filter(p=>p.depot_id===d.id),ready=ps.filter(p=>p.installed&&p.commissioned);return {depot_id:d.id,installed_ports:ps.filter(p=>p.installed).length,commissioned_ports:ready.length,commissioned_kw:ready.reduce((n,p)=>n+p.cap_kw,0),site_power_kw:d.site_power_kw};});
  const initial=capacity();let sequence=0,effective=-1;
  const reject=(e,minute,reason)=>actions.push({id:e?.id??null,sequence:e?.sequence??null,minute,depot_id:e?.depot_id??null,resource_id:e?.resource_id??null,status:'REJECTED',reason});
  for(const e of c.launch.events){
    if(!object(e)||e.version!==COMMISSIONING_VERSION||!id(e.id)||!integer(e.sequence,1,10000)||!integer(e.effective_minute,0,2880)||!id(e.depot_id)||!id(e.resource_id)||!id(e.task_id)||!text(e.owner)||e.action!=='commission'){reject(e,0,'MALFORMED_EVENT');continue;}
    if(seen.has(e.id)){reject(e,0,'DUPLICATE_EVENT');continue;}seen.add(e.id);
    if(e.sequence<=sequence||e.effective_minute<effective){reject(e,0,'OUT_OF_ORDER_EVENT');continue;}
    sequence=e.sequence;effective=e.effective_minute;scheduled.push(e);
  }
  let next=0;
  return {ports,
    tick(minute){while(next<scheduled.length&&scheduled[next].effective_minute<=minute){const e=scheduled[next++],d=depots.find(d=>d.id===e.depot_id),p=ports.find(p=>p.id===e.resource_id&&p.depot_id===e.depot_id),task=d?.tasks.find(t=>t.id===e.task_id);
      const reason=!d||!p||!task||p.commissioning_task_id!==e.task_id?'UNKNOWN_RESOURCE_OR_TASK':e.owner!==task.owner?'OWNER_MISMATCH':task.depends_on.some(id=>d.tasks.find(t=>t.id===id)?.status!=='completed')?'DEPENDENCY_INCOMPLETE':!p.installed?'RESOURCE_NOT_INSTALLED':p.commissioned?'ALREADY_COMMISSIONED':null;
      if(reason){reject(e,minute,reason);continue;}p.commissioned=true;
      if(ports.filter(p=>p.commissioning_task_id===task.id).every(p=>p.commissioned))task.status='completed';
      actions.push({id:e.id,sequence:e.sequence,minute,depot_id:e.depot_id,resource_id:e.resource_id,status:'ACCEPTED',reason:null});
    }},
    finish(requests,visits,metrics,readiness,extensions){
      const horizon=Math.ceil(c.duration_hours*60),target=c.launch.pickup_target_min;
      const cohort={requests:requests.length,pickup_within_target:0,pickup_late:0,pickup_missed:0,pickup_pending:0};
      for(const q of requests){if(q.picked_up_minute!==null)cohort[q.picked_up_minute-q.created_minute<=target?'pickup_within_target':'pickup_late']++;else cohort[q.status==='unserved'||q.created_minute+target<=horizon?'pickup_missed':'pickup_pending']++;}
      return {version:LAUNCH_VERSION,metric_version:LAUNCH_METRICS_VERSION,evidence_status:'NOT_EVIDENCE',deployment_permission:'NONE',scope:'simulation-only',validity:readiness.validity==='VALID'&&extensions.validity==='VALID'?'VALID':'INVALID_SIMULATION',
        checks:[{name:'MOCK_COMMISSIONING_ACTIONS',status:actions.some(a=>a.status==='REJECTED')?'FAIL':'PASS',detail:'Rejected mock actions grant no capacity and are distinct from invalid simulator state.'},...readiness.checks,...extensions.checks],actions,initial_capacity:initial,terminal_capacity:capacity(),
        setup:{initial_pending_tasks:c.launch.depots.flatMap(d=>d.tasks).filter(t=>t.status==='pending').length,terminal_pending_tasks:depots.flatMap(d=>d.tasks).filter(t=>t.status==='pending').length,accepted_mock_actions:actions.filter(a=>a.status==='ACCEPTED').length,rejected_mock_actions:actions.filter(a=>a.status==='REJECTED').length,unprocessed_mock_actions:scheduled.length-next,operator_manual_touches:null,operator_first_pass_validation:null},
        metrics:{...cohort,pickup_within_target_fraction:requests.length?cohort.pickup_within_target/requests.length:null,completed_trips:metrics.completed_trips,completion_fraction:requests.length?metrics.completed_trips/requests.length:null,unfinished_visits:visits.filter(v=>v.completed_minute===null).length,unfinished_tasks:readiness.metrics.unfinished_tasks,queue_observed_min:readiness.metrics.queue_observed_min,active_observed_min:readiness.metrics.active_observed_min,terminal_energy_kwh:metrics.final_energy_kwh},
        limitations:['One synthetic seed is descriptive; no confidence, physical commissioning approval, launch authority or company expansion claim.',
          'Pickup cohort includes every request created before observation end: on time, known late pickup, missed without pickup, or target deadline still pending. Completion and unfinished work remain separate.',
          'Initial capacity is physical truth before minute-zero mock actions; terminal capacity includes accepted actions through the terminal observation, which consumes no interval energy.',
          'Calendars use declared local minute-of-day windows. Closing blocks all new task acquisition and power; already active non-charging tasks finish nonpreemptively. No shifts, timezone conversion or DST service.',
          'Stage acquisition retains FIFO ordering: an incompatible charging job at the queue head may block compatible jobs behind it. No compatibility-aware routing or optimized scheduler is claimed.',
          'Setup counts and accepted mock actions are configuration measurements. Operator manual touches and first-pass validation are unavailable until a usability study.']};
    },
  };
}
