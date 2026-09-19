/** Local, synthetic minute-resolution teaching model. No driving or gate logic. */
export const OPERATIONS_VERSION = 'fleetlab-operations-1.0.0';
export const OPERATIONS_STATES = Object.freeze({
  available: 'Available', pickup: 'Driving to pickup', passenger_trip: 'Passenger trip',
  drive_to_depot: 'Driving to depot', queued_software: 'Waiting for software bay',
  software: 'Software update', queued_cleaning: 'Waiting for cleaning bay', cleaning: 'Cleaning',
  queued_charging: 'Waiting for charger', charging: 'Charging', queued_upload: 'Waiting for upload bay',
  upload: 'Uploading trip data', ready: 'Ready to return',
});

/** Counts/power are per depot. Durations are minutes, energy kWh and power kW. */
export function defaultOperationsConfig() {
  return {
    fleet_size:24, depot_count:2, requests_per_hour:30, start_hour:7, duration_hours:8,
    weather:'clear', traffic_multiplier:1, seed:42, trip_minutes:18, pickup_minutes:5, patience_minutes:12,
    trips_between_visits:3, cleaning_minutes:8, software_minutes:12, upload_minutes:6,
    software_every_visits:2, cleaning_bays:2, software_bays:1, upload_bays:2, chargers:4,
    charger_kw:50, site_power_kw:120, battery_kwh:64, initial_soc_pct:65,
    charge_target_pct:85, reserve_soc_pct:15, energy_kwh_per_minute:0.32, peak_multiplier:1.6,
  };
}

export function validateOperationsConfig(config) {
  if (!config || typeof config!=='object' || Array.isArray(config)) return ['Configuration must be an object.'];
  const errors=[];
  const range=(key,min,max,integer=false)=>{
    const v=config[key];
    if (!Number.isFinite(v) || v<min || v>max || (integer&&!Number.isInteger(v))) {
      errors.push(`${key} must be ${integer?'an integer':'a finite number'} between ${min} and ${max}.`);
    }
  };
  range('fleet_size',1,120,true); range('depot_count',1,6,true);
  range('requests_per_hour',0,240); range('start_hour',0,23.999999); range('duration_hours',1/60,24);
  range('seed',0,4294967295,true);
  for(const key of ['trips_between_visits','software_every_visits']) range(key,1,100,true);
  for(const key of ['cleaning_bays','software_bays','upload_bays','chargers']) range(key,1,120,true);
  for(const key of ['trip_minutes','pickup_minutes','patience_minutes','cleaning_minutes','software_minutes','upload_minutes']) range(key,0.01,240);
  for(const key of ['charger_kw','site_power_kw']) range(key,0.01,10000);
  range('battery_kwh',0.01,1000); range('energy_kwh_per_minute',0.0001,10);
  range('initial_soc_pct',0,100); range('charge_target_pct',0,100); range('reserve_soc_pct',0,99);
  range('peak_multiplier',1,4); range('traffic_multiplier',0.5,3);
  if(!(config.reserve_soc_pct<config.initial_soc_pct && config.initial_soc_pct<=config.charge_target_pct)) {
    errors.push('SOC thresholds must satisfy reserve < initial <= charge target <= 100.');
  }
  if(!['clear','rain','heat'].includes(config.weather)) errors.push('weather must be clear, rain, or heat.');
  return errors;
}

const STAGES=['software','cleaning','charging','upload'];
const MOVING=new Set(['pickup','passenger_trip','drive_to_depot']);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const weatherEffects=weather=>({clear:{travel:1,energy:1,demand:1},rain:{travel:1.3,energy:1.12,demand:1.12},heat:{travel:1.05,energy:1.25,demand:1.05}}[weather]);
function isRushHour(clockMinute) {
  const hour=(clockMinute%1440)/60;
  return (hour>=7&&hour<10)||(hour>=16&&hour<19);
}
function trafficAt(c,minute) {
  return c.traffic_multiplier*(isRushHour(Math.round(c.start_hour*60)+minute)?1.25:1);
}
function random(seed) {
  let value=seed>>>0;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}
