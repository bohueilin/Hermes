/** Optional serial work-order contract for the Bay engine; no independent simulator. */
export const READINESS_VERSION='depot-readiness-1.0.0';
export const READINESS_METRICS_VERSION='depot-readiness-metrics-1.0.0';
export const REQUIRED_WORK_RULE='serial-every-visit-clean-charge-upload-scheduled-software-1';
const STAGES=['software','cleaning','charging','upload'];
export const defaultReadiness=()=>({version:READINESS_VERSION,cleaning_workers:1,scheduler:'fifo',max_task_wait_min:60});
export function validateReadiness(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return ['readiness must be an explicit versioned object.'];
  const errors=[];
  if(value.version!==READINESS_VERSION)errors.push('Unsupported readiness version.');
  if(!Number.isInteger(value.cleaning_workers)||value.cleaning_workers<0||value.cleaning_workers>120)errors.push('cleaning_workers must be an integer between 0 and 120.');
  if(!['fifo','defer_cleaning','skip_cleaning','cancel_cleaning'].includes(value.scheduler))errors.push('Unsupported cleaning scheduler.');
  if(!Number.isInteger(value.max_task_wait_min)||value.max_task_wait_min<1||value.max_task_wait_min>1440)errors.push('max_task_wait_min must be an integer between 1 and 1440.');
  if(Object.keys(value).some(k=>!Object.hasOwn(defaultReadiness(),k)))errors.push('Unknown readiness setting.');
  return errors;
}

/** A mandatory task needs a matching simulated completion record, not just a status. */
export function mandatoryWorkComplete(visit){
  if(!Array.isArray(visit.work_order)||visit.work_order.length!==STAGES.length||STAGES.some(stage=>visit.work_order.filter(t=>t.stage===stage).length!==1))return false;
  if(visit.work_order.some(t=>t.required!==(t.stage!=='software'||visit.software_scheduled)))return false;
  return visit.work_order.filter(t=>t.required).every(t=>t.status==='completed'&&t.completion_record?.task_id===t.id&&
    t.completion_record.minute===t.completed_minute&&t.started_minute!==null&&t.completed_minute>=t.started_minute&&
    t.active_minutes===t.completed_minute-t.started_minute&&
    (t.required_active_min===null||t.active_minutes>=t.required_active_min));
}

