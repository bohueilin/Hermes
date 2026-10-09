import {FLOW_RULES} from '../model/depot-flow-contract.js';
import {verifyFlow} from '../model/depot-flow-verify.js';
import {COHORT_RULES,COHORT_VERSIONS} from '../model/depot-cohort-contract.js';
import {verifyCohort} from '../model/depot-cohort-verify.js';

// Presentation identity is deliberately outside the scientific record versions.
export const PROJECTION_VERSION='depot-flow-projection/1.0.0';
const names=Object.fromEntries([...FLOW_RULES,...COHORT_RULES].map(r=>[r.id,r.name]));
const lower=id=>names[id].toLowerCase();
const upper=text=>text[0].toUpperCase()+text.slice(1);
const join=xs=>xs.length<3?xs.join(' and '):`${xs.slice(0,-1).join(', ')} and ${xs.at(-1)}`;
const duration=s=>s%60?`${Math.floor(s/60)} min ${s%60} s`:`${s/60} min`;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const prepared=new WeakMap();

/** Validate once per unchanged result, then explain a private immutable snapshot.
 * The supplied success flags or completion metrics cannot authenticate a record.
 * Checking serialized identity also invalidates the snapshot after caller mutation.
 */
function verified(result){
  if(!result||typeof result!=='object')throw Error('A verified comparison is required.');
  const identity=JSON.stringify(result),cached=prepared.get(result);
  if(cached?.identity===identity)return cached.value;
  const cohort=result.versions?.model===COHORT_VERSIONS.model,rules=cohort?COHORT_RULES:FLOW_RULES;
  if(!result.comparison_eligible||result.arms?.length!==rules.length)throw Error('A comparison-eligible verified result is required.');
  for(const [i,arm] of result.arms.entries()){
    const checked=(cohort?verifyCohort:verifyFlow)(arm.record);
    if(arm.record.rule!==rules[i].id||!checked.comparison_eligible||checked.model_validity!=='VALID'||arm.verification?.model_validity!=='VALID'||!arm.verification.comparison_eligible||JSON.stringify(checked.metrics)!==JSON.stringify(arm.verification.metrics)||JSON.stringify(checked.visits)!==JSON.stringify(arm.verification.visits)||JSON.stringify(result.scenario)!==JSON.stringify(arm.record.scenario))throw Error('Comparison must match independently verified records.');
  }
  const value=freeze(JSON.parse(identity));prepared.set(result,{identity,value});prepared.set(value,{identity,value});return value;
}

/** Pure interval integral and event fold. No verification or model execution occurs.
 * Time is exact (including fractional seconds), clamped to observed record coverage.
 * Task completion timestamps are null until observed. The current grant uses [start,end).
 * This arithmetic also supports four-vehicle and fractional-time teaching records.
 */
