// NF-03 presentation projection: pure functions over the accepted study manifest and reconstructed records.
// No DOM and no model execution; recordDigest and verifyCapacity only re-check a record that already exists.
import {CAPACITY_RULES,CAPACITY_REGIMES,CAPACITY_TREATMENTS,canonicalText,cellId,deepFreeze,recordDigest} from '../model/depot-capacity-contract.js';
import {verifyCapacity} from '../model/depot-capacity-verify.js';

export const CAPACITY_PROJECTION='depot-capacity-projection/1.0.0';
const BASE_RULE='capacity_equal_uplink';
export const ruleName=id=>CAPACITY_RULES.find(r=>r.id===id).name;
const lower=text=>text.toLowerCase();
export const join=xs=>xs.length<3?xs.join(' and '):`${xs.slice(0,-1).join(', ')} and ${xs.at(-1)}`;
const vehicles=ids=>join(ids.map(id=>`Vehicle ${id}`));
/** Minutes with two decimals: every whole second still reads differently from its neighbours. */
export const minute=s=>Number((s/60).toFixed(2));
export const gbps=rate=>`${Number((rate/125e6).toFixed(3))} Gbps`;
export const kw=rate=>`${Number((rate/1000).toFixed(3))} kW`;
const metricsOf=(manifest,id)=>manifest.cells.find(c=>c.cell_id===id&&c.verification?.model_validity==='VALID'&&c.verification.comparison_eligible===true)?.metrics??null;

/** Base, one rule change and two capacity changes, all at the primary one-second quantum. */
export function caseCells(regime,altRule){
  const T=CAPACITY_TREATMENTS,equal=lower(ruleName(BASE_RULE));
  const make=(c,label,treatment,rule,changed)=>{const cell={regime,treatment,rule,time_quantum_ms:1000};return {case:c,label,cell_id:cellId(cell),cell,changed};};
  return [
    make('base','Base','base',BASE_RULE,`Reference: ${equal}, ${gbps(T.base.uplink_bytes_s)} uplink, ${kw(T.base.site_power_j_s)} site feed.`),
    make('rule','Different rule','base',altRule,`Changed: upload rule, ${equal} to ${lower(ruleName(altRule))}.`),
    make('bandwidth','More bandwidth','more_bandwidth',BASE_RULE,`Changed: uplink, ${gbps(T.base.uplink_bytes_s)} to ${gbps(T.more_bandwidth.uplink_bytes_s)}.`),
    make('power','More power','more_power',BASE_RULE,`Changed: site feed, ${kw(T.base.site_power_j_s)} to ${kw(T.more_power.site_power_j_s)}.`),
  ];
}

const percent=(used,available)=>`${Math.round(100*used/available)}% used`;
/** Card models from manifest metrics only; a cell the manifest does not accept shows as not available, never as zero. */
export function cardsFor(manifest,regime,altRule){
  const energy=Object.values(CAPACITY_REGIMES[regime].energy_j).some(j=>j>0);
  return caseCells(regime,altRule).map(({case:c,label,changed,cell_id})=>{
    const m=metricsOf(manifest,cell_id),u=m?.utilization;
    if(!m)return {case:c,label,changed,cell_id,available:false,on_time:null,missed:null,late:null,unfinished_due:null,lateness_text:'Not in the accepted study',capacity_text:'Not in the accepted study'};
    return {case:c,label,changed,cell_id,available:true,on_time:m.on_time,missed:m.missed,late:m.late,unfinished_due:m.unfinished_due,
      lateness_text:m.final_lateness?`${minute(m.lateness_s)} min`:`At least ${minute(m.lateness_lower_bound_s)} min; ${m.unfinished_due+m.pending} unfinished`,
      capacity_text:`Uplink ${percent(u.uplink_bytes_served,u.uplink_bytes_available)} · site feed ${energy&&u.site_j_available?percent(u.site_j_served,u.site_j_available):'not needed'}`};
  });
}

export function withheldReason(manifest,regime,altRule){
  const ids=caseCells(regime,altRule).map(c=>c.cell_id);
  if(ids.some(id=>!metricsOf(manifest,id)||!manifest.refinement?.[id]))return 'Reading withheld: this workload is incomplete in the accepted study.';
  if(ids.some(id=>manifest.refinement[id].agrees!==true))return 'Reading withheld: the quarter-second repeat disagrees for this workload.';
  if(ids.some(id=>!metricsOf(manifest,id).final_lateness))return 'Reading withheld: an unfinished visit leaves total lateness censored.';
  return null;
}

