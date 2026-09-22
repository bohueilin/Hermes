/** Model-specific contract checked before handing numeric run maps to the shared instrument. */
import {sha256Hex} from '../core/sha256.js';
import {deepFreeze} from './schema.js';
import {defaultBayAreaConfig,validateBayAreaConfig,simulateBayAreaOperations,BAY_OPERATIONS_VERSION} from './bay-operations.js';
import {defaultCharging} from './charging-allocation.js';
import {defaultResources} from './resource-observations.js';
import {defaultAirport} from './airport-demand.js';
import {pairedMetricSteps} from './experiment.js';
import {BAY_SYSTEM_METRICS} from './bay-systems.js';
/** Bay v1 canonical JSON: sorted plain-object keys and finite JSON numbers (IEEE-754 shortest representation).
 * Deliberately separate from regional experiment integer-unit serialization. Hash is identity, not authentication. */
export function canonicalBayJson(value,depth=0){
  if(depth>32)throw new RangeError('Bay JSON nesting exceeds 32 levels.');
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value)){
    const items=[];for(let i=0;i<value.length;i++){if(!Object.hasOwn(value,i))throw new TypeError('Bay JSON rejects sparse arrays.');items.push(canonicalBayJson(value[i],depth+1));}
    return '['+items.join(',')+']';
  }
  if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalBayJson(value[k],depth+1)).join(',')+'}';
  throw new TypeError('Bay JSON requires finite numbers and plain JSON values.');
}
const bayDigest=value=>sha256Hex(canonicalBayJson(value));
export const BAY_EXPERIMENT_FORMAT='fleetlab-bay-paired-experiment';
const treatments={charging_redistribution:['charging','equal_share','redistribute'],charging_deadlines:['charging','redistribute','deadline'],
  resource_freshness:['resources','last_known','fresh_only'],airport_forecast:['airport','reactive','forecast']};
