/** Route-driven operational teaching model. OSM geometry is not navigation permission. */
import {defaultOperationsConfig,validateOperationsConfig,OPERATIONS_STATES} from './operations.js';
import {BAY_AREA_PLACES,bayAreaRoute} from './bay-area.js';
import {createReadiness,validateReadiness,READINESS_VERSION,defaultReadiness,compareReadinessRuns} from './depot-readiness.js';
import {VEHICLE_PROFILES,defaultVehicleProfiles} from './vehicle-profiles.js';
export const BAY_OPERATIONS_VERSION='fleetlab-bay-operations-1.0.0';
export const BAY_OPERATIONS_STATES=Object.freeze({...OPERATIONS_STATES,boarding:'Rider boarding'});
export function defaultBayAreaConfig() {
  return {...defaultOperationsConfig(),place_ids:BAY_AREA_PLACES.map(p=>p.id),ojai_share_pct:50,road_speed_kph:38,vehicle_profiles:defaultVehicleProfiles()};
}
export function validateBayAreaConfig(c) {
  const errors=validateOperationsConfig(c);
  if(!c||typeof c!=='object'||Array.isArray(c))return errors;
  const known=new Set(BAY_AREA_PLACES.map(p=>p.id));
  if(!Array.isArray(c.place_ids)||c.place_ids.length<2||new Set(c.place_ids).size!==c.place_ids.length||c.place_ids.some(id=>!known.has(id)))errors.push('Select at least two distinct known Bay Area places.');
  if(!Number.isFinite(c.ojai_share_pct)||c.ojai_share_pct<0||c.ojai_share_pct>100)errors.push('ojai_share_pct must be between 0 and 100.');
  if(!Number.isFinite(c.road_speed_kph)||c.road_speed_kph<5||c.road_speed_kph>100)errors.push('road_speed_kph must be between 5 and 100.');
  const profileBounds={battery_kwh:[1,300],charge_limit_kw:[1,500],energy_kwh_per_km:[0.01,3],boarding_minutes:[0,30],cleaning_multiplier:[0.1,10],software_multiplier:[0.1,10],upload_multiplier:[0.1,10]};
  if(!c.vehicle_profiles||typeof c.vehicle_profiles!=='object'||Array.isArray(c.vehicle_profiles))errors.push('vehicle_profiles must contain ipace and ojai parameter objects.');
  else {
    if(Object.keys(c.vehicle_profiles).some(key=>!['ipace','ojai'].includes(key)))errors.push('Unknown vehicle profile type.');
    for(const type of ['ipace','ojai']) {
      const p=c.vehicle_profiles[type];
      if(!p||typeof p!=='object'||Array.isArray(p)){errors.push(`Missing ${type} vehicle profile.`);continue;}
      if(Object.keys(p).some(key=>!(key in profileBounds)))errors.push(`Unknown ${type} profile parameter.`);
      for(const [key,[min,max]] of Object.entries(profileBounds))if(!Number.isFinite(p[key])||p[key]<min||p[key]>max)errors.push(`${type}.${key} must be finite between ${min} and ${max}.`);
    }
  }
  if(Object.hasOwn(c,'readiness'))errors.push(...validateReadiness(c.readiness));
  return errors;
}
const STAGES=['software','cleaning','charging','upload'];
const MOVING=new Set(['pickup','passenger_trip','drive_to_depot']);
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const effectFor=w=>({clear:{travel:1,energy:1,demand:1},rain:{travel:1.3,energy:1.12,demand:1.12},heat:{travel:1.05,energy:1.25,demand:1.05}}[w]);
const rush=clock=>{const h=(clock%1440)/60;return (h>=7&&h<10)||(h>=16&&h<19);};
const traffic=(c,t)=>c.traffic_multiplier*(rush(Math.round(c.start_hour*60)+t)?1.25:1);
function random(seed){let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
function prepare(c) {
  const places=BAY_AREA_PLACES.filter(p=>c.place_ids.includes(p.id)),routes={};
  for(const from of places)for(const to of places){const r=bayAreaRoute(from.id,to.id);if(!r.available)throw new RangeError(`No road route available: ${from.id} to ${to.id}`);routes[r.id]=r;}
  return {places,routes};
}
const routeKey=(a,b)=>`bay-area:${a}->${b}`;
function makeDemand(c,network) {
  const {places,routes}=network,rng=random(c.seed),effect=effectFor(c.weather),requests=[];
  const destinations=new Map(places.map(from=>[from.id,places.filter(p=>p.id!==from.id).map(to=>({id:to.id,weight:1/(2+routes[routeKey(from.id,to.id)].distance_km)**1.5}))]));
  for(let minute=0;minute<Math.ceil(c.duration_hours*60);minute++) {
    const rate=c.requests_per_hour/60*(rush(Math.round(c.start_hour*60)+minute)?c.peak_multiplier:1)*effect.demand;
    const count=Math.floor(rate)+(rng()<rate%1?1:0);
    for(let i=0;i<count;i++) {
      const id=`request-${requests.length+1}`,choice=random((c.seed^Math.imul(requests.length+1,2654435761))>>>0);
      const from=places[Math.floor(choice()*places.length)],options=destinations.get(from.id);
      let cursor=choice()*options.reduce((sum,p)=>sum+p.weight,0),to=options.at(-1).id;
      for(const option of options){cursor-=option.weight;if(cursor<=0){to=option.id;break;}}
      const route=routes[routeKey(from.id,to)];
      requests.push({id,created_minute:minute,pickup_node:from.id,dropoff_node:to,trip_route_id:route.id,trip_distance_km:route.distance_km,
        status:'waiting',vehicle_id:null,vehicle_type:null,assigned_minute:null,picked_up_minute:null,departed_minute:null,completed_minute:null,
        pickup_distance_km:null,pickup_drive_min:null,boarding_min:null,passenger_drive_min:null,trip_minutes:null});
    }
  }
  return requests;
}
function signature(requests){let h=2166136261;for(const r of requests){const s=`${r.id}|${r.created_minute}|${r.pickup_node}|${r.dropoff_node}|${r.trip_distance_km};`;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;}return h.toString(16).padStart(8,'0');}
function checkedConfig(config){const errors=validateBayAreaConfig(config);if(errors.length)throw new RangeError(errors.join(' '));return structuredClone(config);}
export function simulateBayAreaOperations(config,{capture=true}={}){const c=checkedConfig(config),network=prepare(c);return simulate(c,makeDemand(c,network),network,capture);}

function simulate(c,demand,network,capture) {
  const readiness=c.readiness?createReadiness(c):null;
  const requests=demand.map(r=>({...r})),byRequest=new Map(requests.map(r=>[r.id,r]));
  const placeLocations=network.places.map(p=>({...p,road_anchor:{...p.road_anchor}}));
  const ordered=[...placeLocations].sort((a,b)=>b.y-a.y||a.x-b.x);
  const depots=Array.from({length:c.depot_count},(_,i)=>{const p=ordered[Math.floor(i*ordered.length/c.depot_count)];return {id:`depot-${i+1}`,label:`Illustrative depot ${i+1} · ${p.label}`,kind:'depot',place_id:p.id,x:p.road_anchor.x,y:p.road_anchor.y,queues:Object.fromEntries(STAGES.map(s=>[s,[]]))};});
  const locations=[...placeLocations,...depots.map(({queues,...d})=>d)],byDepot=new Map(depots.map(d=>[d.id,d]));
  const ojaiCount=Math.round(c.fleet_size*c.ojai_share_pct/100);
  const vehicles=Array.from({length:c.fleet_size},(_,i)=>{const type=i<ojaiCount?'ojai':'ipace',p=c.vehicle_profiles[type];return {
    id:`car-${i+1}`,vehicle_type:type,battery_kwh:p.battery_kwh,profile:p,state:'available',node:placeLocations[i%placeLocations.length].id,place_id:placeLocations[i%placeLocations.length].id,
    from:null,to:null,route_id:null,progress:0,soc_kwh:p.battery_kwh*c.initial_soc_pct/100,depot_id:null,request_id:null,remaining_min:0,total_min:0,leg_energy:0,leg_distance:0,
    visit_count:0,trips_since_visit:0,visit:null,energy_consumed:0,energy_delivered:0,distance:0,completed_trips:0};});
  const frames=[],events=[],visits=[],waiting=[],routes={};
  const horizon=Math.ceil(c.duration_hours*60),start=Math.round(c.start_hour*60),effect=effectFor(c.weather);
  const nearestByPlace=new Map(placeLocations.map(p=>{
    const minimum=Math.min(...depots.map(d=>network.routes[routeKey(p.id,d.place_id)].distance_km));
    return [p.id,depots.filter(d=>network.routes[routeKey(p.id,d.place_id)].distance_km===minimum)];
  }));
  let nextRequest=0,maxQueue=0;const blocked=new Set();
  const reserve=v=>v.battery_kwh*c.reserve_soc_pct/100,target=v=>v.battery_kwh*c.charge_target_pct/100;
  const log=(t,v,kind,detail)=>{if(capture)events.push({minute:t,vehicle_id:v?.id??null,kind,detail});};
  const route=(from,to)=>network.routes[routeKey(from,to)];
  function move(v,state,toNode,toPlace,t) {
    const leg=route(v.place_id,toPlace);routes[leg.id]=leg;
    const duration=leg.distance_km===0?0:Math.ceil(leg.distance_km/c.road_speed_kph*60*traffic(c,t)*effect.travel);
    v.state=state;v.from=v.node;v.to=toNode;v.to_place=toPlace;v.route_id=leg.id;v.remaining_min=duration;v.total_min=duration;v.progress=0;
    v.leg_distance=leg.distance_km;v.leg_energy=leg.distance_km*v.profile.energy_kwh_per_km*effect.energy;
    log(t,v,state,`${BAY_OPERATIONS_STATES[state]} · ${leg.distance_km.toFixed(2)} km · ${duration} min; OSM teaching route.`);
    return duration;
  }
  function queue(v,stage,t) {
    v.state=`queued_${stage}`;v.remaining_min=0;
    v.visit.stages.push({stage,queued_minute:t,started_minute:null,completed_minute:null,active_minutes:0,energy_delivered_kwh:0});
    readiness?.queued(v,t);
    byDepot.get(v.depot_id).queues[stage].push(v);log(t,v,v.state,`Waiting for ${stage} at ${v.depot_id}.`);
  }
  function startVisit(v,t) {
    // Include inbound and on-site unfinished visits so the first arriving car
    // immediately reserves a share of co-located capacity for subsequent choices.
    const candidates=nearestByPlace.get(v.place_id);
    const load=d=>vehicles.filter(car=>car.depot_id===d.id&&car.visit?.completed_minute===null).length;
    const d=candidates.reduce((best,site)=>load(site)<load(best)?site:best,candidates[0]);
    const needed=route(v.place_id,d.place_id).distance_km*v.profile.energy_kwh_per_km*effect.energy+reserve(v);
    if(v.soc_kwh+1e-8<needed){blocked.add(v.id);return false;}
    v.depot_id=d.id;v.visit_count++;
    v.visit={id:`${v.id}-visit-${v.visit_count}`,vehicle_id:v.id,vehicle_type:v.vehicle_type,depot_id:d.id,started_minute:t,arrived_minute:null,completed_minute:null,software_scheduled:v.visit_count%c.software_every_visits===0,stages:[],active_service_min:0};
    readiness?.begin(v,t);
    visits.push(v.visit);move(v,'drive_to_depot',d.id,d.place_id,t);return true;
  }
  function finishStage(v,t) {
    readiness?.finished(v,t);
    const stage=v.state;v.visit.stages.at(-1).completed_minute=t;log(t,v,`${stage}_completed`,`${BAY_OPERATIONS_STATES[stage]} finished.`);
    if(stage==='upload'){readiness?.release(v);v.visit.completed_minute=t;v.state='ready';v.remaining_min=1;v.trips_since_visit=0;log(t,v,'ready','Depot visit complete.');}
    else queue(v,STAGES[STAGES.indexOf(stage)+1],t);
  }
  function settle(v,t) {
    // Only zero-duration transitions repeat. Each transition advances a finite lifecycle.
    for(let transitions=0;transitions<8;transitions++) {
      if(v.state==='ready'&&v.remaining_min<=0){v.state='available';v.depot_id=null;v.visit=null;continue;}
      if(MOVING.has(v.state)&&v.remaining_min<=0) {
        const state=v.state;v.node=v.to;v.place_id=v.to_place;v.from=null;v.to=null;v.route_id=null;v.progress=0;
        if(state==='pickup') {
          const q=byRequest.get(v.request_id);q.picked_up_minute=t;q.status='boarding';q.boarding_min=Math.ceil(v.profile.boarding_minutes);
          v.state='boarding';v.remaining_min=q.boarding_min;log(t,v,'boarding',`Rider boarding: ${q.boarding_min} min.`);
        } else if(state==='passenger_trip') {
          const q=byRequest.get(v.request_id);q.status='completed';q.completed_minute=t;v.completed_trips++;v.trips_since_visit++;v.request_id=null;v.state='available';
          log(t,v,'trip_completed',`${q.id} completed.`);
          if(t<horizon&&(v.trips_since_visit>=c.trips_between_visits||v.soc_kwh<=reserve(v)))startVisit(v,t);
        } else {v.visit.arrived_minute=t;queue(v,v.visit.software_scheduled?'software':'cleaning',t);}
        continue;
      }
      if(v.state==='boarding'&&v.remaining_min<=0) {
        const q=byRequest.get(v.request_id);q.departed_minute=t;q.status='in_progress';
        q.passenger_drive_min=move(v,'passenger_trip',q.dropoff_node,q.dropoff_node,t);q.trip_minutes=q.boarding_min+q.passenger_drive_min;continue;
      }
      if(STAGES.includes(v.state)&&(v.state==='charging'?v.soc_kwh>=target(v)-1e-8:v.remaining_min<=0)){finishStage(v,t);continue;}
      return;
    }
    throw new Error('Bay lifecycle failed to settle within its finite transition bound.');
  }
  for(let minute=0;minute<=horizon;minute++) {
    for(const v of vehicles)settle(v,minute);
    while(nextRequest<requests.length&&requests[nextRequest].created_minute<=minute)waiting.push(requests[nextRequest++]);
    for(let i=waiting.length-1;i>=0;i--)if(minute-waiting[i].created_minute>=Math.ceil(c.patience_minutes)){const q=waiting.splice(i,1)[0];q.status='unserved';log(minute,null,'request_unserved',`${q.id} exceeded assignment patience.`);}
    if(minute<horizon) {
      const available=vehicles.filter(v=>v.state==='available');
      // FIFO requests, nearest feasible car, stable array-order ties. A range lower
      // bound skips impossible requests without scanning every car at max settings.
      let maximumRange=available.reduce((best,v)=>Math.max(best,(v.soc_kwh-reserve(v))/(v.profile.energy_kwh_per_km*effect.energy)),0);
      for(let i=0;i<waiting.length&&available.length;) {
        const q=waiting[i],back=route(q.dropoff_node,nearestByPlace.get(q.dropoff_node)[0].place_id);
        if(q.trip_distance_km+back.distance_km>maximumRange+1e-8){i++;continue;}
        let selected=-1,pickupKm=Infinity;
        for(let j=0;j<available.length;j++) {
          const v=available[j],pickup=route(v.place_id,q.pickup_node);
          const needed=(pickup.distance_km+q.trip_distance_km+back.distance_km)*v.profile.energy_kwh_per_km*effect.energy+reserve(v);
          if(v.soc_kwh+1e-8>=needed&&pickup.distance_km<pickupKm){selected=j;pickupKm=pickup.distance_km;}
        }
        if(selected<0){i++;continue;}
        const v=available.splice(selected,1)[0];waiting.splice(i,1);
        q.status='pickup';q.vehicle_id=v.id;q.vehicle_type=v.vehicle_type;q.assigned_minute=minute;q.pickup_distance_km=pickupKm;v.request_id=q.id;
        q.pickup_drive_min=move(v,'pickup',q.pickup_node,q.pickup_node,minute);settle(v,minute);
        maximumRange=available.reduce((best,car)=>Math.max(best,(car.soc_kwh-reserve(car))/(car.profile.energy_kwh_per_km*effect.energy)),0);
      }
      if(waiting.length)for(const v of available){blocked.add(v.id);if(v.soc_kwh<target(v)-1e-8&&startVisit(v,minute))settle(v,minute);}
    }
    for(const d of depots)for(const stage of STAGES) {
      const capacity=c[stage==='charging'?'chargers':`${stage}_bays`];let active=vehicles.filter(v=>v.depot_id===d.id&&v.state===stage).length;
      while(minute<horizon&&active<capacity&&d.queues[stage].length) {
        if(readiness&&!readiness.mayStart(d.queues[stage][0],minute))break;
        const v=d.queues[stage].shift(),record=v.visit.stages.at(-1);v.state=stage;record.started_minute=minute;
        v.remaining_min=stage==='charging'?0:Math.ceil(c[`${stage}_minutes`]*v.profile[`${stage}_multiplier`]);
        readiness?.started(v,minute);
        log(minute,v,stage,`${BAY_OPERATIONS_STATES[stage]} started.`);active++;
      }
    }
    const depotQueues=depots.map(d=>{const active=Object.fromEntries(STAGES.map(stage=>[stage,vehicles.filter(v=>v.depot_id===d.id&&v.state===stage).length]));return {depot_id:d.id,...Object.fromEntries(STAGES.map(s=>[s,d.queues[s].length])),active,charging_kw:0};});
    maxQueue=Math.max(maxQueue,...depotQueues.flatMap(d=>STAGES.map(s=>d[s])));
    for(const d of depotQueues)for(const v of vehicles)if(v.depot_id===d.depot_id&&v.state==='charging') {
      const kw=Math.min(c.charger_kw,v.profile.charge_limit_kw,c.site_power_kw/d.active.charging);
      v.remaining_min=Math.ceil(Math.max(0,target(v)-v.soc_kwh)/(kw/60));
      v.charge_next=minute===horizon?0:Math.min(Math.max(0,target(v)-v.soc_kwh),kw/60);d.charging_kw+=v.charge_next*60;
    }
    if(readiness)for(const d of depotQueues)d.cleaning_workers=readiness.resources(d.depot_id);
    if(capture)frames.push({minute,clock_minute:(start+minute)%1440,traffic_multiplier:traffic(c,minute),
      vehicles:vehicles.map((v)=>{const {id,state,node,from,to,progress,soc_kwh,depot_id,request_id,remaining_min,vehicle_type,battery_kwh,route_id}=v;return {id,state,node,from,to,progress,soc_kwh,depot_id,request_id,remaining_min,vehicle_type,battery_kwh,route_id,...(readiness?{readiness:readiness.inspect(v)}:{})};}),
      counts:Object.fromEntries(Object.keys(BAY_OPERATIONS_STATES).map(s=>[s,vehicles.filter(v=>v.state===s).length])),depot_queues:depotQueues});
    readiness?.observe(vehicles,depotQueues,minute);
    if(minute===horizon)break;
    for(const v of vehicles) {
      if(MOVING.has(v.state)) {
        const energy=v.leg_energy/v.total_min,distance=v.leg_distance/v.total_min;
        v.soc_kwh-=energy;v.energy_consumed+=energy;v.distance+=distance;v.remaining_min--;v.progress=1-v.remaining_min/v.total_min;
      } else if(v.state==='ready'||v.state==='boarding')v.remaining_min--;
      else if(STAGES.includes(v.state)) {
        const record=v.visit.stages.at(-1);record.active_minutes++;v.visit.active_service_min++;
        if(v.state==='charging'){v.soc_kwh+=v.charge_next;v.energy_delivered+=v.charge_next;record.energy_delivered_kwh+=v.charge_next;}else v.remaining_min--;
      }
    }
  }
  const complete=requests.filter(q=>q.status==='completed'),completedVisits=visits.filter(v=>v.completed_minute!==null);
  const populations=list=>({total_requests:list.length,completed_trips:list.filter(q=>q.status==='completed').length,unserved_requests:list.filter(q=>q.status==='unserved').length,pending_requests:list.filter(q=>q.status==='waiting').length,in_progress_trips:list.filter(q=>['pickup','boarding','in_progress'].includes(q.status)).length});
  const sum=(key,list=vehicles)=>list.reduce((total,v)=>total+v[key],0);
  const initialEnergy=vehicles.reduce((s,v)=>s+v.battery_kwh*c.initial_soc_pct/100,0),finalEnergy=sum('soc_kwh'),delivered=sum('energy_delivered'),consumed=sum('energy_consumed');
  const metrics={fleet_size:c.fleet_size,depot_count:c.depot_count,...populations(requests),trips_per_vehicle:complete.length/c.fleet_size,
    avg_wait_min_completed:mean(complete.map(q=>q.picked_up_minute-q.created_minute)),avg_trip_min_completed:mean(complete.map(q=>q.completed_minute-q.picked_up_minute)),
    avg_depot_onsite_min:mean(completedVisits.map(v=>v.completed_minute-v.arrived_minute)),avg_depot_turnaround_min:mean(completedVisits.map(v=>v.completed_minute-v.started_minute)),
    avg_active_service_min:mean(completedVisits.map(v=>v.active_service_min)),completed_visits:completedVisits.length,censored_visits:visits.length-completedVisits.length,max_queue:maxQueue,
    energy_delivered_kwh:delivered,energy_consumed_kwh:consumed,initial_energy_kwh:initialEnergy,final_energy_kwh:finalEnergy,energy_balance_error_kwh:initialEnergy+delivered-consumed-finalEnergy,energy_blocked_vehicle_count:blocked.size,distance_km:sum('distance'),
    service_breakdown:Object.fromEntries(STAGES.map(stage=>{const records=completedVisits.flatMap(v=>v.stages.filter(s=>s.stage===stage));return [stage,{completed_count:records.length,avg_active_min:mean(records.map(s=>s.active_minutes)),avg_queue_min:mean(records.map(s=>s.started_minute-s.queued_minute))}];})),
    by_vehicle_type:['ipace','ojai'].map(type=>{const selected=vehicles.filter(v=>v.vehicle_type===type),count=sum('completed_trips',selected);return {vehicle_type:type,label:VEHICLE_PROFILES[type].label,vehicle_count:selected.length,completed_trips:count,trips_per_vehicle:selected.length?count/selected.length:null,energy_consumed_kwh:sum('energy_consumed',selected),energy_delivered_kwh:sum('energy_delivered',selected),distance_km:sum('distance',selected)};}),
    by_place:placeLocations.map(p=>({place_id:p.id,label:p.label,...populations(requests.filter(q=>q.pickup_node===p.id))})),
  };
  return {...(readiness?{readiness:readiness.finish(visits,metrics)}:{}),version:readiness?`${BAY_OPERATIONS_VERSION}+${READINESS_VERSION}`:BAY_OPERATIONS_VERSION,config:c,locations,routes,frames,events,requests,visits,metrics,demand_signature:signature(demand),assumptions:[
    'Real frozen OpenStreetMap geometry, synthetic demand and operational parameters. Undirected teaching routes ignore one-way, turn and access restrictions; not navigation, service coverage, airport permission or safety evidence.',
    'City and airport representative points remain separate from snapped major-road anchors. Depot sites are hypothetical and co-located with selected road anchors; no off-road access legs are fabricated.',
    'Dispatch processes requests FIFO and chooses the nearest energy-feasible available car, with stable car-order ties. An infeasible earlier request can remain queued while a later feasible request is served.',
    'Demand origins are uniform across selected places; destinations have weight 1 / (2 + road distance km)^1.5, favoring nearby trips. Requests are identical across fleet, depot and vehicle-mix trials. One request is one party of at most four riders; no pooling or branding capacity bonus.',
    'All quantitative vehicle operational values are editable teaching assumptions. Ojai 90 kWh / 150 kW are illustrative, not published specifications. I-PACE 84 kWh is modeled usable energy, not the published 90 kWh retail nominal pack.',
    'Travel minutes=ceil(route km / selected km/h × 60 × synthetic traffic × weather), evaluated at each leg departure. Both types have identical speed rules. Zero-distance legs consume zero minutes and zero energy; boarding is stationary and separately timed.',
    'Morning 07:00–10:00 and evening 16:00–19:00 demand peaks and a 1.25 traffic factor are synthetic. Rain multiplies travel by 1.30, energy by 1.12 and demand by 1.12; heat uses 1.05, 1.25 and 1.05. Energy is proportional to route distance, distributed evenly over moving intervals; no standby or boarding energy.',
    'Dispatch requires pickup + passenger + nearest-depot return energy plus the individual reserve. Charging is linear, equal site share capped by port and individual vehicle acceptance and target SOC; unused capped share is not redistributed. No charge taper, degradation or thermal model.',
    'Software when scheduled → cleaning → charging → upload, finite per-site resources. Per-type multipliers alter service minutes. Turnaround includes depot driving, queues and service; active time excludes queues and travel. Completed-only averages exclude explicitly counted censored visits.',
    'Patience is assignment waiting; completed wait includes pickup driving and excludes boarding. Horizon and durations round up to minutes; start clock rounds nearest and wraps midnight. Terminal observation consumes no interval energy and retains unfinished requests and visits.',
    'Legacy battery_kwh, energy_kwh_per_minute, pickup_minutes and trip_minutes are retained only for configuration compatibility; Bay calculations use individual profiles and road routes.',
    'Depot locations are spread north-to-south across the selected places. When there are more depots than selected places, multiple independent illustrative sites share an anchor. Among equally near sites, visits choose the fewest unfinished inbound and on-site visits, with stable depot-order ties; return-energy reservation still uses minimum road distance. Additional sites also add bays, ports and site power.',
  ]};
}
export function analyzeBayAreaCapacity(config) {
  const c=checkedConfig(config),network=prepare(c),demand=makeDemand(c,network),sig=signature(demand);
  const trial=(fleet_size,depot_count)=>{const r=simulate(structuredClone({...c,fleet_size,depot_count}),demand,network,false);return {fleet_size,depot_count,metrics:r.metrics,completion_fraction:r.metrics.total_requests?r.metrics.completed_trips/r.metrics.total_requests:null,demand_signature:sig};};
  const fleetCounts=[...new Set([Math.max(1,Math.floor(c.fleet_size/2)),c.fleet_size,Math.min(120,Math.ceil(c.fleet_size*1.5)),Math.min(120,c.fleet_size*2)])].sort((a,b)=>a-b);
  const fleet_trials=fleetCounts.map(n=>trial(n,c.depot_count)),depot_trials=Array.from({length:6},(_,i)=>trial(c.fleet_size,i+1));
  return {target_completion_fraction:.95,fleet_trials,depot_trials,min_depots:depot_trials.find(t=>t.completion_fraction!==null&&t.completion_fraction>=.95)?.depot_count??null,assumptions:['Identical generated demand for every trial. First tested count reaching 95% completed/all requests; not a global optimum. Late unfinished demand remains in the denominator; zero demand is unavailable.','Depot trials hold fleet fixed; extra depots add bays, charging ports and site power. No monotonic gain is guaranteed.']};
}
export function analyzeVehicleMix(config) {
  const c=checkedConfig(config),network=prepare(c),demand=makeDemand(c,network),sig=signature(demand);
  return {trials:[0,50,100].map(ojai_share_pct=>({ojai_share_pct,metrics:simulate(structuredClone({...c,ojai_share_pct}),demand,network,false).metrics,demand_signature:sig})),assumptions:['All three trials use identical demand, fleet count, road-speed rules and depot resources. Actual integer vehicle counts follow round(fleet × Ojai share / 100).','Differences come from editable battery, energy, boarding and service parameters, not branding or added rider capacity. No real fleet-performance claim.']};
}

/** A synthetic mechanism example, not an optimized staffing plan. */
export function depotReadinessDemoConfig(){
  return {...defaultBayAreaConfig(),place_ids:['menlo-park','palo-alto'],fleet_size:16,depot_count:1,
    duration_hours:4,start_hour:0,requests_per_hour:45,peak_multiplier:1,trips_between_visits:1,cleaning_minutes:18,
    cleaning_bays:3,software_every_visits:100,upload_minutes:1,chargers:8,charger_kw:150,site_power_kw:1000,
    initial_soc_pct:85,charge_target_pct:85,readiness:defaultReadiness()};
}
/** Two separate treatments against one submitted baseline; same pregenerated exogenous requests. */
export function analyzeDepotReadiness(config){
  const c=checkedConfig(config);
  if(!c.readiness)throw new RangeError('Enable the readiness extension before comparing.');
  const worker=structuredClone(c),bay=structuredClone(c);
  worker.readiness.cleaning_workers++;bay.cleaning_bays++;
  const network=prepare(c),demand=makeDemand(c,network);
  const definitions=[['baseline','Baseline',c,null],['worker','Cleaning workers per depot',worker,'cleaning_workers'],['bay','Cleaning bays per depot',bay,'cleaning_bays']];
  const arms=definitions.map(([id,label,settings,axis])=>{
    const issues=validateBayAreaConfig(settings);
    return {id,label,axis,from:axis==='cleaning_workers'?c.readiness.cleaning_workers:axis==='cleaning_bays'?c.cleaning_bays:null,
      to:axis==='cleaning_workers'?settings.readiness.cleaning_workers:axis==='cleaning_bays'?settings.cleaning_bays:null,
      available:issues.length===0,reason:issues.length?issues.join(' '):null,requested_config:settings,
      result:issues.length?null:simulate(settings,demand,network,false)};
  });
  for(const arm of arms.slice(1))arm.comparison=arm.available?compareReadinessRuns(arms[0].result,arm.result,arm.axis):{comparable:false,reason:arm.reason,deltas:null};
  return {format:'fleetlab-depot-readiness-comparison',format_version:1,evidence_status:'NOT_EVIDENCE',decision_authority:'NONE',replications:1,
    question:'Does an extra qualified cleaning worker change completed service? Separately, does an extra cleaning bay?',
    primary_estimand:'candidate completed trips minus baseline completed trips at observation end (trips); both arms account for all requests created before H',
    practical_margin:null,horizon_minutes:Math.ceil(c.duration_hours*60),seed_set:[c.seed],arms};
}