export function inspectState(record,t_s){
  if(!Number.isFinite(t_s))throw Error('Inspection time must be finite.');
  const time_s=Math.max(0,Math.min(t_s,record.end_s??record.scenario.horizon_s));
  const current=record.intervals.find(i=>i.start_s<=time_s&&time_s<i.end_s);
  const holders=key=>Object.entries(current?.[key]??{}).filter(([,rate])=>rate>0).map(([id])=>id);
  const upload_holders=holders('upload'),charge_holders=holders('charge');
  const events=record.events.filter(e=>e.time_s<=time_s).map(e=>({...e}));
  const vehicles=record.scenario.vehicles.map(v=>{
    let upload_bytes=0,energy_j=0;const interval_ids=[];
    for(const interval of record.intervals){
      const elapsed=Math.max(0,Math.min(time_s,interval.end_s)-interval.start_s);
      upload_bytes+=elapsed*(interval.upload[v.id]??0);energy_j+=elapsed*(interval.charge[v.id]??0);
      if(elapsed>0&&((interval.upload[v.id]??0)>0||(interval.charge[v.id]??0)>0))interval_ids.push(interval.id);
    }
    const own=events.filter(e=>e.vehicle===v.id),done=task=>own.find(e=>e.type==='complete'&&e.task===task)?.time_s??null;
    const upload=done('upload'),charge=done('charge'),post=done('post'),ready_s=own.find(e=>e.type==='ready')?.time_s??null;
    const ready=ready_s!==null,deadline_reached=time_s>=v.deadline_s;
    const post_s=upload===null?0:Math.min(v.post_s,time_s-upload);
    const upload_rate_bytes_s=current?.upload[v.id]??0,charge_rate_j_s=current?.charge[v.id]??0;
    const waiting_for=[...(upload===null?['upload']:[]),...(post===null?['post-upload step']:[]),...(charge===null?['charging']:[])];
    const tasks={upload:{state:upload!==null?'complete':upload_rate_bytes_s>0?'active':'waiting',completed_s:upload},charge:{state:charge!==null?'complete':charge_rate_j_s>0?'active':'waiting',completed_s:charge},post:{state:post!==null?'complete':upload===null?'waiting':'active',started_s:upload,elapsed_s:post_s,completed_s:post}};
    const uploadText=upload!==null?`Upload finished at minute ${upload/60}`:`${upload_bytes/1e9} of ${v.upload_bytes/1e9} GB · ${upload_rate_bytes_s>0?(upload_holders.length>1?'Active · sharing link':'Active · full link'):`Waiting for uplink · held by ${upload_holders.join(', ')||'none; no capacity'}`}`;
    const energyText=charge!==null?(v.energy_j===0?'Already at target on arrival':`At target since minute ${charge/60}`):`${energy_j/36e5} of ${v.energy_j/36e5} kWh · ${charge_rate_j_s>0?`charging at ${charge_rate_j_s/1000} kW`:'waiting for charger'}`;
    const postText=post!==null?`Done at minute ${post/60}`:upload===null?'Waits for upload':`Running · ${duration(post_s)} of ${duration(v.post_s)}`;
    const readiness=ready?`Ready in this model since minute ${ready_s/60}`:`Not ready · waits for ${waiting_for.join(', ')}${deadline_reached?' · deadline reached':''}`;
    return {vehicle:v.id,upload_bytes,energy_j,post_s,upload_rate_bytes_s,charge_rate_j_s,tasks,ready_s,ready,deadline_s:v.deadline_s,deadline_reached,outcome:ready?(ready_s<=v.deadline_s?'on_time':'late'):deadline_reached?'unfinished_due':'pending',waiting_for,text:{upload:uploadText,energy:energyText,post:postText,readiness},event_sequences:own.map(e=>e.seq),interval_ids};
  });
  return {projection_version:PROJECTION_VERSION,time_s,rule:record.rule,interval_id:current?.id??null,upload_holders,charge_holders,events,vehicles};
}