function makeLocations(depotCount) {
  const districts=Array.from({length:9},(_,i)=>({id:`district-${i+1}`,label:`District ${i+1}`,x:20+(i%3)*30,y:20+Math.floor(i/3)*30,kind:'district'}));
  const positions=[[8,50],[92,50],[50,8],[50,92],[8,8],[92,92]];
  return [...districts,...positions.slice(0,depotCount).map(([x,y],i)=>({id:`depot-${i+1}`,label:`Depot ${i+1}`,x,y,kind:'depot'}))];
}

// All demand/travel draws depend only on seed, request id, weather and clock.
// Fleet/depot counts never advance these random streams.
function makeDemand(c) {
  const rng=random(c.seed), effect=weatherEffects(c.weather), requests=[];
  const horizon=Math.ceil(c.duration_hours*60), start=Math.round(c.start_hour*60);
  for(let minute=0;minute<horizon;minute++) {
    const peak=isRushHour(start+minute), traffic=trafficAt(c,minute);
    const rate=c.requests_per_hour/60*(peak?c.peak_multiplier:1)*effect.demand;
    const count=Math.floor(rate)+(rng()<rate%1?1:0);
    for(let j=0;j<count;j++) {
      const index=requests.length, travel=random((c.seed^Math.imul(index+1,2654435761))>>>0);
      const pickup=Math.floor(travel()*9), offset=1+Math.floor(travel()*8);
      requests.push({
        id:`request-${index+1}`,created_minute:minute,pickup_node:`district-${pickup+1}`,
        dropoff_node:`district-${(pickup+offset)%9+1}`,
        pickup_minutes:Math.max(1,Math.ceil(c.pickup_minutes*(0.8+travel()*0.4)*effect.travel*traffic)),
        trip_minutes:Math.max(1,Math.ceil(c.trip_minutes*(0.8+travel()*0.4)*effect.travel*traffic)),
        traffic_multiplier:traffic,status:'waiting',vehicle_id:null,assigned_minute:null,picked_up_minute:null,completed_minute:null,
      });
    }
  }
  return requests;
}
function demandSignature(requests) {
  let h=2166136261;
  for(const r of requests) {
    const text=`${r.id}|${r.created_minute}|${r.pickup_node}|${r.dropoff_node}|${r.pickup_minutes}|${r.trip_minutes};`;
    for(let i=0;i<text.length;i++) h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;
  }
  return h.toString(16).padStart(8,'0');
}

export function simulateOperations(config, {capture=true}={}) {
  const errors=validateOperationsConfig(config);
  if(errors.length) throw new RangeError(errors.join(' '));
  return simulate({...config},makeDemand(config),capture);
}