/** Private per-run state. Resource ownership remains live at the horizon, never silently canceled. */
export function createReadiness(c){
  const horizon=Math.ceil(c.duration_hours*60),allocations=new Map(),rejections=[],invalid=[];
  let queueMinutes=0,activeMinutes=0,maxWait=0;
  const blockedMinutes={WORKER_UNAVAILABLE:0,BAY_UNAVAILABLE:0,BAY_AND_WORKER_UNAVAILABLE:0,POLICY_DEFERRED:0,OTHER_RESOURCE:0};
  const task=v=>v.visit.work_order.find(t=>t.stage===v.state.replace('queued_',''));
  const owners=depot=>[...allocations.values()].filter(a=>a.depot_id===depot);
  function reject(v,minute,action){
    const id=task(v).id;
    if(!rejections.some(r=>r.task_id===id&&r.action===action))rejections.push({task_id:id,minute,action,check:'MANDATORY_WORK_POLICY',reason:'Mandatory work cannot be skipped or canceled.'});
  }
  function reason(v){
    const held=owners(v.depot_id),bay=held.length>=c.cleaning_bays,worker=held.length>=c.readiness.cleaning_workers;
    if(bay&&worker)return 'BAY_AND_WORKER_UNAVAILABLE';
    if(bay)return 'BAY_UNAVAILABLE';if(worker)return 'WORKER_UNAVAILABLE';
    return c.readiness.scheduler==='fifo'?null:'POLICY_DEFERRED';
  }
  return {
    begin(v,t){
      v.visit.readiness_deadline_minute=horizon;
      v.visit.work_order=STAGES.map(stage=>({id:`${v.visit.id}:${stage}`,stage,required:stage!=='software'||v.visit.software_scheduled,
        status:stage==='software'&&!v.visit.software_scheduled?'not_applicable':'not_reached',created_minute:t,
        queued_minute:null,started_minute:null,completed_minute:null,active_minutes:0,queue_minutes:0,
        required_active_min:stage==='charging'?null:Math.ceil(c[`${stage}_minutes`]*v.profile[`${stage}_multiplier`]),
        bay_id:null,worker_id:null,completion_record:null}));
    },
    queued(v,t){const item=task(v);item.status='queued';item.queued_minute=t;},
    mayStart(v,t){
      if(v.state!=='queued_cleaning')return true;
      if(c.readiness.scheduler==='skip_cleaning'||c.readiness.scheduler==='cancel_cleaning')reject(v,t,c.readiness.scheduler);
      return reason(v)===null;
    },
    started(v,t){
      const item=task(v);item.status='active';item.started_minute=t;
      if(v.state==='cleaning'){
        const held=owners(v.depot_id);
        const free=(kind,count)=>Array.from({length:count},(_,i)=>`${v.depot_id}:${kind}-${i+1}`).find(id=>!held.some(a=>a[`${kind}_id`]===id));
        const bay_id=free('bay',c.cleaning_bays),worker_id=free('worker',c.readiness.cleaning_workers);
        if(!bay_id||!worker_id)throw new Error('INVALID_SIMULATION: cleaning acquired without both resources.');
        item.bay_id=bay_id;item.worker_id=worker_id;allocations.set(v.id,{depot_id:v.depot_id,bay_id,worker_id,task_id:item.id});
      }
    },
    finished(v,t){
      const item=task(v);
      if(item.status!=='active'||item.started_minute===null||item.active_minutes!==t-item.started_minute||
        (item.required_active_min!==null&&item.active_minutes<item.required_active_min))throw new Error('INVALID_SIMULATION: completion without required work.');
      item.status='completed';item.completed_minute=t;item.completion_record={task_id:item.id,minute:t};
      if(v.state==='cleaning'){
        if(allocations.get(v.id)?.task_id!==item.id)throw new Error('INVALID_SIMULATION: missing reservation.');
        allocations.delete(v.id);
      }
    },
    release(v){if(!mandatoryWorkComplete(v.visit))throw new Error('INVALID_SIMULATION: mandatory release check failed.');},
    inspect(v){
      if(!v.visit||v.visit.completed_minute!==null)return null;
      const item=v.visit.work_order.find(t=>['queued','active'].includes(t.status));
      return {visit_id:v.visit.id,task_id:item?.id??null,stage:item?.stage??null,
        blocked_reason:v.state==='queued_cleaning'?reason(v):v.state.startsWith('queued_')?'OTHER_RESOURCE':v.state==='drive_to_depot'?'INBOUND_TRAVEL':null,
        mandatory_remaining:v.visit.work_order.filter(t=>t.required&&t.status!=='completed').map(t=>t.stage),
        bay_id:item?.status==='active'?item.bay_id:null,worker_id:item?.status==='active'?item.worker_id:null};
    },
    resources(depot){const held=owners(depot);return {capacity:c.readiness.cleaning_workers,in_use:held.length,free:c.readiness.cleaning_workers-held.length};},
    observe(vehicles,depots,minute){
      for(const v of vehicles){
        if(!Number.isFinite(v.soc_kwh)||v.soc_kwh<v.battery_kwh*c.reserve_soc_pct/100-1e-8||v.soc_kwh>v.battery_kwh+1e-8)invalid.push('BATTERY_RESERVE_BOUNDS');
        if(v.visit&&v.state.startsWith('queued_')){
          const item=task(v);maxWait=Math.max(maxWait,minute-item.queued_minute);
          if(minute<horizon){item.queue_minutes++;queueMinutes++;blockedMinutes[this.inspect(v).blocked_reason]++;}
        }else if(STAGES.includes(v.state)&&minute<horizon){task(v).active_minutes++;activeMinutes++;}
      }
      for(const d of depots){
        if(d.charging_kw>c.site_power_kw+1e-8||!Number.isFinite(d.charging_kw))invalid.push('SITE_POWER_LIMIT');
        for(const stage of STAGES)if(d.active[stage]>c[stage==='charging'?'chargers':`${stage}_bays`])invalid.push('RESOURCE_CONSERVATION');
        const held=owners(d.depot_id);
        if(held.length!==d.active.cleaning||held.length>c.readiness.cleaning_workers||new Set(held.map(a=>a.worker_id)).size!==held.length||new Set(held.map(a=>a.bay_id)).size!==held.length)invalid.push('RESOURCE_CONSERVATION');
      }
    },
    finish(visits,metrics){
      const tasks=visits.flatMap(v=>v.work_order.filter(t=>t.required)),unfinished=tasks.filter(t=>t.status!=='completed');
      const count=status=>tasks.filter(t=>t.status===status).length;
      const completed=visits.filter(v=>v.completed_minute!==null),onsite=visits.filter(v=>v.arrived_minute!==null);
      if(completed.some(v=>!mandatoryWorkComplete(v)))invalid.push('MANDATORY_RELEASE');
      const onsiteMinutes=onsite.reduce((s,v)=>s+(v.completed_minute??horizon)-v.arrived_minute,0);
      if(onsiteMinutes!==queueMinutes+activeMinutes)invalid.push('ONSITE_TIME_ACCOUNTING');
      if(Math.abs(metrics.energy_balance_error_kwh)>1e-6)invalid.push('ENERGY_BALANCE');
      if(metrics.total_requests!==metrics.completed_trips+metrics.unserved_requests+metrics.pending_requests+metrics.in_progress_trips)invalid.push('REQUEST_ACCOUNTING');
      maxWait=Math.max(maxWait,...tasks.map(t=>t.queue_minutes));
      const observedQueue=tasks.some(t=>t.queued_minute!==null);
      const checks=[{name:'SIMULATION_INVARIANTS',status:invalid.length?'FAIL':'PASS',violations:[...new Set(invalid)]},
        {name:'MANDATORY_RELEASE',status:completed.some(v=>!mandatoryWorkComplete(v))?'FAIL':'PASS'},
        {name:'MANDATORY_WORK_POLICY',status:rejections.length?'FAIL':'PASS',rejected_actions:rejections.length},
        {name:'REQUIRED_WORK_MAX_WAIT',status:observedQueue?(maxWait>c.readiness.max_task_wait_min?'FAIL':'PASS'):'NOT_AVAILABLE',value:observedQueue?maxWait:null,operator:'<=',threshold:c.readiness.max_task_wait_min,unit:'min'}];
      return {version:READINESS_VERSION,metric_version:READINESS_METRICS_VERSION,required_work_rule:REQUIRED_WORK_RULE,
        evidence_status:'NOT_EVIDENCE',decision_authority:'NONE',scope:'simulation-only',validity:invalid.length?'INVALID_SIMULATION':'VALID',checks,rejected_actions:rejections,
        metrics:{required_tasks:tasks.length,completed_tasks:count('completed'),queued_tasks:count('queued'),active_tasks:count('active'),not_reached_tasks:count('not_reached'),
          unfinished_tasks:unfinished.length,oldest_unfinished_task_age_min:unfinished.length?Math.max(...unfinished.map(t=>horizon-t.created_minute)):null,
          queue_observed_min:queueMinutes,active_observed_min:activeMinutes,onsite_observed_min:onsiteMinutes,blocked_minutes:blockedMinutes,
          completed_visit_mean_onsite_min:metrics.avg_depot_onsite_min,completed_visit_mean_active_min:metrics.avg_active_service_min,
          completed_visit_mean_queue_min:completed.length?completed.reduce((s,v)=>s+v.completed_minute-v.arrived_minute-v.active_service_min,0)/completed.length:null,
          ready_by_deadline:completed.filter(v=>v.completed_minute<=v.readiness_deadline_minute).length,deadline_visits:visits.length,
          unfinished_visits:metrics.censored_visits,inbound_visits:visits.filter(v=>v.arrived_minute===null).length,max_task_queue_min:observedQueue?maxWait:null},
        limitations:['One seed is descriptive; no statistical confidence or operational recommendation. Synthetic fictional resources, one qualified cleaning pool per site, serial work, no worker shifts or parallel scheduler.',
          'Every visit requires cleaning, charging to target and upload; software only on scheduled visits. No optional task cancellation or removal of mandatory work. Required work depends on stable vehicle visit ordinal, never scheduling random draws.',
          'All started visits are assigned the observation-end readiness deadline. This is a depot-visit cohort, not distinct vehicles or a pickup SLA. Unfinished tasks include inbound and not-yet-reached work; age starts at visit creation.',
          'Observed queue and active minutes include unfinished on-site visits. Exclusive blocker categories count queued task-minutes, with a separate category when both bay and worker are unavailable. Completed-only means exclude unfinished visits.']};
    },
  };
}