export function eventSentence(result,t_s){
  const r=verified(result),states=r.arms.map(a=>inspectState(a.record,t_s)),time=states[0].time_s,prefix=`Minute ${time/60}. `;
  const at=states.map(s=>s.events.filter(e=>e.time_s===time));
  if(at.every(es=>es.length===0))return prefix+'No recorded events at this minute.';
  const deadlines=at[0].filter(e=>e.type==='deadline');
  const deadlineText=deadlines.map(e=>`Vehicle ${e.vehicle} departure deadline. `+states.map(s=>{
    const v=s.vehicles.find(x=>x.vehicle===e.vehicle);return `${names[s.rule]}: ${v.ready?`ready at minute ${v.ready_s/60}, ${v.outcome==='on_time'?'on time':'deadline missed'}`:'not ready, deadline missed'}.`;
  }).join(' ')).join(' ');
  const phrases=events=>{
    const out=[],arrivals=events.filter(e=>e.type==='arrival');
    if(arrivals.length===2)out.push('both vehicles arrive');else out.push(...arrivals.map(e=>`Vehicle ${e.vehicle} arrives`));
    for(const e of events){
      if(e.type==='arrival')continue;
      if(e.type==='ready'){out.push(`Vehicle ${e.vehicle} ready`);continue;}
      if(e.type!=='complete'||e.task==='post'&&events.some(x=>x.type==='ready'&&x.vehicle===e.vehicle))continue;
      const v=r.scenario.vehicles.find(x=>x.id===e.vehicle);
      out.push(`Vehicle ${e.vehicle} ${e.task==='charge'?(v.energy_j===0?'battery already at target':'battery at target'):e.task==='upload'?'upload complete':'post-upload step complete'}`);
    }
    return out;
  };
  const words=at.map(events=>phrases(events.filter(e=>e.type!=='deadline')));
  const common=words[0].filter(phrase=>words.every(w=>w.includes(phrase)));
  const shared=common.length?`All ${r.arms.length===3?'three':'four'} rules: `+common.join('. ')+'.':'';
  const actionText=[shared,...words.map((w,i)=>{const rest=w.filter(phrase=>!common.includes(phrase));return rest.length?`${names[states[i].rule]}: ${rest.join('. ')}.`:'';})].filter(Boolean).join(' ');
  return prefix+[deadlineText,actionText].filter(Boolean).join(' ');
}

