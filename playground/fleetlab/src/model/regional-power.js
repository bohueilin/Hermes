/** Synthetic N1 demo configuration; existing engine and policies do the work. */
import {deepFreeze} from './schema.js';
import {defaultBayAreaConfig} from './bay-operations.js';
import {defaultCharging} from './charging-allocation.js';
import {defaultReadiness} from './depot-readiness.js';
import {defaultResources} from './resource-observations.js';
import {SITE_POWER_VERSION} from './site-power.js';
import {AUSTIN_REGION,regionReference} from './region-package.js';
export const POWER_CONDITIONS=deepFreeze([{id:'full',label:'Full power control',fraction:1},{id:'moderate',label:'60% power',fraction:.6},{id:'severe',label:'20% power',fraction:.2},{id:'outage',label:'Outage and recovery',fraction:0}]);
/** Clip the fixed [90,180) stress window to H. A shorter shift is an explicit no-effect control. */
export function regionalPowerProfile(condition,horizon=480,site='depot-1'){
  const choice=POWER_CONDITIONS.find(p=>p.id===condition);if(!choice)throw new RangeError('Unknown regional power condition.');
  if(!Number.isInteger(horizon)||horizon<1||horizon>1440)throw new RangeError('Invalid regional power horizon.');
  const boundaries=[...new Set([0,Math.min(90,horizon),Math.min(180,horizon),horizon])];
  return {version:SITE_POWER_VERSION,condition_id:`tx-aus-${condition}-v1`,site_id:site,segments:boundaries.slice(0,-1).map((start,i)=>({start_minute:start,end_minute:boundaries[i+1],fraction:start>=90&&start<180?choice.fraction:1}))};
}
export function regionalPowerDemoConfig(condition='moderate'){
  return {...defaultBayAreaConfig(),region:regionReference(),place_ids:AUSTIN_REGION.geometry.nodes.map(p=>p.id),fleet_size:40,depot_count:2,duration_hours:8,start_hour:0,
    requests_per_hour:60,peak_multiplier:1,initial_soc_pct:35,charge_target_pct:85,trips_between_visits:1,cleaning_minutes:2,cleaning_bays:8,upload_minutes:1,software_every_visits:100,chargers:8,charger_kw:80,site_power_kw:120,
    readiness:{...defaultReadiness(),cleaning_workers:8},charging:{...defaultCharging(),policy:'redistribute'},resources:defaultResources(),
    site_power_profile:regionalPowerProfile(condition)};
}
