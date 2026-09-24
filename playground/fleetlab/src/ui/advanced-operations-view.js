/** Record projections only. Policies and statistical decisions remain in the model. */
import {el} from './dom.js';
import {comparisonLearning} from './scenario-learning.js';
import {defaultCharging} from '../model/charging-allocation.js';
import {defaultResources} from '../model/resource-observations.js';
import {defaultAirport} from '../model/airport-demand.js';
const text=value=>value===null||value===undefined?'Not available':typeof value==='object'?JSON.stringify(value):String(value);
const label=key=>key.replaceAll('_',' ');
const table=(head,rows)=>el('div',{class:'ops-table-wrap'},el('table',{},[el('thead',{},el('tr',{},head.map(x=>el('th',{scope:'col'},x)))),el('tbody',{},rows.map(row=>el('tr',{},row.map(x=>el('td',{},text(x))))))]));
const raw=(title,value)=>el('details',{},[el('summary',{},title),el('pre',{},JSON.stringify(value,null,2))]);
const record=(title,value)=>el('section',{},[el('h4',{},title),table(['Recorded measure','Exact value'],Object.entries(value??{}).filter(([,v])=>v===null||typeof v!=='object').map(([k,v])=>[label(k),v]))]);
const definitions=[
 ['charging','charging allocation',defaultCharging,['equal_share','redistribute','deadline','overcommit']],
 ['resources','resource observations',defaultResources,['last_known','fresh_only']],
 ['airport','synthetic airport wave',defaultAirport,['reactive','forecast']],
];
export function createAdvancedControls(getConfig,setConfig){
 const syncs=[];
 const element=el('section',{class:'ops-advanced-controls'},[el('h3',{},'Optional operating models'),el('p',{},'Each extension is independent. Inputs are synthetic teaching assumptions. Times below are minutes from the start of the day.')]);
 for(const [key,title,defaults,policies]of definitions){
  const enabled=el('input',{type:'checkbox','aria-label':`Enable ${title}`,on:{change:()=>setConfig({[key]:enabled.checked?defaults():undefined})}});
  const fields=el('div',{});const entries=[];
  for(const [name,value]of Object.entries(defaults())){
   if(['version','airport_id','access_rule'].includes(name))continue;
   const caption=name==='policy'?`${key==='resources'?'Resource':key==='airport'?'Airport':'Charging'} policy`:label(name);
   const unit=name.endsWith('_min')?'minutes':name==='ride_conversion'?'fraction (0 to 1)':name.includes('ports')?'ports':name==='staging_capacity'?'vehicles':name==='passengers'?'people':name==='forecast_count'?'requests':'';
   const change=()=>setConfig({[key]:{...getConfig()[key],[name]:name==='policy'?input.value:input.value===''?NaN:Number(input.value)}});
   const input=name==='policy'?el('select',{'aria-label':caption,on:{change}},policies.map(p=>el('option',{value:p},p==='overcommit'?'Counterexample: overcommit power':label(p)))):el('input',{type:'number',min:0,max:name==='ride_conversion'?1:name==='staging_capacity'?120:name.includes('ports')?12:name==='passengers'||name==='forecast_count'?1000:1440,step:name==='ride_conversion'?.01:1,value,'aria-label':`${title}: ${caption}`,on:{change}});
   entries.push([name,input]);fields.appendChild(el('label',{class:'ops-field'},[el('span',{},caption),el('span',{class:'ops-input-unit'},[input,el('small',{},unit)])]));
  }
  fields.appendChild(el('p',{},key==='airport'?'SFO anchor; fictional access rule synthetic-access-2026-09-22. Forecast is separately published synthetic input, no external airport feed.':key==='charging'?'Power is battery-side kW with unit efficiency. Queue, occupied time and delivered energy are separate. Counterexample proposals are checked before execution.':'Installed, commissioned, observed and reserved capacity are separate. Missing observations stay unknown; stale observations remain inferred.'));
  element.appendChild(el('details',{},[el('summary',{},title),el('label',{class:'ops-field'},[enabled,`Enable ${title}`]),fields]));
  syncs.push(()=>{const c=getConfig()[key];enabled.checked=!!c;fields.hidden=!c;for(const [name,input]of entries)input.value=String((c??defaults())[name]);});
 }
 return {element,sync(){syncs.forEach(fn=>fn());}};
}
export function advancedResultView(result){
 const e=result.extensions;if(!e)return el('span');
 return el('section',{},[el('h3',{},'Optional model results'),el('p',{},`One replay is descriptive only. ${e.validity}; NOT_EVIDENCE; deployment permission NONE; simulation-only.`),
 table(['Check','Status','Rejected count / violations'],e.checks.map(c=>[c.name,c.status,c.rejected_count??c.violations])),
 el('p',{},'Charging times are observed vehicle-minutes. Connected occupancy includes zero-power time. Terminal unfinished energy is kWh. Ready, missed and pending deadline counts partition visits. Completed and unfinished service are shown separately above.'),
 record('Charging: queue, active work, occupancy and terminal energy',e.charging),raw('Rejected charging proposals',e.charging.rejected_actions),
 ...(e.resources?[record('Resource observation availability',e.resources),raw('Rejected resource proposals',e.resources.rejected_actions),raw('Recovery delay by port (minutes; absent means not available)',e.resources.recovery_delay_min_by_port)]:[]),
 ...(e.airport?[record('Airport pickup cohort and observation windows (minutes)',e.airport),raw('Recorded area waiting, ready and deficit timeline',e.airport.area_timeline)]:[]),
 raw('Actual submitted inputs',result.config),raw('Full exact extension records',e)]);
}
export function resourceFrameView(resources){
 return el('section',{},[el('h4',{},'Resource observations and reservations'),el('p',{},'Simulator truth is separate from planner knowledge: observed, inferred stale or unknown.'),table(['Port','Simulator truth','Observation','Knowledge','Planner eligible','Owner','Lease expiry (minute)'],resources.ports.map(p=>[p.id,p.truth,p.observation,p.knowledge,p.planner_eligible,p.owner,p.expires_minute]))]);
}
export function airportFrameView(airport){
 return el('section',{},[el('h4',{},'Synthetic airport preparation'),el('p',{},`Staged vehicles: ${airport.staged_vehicle_ids.length}; ${airport.staged_vehicle_ids.join(', ')||'None'}`),record('Current time-valid synthetic forecast',airport.forecast),...(!airport.forecast?[el('p',{},'Forecast: Not available at this minute.')]:[])]);
}
export function advancedComparisonView(r){
 const node=el('section',{},[el('p',{},`Synthetic teaching experiment; ${r.replications} paired repetitions. NOT_EVIDENCE; deployment permission NONE.`),el('p',{},`Validity: ${r.validity}. ${r.reason??''}`)]);
 if(r.spec){const s=r.spec;node.appendChild(el('div',{class:'ops-experiment-spec'},[
  el('p',{},`Changed axis: ${s.axis.path}: ${s.axis.baseline} → ${s.axis.candidate}. All other scenario inputs are held fixed.`),
  el('p',{},`Held-out evaluation seeds: ${s.seeds.join(', ')}. Separate tuning seeds: ${s.tuning_seeds.join(', ')}.`),
  el('p',{},`Practical margin: ${s.margin} (fraction). Null treatment control: ${s.null_treatment?'enabled':'disabled'}.`)
 ]));}
 if(r.validity!=='INVALID_EXPERIMENT'&&r.per_seed?.length){
  const rows=r.per_seed.flatMap(run=>['baseline','candidate'].map(name=>{const arm=run[name],m=arm.metrics,c=arm.extensions?.charging;return [run.seed,label(name),m.total_requests,m.completed_trips,m.unserved_requests,m.pending_requests,m.in_progress_trips,m.censored_visits,c?.queue_observed_min,c?.active_observed_min,c?.unfinished_energy_kwh];}));
  node.appendChild(el('h4',{},'Service and unfinished work by seed'));
  node.appendChild(table(['Seed','Arm','Requests','Completed trips','Unserved','Waiting','In progress','Unfinished visits','Queue (vehicle-min)','Active (vehicle-min)','Terminal unfinished energy (kWh)'],rows));
  node.appendChild(el('p',{},'Queue and active totals are charging observations. Unfinished visits include all depot work. Terminal unfinished energy is the remaining charge target for unfinished visits. Missing values are not available.'));
 }
 if(r.descriptive)node.appendChild(el('p',{},'One seed is descriptive only; no interval or recommendation.'));
 if(r.analysis&&r.validity!=='INVALID_EXPERIMENT'){
  const a=r.analysis,p=a.primary;node.appendChild(el('h3',{},a.outcome));node.appendChild(el('p',{},text(a.recommendation)));
  node.appendChild(table(['Primary metric','Baseline mean','Candidate mean','Mean paired delta','Median paired delta','Interval low','Interval high'],[[p.metric,p.baseline_mean,p.candidate_mean,p.mean_delta,p.median_delta,p.ci_low,p.ci_high]]));
  node.appendChild(el('p',{},'Intervals summarize run-level paired deltas. Guardrails use mean harm and cannot compensate for one another. Practical margin and held inputs are recorded in the frozen specification.'));
  node.appendChild(table(['Guardrail','Status','Mean harm','Maximum allowed harm'],a.guardrail_statuses.map(g=>[g.metric,g.status,g.harm,g.max_harm])));
 }
 node.appendChild(raw('Frozen specification and exact per-seed records',r));
 node.appendChild(el('section',{class:'ops-result-learning'},[el('h3',{},'What this comparison teaches'),el('p',{},comparisonLearning(r)),el('p',{},'Next experiment: inspect the limiting resource, choose one assumption to vary, and freeze a new comparison. Keep the metric population and all other inputs fixed.')]));
 node.appendChild(el('a',{class:'studio-button',download:'fleetlab-bay-experiment.json',href:'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(r,null,2))},'Download full experiment JSON'));
 return node;
}
export function createAdvancedExperimentControls(compare,invalidate){
 const input=(name,value,type='text')=>el('input',{type,value,'aria-label':name,on:{change:invalidate}});
 const treatment=el('select',{'aria-label':'Paired treatment',on:{change:invalidate}},['charging_redistribution','charging_deadlines','resource_freshness','airport_forecast'].map(t=>el('option',{value:t},label(t))));
 const seeds=input('Evaluation seeds','1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012'),tuning=input('Tuning seeds','42,43,44'),margin=input('Practical margin (fraction)',.02,'number'),resamples=input('Bootstrap resamples',2000,'number'),nullTreatment=input('Null treatment control',false,'checkbox');
 margin.setAttribute('min','0');margin.setAttribute('max','1');margin.setAttribute('step','0.01');resamples.setAttribute('min','1000');resamples.setAttribute('max','10000');resamples.setAttribute('step','1');
 const parse=s=>s.trim()===''?[]:s.split(',').map(x=>x.trim()===''?NaN:Number(x));
 const options=()=>({treatment:treatment.value,seeds:parse(seeds.value),tuning_seeds:parse(tuning.value),margin:Number(margin.value),resamples:Number(resamples.value),null_treatment:nullTreatment.checked});
 const button=el('button',{type:'button',class:'studio-button studio-button-primary',on:{click:()=>compare(options())}},'Run paired policy experiment');
 const element=el('div',{class:'ops-experiment-settings'},[...[[treatment,'Treatment (requires matching extension)'],[seeds,'Evaluation seeds (comma separated, 1 to 40)'],[tuning,'Separate tuning seeds'],[margin,'Practical margin (fraction)'],[resamples,'Bootstrap resamples'],[nullTreatment,'Null control: baseline policy in both arms']].map(([control,caption])=>el('label',{class:'ops-field'},[caption,control])),button]);
 return {element,button,options,setTreatment(name){if(!['charging_redistribution','charging_deadlines','resource_freshness','airport_forecast'].includes(name))throw new RangeError('Unsupported treatment.');treatment.value=name;}};
}