const byVehicle=(state,id)=>state.vehicles.find(v=>v.vehicle===id);
function grouped(states,text){
  const groups=new Map();for(const s of states){const value=text(s);if(value===null)continue;if(!groups.has(value))groups.set(value,[]);groups.get(value).push(lower(s.rule));}
  return [...groups].map(([value,rules])=>`${upper(join(rules))}: ${value}`).join(' ');
}
function statePhrase(state,id){
  const v=byVehicle(state,id);
  if(v.ready)return `Vehicle ${id} is ready.`;
  if(v.tasks.post.state==='active')return `Vehicle ${id} is in its post-upload step.`;
  if(v.tasks.upload.state==='complete'&&v.tasks.charge.state!=='complete')return `Vehicle ${id} is still charging and not ready.`;
  if(v.tasks.upload.state==='waiting')return `Vehicle ${id} is waiting for the link, held by ${state.upload_holders.length?join(state.upload_holders.map(x=>`Vehicle ${x}`)):'no vehicle'}.`;
  return `Vehicle ${id} has ${v.upload_bytes/1e9} of ${state._scenario.vehicles.find(x=>x.id===id).upload_bytes/1e9} GB.`;
}
function caption(r,time,kinds){
  const states=r.arms.map(a=>({...inspectState(a.record,time),_scenario:r.scenario})),prefix=`Minute ${time/60}. `;
  if(r.versions.model===COHORT_VERSIONS.model)return eventSentence(r,time);
  if(kinds.some(k=>k.kind==='START')){
    return prefix+'Same work, link and charger under every rule. '+states.map((s,i)=>{
      const active=s.vehicles.filter(v=>v.upload_rate_bytes_s>0),rule=i===0?names[s.rule]:lower(s.rule);
      return active.length===2?`${rule} gives each vehicle ${active[0].upload_rate_bytes_s/125e6} Gbps`:`${rule} gives the whole ${i===0?`${r.scenario.uplink_bytes_s/125e6} Gbps `:''}link to Vehicle ${active[0]?.vehicle??'none'}`;
    }).join('; ')+'.';
  }
  if(kinds.some(k=>k.kind==='LAST_READY')){
    if(states.every(s=>s.vehicles.every(v=>v.ready)))return prefix+`Every vehicle is ready under every rule. ${time===r.scenario.horizon_s?'End of run. Final result':`Final result, unchanged through minute ${r.scenario.horizon_s/60}`}: `+r.arms.map(a=>`${lower(a.record.rule)} ${a.verification.metrics.on_time} of ${r.scenario.vehicles.length}${a.verification.metrics.lateness_lower_bound_s?` on time, ${a.verification.metrics.lateness_lower_bound_s/60} late minutes`:''}`).join('; ')+'.';
    return prefix+'End of run. '+grouped(states,s=>s.vehicles.filter(v=>!v.ready).map(v=>`Vehicle ${v.vehicle} is not ready.`).join(' ')||'Every vehicle is ready.');
  }
  const deadline=kinds.find(k=>k.kind==='DEADLINE');
  if(deadline){
    const id=deadline.vehicle,v=r.scenario.vehicles.find(x=>x.id===id),ready=states.filter(s=>byVehicle(s,id).ready),earliest=v.upload_bytes/r.scenario.uplink_bytes_s+v.post_s;
    const lead=`Vehicle ${id}'s departure deadline. `;
    if(!ready.length&&earliest>time)return prefix+lead+`Vehicle ${id} is not ready under any rule; its earliest possible time is minute ${earliest/60}, even with the whole uplink to itself.`;
    return prefix+lead+(ready.length?`${upper(join(ready.map(s=>lower(s.rule))))} ${ready.length===1?'meets':'meet'} it. `:'')+grouped(states.filter(s=>!byVehicle(s,id).ready),s=>statePhrase(s,id));
  }
  const energy=kinds.find(k=>k.kind==='ENERGY_MET');
  if(energy){
    const id=energy.vehicle,all=states.every(s=>byVehicle(s,id).tasks.charge.completed_s===time),none=states.every(s=>!byVehicle(s,id).ready),total=r.scenario.vehicles.find(v=>v.id===id).upload_bytes/1e9;
    const first=kinds.find(k=>k.kind==='FIRST_READY');
    return prefix+(all?`Vehicle ${id} reaches its battery target under every rule; the upload rule does not change charging here. `:grouped(states,s=>byVehicle(s,id).tasks.charge.completed_s===time?`Vehicle ${id} reaches its battery target.`:null)+' ')+(none?`Vehicle ${id} is still not ready. `:'')+`Upload received by Vehicle ${id}: `+states.map(s=>`${lower(s.rule)} ${byVehicle(s,id).upload_bytes/1e9} of ${total} GB`).join('; ')+'.'+(first?' '+caption(r,time,[first]).slice(prefix.length):'');
  }
  const late=kinds.find(k=>k.kind==='LATE_START');
  if(late){
    const id=late.vehicle,active=states.filter(s=>late.rules.includes(s.rule)),other=r.scenario.vehicles.find(v=>v.id!==id),start=active.map(s=>{
      const own=byVehicle(s,id),x=byVehicle(s,other.id),base=`${names[s.rule]} starts Vehicle ${id}'s upload, ${(time-own.deadline_s)/60} minutes after ${id}'s departure deadline`;
      return base+(x.tasks.upload.completed_s!==null&&x.tasks.charge.completed_s!==null&&!x.ready?`; under that rule Vehicle ${other.id} has all ${other.upload_bytes/1e9} GB and its charge but is not ready until its ${other.post_s/60}-minute post-upload step ends.`:'.');
    }).join(' ');
    return prefix+start+' '+grouped(states.filter(s=>!late.rules.includes(s.rule)),s=>statePhrase(s,other.id));
  }
  const first=kinds.find(k=>k.kind==='FIRST_READY');
  if(first){
    const id=first.vehicle,now=states.filter(s=>byVehicle(s,id).ready_s===time),others=states.filter(s=>!now.includes(s)).sort((a,b)=>Number(byVehicle(b,id).tasks.post.state==='active')-Number(byVehicle(a,id).tasks.post.state==='active'));
    return prefix+now.map(s=>{
      const v=byVehicle(s,id),last=Object.entries(v.tasks).filter(([,task])=>task.completed_s===time).map(([key])=>key==='post'?'post-upload step':key==='charge'?'charging':'upload');
      return `${names[s.rule]} makes Vehicle ${id} ready; its ${join(last)} finished last.`;
    }).join(' ')+(others.length?' '+grouped(others,s=>statePhrase(s,id)):'');
  }
  return eventSentence(r,time);
}

