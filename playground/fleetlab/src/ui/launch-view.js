/** Configuration-driven rehearsal UI; validation and simulation stay in the model. */
import {el} from './dom.js';
import {createLaunchConfig,validateLaunchConfig,compareCommissioning} from '../model/launch-rehearsal.js';
import {decisionForConfig,decisionView} from './scenario-learning.js';

const value=v=>v===null||v===undefined?'Not available':typeof v==='object'?JSON.stringify(v):String(v);
const table=(title,head,rows)=>el('div',{class:'ops-table-wrap',tabindex:0,'aria-label':title},el('table',{},[
 el('caption',{},title),el('thead',{},el('tr',{},head.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(row=>el('tr',{},row.map(v=>el('td',{},value(v))))))]));
const button=(title,fn)=>el('button',{type:'button',class:'studio-button',on:{click:fn}},title);
const metrics=[['All requests','requests'],['Pickups within target','pickup_within_target'],['Late pickups','pickup_late'],['Missed pickups','pickup_missed'],['Pickup outcome pending','pickup_pending'],['Within-target fraction, all requests','pickup_within_target_fraction'],['Completed trips','completed_trips'],['Completion fraction, all requests','completion_fraction'],['Unfinished depot visits','unfinished_visits'],['Unfinished required tasks','unfinished_tasks'],['All-visit queue (task-min)','queue_observed_min'],['All-visit active (task-min)','active_observed_min'],['Terminal energy (kWh)','terminal_energy_kwh']];

export function launchComparisonView(r){
 const root=el('section',{},[el('h3',{},'What did commissioning change?'),el('p',{},`Rehearsal validity: ${r.validity}. ${r.reason??''}`)]);
 if(r.validity!=='VALID'||!r.comparison?.comparable){root.appendChild(el('p',{},r.comparison?.reason??'No compatible comparison is available.'));return root;}
 const arms=[r.baseline,r.candidate],s=r.spec;
 root.appendChild(el('p',{},`Only commissioning time changes: ${s.baseline_delay_minutes} → ${s.delay_minutes} elapsed minutes. Region: ${s.region_id}. Seed: ${s.seed}. Observation: ${s.horizon_minutes} minutes.`));
 root.appendChild(el('p',{},'One seed is descriptive; no confidence interval, winner or operational recommendation. NOT_EVIDENCE; simulation-only; deployment permission NONE.'));
 root.appendChild(table('Service, unfinished work and energy',['Measure','Immediate commissioning','Delayed commissioning','Candidate minus baseline'],metrics.map(([label,key])=>[label,...arms.map(a=>a.launch.metrics[key]),r.comparison.deltas?.[key]])));
 root.appendChild(table('Every request at observation end',['Arm','All','Completed','Unserved','Waiting','Assigned / boarding / trip'],arms.map((a,i)=>[i?'Delayed':'Immediate',...['total_requests','completed_trips','unserved_requests','pending_requests','in_progress_trips'].map(k=>a.metrics[k])])));
 root.appendChild(el('p',{},`Pickup is arrival before boarding/dwell. The target is ${s.pickup_target_min} minutes from request creation. Every request stays in the denominator: within target, late, known missed, or outcome pending. Completion is a different event boundary. Queue and active totals include unfinished visits.`));
 for(const [i,a]of arms.entries()){
  const x=a.launch;
  root.appendChild(el('details',{},[el('summary',{},`${i?'Delayed':'Immediate'}: infrastructure and checks`),
   table('Capacity at shift boundaries',['Boundary','Depot','Installed ports','Commissioned ports','Commissioned kW','Site kW'],['initial','terminal'].flatMap(boundary=>(x[`${boundary}_capacity`]??[]).map(d=>[boundary,d.depot_id,d.installed_ports,d.commissioned_ports,d.commissioned_kw,d.site_power_kw]))),
   table('Named checks',['Check','Status','Detail'],(x.checks??[]).map(c=>[c.name,c.status,c.detail??c.reason??c.violations])),
   table('Setup progress and observation limits',['Measure','Recorded value'],Object.entries(x.setup??{})),
   table('Mock event outcomes',['Recorded event'],(x.actions??[]).map(a=>[a])),
   el('ul',{},(x.limitations??[]).map(t=>el('li',{},t))),
  ]));
 }
 const change=r.comparison.deltas?.pickup_within_target;
 root.appendChild(el('section',{class:'ops-result-learning'},[el('h3',{},'What this rehearsal teaches'),
  el('p',{},change===null||change===undefined?'Pickup comparison is unavailable. Inspect the population and validation checks.':`With the same external demand, delayed commissioning changed within-target pickups by ${change}. This is an observed count in this run; inspect unfinished work and energy before interpreting the service effect.`),
  el('p',{},'Planned hardware is not usable capacity. An unchanged outcome can mean another constraint binds, or that the affected resource was not needed during this window. Next, try a zero-minute delay as a negative control, or change one site resource and repeat both arms.'),
 ]));
 const timeline=el('div',{class:'launch-timeline'});
 const armSelect=el('select',{'aria-label':'Rehearsal replay arm',on:{change:render}},[el('option',{value:'baseline'},'Immediate commissioning'),el('option',{value:'candidate'},'Delayed commissioning')]);
 const minute=el('input',{type:'range',min:0,max:r.baseline.frames.length-1,value:0,step:1,'aria-label':'Rehearsal minute',on:{input:render}});
 root.appendChild(el('details',{},[el('summary',{},'Inspect a recorded shift minute'),el('label',{},['Replay arm',armSelect]),el('label',{},['Elapsed minute',minute]),timeline]));
 function render(){const a=r[armSelect.value||'baseline'],f=a.frames[Number(minute.value)];
  timeline.replaceChildren(el('p',{},`Recorded minute ${f.minute}. ${a.config.launch.region.label}; local clock ${f.clock_minute} minutes after midnight.`),
   table('Vehicles at this minute',['Car','State','Place / depot','Battery (kWh)','Blocked reason'],f.vehicles.map(v=>[v.id,v.state,v.node??v.depot_id,v.soc_kwh,v.resource_blocked??v.readiness?.blocked_reason??'None'])),
   table('Depot queues at this minute',['Site','Charging kW','Workers used / capacity','Software queue','Cleaning queue','Charging queue','Upload queue'],f.depot_queues.map(d=>[d.depot_id,d.charging_kw,d.cleaning_workers?`${d.cleaning_workers.in_use} / ${d.cleaning_workers.capacity}`:null,d.software,d.cleaning,d.charging,d.upload])),
   table('Port state at this minute',['Port','Installed','Commissioned','Healthy','Unreserved','Planner eligible','Planner knowledge','Owner','Lease expiry'],f.depot_queues.flatMap(d=>(d.resources?.ports??[]).map(p=>[p.id,p.truth.installed,p.truth.commissioned,p.truth.healthy,p.truth.available,p.planner_eligible,p.knowledge,p.owner,p.expires_minute]))));
 }
 render();
 root.appendChild(el('details',{},[el('summary',{},'Exact submitted configurations and recorded results'),el('pre',{},JSON.stringify(r,null,2))]));
 root.appendChild(el('a',{class:'studio-button',download:'fleetlab-launch-rehearsal.json',href:'data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(r))},'Download launch rehearsal JSON'));
 return root;
}

export function createLaunchPanel(){
 let config=createLaunchConfig('peninsula'),delay=90,result=null,token=0,destroyed=false,busy=false;
 const taskRefresh=[];
 const status=el('p',{role:'status'},'Choose a template, configure differences, validate, then rehearse.'),checks=el('div',{class:'launch-validation'}),results=el('div',{class:'launch-results'}),settings=el('div',{class:'launch-settings'});
 const select=el('select',{'aria-label':'Launch region template',on:{change:()=>chooseTemplate(select.value)}},[el('option',{value:'peninsula'},'Peninsula template'),el('option',{value:'region_b'},'Region B: fictional compact region')]);
 const runButton=button('Rehearse commissioning delay',()=>run());
 const element=el('details',{class:'ops-launch-rehearsal'},[el('summary',{},'Launch rehearsal: configure a region and test commissioning'),
  decisionView(decisionForConfig({launch:{}})),el('label',{class:'ops-field'},['1. Choose a template',select]),
  el('h3',{},'2. Configure the differences'),settings,button('3. Validate setup',()=>validate()),status,checks,runButton,results]);
 function invalidate(){token++;result=null;checks.replaceChildren();results.replaceChildren(el('p',{},'Settings changed. Validate and rehearse again.'));status.textContent='Setup has changed; previous results are unavailable.';for(const refresh of taskRefresh)refresh();}
 function input(label,current,set,{min,max,step=1,type='number'}={}){
  const edit=()=>{set(type==='number'?(control.value===''?NaN:Number(control.value)):control.value);invalidate();};
  const control=el('input',{type,value:current,'aria-label':label,...(type==='number'?{min,max,step}:{}),on:{input:edit,change:edit}});
  return el('label',{class:'ops-field'},[label,control]);
 }
 function taskView(d){const holder=el('div');const refresh=()=>holder.replaceChildren(table('Owned setup tasks',['Task','Owner','State','Dependencies'],d.tasks.map(t=>[t.label,t.owner,t.status,t.depends_on])));taskRefresh.push(refresh);refresh();return holder;}
 function portView(d){const holder=el('div');const refresh=()=>holder.replaceChildren(table('Configured charging resources',['Port','Installed','Commissioned','Healthy','Supported profiles','kW cap'],d.ports.map(p=>[p.id,p.installed,p.commissioned,p.healthy,p.compatible_vehicle_types,p.cap_kw])));taskRefresh.push(refresh);refresh();return holder;}
 function flag(label,record,key){const control=el('input',{type:'checkbox',checked:record[key],'aria-label':label,on:{change:()=>{record[key]=control.checked;invalidate();}}});return el('label',{class:'ops-field'},[label,control]);}
 function renderSettings(){taskRefresh.length=0;settings.replaceChildren(
  el('p',{},`${config.launch.region.label}. Calendar: ${config.launch.region.local_date}; ${config.launch.region.timezone}. Opening and closing are local minutes after midnight (0 to 1440); commissioning delay is elapsed shift time. No timezone or daylight-saving conversion.`),
  el('div',{class:'ops-fields'},[
   input('Rehearsal fleet size',config.fleet_size,v=>config.fleet_size=v,{min:1,max:120}),
   input('Rehearsal demand per hour',config.requests_per_hour,v=>config.requests_per_hour=v,{min:0,max:240}),
   input('Rehearsal demand seed',config.seed,v=>config.seed=v,{min:0,max:4294967295}),
   input('Commissioning delay (minutes)',delay,v=>delay=v,{min:0,max:1440}),
  ]),
  ...config.launch.depots.map((d,i)=>el('section',{class:'launch-site'},[
   el('h4',{},`${d.label} (${d.id})`),el('p',{},`Anchor: ${d.place_id}. Resource identities stay fixed across both arms.`),
   el('div',{class:'ops-fields'},[
    input(`Site ${i+1} power (kW)`,d.site_power_kw,v=>d.site_power_kw=v,{min:0,max:10000}),
    input(`Site ${i+1} qualified cleaning workers`,d.cleaning_workers,v=>d.cleaning_workers=v,{min:0,max:120}),
    input(`Site ${i+1} cleaning bays`,d.cleaning_bays,v=>d.cleaning_bays=v,{min:0,max:120}),
    input(`Site ${i+1} opening minute`,d.calendar.open_minute,v=>d.calendar.open_minute=v,{min:0,max:1440}),
    input(`Site ${i+1} closing minute`,d.calendar.close_minute,v=>d.calendar.close_minute=v,{min:0,max:1440}),
    input(`Commissioning owner for site ${i+1}`,d.tasks.at(-1).owner,v=>{const task=d.tasks.at(-1);task.owner=v;for(const e of config.launch.events)if(e.depot_id===d.id&&e.task_id===task.id)e.owner=v;},{type:'text'}),
   ]),
   taskView(d),
   portView(d),el('details',{},[el('summary',{},'Simulate an installation or health defect'),el('p',{},'An uninstalled port cannot be commissioned. An unhealthy port cannot deliver power. These physical assumptions stay the same in both comparison arms.'),...d.ports.map(p=>el('div',{class:'ops-fields'},[flag(`${p.id} installed`,p,'installed'),flag(`${p.id} healthy`,p,'healthy')]))]),
  ])),
  el('p',{},'Try a broken setup by clearing a commissioning owner, then validate to find the named blocker. Restore the owner or reload the template to continue. Pending commissioning can be rehearsed with reduced usable capacity. Setup checks do not grant launch permission.'),
 );}
 function chooseTemplate(name){config=createLaunchConfig(name);select.value=name;invalidate();renderSettings();element.open=true;}
 function validate(){const report=validateLaunchConfig(config);checks.replaceChildren(
  table('Setup validation',['Check','Status','Detail'],report.checks.map(c=>[c.name,c.status,c.detail])),
  table('Configuration counts',['Measure','Count'],Object.entries(report.summary??{})),
 );status.textContent=report.ok?'Configuration is structurally valid for a synthetic rehearsal. Inspect remaining setup blockers below.':'Configuration has blocking errors. Fix the named checks before rehearsing.';return report;}
 async function run(){if(busy||destroyed)return;const report=validate();if(!report.ok)return;
  const submitted=structuredClone(config),submittedDelay=delay,current=++token;busy=true;runButton.disabled=true;result=null;results.replaceChildren(el('p',{},'Rehearsing both arms against the same demand…'));
  await new Promise(resolve=>setTimeout(resolve,0));
  try{if(destroyed||token!==current)return;const r=compareCommissioning(submitted,submittedDelay);if(destroyed||token!==current)return;
   result=r;results.replaceChildren(launchComparisonView(r));status.textContent='Rehearsal recorded. Review service, unfinished work and infrastructure together.';return r;
  }catch(e){if(!destroyed&&token===current)results.replaceChildren(el('p',{role:'alert'},`Rehearsal unavailable: ${e.message}`));}
  finally{busy=false;if(!destroyed)runButton.disabled=false;}
 }
 renderSettings();return {element,chooseTemplate,validate,run,getState:()=>({config,result,delay}),destroy(){destroyed=true;token++;}};
}
