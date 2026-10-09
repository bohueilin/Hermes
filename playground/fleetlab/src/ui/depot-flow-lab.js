import {el} from './dom.js';
import {flowScenario,flowComparisonSteps,FLOW_RULES} from '../model/depot-flow.js';
import {FLOW_VERSIONS,FLOW_TRUST} from '../model/depot-flow-contract.js';

const minutes=s=>s===null||s===undefined?'Not observed':`${s/60} min`;
const label={on_time:'On time',late:'Late',unfinished_due:'Unfinished · deadline reached',pending:'Unfinished · deadline pending'};
const table=(caption,heads,rows,attrs={})=>el('div',{class:'flow-table',tabindex:0,role:'region','aria-label':caption,...attrs},el('table',{},[el('caption',{},caption),el('thead',{},el('tr',{},heads.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},rows.map(row=>el('tr',{},row.map((c,i)=>el(i===0?'th':'td',i===0?{scope:'row'}:{},c)))))]));
const detail=(title,children)=>el('details',{},[el('summary',{},title),...children]);
const button=(text,fn,attrs={})=>el('button',{type:'button',class:'studio-button',on:{click:fn},...attrs},text);
const settingsText=o=>`${o.uplink_gbps} Gbps uplink · B ${o.b_gb} GB · ${o.charger_kw} kW charger`;
const yieldPage=()=>new Promise(resolve=>setTimeout(resolve,0));