/** [{run_id,time_s,kinds:[{kind,vehicle?,rules?}],label,caption}]. */
export function guidedMoments(result){
  const r=verified(result),moments=new Map(),add=(time_s,kind,vehicle=null,rules=[])=>{if(!moments.has(time_s))moments.set(time_s,[]);moments.get(time_s).push({kind,...(vehicle?{vehicle}:{}),...(rules.length?{rules}:{})});};
  add(0,'START');let last=0;
  for(const v of r.scenario.vehicles){
    const visits=r.arms.map(a=>a.verification.visits.find(x=>x.vehicle===v.id)),ready=visits.map(x=>x.ready_s).filter(x=>x!==null);
    if(ready.length){const earliest=Math.min(...ready);add(earliest,'FIRST_READY',v.id,r.arms.filter((a,i)=>visits[i].ready_s===earliest).map(a=>a.record.rule));}
    if(visits.some(x=>x.ready_s===null||x.ready_s>v.deadline_s)&&v.deadline_s<=r.scenario.horizon_s)add(v.deadline_s,'DEADLINE',v.id);
    if(v.energy_j>0){const times=[...new Set(visits.filter(x=>x.tasks.charge!==undefined&&x.ready_s>x.tasks.charge).map(x=>x.tasks.charge))];for(const time of times)add(time,'ENERGY_MET',v.id);}
    const starts=r.arms.map(a=>({rule:a.record.rule,time:a.record.intervals.find((n,i)=>n.start_s>=v.deadline_s&&(n.upload[v.id]??0)>0&&(i===0||(a.record.intervals[i-1].upload[v.id]??0)===0))?.start_s})).filter(x=>x.time!==undefined);
    if(starts.length){const time=Math.min(...starts.map(x=>x.time));add(time,'LATE_START',v.id,starts.filter(x=>x.time===time).map(x=>x.rule));}
    last=Math.max(last,ready.length===visits.length?Math.max(...ready):r.scenario.horizon_s);
  }
  add(last,'LAST_READY');
  const labels={START:'Start',FIRST_READY:'first ready',DEADLINE:'departure deadline',ENERGY_MET:'battery target met',LATE_START:'upload starts after deadline',LAST_READY:last===r.scenario.horizon_s?'End of run':'Last vehicle ready'};
  return [...moments].sort(([a],[b])=>a-b).map(([time_s,kinds])=>({run_id:r.run_id??null,time_s,kinds,label:`Minute ${time_s/60} · `+kinds.map(k=>k.vehicle?`Vehicle ${k.vehicle} ${labels[k.kind]}${k.rules?.length?` (${k.rules.map(lower).join(', ')})`:''}`:labels[k.kind]).join('; '),caption:caption(r,time_s,kinds)}));
}

export function outcomeHeadline(result){
  const r=verified(result),groups=new Map(),arms=r.arms;
  for(const a of arms){const n=a.verification.metrics.on_time;if(!groups.has(n))groups.set(n,[]);groups.get(n).push(a.record.rule);}
  const count=r.scenario.vehicles.length,highest=Math.max(...groups.keys()),least=Math.min(...arms.map(a=>a.verification.metrics.lateness_lower_bound_s));
  const leastRules=arms.filter(a=>a.verification.metrics.lateness_lower_bound_s===least).map(a=>a.record.rule);
  if(highest===0)return `No rule gets a vehicle ready on time; ${join(leastRules.map(lower))} ${leastRules.length===1?'adds':'add'} the fewest late minutes (${least/60}).`;
  const sorted=[...groups].sort(([a],[b])=>b-a),parts=sorted.map(([n,ids],i)=>{
    const plural=ids.length>1,verb=plural?'get':'gets',label=join(ids.map(lower));
    return label+' '+verb+(n===count?` ${count===2?'both':`all ${count}`} vehicles ready on time`:n===0?' none':` ${n} of ${count}${i===0?' vehicles ready on time':''}`);
  });
  let line=upper(parts.join('; '));
  if(!leastRules.some(id=>groups.get(highest).includes(id)))line+=`, but ${join(leastRules.map(lower))} ${leastRules.length===1?'adds':'add'} the fewest late minutes (${least/60})`;
  return line+'.';
}