/** Compare only this producer/population; the regional inferential instrument is intentionally unused. */
export function compareReadinessRuns(a,b,axis){
  const reject=reason=>({comparable:false,reason,deltas:null});
  if(!['cleaning_workers','cleaning_bays'].includes(axis))return reject('Unsupported treatment.');
  if(a.version!==`fleetlab-bay-operations-1.0.0+${READINESS_VERSION}`||a.version!==b.version||
    a.readiness?.metric_version!==READINESS_METRICS_VERSION||b.readiness?.metric_version!==READINESS_METRICS_VERSION||
    a.readiness.required_work_rule!==REQUIRED_WORK_RULE||b.readiness.required_work_rule!==REQUIRED_WORK_RULE)return reject('Model, metric or required-work rule mismatch.');
  if(a.readiness.validity!=='VALID'||b.readiness.validity!=='VALID')return reject('Invalid simulator state.');
  const left=structuredClone(a.config),right=structuredClone(b.config);
  if(axis==='cleaning_workers')right.readiness.cleaning_workers=left.readiness.cleaning_workers;else right.cleaning_bays=left.cleaning_bays;
  if(JSON.stringify(left)!==JSON.stringify(right))return reject('Non-treatment settings differ.');
  const external=r=>r.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]);
  if(JSON.stringify(external(a))!==JSON.stringify(external(b)))return reject('External demand differs.');
  const keys=['completed_trips','unserved_requests','pending_requests','in_progress_trips','censored_visits','final_energy_kwh'];
  if(keys.some(k=>!Number.isFinite(a.metrics[k])||!Number.isFinite(b.metrics[k])))return reject('Required service measurements unavailable.');
  return {comparable:true,reason:null,deltas:Object.fromEntries(keys.map(k=>[k,b.metrics[k]-a.metrics[k]]))};
}