/** Each change against Base in card order, without ranking; a trade-off between the two counts is stated both ways. */
export function readingSentence(manifest,regime,altRule){
  if(withheldReason(manifest,regime,altRule))return null;
  const [base,...others]=caseCells(regime,altRule),a=metricsOf(manifest,base.cell_id),total=a.on_time+a.late+a.unfinished_due+a.pending;
  const subject={rule:lower(ruleName(altRule)),bandwidth:'more bandwidth',power:'more site power'};
  const clauses=others.map(c=>{
    const b=metricsOf(manifest,c.cell_id),d=(b.lateness_s-a.lateness_s)/60,name=subject[c.case];
    const late=`${Math.abs(d).toLocaleString('en-US')} ${d<0?'fewer':'more'} late minutes`;
    if(b.on_time===a.on_time&&b.missed===a.missed&&d===0)return `${name} changes nothing`;
    if(b.on_time===a.on_time)return `${name} leaves on-time readiness at ${a.on_time} of ${total} with ${late}`;
    const tradeoff=d!==0&&(b.on_time>a.on_time)===(d>0);
    return `${name} takes on-time readiness from ${a.on_time} to ${b.on_time} of ${total}${tradeoff?`, but with ${late}`:''}`;
  });
  return `Under the ${lower(CAPACITY_REGIMES[regime].name)} workload, ${clauses.join('; ')}.`;
}

function waitReason(x,v,upload_s,{holders,ports,rule,current}){
  const id=`Vehicle ${x.vehicle}`,{upload,charge,post}=x.tasks,chargeDone=charge==='complete'||charge==='not-applicable';
  if(!x.present)return `${id} arrives at minute ${minute(v.arrival_s)}.`;
  if(x.ready)return `${id} is ready since minute ${minute(x.ready_s)}.`;
  if(!current)return `${id} is not ready at the end of the observation.`;
  const charging=`${id} is charging at ${kw(current.charge[x.vehicle]??0)}`,held=vehicles(ports.filter(p=>p.vehicle).map(p=>p.vehicle));
  if(post==='active'){
    if(chargeDone)return `${id} is in its local step; ready at minute ${minute(upload_s+v.post_s)}.`;
    return charge==='active'?`${charging}; the local step is running.`:`${id} waits for a charging port while its local step runs; ports held by ${held}.`;
  }
  if(upload==='waiting')return `${id} waits for the uplink, held by ${vehicles(holders.map(h=>h.id))} under ${lower(ruleName(rule))}.`;
  if(upload==='active'){
    // Work in progress is named first; charging that waits for a port is named last.
    const rest=charge==='active'?['charging','the local step']:chargeDone?['the local step']:['the local step','charging'];
    return `${id} is uploading at ${gbps(current.upload[x.vehicle])}; ${join(rest)} ${rest.length>1?'remain':'remains'}.`;
  }
  return charge==='waiting'?`${id} waits for a charging port; ports held by ${held}.`:`${charging}; nothing else remains.`;
}

/** Interval integral and event fold at t_s, clamped to the record; the current slot is the one with start <= t < end. */
export function inspectCapacity(record,t_s){
  if(!Number.isFinite(t_s))throw Error('Inspection time must be finite.');
  const s=record.scenario,time_s=Math.max(0,Math.min(t_s,record.end_s));
  const current=record.intervals.find(i=>i.start_s<=time_s&&time_s<i.end_s)??null,bytes={},joules={};
  for(const i of record.intervals){
    if(i.start_s>=time_s)break;
    const elapsed=Math.min(time_s,i.end_s)-i.start_s;
    for(const [id,rate] of Object.entries(i.upload))bytes[id]=(bytes[id]??0)+elapsed*rate;
    for(const [id,rate] of Object.entries(i.charge))joules[id]=(joules[id]??0)+elapsed*rate;
  }
  const rate=(key,id)=>current?.[key][id]??0,events=record.events.filter(e=>e.time_s<=time_s);
  const done=(id,task)=>events.find(e=>e.vehicle===id&&e.type==='complete'&&e.task===task)?.time_s??null;
  const holders=s.vehicles.filter(v=>rate('upload',v.id)>0).map(v=>({id:v.id,rate_bytes_s:rate('upload',v.id)}));
  const ports=Array.from({length:s.charge_ports},(_,n)=>{const vehicle=s.vehicles.find(v=>current?.ports[v.id]===n+1)?.id??null;return {port:n+1,vehicle,rate_j_s:vehicle?rate('charge',vehicle):0};});
  const state=(finished,active)=>finished!==null?'complete':active?'active':'waiting';
  const visits=s.vehicles.map(v=>{
    const present=v.arrival_s<=time_s,upload=done(v.id,'upload'),ready_s=events.find(e=>e.vehicle===v.id&&e.type==='ready')?.time_s??null,ready=ready_s!==null;
    const tasks={upload:state(upload,rate('upload',v.id)>0),charge:v.energy_j===0?'not-applicable':state(done(v.id,'charge'),rate('charge',v.id)>0),post:state(done(v.id,'post'),upload!==null)};
    const x={vehicle:v.id,wave:v.wave,present,arrived_s:present?v.arrival_s:null,upload_bytes:bytes[v.id]??0,upload_total:v.upload_bytes,energy_j:joules[v.id]??0,energy_total:v.energy_j,
      post_s:upload===null?0:Math.min(v.post_s,time_s-upload),tasks,ready_s,ready,outcome:ready?(ready_s<=v.deadline_s?'on_time':'late'):time_s>=v.deadline_s?'unfinished_due':'pending',deadline_s:v.deadline_s};
    return {...x,wait_reason:waitReason(x,v,upload,{holders,ports,rule:record.rule,current})};
  });
  return {time_s,uplink:{holders,capacity_bytes_s:s.uplink_bytes_s},ports,site:{used_j_s:ports.reduce((n,p)=>n+p.rate_j_s,0),capacity_j_s:s.site_power_j_s},visits};
}