/** Each value is one whole-run metric. No vehicle/request rows are treated as independent replications. */
export const BAY_METRIC_DEFINITIONS=Object.freeze({
  completion_fraction:{unit:'fraction',population:'All requests created before intake cutoff (or H without airport extension). Completed by H / all requests.',missing:'null if no requests'},
  max_request_wait_min:{unit:'min',population:'All requests; pickup minus creation, or observed H minus creation if not picked up, including unserved.',missing:'null if no requests'},
  unfinished_visits:{unit:'visits',population:'All started depot visits; completion absent at H.',missing:'zero when no visits'},
  terminal_energy_kwh:{unit:'kWh',population:'All starting vehicles, battery-side energy at H.',missing:'never optional'},
  rejected_actions:{unit:'actions',population:'All rejected power proposals and resource reservations in [0,H).',missing:'zero when no rejected actions'},
  nonairport_completion_fraction:{unit:'fraction',population:'All non-airport-origin requests before intake cutoff; completed by H / this cohort.',missing:'null if empty cohort'},
  airport_within_target_fraction:{unit:'fraction',population:'All airport-origin requests; picked up within target / all, including late and pending requests.',missing:'null if empty cohort'},
});
export function advancedOperationsDemoConfig(kind){
  const c={...defaultBayAreaConfig(),place_ids:['menlo-park','palo-alto'],fleet_size:24,depot_count:1,duration_hours:4,start_hour:0,
    requests_per_hour:35,peak_multiplier:1,trips_between_visits:1,cleaning_minutes:2,cleaning_bays:8,software_every_visits:100,upload_minutes:1,
    chargers:8,charger_kw:80,site_power_kw:120,initial_soc_pct:35,charge_target_pct:85};
  if(kind==='charging'){
    c.charging=defaultCharging();c.vehicle_profiles.ipace.charge_limit_kw=10;
    return c;
  }
  if(kind==='resources'){c.resources={...defaultResources(),policy:'last_known',delay_min:8,ttl_min:10,outage_start_min:10,outage_end_min:100,outage_ports:4};return c;}
  if(kind==='airport'){c.place_ids=['sfo','menlo-park','palo-alto'];c.requests_per_hour=5;c.initial_soc_pct=85;c.airport=defaultAirport();return c;}
  throw new RangeError('Unknown advanced situation.');
}
export function bayModelVersion(c){return [BAY_OPERATIONS_VERSION,...['readiness','charging','resources','airport'].filter(k=>c[k]).map(k=>c[k].version)].join('+');}
export function freezeBayExperiment(config,options={}){
  const {treatment,seeds=Array.from({length:12},(_,i)=>1001+i),tuning_seeds=[42,43,44],margin=.02,resamples=2000,null_treatment=false}=options;
  if(Object.keys(options).some(k=>!['treatment','seeds','tuning_seeds','margin','resamples','null_treatment'].includes(k)))throw new RangeError('Unknown experiment option.');
  const definition=treatments[treatment];if(!definition)throw new RangeError('Select a supported single treatment.');
  const [group,baselinePolicy,candidatePolicy]=definition;
  if(!config?.[group])throw new RangeError(`Enable the ${group} extension before this comparison.`);
  const issues=validateBayAreaConfig(config);if(issues.length)throw new RangeError(issues.join(' '));
  const validSeeds=xs=>Array.isArray(xs)&&xs.length>=1&&xs.length<=40&&new Set(xs).size===xs.length&&xs.every(x=>Number.isInteger(x)&&x>=0&&x<=4294967295);
  if(!validSeeds(seeds)||!validSeeds(tuning_seeds)||seeds.some(s=>tuning_seeds.includes(s)))throw new RangeError('Evaluation and tuning seeds must be unique, disjoint bounded sets (1–40 seeds each).');
  if(!Number.isFinite(margin)||margin<=0||margin>1)throw new RangeError('Practical margin must be greater than zero and at most one fraction unit.');
  if(!Number.isInteger(resamples)||resamples<1000||resamples>10000)throw new RangeError('Use 1,000–10,000 bootstrap resamples.');
  if(typeof null_treatment!=='boolean')throw new RangeError('Null treatment must be a boolean.');
  if(config.duration_hours*60*config.fleet_size*(seeds.length+1)*2>1500000)throw new RangeError('Comparison exceeds 1,500,000 vehicle-minute replay budget. Reduce fleet, horizon or replications.');
  const baseline=structuredClone(config),candidate=structuredClone(config);baseline[group].policy=baselinePolicy;candidate[group].policy=null_treatment?baselinePolicy:candidatePolicy;
  const primary={name:'completion_fraction',direction:'higher_is_better',equivalence_margin:margin};
  const guardrails=[{metric:'max_request_wait_min',direction:'lower_is_better',max_harm:5},
    {metric:'unfinished_visits',direction:'lower_is_better',max_harm:0},{metric:'terminal_energy_kwh',direction:'higher_is_better',max_harm:5},
    {metric:'rejected_actions',direction:'lower_is_better',max_harm:0}];
  if(config.airport)guardrails.push({metric:'nonairport_completion_fraction',direction:'higher_is_better',max_harm:.02},
    {metric:'airport_within_target_fraction',direction:'higher_is_better',max_harm:.02});
  const spec=deepFreeze({format:BAY_EXPERIMENT_FORMAT,format_version:1,model_version:bayModelVersion(config),metric_version:BAY_SYSTEM_METRICS,
    treatment,axis:{path:`${group}.policy`,baseline:baselinePolicy,candidate:candidate[group].policy},baseline,candidate,seeds:[...seeds],tuning_seeds:[...tuning_seeds],margin,resamples,primary,guardrails,null_treatment});
  return Object.freeze({spec,digest:bayDigest(spec)});
}
/** Frozen specs are still checked at consumption; imported or mutable objects receive no implicit trust. */
export function requireBaySpec(frozen){
  if(!frozen?.spec||frozen.digest!==bayDigest(frozen.spec))throw new RangeError('Experiment frozen digest does not match.');
  const s=frozen.spec,reconstructed=freezeBayExperiment(s.baseline,{treatment:s.treatment,seeds:s.seeds,tuning_seeds:s.tuning_seeds,margin:s.margin,resamples:s.resamples,null_treatment:s.null_treatment});
  if(canonicalBayJson(reconstructed.spec)!==canonicalBayJson(s))throw new RangeError('Unsupported or altered frozen experiment contract.');
  return reconstructed;
}
const external=r=>r.requests.map(q=>[q.id,q.created_minute,q.pickup_node,q.dropoff_node,q.trip_distance_km]);
/** No absent measurement, including a required guardrail, is silently converted to zero. */
export function bayMetricMap(r){
  const m=r.metrics,x=r.extensions;
  return {completion_fraction:m.total_requests?m.completed_trips/m.total_requests:null,
    max_request_wait_min:r.requests.length?Math.max(...r.requests.map(q=>(q.picked_up_minute??Math.ceil(r.config.duration_hours*60))-q.created_minute)):null,
    unfinished_visits:m.censored_visits,terminal_energy_kwh:m.final_energy_kwh,
    rejected_actions:x.charging.rejected_actions.length+(x.resources?.rejected_actions.length??0),
    ...(x.airport?{nonairport_completion_fraction:x.airport.nonairport_requests?x.airport.nonairport_completed/x.airport.nonairport_requests:null,
      airport_within_target_fraction:x.airport.requests?x.airport.within_target/x.airport.requests:null}:{})};
}
export function validateBayPair(spec,a,b,seed){
  const fail=reason=>({ok:false,reason,maps:null});
  for(const [r,expected] of [[a,spec.baseline],[b,spec.candidate]]){
    if(r?.version!==spec.model_version||r?.extensions?.producer!=='fleetlab-bay-operations'||r.extensions.metric_version!==spec.metric_version)return fail('Incompatible producer or model/metric version.');
    if(r.extensions.validity!=='VALID'||r.readiness&&r.readiness.validity!=='VALID')return fail('Invalid simulator state.');
    if(canonicalBayJson(r.config)!==canonicalBayJson({...expected,seed}))return fail('Non-treatment inputs differ from the frozen spec.');
    const m=r.metrics;
    if(!Array.isArray(r.requests)||m.total_requests!==r.requests.length||m.total_requests!==m.completed_trips+m.unserved_requests+m.pending_requests+m.in_progress_trips||
      m.completed_trips!==r.requests.filter(q=>q.status==='completed').length||m.censored_visits!==r.visits.filter(v=>v.completed_minute===null).length||
      !Number.isFinite(m.energy_balance_error_kwh)||Math.abs(m.energy_balance_error_kwh)>1e-6)return fail('Population or energy accounting mismatch.');
  }
  if(canonicalBayJson(external(a))!==canonicalBayJson(external(b)))return fail('External demand differs; runs cannot be paired.');
  const maps=[bayMetricMap(a),bayMetricMap(b)],names=[spec.primary.name,...spec.guardrails.map(g=>g.metric)];
  if(maps.some(m=>names.some(k=>!Number.isFinite(m[k]))))return fail('Required metric or population unavailable; no comparison or recommendation.');
  return {ok:true,reason:null,maps};
}

