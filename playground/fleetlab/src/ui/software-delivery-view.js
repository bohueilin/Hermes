import {deliveryInput,deliveryDigest} from "../model/software-delivery-contract.js";

// Read-only projection of an accepted record. Allocation and verification live elsewhere.
export const ARM_NAMES=Object.freeze({repeated:'Repeated download',cold:'Cold shared cache'});
export const CASE_NAMES=Object.freeze({default:'Four vehicles, one update',one:'One vehicle','slow-local':'Slower local link','two-arrivals':'Two arrivals, competing deadlines'});
export const seconds=ms=>ms===null?'Not all ready':`${Number((ms/1000).toFixed(3))} s`;
export const gb=bytes=>`${Number((bytes/1e9).toFixed(3))} GB`;
export const rate=bps=>`${Number((bps*8/1e9).toFixed(3))} Gbit/s`;
const done=(when,t)=>when!==null&&when<=t;

export function createDeliveryProjection(record){
 const {input,outcomes,resources}=record, q=input.quantum_ms, count=input.H_ms/q+1, ids=input.requests.map(r=>r.id);
 const per=new Map(record.universe.map(x=>[x.id,new Float64Array(count)]));
 const totals={wan:new Float64Array(count),local:new Float64Array(count)};
 for(let i=1;i<count;i++){
  for(const v of per.values())v[i]=v[i-1];
  for(let k=0;k<2;k++){
   const row=resources[2*(i-1)+k],r=k===0?'wan':'local';totals[r][i]=totals[r][i-1];
   for(const grant of row.eligible){per.get(grant.id)[i]+=grant.grant_bytes;totals[r][i]+=grant.grant_bytes;}
  }
 }
 const cachedAt=record.inventory[0]?.t_ms??null, ordered=new Map(outcomes.map(x=>[x.id,x]));
 const events=[...record.tasks.map(e=>({...e,raw_ms:e.t_ms,label:`${e.request_id??'Depot copy'}: ${e.type.replaceAll('_',' ')}`})),
  {t_ms:Math.ceil(input.artifact.available_at_ms/q)*q,raw_ms:input.artifact.available_at_ms,label:'Source becomes available'},
  ...input.requests.flatMap(r=>[{t_ms:Math.ceil(r.arrival_ms/q)*q,raw_ms:r.arrival_ms,label:`${r.id}: arrival`},{t_ms:Math.ceil(r.deadline_ms/q)*q,raw_ms:r.deadline_ms,label:`${r.id}: raw target`}])]
  .sort((a,b)=>a.t_ms-b.t_ms);
 const at=(raw,id=ids[0])=>{
  const i=Math.max(0,Math.min(count-1,Math.floor(raw/q))),t=i*q,r=input.requests.find(x=>x.id===id),o=ordered.get(id);
  if(!r||!o)throw Error('Selected vehicle is not in this accepted record.');
  const rows={wan:resources[2*i],local:resources[2*i+1]},amount=(resource,transfer)=>per.get(transfer)?.[i]??0;
  const own={wan_bytes:amount('wan',`wan-${id}`),local_bytes:amount('local',`loc-${id}`),wan_rate_Bps:0,local_rate_Bps:0};
  const shared={wan_rate_Bps:0,local_rate_Bps:0};
  for(const resource of ['wan','local'])for(const g of rows[resource].eligible){shared[`${resource}_rate_Bps`]+=g.grant_bytes*1000/q;if(g.id===`${resource==='wan'?'wan':'loc'}-${id}`)own[`${resource}_rate_Bps`]+=g.grant_bytes*1000/q;}
  const arrived=t>=o.arrival_applied_ms,ready=done(o.ready_ms,t),failed=done(o.failed_ms,t),received=done(o.local_completed_ms,t);
  const wanReceived=record.policy==='cold'?done(cachedAt,t):done(o.wan_completed_ms,t);
  let state='waiting',headline='',cause='',stage='WAN receipt',remaining_ms=null;
  if(!arrived){state='not-arrived';headline='Vehicle has not arrived';cause=`Arrival at ${seconds(r.arrival_ms)}. No vehicle transfer is eligible yet.`;}
  else if(failed){state='failed';headline='Modeled check failed';cause=`The declared check finished at ${seconds(o.failed_ms)}. Activation and readiness are blocked.`;}
  else if(ready){state='ready';headline='Ready in this model';cause=`Receipt, modeled check and activation finished at ${seconds(o.ready_ms)}.`;}
  else if(done(o.activation_started_ms,t)){state='activating';stage='Activation';headline='Activation is in progress';remaining_ms=Math.max(0,o.activation_started_ms+Math.ceil(r.activation_ms/q)*q-t);cause=`Modeled check finished as declared. ${seconds(remaining_ms)} of activation remains.`;}
  else if(done(o.check_started_ms,t)&&!done(o.check_completed_ms,t)){state='checking';stage='Modeled check';headline='Bytes received; modeled check remains';remaining_ms=Math.max(0,o.check_started_ms+Math.ceil(r.check_ms/q)*q-t);cause=`Modeled check; outcome set by the scenario. ${seconds(remaining_ms)} remains.`;}
  else if(received){stage=done(o.check_completed_ms,t)?'Activation':'Modeled check';headline=`Waiting for ${stage.toLowerCase()}`;cause=`${stage} cannot start at the observation end because it requires positive time.`;}
  else{
   const resource=wanReceived?'local':'wan',transfer=resource==='local'?`loc-${id}`:record.policy==='cold'?record.universe.find(x=>x.owner_kind==='depot_cache'&&x.resource==='wan').id:`wan-${id}`,g=rows[resource].eligible.find(x=>x.id===transfer),limits=input.resources[resource];
   stage=resource==='local'?'Local receipt':'WAN receipt';
   if(t<input.artifact.available_at_ms){headline='Waiting for the source';cause=`The required artifact becomes available at ${seconds(input.artifact.available_at_ms)}.`;}
   else if(g&&g.grant_bytes>0){
    if(record.policy==='cold'&&resource==='wan'){headline='Waiting for the depot copy';cause=`Shared depot download is receiving at ${rate(shared.wan_rate_Bps)}. The vehicle receives locally only after the whole object arrives.`;}
    else{state='receiving';headline=resource==='wan'?'Receiving across the WAN':'Receiving from the depot';cause=`${gb(g.remaining_bytes)} remains in this receipt. Modeled checks and activation follow it.`;}
   }else if(limits.aggregate_Bps===0||limits.transfer_cap_Bps===0){
    headline='No useful service on the required link';const parts=[];
    if(limits.aggregate_Bps===0)parts.push(`${resource==='wan'?'WAN':'Local'} resource capacity is 0 B/s`);
    if(limits.transfer_cap_Bps===0)parts.push('this transfer cap is 0 B/s');
    cause=`${parts.join('; ')}. Both declared limits apply; no bytes progress.`;
   }else{headline=wanReceived?'Waiting for local service':'Waiting for the whole object';cause=`${gb(input.artifact.size_bytes-(resource==='local'?own.local_bytes:amount('wan',transfer)))} remains. The next interval has zero selected service; inspect the prerequisite and accepted allocation.`;}
  }
  if(t===input.H_ms&&!ready&&!failed){state='unfinished';headline='Unfinished at observation end';cause=`${stage} has not led to readiness. ${cause} No service occurs beyond this window.`;}
  const target=failed?'Modeled check failed; readiness blocked':ready?(o.ready_ms<=r.deadline_ms?'Ready on time':'Ready late'):t===input.H_ms?'Unfinished at observation end':t<r.deadline_ms?`Target at ${seconds(r.deadline_ms)}; ${seconds(r.deadline_ms-t)} remaining`:t===r.deadline_ms?'Target now; not ready':'Target passed; not ready';
  return {t_ms:t,id,state,headline,cause,target,stage,remaining_ms,deadline_ms:r.deadline_ms,ready_ms:ready?o.ready_ms:null,
   own,shared,wan_bytes:totals.wan[i],local_bytes:totals.local[i],artifact_bytes:input.artifact.size_bytes,
   whole_copies:{complete:record.policy==='cold'?Number(done(cachedAt,t)):outcomes.filter(x=>done(x.wan_completed_ms,t)).length,total:record.policy==='cold'?1:ids.length},
   ready_count:outcomes.filter(x=>done(x.ready_ms,t)).length,total:ids.length,interval:t===input.H_ms?'Observation end; no next service interval':`Useful rates for [${seconds(t)}, ${seconds(t+q)})`,
   chain:{receipt:received?'complete':state==='receiving'?'active':arrived?'waiting':'not-arrived',check:failed?'failed':done(o.check_completed_ms,t)?'complete':state==='checking'?'active':'waiting',activation:ready?'complete':state==='activating'?'active':'waiting',readiness:ready?'complete':failed?'blocked':'waiting'},
   tasks:{check_declared_ms:r.check_ms,check_quantized_ms:Math.ceil(r.check_ms/q)*q,activation_declared_ms:r.activation_ms,activation_quantized_ms:Math.ceil(r.activation_ms/q)*q},
   grants:{wan:rows.wan.eligible,local:rows.local.eligible},limits:input.resources,
  };
 };
 return {record,input,metrics:record.metrics,events,at,scale_Bps:Math.max(input.resources.wan.aggregate_Bps,input.resources.local.aggregate_Bps)};
}