function simulate(c, demand, capture) {
  const requests=demand.map(r=>({...r})), locations=makeLocations(c.depot_count);
  const byNode=new Map(locations.map(n=>[n.id,n])), byRequest=new Map(requests.map(r=>[r.id,r]));
  const depots=locations.filter(n=>n.kind==='depot').map(n=>({...n,queues:Object.fromEntries(STAGES.map(s=>[s,[]]))}));
  const byDepot=new Map(depots.map(d=>[d.id,d]));
  const vehicles=Array.from({length:c.fleet_size},(_,i)=>({id:`car-${i+1}`,state:'available',node:`district-${i%9+1}`,from:null,to:null,progress:0,soc_kwh:c.battery_kwh*c.initial_soc_pct/100,depot_id:null,request_id:null,remaining_min:0,total_min:0,trips_since_visit:0,visit_count:0,visit:null}));
  const frames=[], events=[], visits=[], waiting=[];
  const horizon=Math.ceil(c.duration_hours*60), start=Math.round(c.start_hour*60);
  const effect=weatherEffects(c.weather), energyRate=c.energy_kwh_per_minute*effect.energy;
  const reserve=c.battery_kwh*c.reserve_soc_pct/100, target=c.battery_kwh*c.charge_target_pct/100;
  let nextRequest=0, energyDelivered=0, energyConsumed=0, maxQueue=0;
  const energyBlocked=new Set();
  const log=(minute,v,kind,detail)=>{if(capture) events.push({minute,vehicle_id:v?.id??null,kind,detail});};
  const nearest=node=>{
    const p=byNode.get(node);
    return depots.reduce((best,d)=>Math.hypot(p.x-d.x,p.y-d.y)<Math.hypot(p.x-best.x,p.y-best.y)?d:best,depots[0]);
  };
  const depotTravel=(node,depot,minute=null)=>{
    const p=byNode.get(node);
    const traffic=minute===null?c.traffic_multiplier*1.25:trafficAt(c,minute);
    return Math.max(1,Math.ceil(c.pickup_minutes*effect.travel*traffic*(0.5+Math.hypot(p.x-depot.x,p.y-depot.y)/100)));
  };
  // Cache fixed request return costs once; capacity extremes must remain usable.
  const requiredEnergy=new Map(requests.map(r=>[r.id,
    (r.pickup_minutes+r.trip_minutes+depotTravel(r.dropoff_node,nearest(r.dropoff_node)))*energyRate+reserve]));
  function move(v,state,to,duration,minute) {
    v.state=state;v.from=v.node;v.to=to;v.progress=0;v.remaining_min=duration;v.total_min=duration;
    log(minute,v,state,`${OPERATIONS_STATES[state]}: ${v.from} → ${to}; ${duration} min.`);
  }
  function queue(v,stage,minute) {
    v.state=`queued_${stage}`;v.remaining_min=0;
    const record={stage,queued_minute:minute,started_minute:null,completed_minute:null,active_minutes:0,energy_delivered_kwh:0};
    v.visit.stages.push(record);
    byDepot.get(v.depot_id).queues[stage].push(v);
    log(minute,v,v.state,`Waiting for ${stage} at ${v.depot_id}.`);
  }
  function startVisit(v,minute) {
    const depot=nearest(v.node), duration=depotTravel(v.node,depot,minute);
    if(v.soc_kwh+1e-9<duration*energyRate+reserve) {energyBlocked.add(v.id);return false;}
    v.depot_id=depot.id;v.visit_count++;
    v.visit={id:`${v.id}-visit-${v.visit_count}`,vehicle_id:v.id,depot_id:depot.id,started_minute:minute,arrived_minute:null,completed_minute:null,software_scheduled:v.visit_count%c.software_every_visits===0,stages:[],active_service_min:0};
    visits.push(v.visit);
    move(v,'drive_to_depot',depot.id,duration,minute);
    return true;
  }
  function finishStage(v,minute) {
    const stage=v.state, record=v.visit.stages.at(-1);
    record.completed_minute=minute;
    log(minute,v,`${stage}_completed`,`${OPERATIONS_STATES[stage]} finished.`);
    if(stage==='upload') {
      v.visit.completed_minute=minute;v.trips_since_visit=0;v.state='ready';v.remaining_min=1;
      log(minute,v,'ready',`Depot visit complete in ${minute-v.visit.started_minute} min.`);
    } else queue(v,STAGES[STAGES.indexOf(stage)+1],minute);
  }
  for(let minute=0;minute<=horizon;minute++) {
    // Complete intervals before assigning work at this same clock minute.
    for(const v of vehicles) {
      if(v.state==='ready'&&v.remaining_min<=0) {v.state='available';v.depot_id=null;v.visit=null;}
      if(MOVING.has(v.state)&&v.remaining_min<=0) {
        v.node=v.to;v.from=null;v.to=null;v.progress=0;
        if(v.state==='pickup') {
          const r=byRequest.get(v.request_id);r.picked_up_minute=minute;r.status='in_progress';
          move(v,'passenger_trip',r.dropoff_node,r.trip_minutes,minute);
        } else if(v.state==='passenger_trip') {
          const r=byRequest.get(v.request_id);r.status='completed';r.completed_minute=minute;
          log(minute,v,'trip_completed',`${r.id} completed.`);
          v.request_id=null;v.trips_since_visit++;v.state='available';
          if(minute<horizon&&(v.trips_since_visit>=c.trips_between_visits||v.soc_kwh<=reserve)) startVisit(v,minute);
        } else {
          v.visit.arrived_minute=minute;
          queue(v,v.visit.software_scheduled?'software':'cleaning',minute);
        }
      }
      if(STAGES.includes(v.state) && (v.state==='charging'?v.soc_kwh>=target-1e-9:v.remaining_min<=0)) finishStage(v,minute);
    }
    // Add only demand that actually arrived; future requests are never dispatched.
    while(nextRequest<requests.length&&requests[nextRequest].created_minute<=minute) waiting.push(requests[nextRequest++]);
    for(let i=waiting.length-1;i>=0;i--) {
      const r=waiting[i];
      if(minute-r.created_minute>=Math.ceil(c.patience_minutes)) {
        r.status='unserved';waiting.splice(i,1);
        log(minute,null,'request_unserved',`${r.id} exceeded pickup-assignment patience.`);
      }
    }
    // FIFO request assignment, stable vehicle order, and a return-energy reservation.
    // Do not launch new work at the terminal observation (zero interval remains).
    const minimumWaitingEnergy=waiting.reduce((minimum,r)=>Math.min(minimum,requiredEnergy.get(r.id)),Infinity);
    if(minute<horizon) for(const v of vehicles) {
      if(v.state!=='available') continue;
      let assigned=false;
      for(let i=0;v.soc_kwh+1e-9>=minimumWaitingEnergy&&i<waiting.length;i++) {
        const r=waiting[i], needed=requiredEnergy.get(r.id);
        if(v.soc_kwh+1e-9<needed) continue;
        waiting.splice(i,1);r.status='pickup';r.vehicle_id=v.id;r.assigned_minute=minute;
        v.request_id=r.id;move(v,'pickup',r.pickup_node,r.pickup_minutes,minute);assigned=true;break;
      }
      if(!assigned && waiting.length) {
        energyBlocked.add(v.id);
        // Charging cannot make an intrinsically infeasible trip feasible: avoid
        // repeated empty depot visits when target SOC already cannot cover it.
        if(v.soc_kwh<target-1e-9) startVisit(v,minute);
      }
    }
    // Each stage has a finite FIFO server pool; no vehicle owns two resources.
    for(const depot of depots) for(const stage of STAGES) {
      const capacity=c[stage==='charging'?'chargers':`${stage}_bays`];
      let active=vehicles.filter(v=>v.depot_id===depot.id&&v.state===stage).length;
      while(minute<horizon && active<capacity && depot.queues[stage].length) {
        const v=depot.queues[stage].shift(), record=v.visit.stages.at(-1);
        v.state=stage;record.started_minute=minute;
        v.remaining_min=stage==='charging'?Math.ceil(Math.max(0,target-v.soc_kwh)/(Math.min(c.charger_kw,c.site_power_kw)/60)):Math.ceil(c[`${stage}_minutes`]);
        log(minute,v,stage,`${OPERATIONS_STATES[stage]} started at ${depot.id}.`);
        active++;
      }
    }
    const depotQueues=depots.map(d=>{
      const active=Object.fromEntries(STAGES.map(s=>[s,vehicles.filter(v=>v.depot_id===d.id&&v.state===s).length]));
      const chargingKw=minute===horizon?0:vehicles.filter(v=>v.depot_id===d.id&&v.state==='charging')
        .reduce((sum,v)=>sum+Math.min(c.charger_kw,c.site_power_kw/active.charging,Math.max(0,target-v.soc_kwh)*60),0);
      return {depot_id:d.id,...Object.fromEntries(STAGES.map(s=>[s,d.queues[s].length])),active,charging_kw:chargingKw};
    });
    maxQueue=Math.max(maxQueue,...depotQueues.flatMap(d=>STAGES.map(s=>d[s])));
    // Charging remaining_min is an estimate at this minute's equal site share.
    for(const d of depotQueues) for(const v of vehicles) if(v.depot_id===d.depot_id&&v.state==='charging') {
      v.remaining_min=Math.ceil(Math.max(0,target-v.soc_kwh)/(Math.min(c.charger_kw,c.site_power_kw/d.active.charging)/60));
    }
    if(capture) frames.push({minute,clock_minute:(start+minute)%1440,traffic_multiplier:trafficAt(c,minute),
      vehicles:vehicles.map(({id,state,node,from,to,progress,soc_kwh,depot_id,request_id,remaining_min})=>({id,state,node,from,to,progress,soc_kwh,depot_id,request_id,remaining_min})),
      counts:Object.fromEntries(Object.keys(OPERATIONS_STATES).map(s=>[s,vehicles.filter(v=>v.state===s).length])),depot_queues:depotQueues});
    if(minute===horizon) break;
    for(const v of vehicles) {
      if(MOVING.has(v.state)) {
        v.soc_kwh-=energyRate;energyConsumed+=energyRate;
        v.remaining_min--;v.progress=1-v.remaining_min/v.total_min;
      } else if(v.state==='ready') v.remaining_min--;
      else if(STAGES.includes(v.state)) {
        const record=v.visit.stages.at(-1);record.active_minutes++;v.visit.active_service_min++;
        if(v.state==='charging') {
          const active=depotQueues.find(d=>d.depot_id===v.depot_id).active.charging;
          const delivered=Math.min(Math.max(0,target-v.soc_kwh),c.charger_kw/60,c.site_power_kw/active/60);
          v.soc_kwh+=delivered;energyDelivered+=delivered;record.energy_delivered_kwh+=delivered;
        } else v.remaining_min--;
      }
    }
  }
  const complete=requests.filter(r=>r.status==='completed'), completeVisits=visits.filter(v=>v.completed_minute!==null);
  const initialEnergy=c.fleet_size*c.battery_kwh*c.initial_soc_pct/100;
  const finalEnergy=vehicles.reduce((sum,v)=>sum+v.soc_kwh,0);
  const metrics={
    fleet_size:c.fleet_size,depot_count:c.depot_count,total_requests:requests.length,completed_trips:complete.length,
    unserved_requests:requests.filter(r=>r.status==='unserved').length,pending_requests:requests.filter(r=>r.status==='waiting').length,
    in_progress_trips:requests.filter(r=>['pickup','in_progress'].includes(r.status)).length,trips_per_vehicle:complete.length/c.fleet_size,
    avg_wait_min_completed:mean(complete.map(r=>r.picked_up_minute-r.created_minute)),
    avg_depot_turnaround_min:mean(completeVisits.map(v=>v.completed_minute-v.started_minute)),
    avg_depot_onsite_min:mean(completeVisits.map(v=>v.completed_minute-v.arrived_minute)),
    avg_active_service_min:mean(completeVisits.map(v=>v.active_service_min)),
    censored_visits:visits.length-completeVisits.length,completed_visits:completeVisits.length,max_queue:maxQueue,
    energy_delivered_kwh:energyDelivered,energy_consumed_kwh:energyConsumed,initial_energy_kwh:initialEnergy,final_energy_kwh:finalEnergy,
    energy_balance_error_kwh:initialEnergy+energyDelivered-energyConsumed-finalEnergy,
    energy_blocked_vehicle_count:energyBlocked.size,
    service_breakdown:Object.fromEntries(STAGES.map(stage=>{
      const records=completeVisits.flatMap(v=>v.stages.filter(s=>s.stage===stage));
      return [stage,{completed_count:records.length,avg_active_min:mean(records.map(s=>s.active_minutes)),avg_queue_min:mean(records.map(s=>s.started_minute-s.queued_minute))}];
    })),
  };
  return {version:OPERATIONS_VERSION,config:c,locations,frames,events,requests,visits,metrics,demand_signature:demandSignature(requests),assumptions:[
    'Synthetic teaching simulation only: invented geography, demand, weather effects, energy and service durations; not calibrated fleet or road evidence.',
    'One-minute intervals; durations and horizon round up, start clock rounds to the nearest minute and wraps after midnight. The final frame performs completions but starts no new assignments or service.',
    'Demand has morning 07:00–10:00 and evening 16:00–19:00 peaks. Rain multiplies travel by 1.30, energy by 1.12 and demand by 1.12; heat uses 1.05, 1.25 and 1.05.',
    'Request-keyed pickup/trip durations vary ±20% before weather, traffic and rounding; pickup time does not use vehicle distance. Synthetic rush-hour congestion multiplies travel by 1.25 during 07:00–10:00 and 16:00–19:00, in addition to the traffic multiplier control. Request travel uses its creation clock; depot travel uses departure clock and invented geometry. FIFO assignment uses stable vehicle order.',
    'Patience measures waiting for assignment; completed wait includes pickup travel. Assignment reserves energy for pickup, passenger travel, a worst-rush-hour depot return and reserve SOC. A depot leg also requires enough energy to preserve reserve SOC. Energy-infeasible demand can remain waiting or expire.',
    'Visits run scheduled software → cleaning → charging → upload. Software is due every configured visit count. Bays are finite; active chargers equally share per-depot site power, capped by charger kW. No taper, standby energy, thermal or battery degradation model.',
    'Fixed cleaning/software/upload durations. Charging time follows energy and allocated power. Active charging remaining time is an estimate at the current site share. Completed turnaround includes depot travel, queues and service; on-site time excludes return travel but includes queues; active service excludes travel and queues.',
    'Maximum queue is the largest single stage queue at one depot after resource assignment. Energy-blocked vehicle count is cumulative unique vehicles unable to accept waiting demand on at least one minute.',
    'Means use completed trips or completed visits only; absent means are null. Unfinished requests and censored visits remain explicit; no completion or turnaround is imputed past the horizon.',
  ]};
}

