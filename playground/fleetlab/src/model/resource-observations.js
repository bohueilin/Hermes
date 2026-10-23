/** Fictional charging ports: delayed planner observations never grant execution authority. */
export const RESOURCES_VERSION='depot-resources-1.0.0';
export const defaultResources=()=>({version:RESOURCES_VERSION,policy:'fresh_only',ttl_min:10,period_min:5,delay_min:2,
  planned_ports:0,uncommissioned_ports:0,outage_start_min:60,outage_end_min:120,outage_ports:1});
export function validateResources(config){
  const c=config.resources,errors=[];
  if(!c||typeof c!=='object'||Array.isArray(c))return ['resources must be an object.'];
  if(c.version!==RESOURCES_VERSION)errors.push('Unsupported resources version.');
  if(!['last_known','fresh_only'].includes(c.policy))errors.push('Unsupported resource policy.');
  for(const k of ['ttl_min','period_min','delay_min','outage_start_min','outage_end_min'])if(!Number.isInteger(c[k])||c[k]<(k==='ttl_min'||k==='period_min'?1:0)||c[k]>1440)errors.push(`${k} must be a bounded minute value.`);
  for(const k of ['planned_ports','uncommissioned_ports','outage_ports'])if(!Number.isInteger(c[k])||c[k]<0||c[k]>config.chargers)errors.push(`${k} must be within configured ports.`);
  if(c.planned_ports+c.uncommissioned_ports>config.chargers)errors.push('Planned and uncommissioned ports exceed configured ports.');
  if(c.outage_end_min<=c.outage_start_min)errors.push('Outage end must follow its start.');
  if(config.chargers*config.depot_count>72)errors.push('Resource extension supports at most 72 configured ports.');
  if(Object.keys(c).some(k=>!Object.hasOwn(defaultResources(),k)))errors.push('Unknown resource setting.');
  return errors;
}
export function acceptObservation(previous,event,minute){
  const reject=reason=>({accepted:false,reason,observation:previous});
  if(!event||typeof event.resource_id!=='string'||!Number.isInteger(event.sequence)||event.sequence<1||
    !Number.isInteger(event.observed_minute)||event.observed_minute<0||!Number.isInteger(event.received_minute)||
    event.observed_minute>event.received_minute||event.received_minute>minute||
    event.source!=='synthetic-port-feed-1'||event.idempotency_key!==`${event.resource_id}:${event.sequence}`||
    ['installed','commissioned','healthy','compatible'].some(k=>typeof event[k]!=='boolean'))return reject('MALFORMED_OBSERVATION');
  if(previous&&(event.resource_id!==previous.resource_id||event.sequence<=previous.sequence||event.observed_minute<previous.observed_minute))return reject('DUPLICATE_OR_OUT_OF_ORDER');
  return {accepted:true,reason:null,observation:{...event}};
}
export function createResourcePool(config,launch=null){
  const c=config.resources,horizon=Math.ceil(config.duration_hours*60),ports=[],pending=[],observations=new Map(),actions=[];
  if(launch)ports.push(...launch.ports);
  else for(let d=1;d<=config.depot_count;d++)for(let i=0;i<config.chargers;i++)ports.push({id:`depot-${d}:port-${i+1}`,depot_id:`depot-${d}`,index:i,
    installed:i<config.chargers-c.planned_ports,commissioned:i<config.chargers-c.planned_ports-c.uncommissioned_ports,healthy:true,compatible:true,owner:null,expires_minute:null});
  const knowledge=(p,t)=>{const o=observations.get(p.id);return !o?'UNKNOWN':t-o.observed_minute>c.ttl_min?'INFERRED_STALE':'OBSERVED';};
  const eligible=(p,t)=>{const o=observations.get(p.id);return !p.owner&&o&&o.installed&&o.commissioned&&o.healthy&&o.compatible&&(c.policy==='last_known'||knowledge(p,t)==='OBSERVED');};
  let lastMinute=-1;
  return {
    tick(t){
      // Visit every elapsed observation boundary even when a test jumps the clock.
      for(let minute=lastMinute+1;minute<=t;minute++){
        launch?.tick(minute);
        for(const p of ports){if(!launch)p.healthy=!(p.index<c.outage_ports&&minute>=c.outage_start_min&&minute<c.outage_end_min);if(p.owner&&minute>=p.expires_minute){p.owner=null;p.expires_minute=null;}}
        if(minute%c.period_min===0)for(const p of ports)pending.push({source:'synthetic-port-feed-1',idempotency_key:`${p.id}:${Math.floor(minute/c.period_min)+1}`,resource_id:p.id,sequence:Math.floor(minute/c.period_min)+1,observed_minute:minute,received_minute:minute+c.delay_min,
          installed:p.installed,commissioned:p.commissioned,healthy:p.healthy,compatible:p.compatible});
        while(pending.length&&pending[0].received_minute<=minute){const event=pending.shift(),result=acceptObservation(observations.get(event.resource_id),event,minute);if(result.accepted)observations.set(event.resource_id,result.observation);}
      }
      lastMinute=t;
    },
    reserve(vehicle,depot,t,vehicleType=null){
      const held=ports.find(p=>p.owner===vehicle);
      if(held)return held.depot_id===depot&&t<held.expires_minute?{accepted:true,resource_id:held.id,idempotent:true}:{accepted:false,reason:'ALREADY_RESERVED'};
      const candidates=ports.filter(p=>p.depot_id===depot&&eligible(p,t)&&(!launch||p.compatible_vehicle_types.includes(vehicleType)));
      if(!candidates.length)return {accepted:false,reason:'NO_FRESH_ELIGIBLE_RESOURCE'};
      for(const p of candidates){
        const reason=!p.installed||!p.commissioned?'NOT_COMMISSIONED':!p.healthy?'RESOURCE_UNHEALTHY':!p.compatible?'INCOMPATIBLE':p.owner?'RESOURCE_RESERVED':null;
        if(reason){if(!actions.some(a=>a.minute===t&&a.vehicle_id===vehicle&&a.resource_id===p.id))actions.push({minute:t,vehicle_id:vehicle,resource_id:p.id,status:'REJECTED',reason});continue;}
        p.owner=vehicle;p.expires_minute=horizon+1;if(launch)p.vehicle_type=vehicleType;return {accepted:true,resource_id:p.id};
      }
      return {accepted:false,reason:'RESOURCE_UNHEALTHY'};
    },
    release(vehicle){const p=ports.find(p=>p.owner===vehicle);if(p){p.owner=null;p.expires_minute=null;}},
    usable(vehicle,t){const p=ports.find(p=>p.owner===vehicle);return !!p&&p.installed&&p.commissioned&&p.healthy&&p.compatible&&(!launch||p.compatible_vehicle_types.includes(p.vehicle_type))&&t<p.expires_minute;},
    cap(vehicle){return ports.find(p=>p.owner===vehicle)?.cap_kw??Infinity;},
    snapshot(depot,t){return {policy:c.policy,ports:ports.filter(p=>p.depot_id===depot).map(p=>({id:p.id,...(launch?{cap_kw:p.cap_kw,compatible_vehicle_types:[...p.compatible_vehicle_types]}:{}),truth:{installed:p.installed,commissioned:p.commissioned,healthy:p.healthy,compatible:p.compatible,available:!p.owner},
      observation:observations.get(p.id)?{...observations.get(p.id)}:null,knowledge:knowledge(p,t),planner_eligible:!!eligible(p,t),owner:p.owner,expires_minute:p.expires_minute}))};},
    result(){return {version:RESOURCES_VERSION,rejected_actions:actions,checks:[{name:'RESOURCE_PROPOSAL_FEASIBILITY',status:actions.length?'FAIL':'PASS',rejected_count:actions.length}],
      lease_rule:'Exclusive per-port reservation expires after the declared observation window; outages retain connected ownership and deliver zero power.',
      observation_rule:'Sequenced synthetic snapshots; freshness uses observed time. Inferred stale capacity is distinct from observed capacity. No external resource feed.'};},
  };
}
