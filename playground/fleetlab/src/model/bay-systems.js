/** Optional Bay model accounting. These records belong to this producer, never Python evidence. */
import {allocateChargingPower,checkPowerProposal,chargingOrder} from './charging-allocation.js';
import {createResourcePool} from './resource-observations.js';
import {airportCohort} from './airport-demand.js';
import {createLaunchState,sitePower,siteOpen} from './launch-contract.js';
export const BAY_SYSTEM_METRICS='bay-systems-metrics-1.0.0';
export function createBaySystems(c){
  const launch=c.launch?createLaunchState(c):null;
  const horizon=Math.ceil(c.duration_hours*60),pool=c.resources?createResourcePool(c,launch):null,rejected=[],invalid=new Set();
  const resourceMinutes={unknown_port_minutes:0,stale_port_minutes:0,false_ready_port_minutes:0,prediction_error_port_minutes:0,observed_port_minutes:0};
  let terminalStaging=[];
  const recoveries=new Map(),power={connected_vehicle_min:0,zero_power_vehicle_min:0,aged_job_minutes:0},areaTimeline=[];
  const job=v=>({id:v.id,cap_kw:Math.min(c.charger_kw,v.profile.charge_limit_kw,pool?.cap(v.id)??Infinity),needed_kwh:Math.max(0,v.battery_kwh*c.charge_target_pct/100-v.soc_kwh),
    queued_minute:v.visit.stages.at(-1).queued_minute,deadline_minute:v.visit.charge_deadline_minute});
  return {
    pool,launch,
    begin(v,t){if(c.charging)v.visit.charge_deadline_minute=t+c.charging.deadline_budget_min+((Number(v.id.slice(4))-1)%3)*c.charging.deadline_spread_min;},
    order(queue,t){if(c.charging?.policy==='deadline'){const ids=chargingOrder(queue.map(job),'deadline',t,c.charging.starvation_min).map(j=>j.id);queue.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));}},
    allocate(vehicles,d,t){
      const active=vehicles.filter(v=>v.depot_id===d.depot_id&&v.state==='charging');
      const jobs=active.map(v=>({...job(v),cap_kw:pool&&!pool.usable(v.id,t)?0:job(v).cap_kw}));
      const powerCap=sitePower(c,d.depot_id,t);
      const proposal=allocateChargingPower(jobs,powerCap,c.charging?.policy??'equal_share',t,c.charging?.starvation_min??60);
      const reason=checkPowerProposal(jobs,powerCap,proposal);
      if(reason&&t<horizon)rejected.push({minute:t,depot_id:d.depot_id,reason,status:'REJECTED'});
      for(const v of active){
        const kw=reason?0:proposal[v.id];v.charge_next=t===horizon?0:kw/60;
        v.remaining_min=kw>0?Math.ceil(job(v).needed_kwh/(kw/60)):null;d.charging_kw+=v.charge_next*60;
        v.power_kw=v.charge_next*60;v.resource_blocked=!siteOpen(c,d.depot_id,t)?'SITE_CLOSED':pool&&!pool.usable(v.id,t)?'CONNECTED_RESOURCE_UNAVAILABLE':null;
        if(t<horizon){power.connected_vehicle_min++;if(kw===0)power.zero_power_vehicle_min++;}
      }
      if(d.charging_kw>powerCap+1e-7||!Number.isFinite(d.charging_kw))invalid.add('SITE_POWER_INVARIANT');
      if(pool){d.resources=pool.snapshot(d.depot_id,t);for(const p of d.resources.ports){
        const truth=p.truth.installed&&p.truth.commissioned&&p.truth.healthy&&p.truth.compatible;
        if(t<horizon){
          if(p.knowledge==='UNKNOWN')resourceMinutes.unknown_port_minutes++;else if(p.knowledge==='INFERRED_STALE')resourceMinutes.stale_port_minutes++;else resourceMinutes.observed_port_minutes++;
          if(p.planner_eligible&&!truth)resourceMinutes.false_ready_port_minutes++;
          if(p.observation&&Boolean(p.observation.installed&&p.observation.commissioned&&p.observation.healthy&&p.observation.compatible)!==truth)resourceMinutes.prediction_error_port_minutes++;
        }
        // Recovery is fresh knowledge of an affected commissioned port, not its occupancy.
        if(Number(p.id.split('-').at(-1))<=c.resources.outage_ports&&truth&&t>=c.resources.outage_end_min&&p.knowledge==='OBSERVED'&&p.observation.healthy&&!recoveries.has(p.id))recoveries.set(p.id,t-c.resources.outage_end_min);
      }}
    },
    observe(vehicles,requests,places,staged,t){
      if(vehicles.some(v=>!Number.isFinite(v.soc_kwh)||v.soc_kwh<v.battery_kwh*c.reserve_soc_pct/100-1e-7||v.soc_kwh>v.battery_kwh+1e-7))invalid.add('BATTERY_RESERVE_INVARIANT');
      if(c.charging&&t<horizon)power.aged_job_minutes+=vehicles.filter(v=>['queued_charging','charging'].includes(v.state)&&t-job(v).queued_minute>=c.charging.starvation_min).length;
      if(c.airport){
        terminalStaging=[...staged];
        if(staged.size>c.airport.staging_capacity)invalid.add('STAGING_CAPACITY_INVARIANT');
        const waitingByPlace=new Map(),readyByPlace=new Map();
        for(const q of requests)if(q.created_minute<=t&&['waiting','pickup'].includes(q.status))waitingByPlace.set(q.pickup_node,(waitingByPlace.get(q.pickup_node)??0)+1);
        for(const v of vehicles)if(v.state==='available')readyByPlace.set(v.place_id,(readyByPlace.get(v.place_id)??0)+1);
        areaTimeline.push({minute:t,areas:places.map(p=>{const waiting=waitingByPlace.get(p.id)??0,ready=readyByPlace.get(p.id)??0;return {place_id:p.id,waiting,ready,deficit:Math.max(0,waiting-ready)};})});
      }
    },
    finish(visits,vehicles,requests,metrics){
      if(Math.abs(metrics.energy_balance_error_kwh)>1e-6)invalid.add('ENERGY_BALANCE_INVARIANT');
      if(metrics.total_requests!==metrics.completed_trips+metrics.unserved_requests+metrics.pending_requests+metrics.in_progress_trips)invalid.add('REQUEST_ACCOUNTING_INVARIANT');
      const records=visits.flatMap(v=>v.stages.filter(s=>s.stage==='charging'));
      const charging={policy:c.charging?.policy??'equal_share',...power,visits:visits.length,unfinished_visits:visits.filter(v=>v.completed_minute===null).length,
        queue_observed_min:records.reduce((n,r)=>n+(r.started_minute??horizon)-r.queued_minute,0),active_observed_min:records.reduce((n,r)=>n+r.active_minutes,0),
        unfinished_energy_kwh:vehicles.filter(v=>v.visit&&v.visit.completed_minute===null).reduce((n,v)=>n+Math.max(0,v.battery_kwh*c.charge_target_pct/100-v.soc_kwh),0),rejected_actions:rejected};
      if(c.charging){
        charging.ready_by_deadline=visits.filter(v=>v.completed_minute!==null&&v.completed_minute<=v.charge_deadline_minute).length;
        charging.missed_deadline=visits.filter(v=>v.completed_minute!==null?v.completed_minute>v.charge_deadline_minute:v.charge_deadline_minute<=horizon).length;
        charging.deadline_pending=visits.length-charging.ready_by_deadline-charging.missed_deadline;
      }
      const checks=[{name:'POWER_PROPOSAL_FEASIBILITY',status:rejected.length?'FAIL':'PASS',rejected_count:rejected.length},
        {name:'SIMULATOR_STATE_INVARIANTS',status:invalid.size?'FAIL':'PASS',violations:[...invalid]}];
      const result={producer:'fleetlab-bay-operations',metric_version:BAY_SYSTEM_METRICS,evidence_status:'NOT_EVIDENCE',deployment_permission:'NONE',scope:'simulation-only',validity:invalid.size?'INVALID_SIMULATION':'VALID',checks,charging};
      if(pool){result.resources={...pool.result(),...resourceMinutes,recovery_delay_min_by_port:Object.fromEntries(recoveries),
        recovery_definition:'First fresh healthy observation at/after outage end, per affected commissioned port; absent ports have not recovered within observation.'};checks.push(...result.resources.checks);}
      if(c.airport){const nonairport=requests.filter(q=>q.pickup_node!==c.airport.airport_id);
        result.airport={...airportCohort(requests,c.airport.airport_id,horizon,c.airport.pickup_target_min),nonairport_requests:nonairport.length,
          nonairport_completed:nonairport.filter(q=>q.status==='completed').length,area_timeline:areaTimeline,
          terminal_preparation_slots:terminalStaging.length,terminal_preparation_inbound:vehicles.filter(v=>v.state==='airport_reposition').length,
          staging_overflow:invalid.has('STAGING_CAPACITY_INVARIANT'),intake_end_min:c.airport.intake_end_min,observation_end_min:horizon};}
      return result;
    },
  };
}