export function analyzeOperationsCapacity(config) {
  const errors=validateOperationsConfig(config);
  if(errors.length) throw new RangeError(errors.join(' '));
  const demand=makeDemand(config), signature=demandSignature(demand);
  const fleetCounts=[...new Set([Math.max(1,Math.floor(config.fleet_size/2)),config.fleet_size,Math.min(120,Math.ceil(config.fleet_size*1.5)),Math.min(120,config.fleet_size*2)])].sort((a,b)=>a-b);
  const trial=(fleet_size,depot_count)=>{
    const result=simulate({...config,fleet_size,depot_count},demand,false);
    return {fleet_size,depot_count,metrics:result.metrics,completion_fraction:result.metrics.total_requests?result.metrics.completed_trips/result.metrics.total_requests:null,demand_signature:signature};
  };
  const fleet_trials=fleetCounts.map(n=>trial(n,config.depot_count));
  const depot_trials=Array.from({length:6},(_,i)=>trial(config.fleet_size,i+1));
  return {target_completion_fraction:0.95,fleet_trials,depot_trials,min_depots:depot_trials.find(t=>t.completion_fraction!==null&&t.completion_fraction>=0.95)?.depot_count??null,
    assumptions:['All trials reuse the exact generated demand and request-keyed travel inputs. Fleet trials keep depot count fixed; depot trials keep fleet size fixed.',
      'Completion fraction is completed trips / all requests arriving before the horizon; late arrivals and unfinished trips stay in the denominator. Zero demand yields null.',
      'The first tested depot count reaching 95% is a tested scenario requirement, not a global optimum. More depots also add bays, chargers and site power. No monotonic improvement is guaranteed.']};
}