/** Per visit: merged upload and charging spans (fraction of the link or of one port's cap), local step, ready and target. */
export function allocationSpans(record){
  const s=record.scenario,eventTime=(id,type,task=null)=>record.events.find(e=>e.vehicle===id&&e.type===type&&e.task===task)?.time_s??null;
  const spans=(id,key,capacity)=>{
    const out=[];let open=null;
    for(const i of record.intervals){
      const rate=i[key][id]??0,amount=rate*(i.end_s-i.start_s);
      // Equal share rotates whole remainder bytes, so one share level alternates by one byte per second.
      if(open&&rate>0&&open.t1===i.start_s&&Math.abs(rate-open.rate)<=1){open.t1=i.end_s;open.amount+=amount;continue;}
      open=rate>0?{t0:i.start_s,t1:i.end_s,rate,amount}:null;
      if(open)out.push(open);
    }
    return out.map(({t0,t1,amount})=>({t0,t1,fraction:amount/((t1-t0)*capacity)}));
  };
  return s.vehicles.map(v=>{
    const upload=eventTime(v.id,'complete','upload');
    return {vehicle:v.id,upload:spans(v.id,'upload',s.uplink_bytes_s),charge:spans(v.id,'charge',s.port_cap_j_s),
      post:upload===null?null:{t0:upload,t1:eventTime(v.id,'complete','post')??record.end_s},ready_s:eventTime(v.id,'ready'),deadline_s:v.deadline_s,arrival_s:v.arrival_s};
  });
}

const activity=(i,id)=>[i.upload[id]?`uploading at ${gbps(i.upload[id])}`:null,i.charge[id]?`charging at ${kw(i.charge[id])}`:null].filter(Boolean).join(' and ')||'idle';
export function firstAllocationDifference(base,other){
  const ids=base.scenario.vehicles.map(v=>v.id),slots=Math.min(base.intervals.length,other.intervals.length);
  for(let k=0;k<slots;k++){
    const a=base.intervals[k],b=other.intervals[k];
    const vehicle=ids.find(id=>(a.upload[id]??0)!==(b.upload[id]??0)||(a.charge[id]??0)!==(b.charge[id]??0));
    if(vehicle)return {time_s:a.start_s,vehicle,base:activity(a,vehicle),other:activity(b,vehicle)};
  }
  return null;
}

const pairs=(base,other)=>base.visits.map(a=>[a,other.visits.find(v=>v.vehicle===a.vehicle)]);
export function firstReadinessDifference(base,other){
  let first=null;
  for(const [a,b] of pairs(base,other)){
    const t=Math.min(a.ready_s??Infinity,b.ready_s??Infinity);
    if(a.ready_s!==b.ready_s&&(!first||t<first.t))first={t,vehicle:a.vehicle,base_ready_s:a.ready_s,other_ready_s:b.ready_s};
  }
  return first&&{vehicle:first.vehicle,base_ready_s:first.base_ready_s,other_ready_s:first.other_ready_s};
}

/** Both cells share deadlines and horizon, so an earlier ready time is also the better outcome class, never the worse. */
export function exampleVisits(base,other){
  const out={selected:null,improving:[],regressing:[],unchanged:[],note:null},both=pairs(base,other);
  for(const [a,b] of both){const d=(b.ready_s??Infinity)-(a.ready_s??Infinity);(d<0?out.improving:d>0?out.regressing:out.unchanged).push(a.vehicle);}
  out.selected=(both.find(([a,b])=>a.outcome!==b.outcome)??both.find(([a,b])=>a.ready_s!==b.ready_s))?.[0].vehicle??null;
  if(out.selected===null)out.note='No readiness difference between these two cells.';
  return out;
}

/** Supplied success flags cannot vouch for a record: its digest and an independent verification are recomputed. */
export function verifiedCell(cell,manifestCell){
  const fail=reason=>{throw Error(reason);};
  if(!manifestCell?.metrics)fail('not in the accepted study');
  if(cell?.verification?.model_validity!=='VALID'||cell.verification.comparison_eligible!==true)fail('verification did not pass');
  if(cellId(cell.cell)!==manifestCell.cell_id)fail('a different cell was reconstructed');
  if(cell.digest!==manifestCell.record_digest||recordDigest(cell.record)!==manifestCell.record_digest)fail('digest differs from the accepted study');
  const verification=verifyCapacity(cell.record);
  if(verification.model_validity!=='VALID'||verification.comparison_eligible!==true)fail('verification did not pass');
  const {ready_s:_ready,...metrics}=verification.metrics;
  if(canonicalText(metrics)!==canonicalText(manifestCell.metrics))fail('metrics differ from the accepted study');
  return deepFreeze(structuredClone({cell_id:manifestCell.cell_id,cell:cell.cell,record:cell.record,verification,digest:manifestCell.record_digest}));
}