/** Bay producer adapter: compatibility, availability and replay checks precede shared numeric statistics. */
export function* bayExperimentSteps(frozen){
  const {spec,digest}=requireBaySpec(frozen),per_seed=[],baselineRuns=[],candidateRuns=[];
  const out={format:BAY_EXPERIMENT_FORMAT,format_version:1,evidence_status:'NOT_EVIDENCE',deployment_permission:'NONE',spec,digest,
    replications:spec.seeds.length,per_seed,metric_definitions:BAY_METRIC_DEFINITIONS,validity:'VALID',reason:null,analysis:null,descriptive:spec.seeds.length===1,
    limitations:['Run-level paired deltas across declared held-out seeds. Tuning seeds are excluded by contract, not authenticated as unseen by an operator.',
      'Bootstrap percentile interval for the synthetic-model mean delta; small seed sets can give narrow or unstable intervals. No real-world confidence or deployment authority.',
      'Guardrails compare mean paired harm separately from the primary outcome. A favorable primary cannot compensate for a regressed guardrail. Required unavailable metrics block analysis.']};
  const invalid=reason=>({...out,validity:'INVALID_EXPERIMENT',reason,analysis:null});
  const replay=r=>canonicalBayJson({requests:r.requests,visits:r.visits,metrics:r.metrics,extensions:r.extensions,readiness:r.readiness??null});
  for(const [i,seed] of spec.seeds.entries()){
    yield {phase:'paired runs',completed:i,total:spec.seeds.length};
    const baseline=simulateBayAreaOperations({...spec.baseline,seed},{capture:false});
    yield {phase:'candidate run',completed:i,total:spec.seeds.length};
    const candidate=simulateBayAreaOperations({...spec.candidate,seed},{capture:false});
    const pair=validateBayPair(spec,baseline,candidate,seed);
    per_seed.push({seed,baseline:{metrics:baseline.metrics,extensions:baseline.extensions},candidate:{metrics:candidate.metrics,extensions:candidate.extensions}});
    if(!pair.ok)return invalid(pair.reason);
    if(i===0){for(const r of [baseline,candidate]){
      yield {phase:'repeatability check',completed:i,total:spec.seeds.length};
      if(replay(r)!==replay(simulateBayAreaOperations(r.config,{capture:false})))return invalid('REPLICATION_MISMATCH: identical seed and settings did not replay.');
    }}
    baselineRuns.push(pair.maps[0]);candidateRuns.push(pair.maps[1]);
  }
  if(out.descriptive)return out;
  const steps=pairedMetricSteps({primary:spec.primary,guardrails:spec.guardrails,baselineRuns,candidateRuns,resamples:spec.resamples,key:digest,precheckMatched:true});
  for(;;){const next=steps.next();if(next.done){out.analysis=next.value;break;}yield {phase:'paired bootstrap',completed:spec.seeds.length,total:spec.seeds.length};}
  if(out.analysis.validity!=='VALID')return invalid(out.analysis.invalidity_detail);
  return out;
}