const inputInfo={b_gb:{title:'Vehicle B upload',unit:'GB',noun:'Vehicle B upload'},charger_kw:{title:'Charger power',unit:'kW',noun:'charger'},uplink_gbps:{title:'Uplink capacity',unit:'Gbps',noun:'uplink'}};
const optionsOf=r=>({uplink_gbps:r.scenario.uplink_bytes_s/125e6,b_gb:r.scenario.vehicles.find(v=>v.id==='B').upload_bytes/1e9,charger_kw:r.scenario.charger_j_s/1000});
const optionKey=o=>`${o.uplink_gbps}/${o.b_gb}/${o.charger_kw}`;

/** Null unless exactly one NF-01 input changed and every outcome is observed.
 * changes includes all six cells, in rule/vehicle table order; delta_s is current minus previous.
 * sentences is [setup,counts,summary], also available as separately named fields.
 */
export function comparePrevious(previous,current){
  let before,after;try{before=verified(previous);after=verified(current);}catch{return null;}
  if(before.versions.model!==after.versions.model||after.versions.model===COHORT_VERSIONS.model||before.scenario.fixture!==after.scenario.fixture)return null;
  if([...before.arms,...after.arms].some(a=>!a.verification.metrics.final_lateness||a.verification.visits.some(v=>v.ready_s===null)))return null;
  const old=optionsOf(before),next=optionsOf(after),keys=Object.keys(old).filter(k=>old[k]!==next[k]);if(keys.length!==1)return null;
  // The one-control explanation is valid only with otherwise identical workloads/dependencies.
  const comparable=r=>({...r.scenario,horizon_s:0,uplink_bytes_s:0,charger_j_s:0,vehicles:r.scenario.vehicles.map(v=>({...v,upload_bytes:v.id==='B'?0:v.upload_bytes}))});
  if(JSON.stringify(comparable(before))!==JSON.stringify(comparable(after)))return null;
  const key=keys[0],info=inputInfo[key],changes=after.arms.flatMap((a,i)=>a.verification.visits.map(v=>{
    const prev=before.arms[i].verification.visits.find(x=>x.vehicle===v.vehicle);
    return {rule:a.record.rule,vehicle:v.vehicle,previous_ready_s:prev.ready_s,ready_s:v.ready_s,delta_s:v.ready_s-prev.ready_s};
  }));
  const unchanged_count=changes.filter(v=>v.delta_s===0).length,changed_count=changes.length-unchanged_count,largest_change_s=Math.max(...changes.map(v=>Math.abs(v.delta_s)));
  const setup=`Only ${info.title} changed: ${old[key]} ${info.unit} to ${next[key]} ${info.unit}. The rules, deadlines and Vehicle A's work are the same.`;
  const counts='On time: '+after.arms.map((a,i)=>`${lower(a.record.rule)} ${before.arms[i].verification.metrics.on_time} to ${a.verification.metrics.on_time} of 2`).join('; ')+'. Total late minutes: '+after.arms.map((a,i)=>`${before.arms[i].verification.metrics.lateness_lower_bound_s/60} to ${a.verification.metrics.lateness_lower_bound_s/60}`).join('; ')+'.';
  let summary;
  if(changed_count===0)summary=`No ready time, on-time count or late-minute total changed. At these settings, a ${old[key]} ${info.unit} and a ${next[key]} ${info.unit} ${info.noun} give the same results under all three rules.`;
  else{
    const largest=changes.filter(v=>Math.abs(v.delta_s)===largest_change_s),directions=[...new Set(largest.map(v=>v.delta_s>0?'later':'earlier'))],direction=directions.length===1?directions[0]:'in either direction';
    const who=v=>`${lower(v.rule)}: Vehicle ${v.vehicle}`;
    summary=`${unchanged_count} of 6 ready times ${unchanged_count===1?'is':'are'} unchanged. Largest change: ${largest_change_s/60} min ${direction}, for ${largest.length===1?who(largest[0]):`${largest.length} ready times (${largest.map(who).join('; ')})`}.`;
  }
  return {previous_run_id:before.run_id??null,changed_key:key,old_value:old[key],new_value:next[key],changed_count,unchanged_count,largest_change_s,changes,sentences:[setup,counts,summary],setup,counts,summary};
}

