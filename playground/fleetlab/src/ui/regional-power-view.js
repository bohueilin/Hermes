/** Opt-in regional teaching view. Existing engine and paired instrument own every numerical result. */
import {el} from './dom.js';
import {AUSTIN_REGION} from '../model/region-package.js';
import {POWER_CONDITIONS,regionalPowerDemoConfig,regionalPowerProfile} from '../model/regional-power.js';
import {simulateBayAreaOperations} from '../model/bay-operations.js';
import {freezeBayExperiment,bayExperimentSteps,canonicalBayJson,bayModelVersion} from '../model/bay-experiment-contract.js';
import {createSetup,encodeSetup,decodeSetup} from './setup-codec.js';
import {number,nonzero} from './format.js';
import {modelHeader} from './model-identity.js';

const value=v=>v===null||v===undefined?'Not available':typeof v==='object'?JSON.stringify(v):String(v);
const button=(label,click)=>el('button',{type:'button',class:'studio-button',on:{click}},label);
const table=(caption,head,rows)=>el('div',{class:'ops-table-wrap',tabindex:0,'aria-label':caption},el('table',{},[
  el('caption',{},caption),el('thead',{},el('tr',{},head.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(row=>el('tr',{},row.map(v=>el('td',{},value(v))))))]));
const exact=(label,record)=>el('details',{},[el('summary',{},label),el('pre',{},JSON.stringify(record,null,2))]);
const defaultOptions=()=>({treatment:'charging_deadlines',seeds:Array.from({length:12},(_,i)=>1001+i),tuning_seeds:[42,43,44],margin:.02,resamples:2000,null_treatment:false});
const yieldPage=()=>new Promise(resolve=>setTimeout(resolve,0));
function download(label,name,record){
  const link=el('a',{download:name,class:'studio-button'},label);
  link.addEventListener('click',()=>link.setAttribute('href','data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(record))));
  return link;
}
function schematic(){
  const svg=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;return n;};
  const graph=svg('svg',{viewBox:'0 0 660 320',role:'img','aria-label':'Synthetic Austin schematic: Site A at North neighborhood, Site B at East neighborhood. No real roads.'});
  const point=p=>[100+p.x*.05,270-p.y*.022],byId=new Map(AUSTIN_REGION.geometry.nodes.map(p=>[p.id,p]));
  for(const [a,b] of AUSTIN_REGION.geometry.edges){const pa=point(byId.get(a)),pb=point(byId.get(b));graph.appendChild(svg('line',{x1:pa[0],y1:pa[1],x2:pb[0],y2:pb[1],stroke:'#9bab9c','stroke-width':5}));}
  for(const p of byId.values()){const [x,y]=point(p),depot=AUSTIN_REGION.depots.find(d=>d.place_id===p.id);graph.appendChild(svg('circle',{cx:x,cy:y,r:8,fill:depot?'#d5903b':'#236457'}));graph.appendChild(svg('text',{x:x+13,y:y-12,fill:'#203a32','font-size':14},p.label));if(depot)graph.appendChild(svg('text',{x:x+13,y:y+8,fill:'#71511f','font-size':12},depot.label));}
  return el('figure',{class:'regional-power-graph'},[graph,el('figcaption',{},'Schematic graph · local meters converted to kilometers. All locations, edges, demand and operating parameters are synthetic. America/Chicago is a display label; the model uses elapsed minutes.')]);
}
function resources(c){const r=c.resources;return el('p',{},r?`This setup includes a ${r.delay_min}-minute resource-observation delay and ${r.outage_ports} charging port(s) per depot out from minute ${r.outage_start_min} to ${r.outage_end_min}.`:'Resource observations are not modeled in this setup.');}
// Shift the stored decimal without losing a near-threshold digit to multiplication.
function decimal(v,scale){
  const [base,e=0]=String(Math.abs(v)).split('e'),digits=base.replace('.',''),point=(base.includes('.')?base.indexOf('.'):base.length)+Number(e)+(scale===100?2:0);
  const text=(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point)).replace(/^0+(?=\d)/,'');
  return (v<0?'-':'')+text;
}
function thresholdFormat(values,limits,scale=1){
  let d=2;
  const displayed=v=>Number(number(v*scale,d).replaceAll(',',''));
  for(;d<=6;d++)if(values.every(v=>limits.every(t=>Math.sign(v-t)===Math.sign(displayed(v)-displayed(t)))))break;
  return (v,sign=false)=>d<=6?nonzero(v*scale,d,{withSign:sign}):(sign&&v>0?'+':'')+decimal(v,scale);
}
const railLabels={max_request_wait_min:['Maximum request wait','min'],unfinished_visits:['Unfinished depot visits','per seed'],terminal_energy_kwh:['Terminal energy','kWh'],rejected_actions:['Rejected actions','per seed']};
function verdict(r){
  const a=r.analysis,p=a.primary,m=r.spec.primary.equivalence_margin,f=thresholdFormat([p.mean_delta,p.ci_low,p.ci_high],[-m,m],100);
  const relation={IMPROVED:`above the +${f(m)}-point improvement margin`,REGRESSED:`below the -${f(m)}-point regression margin`,UNCHANGED:`inside the ±${f(m)}-point equivalence band`,INCONCLUSIVE:'crossing a practical-margin boundary'};
  const root=el('div',{class:'regional-verdict'},el('p',{},`${r.spec.null_treatment?'Same-policy control':'Deadline priority'} changed completion by ${f(p.mean_delta,true)} percentage points (95% interval ${f(p.ci_low,true)} to ${f(p.ci_high,true)}), ${relation[a.outcome]} → ${a.outcome}.`));
  for(const g of a.guardrail_statuses){
    const [label,unit]=railLabels[g.metric]??[g.metric,'fraction'],direction=r.spec.guardrails.find(d=>d.metric===g.metric).direction;
    const f=thresholdFormat(g.harm===null?[]:[g.harm],[g.max_harm]),allowed=decimal(g.max_harm,1);
    const change=g.status==='NOT_EVALUABLE'?`${label}: not evaluable; allowed ${allowed} ${unit}.`:`${label} ${g.harm===0?`did not change (${f(0)} ${unit})`:`${(direction==='higher_is_better')===(g.harm>0)?'fell':'rose'} by ${f(Math.abs(g.harm))} ${unit}`}; allowed ${allowed} → ${g.status==='REGRESSED'?'HOLD':'within allowance'}.`;
    root.appendChild(el('p',{},change));
  }
  const next={ADVANCE_TO_NEXT_TEST:'Advance to the next simulation test → ADVANCE_TO_NEXT_TEST.',RUN_MORE_EXPERIMENTS:'Run more experiments to resolve the interval → RUN_MORE_EXPERIMENTS.',NO_RECOMMENDATION:'No change is recommended within this equivalence band → NO_RECOMMENDATION.',HOLD:'Completion regressed beyond its practical margin → HOLD.'};
  if(a.recommendation!=='HOLD'||!a.guardrail_statuses.some(g=>g.status==='REGRESSED'))root.appendChild(el('p',{},next[a.recommendation]));
  return root;
}
function runView(r){
  const m=r.metrics,x=r.extensions,c=x.charging,root=el('section',{},[
    el('h3',{},'Recorded Austin shift'),el('p',{class:'result-provenance'},`Seed ${r.config.seed} · ${r.version} · ${x.validity} · Simulation only · NOT_EVIDENCE · deployment permission NONE.`),
    el('p',{},`Submitted condition ${r.config.site_power_profile.condition_id} at ${r.config.site_power_profile.site_id}; ${r.config.duration_hours} hours, ${r.config.fleet_size} vehicles, nominal ${r.config.site_power_kw} kW per site.`),
    resources(r.config),
    table('Every request at the horizon',['All requests','Completed','Unserved','Waiting','Assigned / boarding / trip'],[[m.total_requests,m.completed_trips,m.unserved_requests,m.pending_requests,m.in_progress_trips]]),
    table('Readiness, unfinished work and energy',['Measure','Recorded value'],[
      ['Ready by deadline (visits)',c.ready_by_deadline],['Missed deadline (visits)',c.missed_deadline],['Deadline pending (visits)',c.deadline_pending],
      ['Unfinished visits',m.censored_visits],['Unfinished required tasks',r.readiness?.metrics.unfinished_tasks],['Remaining charge targets (kWh)',c.unfinished_energy_kwh],
      ['Charging queue (vehicle-min)',c.queue_observed_min],['Charging active (vehicle-min)',c.active_observed_min],['Connected zero-power (vehicle-min)',c.zero_power_vehicle_min],
      ['Terminal fleet energy (kWh)',m.final_energy_kwh],['Delivered energy (kWh)',m.energy_delivered_kwh],['Energy balance error (kWh)',m.energy_balance_error_kwh],
      ['Rejected power proposals',c.rejected_actions.length],['All-request within-target pickup',null]]),
    el('p',{},'Completion is the registered primary metric. All-request within-target pickup is not registered for this experiment. Deadline counts partition depot visits; readiness requires all serial work. Power is battery-side with unit efficiency, without auxiliary or thermal behavior.'),
    table('Service by origin',['Origin','All','Completed','Unserved','Waiting','In progress'],m.by_place.map(p=>[p.label,p.total_requests,p.completed_trips,p.unserved_requests,p.pending_requests,p.in_progress_trips])),
  ]);
  const display=el('div'),minute=el('input',{type:'range',min:0,max:r.frames.length-1,step:1,value:Math.min(90,r.frames.length-1),'aria-label':'Regional recorded minute',on:{input:render}});
  const car=el('select',{'aria-label':'Regional vehicle',on:{change:render}},r.frames[0].vehicles.map(v=>el('option',{value:v.id},v.id)));
  root.appendChild(el('section',{},[el('h4',{},'Inspect the resource constraint'),el('label',{},['Elapsed minute',minute]),el('label',{},['Vehicle',car]),display]));
  function render(){const f=r.frames[Number(minute.value)],v=f.vehicles.find(v=>v.id===(car.value||'car-1'));
    display.replaceChildren(el('p',{},`Recorded minute ${f.minute}; allocation applies to [${f.minute}, ${f.minute+1})${f.minute===r.frames.length-1?' only as a terminal observation; no energy delivered':''}.`),
      table('Site power and work queues',['Site','Usable cap (kW)','Delivered (kW)','Charging queue','Connected','Cleaning queue','Workers used / capacity'],f.depot_queues.map(d=>[d.depot_id,d.usable_site_kw,d.charging_kw,d.charging,d.active.charging,d.cleaning,d.cleaning_workers?`${d.cleaning_workers.in_use} / ${d.cleaning_workers.capacity}`:null])),
      table('Selected vehicle',['Car','State','Place / depot','Battery (kWh)','Power (kW)','Recorded blocker'],[[v.id,v.state,v.node??v.depot_id,v.soc_kwh,v.power_kw,v.resource_blocked??v.readiness?.blocked_reason??'None recorded']]),
      exact('Selected vehicle required work and visits',r.visits.filter(visit=>visit.vehicle_id===v.id)),
      exact('Port truth, observations and reservations',f.depot_queues.map(d=>({site:d.depot_id,resources:d.resources}))),
    );
  }
  render();
  root.appendChild(exact('Exact submitted configuration and graph provenance',{config:r.config,region:r.region}));
  root.appendChild(exact('Exact minute-by-minute power trace',x.site_power));
  root.appendChild(download('Download regional shift JSON','fleetlab-regional-power-run.json',r));
  return root;
}
export function comparisonView(r){
  const root=el('section',{},[el('h3',{},'Redistribution versus deadline priority'),el('p',{},`${r.replications} paired seeds · ${r.validity} · NOT_EVIDENCE · deployment permission NONE.`),
    el('p',{},'Both arms receive identical demand and external power conditions. Only charging.policy changes. Same-policy controls retain the baseline in both arms.'),
    el('p',{},`Submitted condition ${r.spec.baseline.site_power_profile.condition_id}; ${r.spec.baseline.duration_hours} hours, ${r.spec.baseline.fleet_size} vehicles, nominal ${r.spec.baseline.site_power_kw} kW per site.`),
    resources(r.spec.baseline),
    exact('Frozen experiment inputs, versions and graph provenance',{spec:r.spec,digest:r.digest,region:r.region}),
  ]);
  if(r.validity!=='VALID'){root.appendChild(el('p',{role:'alert'},r.reason??'Comparison unavailable.'));return root;}
  if(r.descriptive)root.appendChild(el('p',{},'One seed is descriptive; no interval or recommendation.'));
  if(r.analysis){root.appendChild(verdict(r));const details=exact('Exact comparison values',{analysis:r.analysis,primary:r.spec.primary,guardrails:r.spec.guardrails});details.className='regional-exact-values';root.appendChild(details);}
  root.appendChild(table('Complete service and work by seed',['Seed','Arm','All requests','Completed','Unserved','Waiting','In progress','Ready / missed / pending deadlines','Unfinished visits','Unfinished tasks','Ending kWh','Rejected power'],r.per_seed.flatMap(pair=>['baseline','candidate'].map(arm=>{const a=pair[arm],m=a.metrics,c=a.extensions.charging;return [pair.seed,arm,m.total_requests,m.completed_trips,m.unserved_requests,m.pending_requests,m.in_progress_trips,`${c.ready_by_deadline} / ${c.missed_deadline} / ${c.deadline_pending}`,m.censored_visits,a.readiness?.metrics.unfinished_tasks,m.final_energy_kwh,c.rejected_actions.length];}))));
  root.appendChild(el('p',{},'A policy can improve completion and still worsen a guardrail. An unchanged result can mean the affected site was not binding. Test full power, 60%, 20%, and an outage separately; only tested conditions support conclusions. Rejected proposals are distinct from invalid simulator accounting.'));
  root.appendChild(el('ul',{},r.limitations.map(t=>el('li',{},t))));
  root.appendChild(download('Download regional paired experiment JSON','fleetlab-regional-power-experiment.json',r));
  return root;
}
export function createRegionalPowerPanel(){
  let config=regionalPowerDemoConfig(),options=defaultOptions(),result=null,lastRun=null,lastExperiment=null,stale=false,busy=false,token=0,destroyed=false;
  const identity=modelHeader('Austin power and readiness','Fictional Austin-inspired schematic (not imported roads)',bayModelVersion(config)),heading=el('h2',{tabindex:-1},'What happens when charging power falls during the shift?'),shareSlot=el('div');
  const status=el('p',{role:'status'},'Configure a synthetic condition, then run explicitly.'),results=el('div',{class:'regional-power-results'}),comparisons=el('div',{class:'regional-power-comparison'}),timeline=el('div'),resultLabel=el('p',{class:'regional-result-context',role:'note'}),fields=new Map();
  const condition=el('select',{'aria-label':'Regional power condition',on:{change:()=>{
    const p=POWER_CONDITIONS.find(p=>p.id===condition.value);if(!p)return;
    config.site_power_profile=regionalPowerProfile(p.id,Math.ceil(config.duration_hours*60),config.site_power_profile.site_id);invalidate();renderTimeline();
  }}},[...POWER_CONDITIONS.map(p=>el('option',{value:p.id,selected:p.id==='moderate'},p.label)),el('option',{value:'custom',disabled:true},'Custom shared profile')]);
  function number(label,key,min,max){const control=el('input',{type:'number',value:config[key],min,max,'aria-label':label,on:{input:()=>{config[key]=control.value===''?NaN:Number(control.value);invalidate();renderTimeline();}}});fields.set(key,control);return el('label',{class:'ops-field'},[label,control]);}
  const seeds=el('input',{type:'text',value:options.seeds.join(','),'aria-label':'Regional evaluation seeds',on:{input:()=>{options.seeds=seeds.value.split(',').map(s=>s.trim()===''?NaN:Number(s));invalidate();}}});
  const nullControl=el('input',{type:'checkbox','aria-label':'Regional same-policy control',on:{change:()=>{options.null_treatment=nullControl.checked;invalidate();}}});
  const runButton=button('Run Austin shift',()=>run()),compareButton=button('Compare Austin charging policies',()=>compare()),cancelButton=button('Cancel regional computation',()=>cancel());cancelButton.disabled=true;
  const element=el('details',{class:'ops-regional-power'},[el('summary',{},'Regional stress lab: Austin power and readiness'),
    el('p',{class:'eyebrow'},'TX-AUS-01 / REGIONAL POLICY STRESS TEST'),heading,identity.element,shareSlot,
    el('p',{},'Austin-inspired operating testbed. Compare existing capped redistribution with deadline/aged priority, holding the fleet, demand, required work and external conditions fixed.'),
    el('p',{class:'result-provenance'},'Simulation only · NOT_EVIDENCE · deployment permission NONE. Synthetic inputs; no real operating, airport-access or vehicle-safety claim.'),schematic(),
    el('div',{class:'ops-fields'},[el('label',{class:'ops-field'},['Condition at the selected site',condition]),number('Regional nominal site power (kW)','site_power_kw',.01,10000),number('Regional fleet size','fleet_size',1,120),number('Regional demand per hour','requests_per_hour',0,240),number('Regional demand seed','seed',0,4294967295)]),timeline,
    el('p',{},'Two fixed fictional depots. The table specifies the complete elapsed-time condition; the other site retains its nominal cap. No new heat physics or demand model.'),
    el('div',{class:'ops-run-line'},[runButton,compareButton,cancelButton]),status,
    el('details',{},[el('summary',{},'Paired experiment controls'),el('label',{class:'ops-field'},['Evaluation seeds',seeds]),el('label',{class:'ops-field'},[nullControl,'Same-policy control']),el('p',{},'Defaults: tuning seeds 42, 43, 44; evaluation 1001 to 1012; completion margin 0.02; 2,000 bootstrap resamples. Complete submitted settings are recorded with each result.')]),resultLabel,results,comparisons]);
  function renderTimeline(){timeline.replaceChildren(table('External power condition, equal in both arms',['Site','Start minute inclusive','End minute exclusive','Fraction','Usable battery-side kW'],config.site_power_profile.segments.map(s=>[config.site_power_profile.site_id,s.start_minute,s.end_minute,s.fraction,s.fraction*config.site_power_kw])));}
  function invalidate(){token++;stale=!!result;identity.update(result?.version??bayModelVersion(config),stale);if(result)resultLabel.textContent='Recorded shift below uses previous settings; its submitted condition remains attached.';status.textContent=result?'Settings changed. Recorded results use previous settings. Run or compare again.':'Settings changed. Run explicitly to compute.';comparisons.replaceChildren();}
  function cancel(){token++;status.textContent='Regional computation canceled. Any recorded result still uses its original settings.';}
  function snapshot(){return structuredClone({model:'regional-power',config,options});}
  function getSharedSetup(source='current'){
    const s=source==='current'?snapshot():source==='last-run'?lastRun:source==='last-experiment'?lastExperiment:null;
    if(!s)throw new RangeError('No completed regional run or experiment for this snapshot. Run first.');return structuredClone(s);
  }
  function loadSharedSetup(setup){const checked=setup.schema?decodeSetup(encodeSetup(setup)):createSetup(setup);if(checked.model!=='regional-power')throw new RangeError('Unsupported regional setup model.');
    config=checked.config;options=checked.options;invalidate();for(const [key,input] of fields)input.value=String(config[key]);seeds.value=options.seeds.join(',');nullControl.checked=options.null_treatment;
    const matched=POWER_CONDITIONS.find(p=>canonicalBayJson(regionalPowerProfile(p.id,Math.ceil(config.duration_hours*60),config.site_power_profile.site_id))===canonicalBayJson(config.site_power_profile));condition.value=matched?.id??'custom';renderTimeline();element.open=true;return snapshot();
  }
  async function execute(paired){
    if(busy||destroyed)return;let submitted,frozen;
    try{submitted=createSetup(snapshot());frozen=freezeBayExperiment(submitted.config,submitted.options);}catch(e){status.textContent=`Regional setup unavailable: ${e.message}`;return;}
    const current=++token;busy=true;runButton.disabled=compareButton.disabled=true;cancelButton.disabled=false;status.textContent=paired?'Running matched policy arms…':'Computing Austin shift…';
    await yieldPage();
    try{
      if(destroyed||token!==current)return;
      if(paired){const steps=bayExperimentSteps(frozen);let step;
        do{step=steps.next();if(!step.done){status.textContent=`Regional comparison: ${step.value.phase}, ${step.value.completed} / ${step.value.total}.`;await yieldPage();if(destroyed||token!==current){steps.return();return;}}}while(!step.done);
        if(destroyed||token!==current)return;lastExperiment={model:submitted.model,config:submitted.config,options:submitted.options};comparisons.replaceChildren(comparisonView(step.value));if(!result)identity.update(step.value.spec.model_version);status.textContent='Comparison recorded. Review completion, guardrails and unfinished work together.';return step.value;
      }
      const run=simulateBayAreaOperations(submitted.config);if(destroyed||token!==current)return;
      result=run;identity.update(run.version);lastRun={model:submitted.model,config:submitted.config,options:submitted.options};stale=false;resultLabel.textContent='Recorded shift matches the submitted settings.';results.replaceChildren(runView(run));status.textContent='Austin shift recorded. Inspect power, required work and complete request populations.';return run;
    }catch(e){if(!destroyed&&token===current)status.textContent=`Regional computation unavailable: ${e.message}`;}
    finally{busy=false;if(!destroyed){runButton.disabled=compareButton.disabled=false;cancelButton.disabled=true;}}
  }
  function run(){return execute(false);}function compare(){return execute(true);}
  renderTimeline();return {element,heading,shareSlot,run,compare,cancel,getSharedSetup,loadSharedSetup,getState:()=>({config:structuredClone(config),result,stale,busy}),destroy(){destroyed=true;token++;}};
}