export function deliveryChapters(pair){
 if(pair.id!=='default'||pair.entry?.input_digest!==deliveryDigest(deliveryInput())||['repeated','cold'].some(k=>pair.projections[k].record.record_digest!==pair.entry?.primary?.[k]?.record_digest||pair.projections[k].record.input_digest!==pair.entry.input_digest))return [];
 const cold=pair.projections.cold, repeated=pair.projections.repeated, first=cold.input.requests[0].id;
 const times=[0,cold.record.inventory[0]?.t_ms,Math.max(...cold.record.outcomes.map(o=>o.local_completed_ms)),cold.metrics.all_ready_ms,cold.input.requests[0].deadline_ms,repeated.metrics.all_ready_ms];
 if(pair.id!=='default'||times.some(t=>t===null||t===undefined))return [];
 return times.map((t_ms,i)=>({t_ms,vehicle:first,hold_ms:[6000,7000,7000,7000,7000,6000][i],title:['Same demand, different delivery','A reusable copy releases local work','Receipt is not readiness','Shared traffic, different prerequisites','At the invented target','Less WAN work; local work remains'][i]}));
}
export function deliveryCaption(pair,chapter){
 const c=pair.projections.cold.at(chapter.t_ms,chapter.vehicle),r=pair.projections.repeated.at(chapter.t_ms,chapter.vehicle);
 const cause=chapter.t_ms===96000?'A whole depot copy can release local work; partial separate copies cannot.':`${ARM_NAMES.repeated} ${r.id}: ${r.headline}. ${ARM_NAMES.cold} ${c.id}: ${c.headline}.`;
 return `${cause} ${ARM_NAMES.repeated}: ${gb(r.wan_bytes)} WAN, ${r.whole_copies.complete}/${r.whole_copies.total} whole copies. ${ARM_NAMES.cold}: ${gb(c.wan_bytes)} WAN, ${c.whole_copies.complete}/${c.whole_copies.total} whole copies. Local delivery ${gb(r.local_bytes)} / ${gb(c.local_bytes)}; ready ${r.ready_count}/${r.total} / ${c.ready_count}/${c.total} (repeated / cache).`;
}