// Each row contains a primary and alternate [input,value,question kind,rule].
const suggestions={
  '1/7.5/60':[['b_gb',15,'K3','nf_equal_uplink'],['charger_kw',20,'K4','nf_departure_deadline']],
  '1/15/60':[['b_gb',45,'K1'],['charger_kw',20,'K4','nf_departure_deadline']],
  '1/45/60':[['charger_kw',20,'K2'],['b_gb',7.5,'K3','nf_equal_uplink']],
  '1/45/20':[['b_gb',7.5,'K4','nf_equal_uplink'],['charger_kw',60,'K2']],
  '1/7.5/20':[['uplink_gbps',0.5,'K4','nf_departure_deadline'],['charger_kw',60,'K3','nf_equal_uplink']],
  '0.5/7.5/20':[['charger_kw',60,'K2'],['uplink_gbps',1,'K4','nf_fifo']],
  '0.5/7.5/60':[['uplink_gbps',1,'K1'],['charger_kw',20,'K2']],
  '1/15/20':[['charger_kw',60,'K4','nf_equal_uplink'],['b_gb',7.5,'K4','nf_equal_uplink']],
  '0.5/15/60':[['charger_kw',20,'K2'],['uplink_gbps',1,'K1']],
  '0.5/15/20':[['charger_kw',60,'K2'],['uplink_gbps',1,'K4','nf_departure_deadline']],
  '0.5/45/60':[['charger_kw',20,'K2'],['uplink_gbps',1,'K1']],
  '0.5/45/20':[['charger_kw',60,'K2'],['b_gb',7.5,'K4','nf_departure_deadline']],
};

/** Pure one-control suggestion. seen is an iterable of option objects or slash-joined keys.
 * Returns {key,value,options,kind,rule,question,button,status}; contains no outcome answer.
 */
export function nextSuggestion(options,seen=[]){
  const choices=suggestions[optionKey(options)];if(!choices)throw Error('Choose a supported lesson setting.');
  const visited=new Set([...seen].map(value=>typeof value==='string'?value:optionKey(value)));
  let choice=choices[0];if(visited.has(optionKey({...options,[choice[0]]:choice[1]}))&&!visited.has(optionKey({...options,[choices[1][0]]:choices[1][1]})))choice=choices[1];
  const [key,value,kind,rule=null]=choice,info=inputInfo[key],next={...options,[key]:value};
  const prefix=key==='b_gb'?`With Vehicle B at ${value} GB,`:key==='charger_kw'?`With a ${value} kW charger,`:`With the uplink at ${value} Gbps,`;
  const question=prefix+' '+(kind==='K1'?'which upload rule will miss the fewest departure deadlines?':kind==='K2'?'how many of the six ready times in the table (2 vehicles × 3 rules) will change?':kind==='K3'?`will ${lower(rule)} get both vehicles ready on time?`:`who will miss their departure deadline under ${lower(rule)}?`);
  const title=key==='b_gb'?info.title:info.title.toLowerCase();
  return {key,value,options:next,kind,rule,question,button:`Set ${title} to ${value} ${info.unit}`,status:`${info.title} set to ${value} ${info.unit}.`};
}
