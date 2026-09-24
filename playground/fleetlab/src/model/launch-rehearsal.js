/** Versioned launch rehearsal API for the existing Bay operations lifecycle. */
import {defaultBayAreaConfig,validateBayAreaConfig,simulateBayAreaOperations,BAY_OPERATIONS_VERSION} from './bay-operations.js';
import {BAY_AREA_PLACES} from './bay-area.js';
import {defaultReadiness,READINESS_VERSION,READINESS_METRICS_VERSION,REQUIRED_WORK_RULE,mandatoryWorkComplete} from './depot-readiness.js';
import {defaultCharging,CHARGING_VERSION} from './charging-allocation.js';
import {defaultResources,RESOURCES_VERSION} from './resource-observations.js';
import {BAY_SYSTEM_METRICS} from './bay-systems.js';
import {LAUNCH_VERSION,REGION_VERSION,DEPOT_VERSION,COMMISSIONING_VERSION,LAUNCH_METRICS_VERSION,validateLaunchStructure,createLaunchState} from './launch-contract.js';
export function createLaunchConfig(template='peninsula'){
  if(!['peninsula','region_b'].includes(template))throw new RangeError('Unknown launch template.');
  const places=template==='peninsula'?['menlo-park','palo-alto'].map(id=>{const p=BAY_AREA_PLACES.find(p=>p.id===id);return {id:p.id,label:p.label,x:p.x,y:p.y};}):[
    {id:'region-b:north',label:'Synthetic North',x:0,y:4},{id:'region-b:south',label:'Synthetic South',x:0,y:0},{id:'region-b:east',label:'Synthetic East',x:3,y:2}];
  const depots=[0,1].map(i=>{const id=template==='region_b'?`region-b:depot-${i+1}`:`peninsula:depot-${i+1}`,task=id+':commission';return {version:DEPOT_VERSION,id,label:`Fictional ${i?'South':'North'} depot`,place_id:places[i].id,site_power_kw:i?60:120,cleaning_bays:i?1:3,cleaning_workers:i?1:2,software_bays:1,upload_bays:i?1:2,calendar:{open_minute:0,close_minute:1440},
    tasks:[{id:id+':installation',label:'Simulated installation prerequisite',owner:'Synthetic installation lead',depends_on:[],status:'completed'},{id:task,label:'Mock commissioning',owner:'Synthetic commissioning lead',depends_on:[id+':installation'],status:'pending'}],
    ports:Array.from({length:i?2:3},(_,j)=>({id:`${id}:port-${j+1}`,installed:true,commissioned:false,healthy:true,compatible_vehicle_types:['ipace','ojai'],cap_kw:i?35:60,commissioning_task_id:task}))};});
  const events=depots.flatMap(d=>d.ports.map(p=>({version:COMMISSIONING_VERSION,id:`${p.id}:commission`,sequence:0,effective_minute:0,depot_id:d.id,resource_id:p.id,task_id:p.commissioning_task_id,owner:d.tasks.at(-1).owner,action:'commission'}))).map((e,i)=>({...e,sequence:i+1}));
  return {...defaultBayAreaConfig(),place_ids:places.map(p=>p.id),depot_count:2,fleet_size:24,requests_per_hour:45,duration_hours:4,start_hour:0,peak_multiplier:1,trips_between_visits:1,cleaning_minutes:5,upload_minutes:2,software_every_visits:100,initial_soc_pct:35,charge_target_pct:85,
    readiness:defaultReadiness(),charging:defaultCharging(),resources:{...defaultResources(),delay_min:0,period_min:1,outage_ports:0},
    launch:{version:LAUNCH_VERSION,pickup_target_min:10,region:{version:REGION_VERSION,id:template,label:template==='peninsula'?'Peninsula teaching region':'Region B — synthetic',timezone:template==='peninsula'?'America/Los_Angeles (label only)':'Synthetic local time',local_date:'2026-01-15',geography:template==='peninsula'?'frozen_bay_routes':'synthetic_km',places},depots,events}};
}
export function validateLaunchConfig(c){
  const result=validateLaunchStructure(c),errors=validateBayAreaConfig(c);
  const details=new Set(result.checks.filter(q=>q.status==='FAIL').map(q=>q.detail));
  for(const detail of errors)if(!details.has(detail))result.checks.push({name:'BAY_CONFIGURATION',status:'FAIL',detail});
  result.ok=result.checks.every(q=>q.status!=='FAIL');return result;
}
const external=r=>r.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]);
const supportedModel=[BAY_OPERATIONS_VERSION,READINESS_VERSION,CHARGING_VERSION,RESOURCES_VERSION,LAUNCH_VERSION].join('+');
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const nonnegative=x=>Number.isFinite(x)&&x>=0;
const count=x=>Number.isInteger(x)&&x>=0;
const stages=['software','cleaning','charging','upload'];
const validChecks=xs=>Array.isArray(xs)&&xs.every(x=>object(x)&&typeof x.name==='string'&&['PASS','FAIL','NOT_AVAILABLE','WARN'].includes(x.status));
/** Validate fields before projection. Missing is never treated as an empty or zero population. */
function validRecordedPopulations(r){
  const horizon=Math.ceil(r.config.duration_hours*60),minute=x=>count(x)&&x<=horizon,optionalMinute=x=>x===null||minute(x);
  const places=new Set(r.config.place_ids),depots=new Set(r.config.launch.depots.map(d=>d.id));
  if(!Array.isArray(r.requests)||!Array.isArray(r.visits)||!object(r.metrics)||!object(r.readiness.metrics)||!object(r.launch.metrics))return false;
  if(!validChecks(r.readiness.checks)||!validChecks(r.extensions.checks)||!validChecks(r.launch.checks))return false;
  if(!r.requests.every(q=>object(q)&&typeof q.id==='string'&&minute(q.created_minute)&&q.created_minute<horizon&&places.has(q.pickup_node)&&places.has(q.dropoff_node)&&nonnegative(q.trip_distance_km)&&['waiting','pickup','boarding','in_progress','completed','unserved'].includes(q.status)&&optionalMinute(q.picked_up_minute)&&optionalMinute(q.completed_minute)))return false;
  if(new Set(r.requests.map(q=>q.id)).size!==r.requests.length)return false;
  if(!r.visits.every(v=>object(v)&&typeof v.id==='string'&&depots.has(v.depot_id)&&typeof v.software_scheduled==='boolean'&&minute(v.started_minute)&&optionalMinute(v.arrived_minute)&&optionalMinute(v.completed_minute)&&Array.isArray(v.work_order)&&v.work_order.length===4&&
    v.work_order.every(t=>object(t)&&t.id===`${v.id}:${t.stage}`&&stages.includes(t.stage)&&t.required===(t.stage!=='software'||v.software_scheduled)&&['not_applicable','not_reached','queued','active','completed'].includes(t.status)&&minute(t.created_minute)&&optionalMinute(t.queued_minute)&&optionalMinute(t.started_minute)&&optionalMinute(t.completed_minute)&&count(t.active_minutes)&&count(t.queue_minutes)&&(t.required_active_min===null||nonnegative(t.required_active_min))&&(t.completion_record===null||object(t.completion_record)&&t.completion_record.task_id===t.id&&minute(t.completion_record.minute)))&&
    new Set(v.work_order.map(t=>t.stage)).size===4&&(v.completed_minute===null||mandatoryWorkComplete(v))))return false;
  if(new Set(r.visits.map(v=>v.id)).size!==r.visits.length)return false;
  if(!['total_requests','completed_trips','unserved_requests','pending_requests','in_progress_trips','censored_visits'].every(k=>count(r.metrics[k]))||!['final_energy_kwh','initial_energy_kwh','energy_delivered_kwh','energy_consumed_kwh'].every(k=>nonnegative(r.metrics[k]))||!Number.isFinite(r.metrics.energy_balance_error_kwh))return false;
  return ['required_tasks','completed_tasks','queued_tasks','active_tasks','not_reached_tasks','unfinished_tasks','queue_observed_min','active_observed_min','onsite_observed_min'].every(k=>count(r.readiness.metrics[k]));
}
/** Replay setup transitions only: no demand, vehicles, dispatch, charging or fleet simulation. */
function commissioningRecordsMatch(r){
  if(!Array.isArray(r.launch.actions)||!Array.isArray(r.launch.initial_capacity)||!Array.isArray(r.launch.terminal_capacity)||!object(r.launch.setup))return false;
  const state=createLaunchState(r.config),horizon=Math.ceil(r.config.duration_hours*60);
  for(let minute=0;minute<=horizon;minute++)state.tick(minute);
  const expected=state.finish(r.requests,r.visits,r.metrics,r.readiness,r.extensions);
  return ['actions','initial_capacity','terminal_capacity','setup'].every(k=>JSON.stringify(r.launch[k])===JSON.stringify(expected[k]))&&
    JSON.stringify(r.launch.checks.filter(c=>c.name==='MOCK_COMMISSIONING_ACTIONS'))===JSON.stringify(expected.checks.filter(c=>c.name==='MOCK_COMMISSIONING_ACTIONS'));
}
/** This comparison accepts only a uniform event-time shift, with unchanged exogenous demand. */
export function compareLaunchRuns(a,b){
  const fail=reason=>({comparable:false,reason,deltas:null});
  if([a,b].some(r=>r?.version!==supportedModel||r?.launch?.version!==LAUNCH_VERSION||r?.launch?.metric_version!==LAUNCH_METRICS_VERSION||r?.extensions?.producer!=='fleetlab-bay-operations'||r?.extensions?.metric_version!==BAY_SYSTEM_METRICS||r?.extensions?.resources?.version!==RESOURCES_VERSION||r?.readiness?.version!==READINESS_VERSION||r?.readiness?.metric_version!==READINESS_METRICS_VERSION||r?.readiness?.required_work_rule!==REQUIRED_WORK_RULE))return fail('Unsupported launch producer, composite model, metric version or required-work rule.');
  if([a,b].some(r=>!r.config?.launch||!validateLaunchConfig(r.config).ok))return fail('Invalid or unsupported launch configuration.');
  if([a,b].some(r=>r.launch.validity!=='VALID'||r.readiness?.validity!=='VALID'||r.extensions?.validity!=='VALID'))return fail('Invalid simulator state.');
  if(a.config.launch.region.id!==b.config.launch.region.id||a.config.launch.region.version!==b.config.launch.region.version)return fail('Incompatible region identity or version.');
  if([a,b].some(r=>!validRecordedPopulations(r)))return fail('Required request, work or metric population unavailable or malformed.');
  if([a,b].some(r=>!commissioningRecordsMatch(r)))return fail('Recorded commissioning actions, setup or capacity disagree with the declared event timeline.');
  const left=structuredClone(a.config),right=structuredClone(b.config),ae=left.launch.events,be=right.launch.events;
  if(ae.length!==be.length)return fail('Mock event inventory differs.');
  let shift=null;
  for(let i=0;i<ae.length;i++){const delta=be[i]?.effective_minute-ae[i]?.effective_minute;if(!Number.isInteger(delta)||delta<0||shift!==null&&shift!==delta)return fail('Only a uniform nonnegative commissioning-time shift is supported.');shift=delta;be[i].effective_minute=ae[i].effective_minute;}
  if(JSON.stringify(left)!==JSON.stringify(right))return fail('Non-treatment configuration differs.');
  if(JSON.stringify(external(a))!==JSON.stringify(external(b)))return fail('External requests differ.');
  const keys=['requests','pickup_within_target','pickup_late','pickup_missed','pickup_pending','pickup_within_target_fraction','completed_trips','completion_fraction','unfinished_visits','unfinished_tasks','queue_observed_min','active_observed_min','terminal_energy_kwh'];
  if(keys.some(k=>!Number.isFinite(a.launch.metrics?.[k])||!Number.isFinite(b.launch.metrics?.[k])))return fail('Required metric population unavailable.');
  for(const r of [a,b]){
    const m=r.metrics,x=r.launch.metrics,horizon=Math.ceil(r.config.duration_hours*60),target=r.config.launch.pickup_target_min;
    if(!Array.isArray(r.requests)||!Array.isArray(r.visits)||!m||m.total_requests!==r.requests.length||x.requests!==r.requests.length||!Number.isFinite(m.energy_balance_error_kwh)||Math.abs(m.energy_balance_error_kwh)>1e-6||m.total_requests!==m.completed_trips+m.unserved_requests+m.pending_requests+m.in_progress_trips)return fail('Population or energy accounting mismatch.');
    const within=r.requests.filter(q=>q.picked_up_minute!==null&&q.picked_up_minute-q.created_minute<=target).length;
    const late=r.requests.filter(q=>q.picked_up_minute!==null&&q.picked_up_minute-q.created_minute>target).length;
    const missed=r.requests.filter(q=>q.picked_up_minute===null&&(q.status==='unserved'||q.created_minute+target<=horizon)).length;
    if(x.pickup_within_target!==within||x.pickup_late!==late||x.pickup_missed!==missed||x.pickup_pending!==r.requests.length-within-late-missed||x.pickup_within_target_fraction!==within/r.requests.length||x.completed_trips!==r.requests.filter(q=>q.status==='completed').length||x.completed_trips!==m.completed_trips||x.completion_fraction!==x.completed_trips/r.requests.length||x.unfinished_visits!==r.visits.filter(v=>v.completed_minute===null).length||x.unfinished_tasks!==r.visits.flatMap(v=>v.work_order).filter(t=>t.required&&t.status!=='completed').length||x.queue_observed_min!==r.readiness.metrics.queue_observed_min||x.active_observed_min!==r.readiness.metrics.active_observed_min||x.terminal_energy_kwh!==m.final_energy_kwh)return fail('Launch measurements disagree with their declared populations.');
  }
  return {comparable:true,reason:null,deltas:Object.fromEntries(keys.map(k=>[k,b.launch.metrics[k]-a.launch.metrics[k]]))};
}
export function compareCommissioning(config,delayMinutes){
  const validation=validateLaunchConfig(config);if(!validation.ok)throw new RangeError(validation.checks.filter(q=>q.status==='FAIL').map(q=>q.detail).join(' '));
  if(!Number.isInteger(delayMinutes)||delayMinutes<0||delayMinutes>1440)throw new RangeError('Commissioning delay must be an integer from 0 to 1440 minutes.');
  if(config.launch.events.some(e=>e?.effective_minute!==0))throw new RangeError('This comparison requires a minute-zero baseline schedule; use raw shift simulation for arbitrary event times.');
  const a=structuredClone(config),b=structuredClone(config);for(const e of b.launch.events)if(Number.isInteger(e?.effective_minute))e.effective_minute+=delayMinutes;
  const baseline=simulateBayAreaOperations(a),candidate=simulateBayAreaOperations(b),comparison=compareLaunchRuns(baseline,candidate);
  return {format:'fleetlab-launch-rehearsal',version:LAUNCH_VERSION,evidence_status:'NOT_EVIDENCE',deployment_permission:'NONE',descriptive:true,validity:comparison.comparable?'VALID':'INVALID_COMPARISON',reason:comparison.reason,
    spec:{region_id:a.launch.region.id,region_version:a.launch.region.version,depot_version:DEPOT_VERSION,seed:a.seed,delay_minutes:delayMinutes,baseline_delay_minutes:0,axis:'launch.events[].effective_minute',pickup_target_min:a.launch.pickup_target_min,horizon_minutes:Math.ceil(a.duration_hours*60)},baseline,candidate,comparison};
}