/** Pure text/table projection of verified records. Page-local attempts never survive a reload. */
export function createDepotFlowLab({yieldPage:yieldControl=yieldPage,steps=flowComparisonSteps}={}){
  let options={uplink_gbps:1,b_gb:7.5,charger_kw:60},result=null,resultOptions=null,attempt=null,serial=0,job=null,destroyed=false,cursor=0;
  const inputBoard=el('div',{class:'flow-input-board'}),controls=el('div',{class:'flow-controls'}),output=el('section',{class:'flow-output'});
  const status=el('p',{role:'status',class:'flow-status'},'Nothing has run yet. Explore the inputs, then run the three rules.');
  const guess=el('select',{'aria-label':'Optional guess: who will miss their deadline under first come, first served?'},[['','Choose a guess (optional)'],['A','Vehicle A'],['B','Vehicle B'],['A,B','Both vehicles'],['none','Neither vehicle']].map(([value,text])=>el('option',{value},text)));
  const runButton=button('Run the three rules',()=>run(),{class:'studio-button studio-button-primary'}),cancelButton=button('Cancel',()=>cancel(),{hidden:true});
  const element=el('main',{class:'depot-flow-lab'},[
    el('section',{class:'flow-hero'},[el('p',{class:'eyebrow'},'DEPOT FLOW LAB / TWO VEHICLES, ONE UPLINK'),el('h1',{},'Charged. Uploaded. Ready?'),el('p',{class:'flow-lede'},'Why is a charged vehicle still not ready to leave the depot? Give two vehicles the same resources, try three upload rules, and follow what holds each one back.'),el('p',{class:'flow-boundary'},'Constructed teaching example: these vehicles, workloads, capacities and departure deadlines are invented for this lesson, not measurements of a real depot.')]),
    el('section',{class:'flow-setup','aria-label':'Lesson inputs'},[inputBoard,el('div',{class:'flow-workbench'},[el('h2',{},'One shared link. Two deadlines.'),el('p',{},'In this lesson a vehicle is ready to leave when its battery is at target, its upload is complete and its two-minute post-upload step is complete.'),controls,el('p',{class:'flow-assumptions'},'Both arrive at minute 0. One charge port; one independent post-upload slot per vehicle. Charging and uploads can overlap. GB means decimal gigabytes; Gbps is useful payload capacity.'),el('label',{class:'flow-prediction'},[el('span',{},'First come, first served: who will miss their departure deadline?'),guess]),el('div',{class:'flow-actions'},[runButton,cancelButton]),status])]),
    el('section',{class:'flow-rules','aria-label':'Three upload rules'},FLOW_RULES.map((r,i)=>el('article',{},[el('span',{class:'eyebrow'},`RULE 0${i+1}`),el('h2',{},r.name),el('p',{},r.description)]))),
    output,
    el('section',{class:'flow-method'},[detail('Model, assumptions and limits',[
      el('p',{},'This small event model tracks useful bytes, energy and task dependencies in integer seconds. It contains no random draws. There are no packet losses, retransmissions, protocol overhead, charge taper, auxiliary load, software authenticity checks or physical vehicles.'),
      el('p',{},'The two-minute post-upload step is simulated depot work. Named checks independently check the model record; they do not authenticate or approve software.'),
      el('p',{},'Vehicle B is both smaller and earlier due in these settings. The example cannot isolate deadline priority from short-job priority or establish a fleet-wide benefit.'),
      el('p',{},'The horizon is set before each run from this bounded workload. A future infrastructure experiment needs one fixed horizon across all configurations, data deadlines, backlog accounting, size uncertainty and more visits.'),
      el('pre',{},JSON.stringify({...FLOW_VERSIONS,...FLOW_TRUST},null,2)),
    ]),detail('Research behind the questions',[
      el('p',{},'Chowdhury, Zhong and Stoica, Efficient Coflow Scheduling with Varys (SIGCOMM 2014). DOI: 10.1145/2619239.2626315. Motivation: optimize useful work completion, with the application’s objective made explicit. A vehicle’s data and charging tasks do not form the same network model.'),
      el('p',{},'Lee, Sharma, Johansson and Low, ACN-Sim: An Open-Source Simulator for Data-Driven Electric Vehicle Charging Research (2020 preprint). arXiv: 2012.02809. Candidate for a later charging-fidelity study; workplace charging assumptions require review before use in a depot question.'),
      el('p',{},'These references motivate questions. This lesson implements neither system and claims none of their measured performance or guarantees.'),
    ]),detail('What to study next',[
      el('p',{},'Should this depot improve scheduling, add bandwidth, or add charging capacity? Next: cross upload size with urgency, compare the same visits and horizon, and report missed departures alongside late minutes and data backlog.'),
      el('p',{},'This first lesson shows mechanisms. The task finishing last is not automatically the resource worth expanding. That requires a matched capacity intervention and an explicit objective.'),
    ])]),
  ]);

  function refreshInputs(){
    let s;try{s=flowScenario(options);runButton.disabled=false;}catch(error){runButton.disabled=true;status.textContent=error.message;}
    inputBoard.replaceChildren(...['A','B'].map((id,i)=>el('article',{class:'flow-vehicle'},[
      el('div',{class:'flow-vehicle-top'},[el('span',{class:'flow-vehicle-id','aria-hidden':'true'},id),el('h2',{},`Vehicle ${id}`)]),
      el('p',{class:'flow-deadline'},`Departure deadline · minute ${i?5:15}`),
      el('dl',{},[el('dt',{},'Upload to complete'),el('dd',{},`${i?options.b_gb:75} GB`),el('dt',{},'Energy to battery target'),el('dd',{},i?'0 kWh · already at target':'6 kWh'),el('dt',{},'After uploading'),el('dd',{},'2 min local step')]),
    ])),el('p',{class:'flow-horizon'},s?`Observe through minute ${s.horizon_s/60}. Same workload, capacity and end time for all three rules.`:'Input outside this lesson.'));
    if(controls.children.length){for(const [key,title] of [['uplink_gbps','Uplink capacity'],['b_gb','Vehicle B upload'],['charger_kw','Charger power']])controls.querySelector(`[aria-label="${title}"]`).value=String(options[key]);return;}
    controls.replaceChildren(...[
      ['uplink_gbps','Uplink capacity',[[1,'1 Gbps'],[0.5,'0.5 Gbps']]],
      ['b_gb','Vehicle B upload',[[7.5,'7.5 GB'],[15,'15 GB'],[45,'45 GB']]],
      ['charger_kw','Charger power',[[60,'60 kW'],[20,'20 kW']]],
    ].map(([key,title,choices])=>{const select=el('select',{'aria-label':title,on:{change:()=>setOptions({[key]:Number(select.value)})}},choices.map(([value,text])=>el('option',{value,selected:options[key]===value},text)));return el('label',{},[el('span',{},title),select]);}));
  }
  function setOptions(patch){cancel();options={...options,...patch};refreshInputs();renderOutput();}
  function rest(){const held=document.activeElement===cancelButton;cancelButton.hidden=true;runButton.disabled=false;if(held)runButton.focus();}
  function cancel(){if(!job)return;job.cancelled=true;attempt={...attempt,status:'cancelled'};job=null;rest();status.textContent='Cancelled. No new comparison. Partial diagnostic records are retained below.';renderOutput();}
  async function run(){
    cancel();const token={id:++serial,cancelled:false};job=token;const used={...options},prediction=guess.value;
    attempt={id:token.id,status:'running',options:used,partial:null};runButton.disabled=true;cancelButton.hidden=false;status.textContent='Computing the three rules. No completed comparison yet.';renderOutput();
    try{
      flowScenario(used); // Validate before yielding: an invalid setup cannot enter a pending computation.
      const iterator=steps(used,{shouldCancel:()=>token.cancelled});
      for(;;){await yieldControl();if(destroyed||job!==token||token.cancelled){iterator.return?.();return;}
        const next=iterator.next();
        if(!next.done){attempt.partial=next.value;continue;}
        const value=next.value;attempt={...attempt,status:value.comparison_eligible?'complete':'invalid',partial:value};
        if(value.comparison_eligible){result={...value,run_id:token.id,prediction};resultOptions=used;cursor=0;status.textContent='Three rules complete. Model consistency checked. Results are ready to inspect.';}
        else status.textContent='Comparison withheld. Inspect the failed or unavailable check and policy status in the diagnostic record.';
        break;
      }
    }catch(error){if(job!==token)return;attempt={...attempt,status:'invalid',error:String(error.message??error)};status.textContent=`Comparison withheld: ${attempt.error}`;}
    if(job===token){job=null;rest();try{flowScenario(options);}catch{runButton.disabled=true;}renderOutput();}
  }

  function renderOutput(){
    output.replaceChildren();
    if(attempt&&attempt.status!=='complete')output.appendChild(detail(`Latest attempt ${attempt.id}: ${attempt.status} · no new comparison`,[el('p',{},'These are diagnostic records, not a completed comparison.'),el('pre',{},JSON.stringify(attempt,null,2))]));
    if(!result)return;
    const old=JSON.stringify(options)!==JSON.stringify(resultOptions)||attempt?.id!==result.run_id;
    const heading=el('h2',{},old?'Result from previous setup':'Same resources. Different readiness.');output.appendChild(heading);
    if(old)output.appendChild(el('p',{class:'flow-stale'},`Run ${result.run_id} used ${settingsText(resultOptions)}. Current inputs: ${settingsText(options)}. Changes: ${Object.keys(options).filter(k=>options[k]!==resultOptions[k]).map(k=>`${resultOptions[k]} ${k==='b_gb'?'GB':k==='charger_kw'?'kW':'Gbps'} → ${options[k]} ${k==='b_gb'?'GB':k==='charger_kw'?'kW':'Gbps'}`).join('; ')||'same inputs; the latest attempt has no new completed comparison'}.`));
    output.appendChild(el('p',{class:'flow-result-note'},`Run ${result.run_id} · Synthetic teaching run. Model consistency checked. No operational authority.`));
    output.appendChild(table(`Same inputs: ${settingsText(resultOptions)}. Both arrive at 0; A 75 GB and 6 kWh, B 0 kWh; deadlines A 15 / B 5 min; 2 min post-upload steps. Horizon ${result.scenario.horizon_s/60} min.`,['Upload rule','Vehicle A ready','Vehicle B ready','On time','Late','Unfinished / pending','Total late minutes'],result.arms.map((a,i)=>{const m=a.verification.metrics;return [FLOW_RULES[i].name,...a.verification.visits.map(v=>`${minutes(v.ready_s)} · ${label[v.outcome]}`),`${m.on_time} of 2`,String(m.late),`${m.unfinished_due} / ${m.pending}`,`${m.final_lateness?'':'At least '}${m.lateness_lower_bound_s/60}`];}),{'data-flow-outcomes':''}));
    const fifo=result.arms[0].verification.metrics,share=result.arms[1].verification.metrics,deadline=result.arms[2].verification.metrics;
    const delta=deadline.ready_s.A-fifo.ready_s.A;
    const explanation=el('section',{class:'flow-reading'},[el('h3',{},'What this run shows'),el('p',{},`Vehicle B is ready at ${minutes(fifo.ready_s.B)} with first come, first served, ${minutes(share.ready_s.B)} with equal sharing, and ${minutes(deadline.ready_s.B)} with departure deadline first.`),el('h3',{},'Who became ready later?'),el('p',{},delta>0?`Vehicle A becomes ready ${delta/60} min later with departure deadline first than with first come, first served. Read missed deadlines and late minutes together; one measure can improve while the other worsens.`:'Vehicle A has the same ready time under first come, first served and departure deadline first in this configuration. Its charging or post-upload dependency can mask an upload change.'),el('p',{},`Equal sharing meets ${share.on_time} of 2 deadlines without using deadline information. B is also the smaller upload here, so this example does not establish that deadline priority is better than short-job priority.`),el('h3',{},'Next test to try'),el('p',{},'Try B at 45 GB to separate the number of missed deadlines from total late minutes. Try a 20 kW charger to see when energy, rather than upload order, determines A’s readiness.')]);
    if(result.prediction){const missed=result.arms[0].verification.visits.filter(v=>v.outcome==='late'||v.outcome==='unfinished_due').map(v=>v.vehicle).join(',')||'none';explanation.appendChild(el('p',{},`Your guess: ${result.prediction==='none'?'neither vehicle':result.prediction}. This run’s first-come outcome: ${missed==='none'?'neither vehicle misses':`vehicle ${missed} misses`}.`));}
    output.appendChild(explanation);
    output.appendChild(table('Individual earliest readiness · ideal lower bounds, not a joint schedule',['Vehicle','Earliest possible','Deadline','What the bound tells us'],result.bounds.map(b=>[b.vehicle,minutes(b.earliest_s),minutes(b.deadline_s),b.individually_impossible?'Impossible even with the full link and charger alone':'Individual bound fits; joint feasibility is not established'])));
    output.appendChild(detail('How the lower bound is calculated',[el('p',{},'For each vehicle: max(energy / full charger power, upload / full uplink + post-upload time), from arrival at zero. This ideal bound does not account for competition from the other vehicle. A bound past the deadline makes that deadline impossible in this model.')]));
    output.appendChild(el('h3',{},'Trace the wait. Inspect the dependency.'));
    output.appendChild(el('p',{},'Static upload lanes: filled = active, outlined = waiting for the link, dotted = upload finished. The deadline marker is for departure, which also requires energy and the post-upload step. Tables below carry the same intervals.'));
    output.appendChild(el('div',{class:'flow-timelines'},result.arms.map((a,i)=>timeline(a,FLOW_RULES[i]))));
    const times=[...new Set([0,result.scenario.horizon_s,...result.arms.flatMap(a=>a.record.events.map(e=>e.time_s))])].sort((a,b)=>a-b);
    const readout=el('div',{'data-cursor-state':''});
    const slider=el('input',{type:'range',min:0,max:result.scenario.horizon_s,step:60,value:cursor,'aria-label':'Inspect minute across all three rules',on:{input:()=>{cursor=Number(slider.value);renderCursor();}}});
    const previous=button('Previous event',()=>seek([...times].reverse().find(t=>t<cursor)??0));
    const next=button('Next event',()=>seek(times.find(t=>t>cursor)??result.scenario.horizon_s),{'data-next-event':''});
    function seek(t){cursor=t;slider.value=String(t);renderCursor();}
    function renderCursor(){previous.disabled=cursor===0;next.disabled=cursor===result.scenario.horizon_s;slider.setAttribute('aria-valuetext',`Minute ${cursor/60}`);readout.replaceChildren(table(`Minute ${cursor/60} · state after events at this time`,['Rule','Vehicle','Upload received','Energy received','Readiness'],result.arms.flatMap((a,i)=>a.record.scenario.vehicles.map(v=>{let bytes=0,joules=0;for(const n of a.record.intervals){const dt=Math.max(0,Math.min(cursor,n.end_s)-n.start_s);bytes+=dt*(n.upload[v.id]??0);joules+=dt*(n.charge[v.id]??0);}const ready=a.record.events.find(e=>e.vehicle===v.id&&e.type==='ready'&&e.time_s<=cursor);return [FLOW_RULES[i].name,v.id,`${bytes/1e9} / ${v.upload_bytes/1e9} GB`,`${Number((joules/36e5).toFixed(3))} / ${v.energy_j/36e5} kWh`,ready?`Ready at ${minutes(ready.time_s)}`:cursor>=v.deadline_s?'Not ready · deadline reached':'Not ready yet'];}))));}
    renderCursor();output.appendChild(detail('Inspect exact events across all rules',[el('p',{},'Use event buttons for exact boundaries or move the minute cursor. No interpolation or animation.'),el('div',{class:'flow-actions'},[previous,next]),slider,readout]));
    output.appendChild(detail('Named checks · independently reconstructed',[el('p',{},'Checks replay the accepted service intervals, reconstruct bytes and energy, check capacities and prerequisites, and compare the exact completion inventory. A policy error prevents comparison even if earlier intervals conserve work.'),...result.arms.map((a,i)=>detail(FLOW_RULES[i].name,[el('p',{},`Model validity: ${a.verification.model_validity}. Policy: ${a.record.policy_status}. Execution: ${a.record.execution_status}.`),table('Recorded model checks',['Check','Status','Exact rule'],a.verification.checks.map(c=>[c.name,c.status,c.rule]))]))]));
    output.appendChild(detail('Exact event ledger, inputs and export',[button('Download this run as JSON',()=>{const blob=new Blob([exportJSON()],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a',{href:url,download:`fleetlab-depot-flow-run-${result.run_id}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}),el('pre',{},exportJSON())]));
  }

  function timeline(arm,rule){
    const {record:r,verification:v}=arm,h=r.scenario.horizon_s;
    const lanes=r.scenario.vehicles.map(vehicle=>{
      const done=v.visits.find(x=>x.vehicle===vehicle.id).tasks.upload;
      const bars=r.intervals.map(i=>{const active=(i.upload[vehicle.id]??0)>0;const state=active?'active':done!==undefined&&i.start_s>=done?'finished':'waiting';const span=el('span',{class:`flow-segment flow-${state}`,title:`${i.start_s/60} to ${i.end_s/60} min: ${state}`});span.style.width=`${100*(i.end_s-i.start_s)/h}%`;return span;});
      const marker=el('span',{class:'flow-deadline-marker'});marker.style.left=`${100*vehicle.deadline_s/h}%`;
      return el('div',{class:'flow-lane'},[el('span',{},`Vehicle ${vehicle.id} · due ${vehicle.deadline_s/60} min`),el('div',{class:'flow-track','aria-hidden':'true'},[...bars,marker])]);
    });
    const rows=r.intervals.flatMap(i=>r.scenario.vehicles.map(vehicle=>{const rate=i.upload[vehicle.id]??0,visit=v.visits.find(x=>x.vehicle===vehicle.id);const holders=Object.entries(i.upload).filter(([,n])=>n>0).map(([id])=>id).join(', ');const state=rate?Object.values(i.upload).filter(n=>n>0).length>1?'Active · sharing link':'Active · full link':visit.tasks.upload!==undefined&&i.start_s>=visit.tasks.upload?'Upload finished':`Waiting for uplink · held by ${holders||'none; no capacity'}`;return [`${i.start_s/60} to ${i.end_s/60} min`,vehicle.id,state,`${rate} bytes/s`,`interval ${i.id}`];}));
    return el('article',{class:'flow-timeline'},[el('h4',{},rule.name),...lanes,el('p',{class:'flow-axis'},`0 min → ${h/60} min`),detail('Table and vehicle task histories',[table('Upload allocations and recorded wait holders',['Interval','Vehicle','State / reason','Accepted rate','Ledger reference'],rows),...v.visits.map(visit=>{const vehicle=r.scenario.vehicles.find(x=>x.id===visit.vehicle);const last=Math.max(...Object.values(visit.tasks));const tasks=Object.entries(visit.tasks).filter(([,t])=>t===last).map(([k])=>k==='post'?'post-upload step':k);return el('section',{},[el('h5',{},`Vehicle ${visit.vehicle} · ${label[visit.outcome]}`),el('ol',{},[el('li',{},`Upload: prerequisite for the local step; completes at ${minutes(visit.tasks.upload)}. Waiting intervals and link holders are recorded in the table.`),el('li',{},`Charging: independent of upload; ${vehicle.energy_j===0?'already at target at arrival':`reaches target at ${minutes(visit.tasks.charge)}`}. Can overlap the upload and local step.`),el('li',{},`Post-upload step: starts at ${minutes(visit.tasks.upload)}, completes at ${minutes(visit.tasks.post)}. No shared local-step queue in this lesson.`)]),el('p',{},`Last finished: ${tasks.join(' and ')}. Ready at ${minutes(visit.ready_s)}. The dependency path upload → local step is distinct from the independent charging branch. Adding capacity needs a separate intervention test.`)]);})])]);
  }
  function exportJSON(){return JSON.stringify(result,null,2);}
  refreshInputs();return {element,run,cancel,setOptions,exportJSON,getState:()=>structuredClone({options,result,attempt}),setLesson:()=>setOptions({uplink_gbps:1,b_gb:7.5,charger_kw:60}),pause:cancel,destroy(){cancel();destroyed=true;}};
}
