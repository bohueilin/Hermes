// Independent timeline reconstruction: jobs have analytical milestones; no producer scheduler is imported.
import {VERSION,normalize,canonical,copy,hash} from './dispatch-contract.js';
const fail=message=>{throw Error(message);};
const equal=(a,b,label)=>{if(canonical(a)!==canonical(b))fail(`${label} differs from independent reconstruction`);};
const point=p=>p.map(n=>n*1000);
const length=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
const along=(a,b,n)=>{const dx=Math.min(n,Math.abs(b[0]-a[0]));return [a[0]+Math.sign(b[0]-a[0])*dx,a[1]+Math.sign(b[1]-a[1])*Math.max(0,n-dx)];};
export function verifyDispatch(record){
 try{
  let nodes=0;
  const json=(v,depth=0)=>{
   if(++nodes>65536||depth>20)fail('JSON bounds exceeded');
   if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
   if(!v||typeof v!=='object'||Object.getOwnPropertySymbols(v).length)fail('Unsupported JSON value');
   if(Array.isArray(v)){if(Object.keys(v).length!==v.length)fail('Sparse or extended array');}
   else if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)fail('Non-JSON object');
   for(const x of Object.values(v))json(x,depth+1);
  };json(record);
  if(!record||typeof record!=='object'||new TextEncoder().encode(canonical(record)).length>262144)fail('Record size or structure invalid');
  if(!Array.isArray(record.events)||record.events.length>256||!Array.isArray(record.ledger)||record.ledger.length>41||!Array.isArray(record.decisions)||record.decisions.length>40||!Array.isArray(record.preDecision)||record.preDecision.length>40)fail('Record arrays exceed domain');
  const input=normalize(record.input),{horizon}=input,end=record.end,policy=record.policy;
  equal(record.input,input,'normalized input');if(!['greedy','joint','manual'].includes(policy)||!Number.isSafeInteger(end)||end<0||end>horizon||end%30||policy!=='manual'&&end!==horizon)fail('Invalid stop time or policy');
  const rows=input.requests.map(r=>({...copy(r),state:'future',vehicle:null,pickup:null,complete:null})),jobs=[],events=[],ledger=[],decisions=[],preDecision=[];
  const emit=(t,kind,vid=null,rid=null)=>events.push({seq:events.length,t,kind,vehicle:vid,request:rid});
  for(const v of input.vehicles)emit(0,'ready',v.id);
  const cars=t=>input.vehicles.map(v=>{
   const j=jobs.filter(j=>j.vid===v.id).at(-1);let at=point(v.at),mode='idle',request=null,target=null,until=null;
   if(j){request=j.rid;if(t<j.approachEnd){mode='approach';at=along(j.startAt,j.origin,(t-j.start)*1000/60);target=j.origin;until=j.approachEnd;}
    else if(t<j.pickupEnd){mode='pickup';at=j.origin;until=j.pickupEnd;}
    else if(t<j.tripEnd){mode='trip';at=along(j.origin,j.destination,(t-j.pickupEnd)*1000/60);target=j.destination;until=j.tripEnd;}
    else{at=j.destination;request=null;}}
   return {id:v.id,at,mode,request,target,until};
  });
  const capture=(t,phase,pairs=[])=>({t,phase,vehicles:copy(cars(t)),requests:copy(rows.filter(r=>r.state!=='future')),pairs:copy(pairs),edges:rows.flatMap(r=>cars(t).filter(v=>legal(r,v,t)).map(v=>({request:r.id,vehicle:v.id,meters:length(v.at,point(r.origin)),pickupAt:t+length(v.at,point(r.origin))*60/1000+30})))});
  const legal=(r,v,t)=>r.state==='pending'&&v.mode==='idle'&&t+length(v.at,point(r.origin))*60/1000+30<=r.deadline&&t+length(v.at,point(r.origin))*60/1000+30<=horizon;
  const choose=t=>{
   const vs=cars(t),rs=rows.filter(r=>r.state==='pending'),candidates=[];
   if(policy==='manual'){const d=record.decisions[t/30];if(!d||d.t!==t||!Array.isArray(d.pairs)||d.pairs.length>4)fail('Manual decision coverage invalid');return copy(d.pairs);}
   if(policy==='greedy'){const used=new Set(),pairs=[];for(const r of rs.sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id))){let picked=null;for(const v of vs)if(!used.has(v.id)&&legal(r,v,t)&&(!picked||length(v.at,point(r.origin))<length(picked.at,point(r.origin))))picked=v;if(picked){used.add(picked.id);pairs.push([r.id,picked.id]);}}return pairs.sort((a,b)=>canonical(a).localeCompare(canonical(b)));}
   // Enumerate by vehicle, unlike the producer's recursion by request.
   const explore=(i,pairs,used,meters)=>{if(i===vs.length){candidates.push({pairs:pairs.slice().sort((a,b)=>canonical(a).localeCompare(canonical(b))),meters});return;}explore(i+1,pairs,used,meters);for(const r of rs)if(!used.includes(r.id)&&legal(r,vs[i],t))explore(i+1,[...pairs,[r.id,vs[i].id]],[...used,r.id],meters+length(vs[i].at,point(r.origin)));};
   explore(0,[],[],0);candidates.sort((a,b)=>b.pairs.length-a.pairs.length||a.meters-b.meters||(canonical(a.pairs)<canonical(b.pairs)?-1:canonical(a.pairs)>canonical(b.pairs)?1:0));return candidates[0].pairs;
  };
  let final;
  for(let t=0;t<=end;t+=30){
   for(const [stage,kind]of [['approachEnd','approach_end'],['pickupEnd','pickup_end'],['tripEnd','trip_end']]){
    for(const j of jobs.filter(j=>j[stage]===t).sort((a,b)=>a.vid.localeCompare(b.vid))){const r=rows.find(r=>r.id===j.rid);emit(t,kind,j.vid,j.rid);if(stage==='pickupEnd'){r.state='riding';r.pickup=t;}if(stage==='tripEnd'){r.state='completed';r.complete=t;}}
   }
   for(const r of rows)if(r.arrival===t){r.state='pending';emit(t,'admit',null,r.id);}
   if(t<horizon)preDecision.push(capture(t,'PRE_DISPATCH'));
   if(policy==='manual'&&t===end&&t<horizon){final=capture(t,'PRE_DISPATCH');break;}
   let pairs=[];
   if(t<horizon){pairs=choose(t);equal(pairs,[...pairs].sort((a,b)=>canonical(a).localeCompare(canonical(b))),'pair ordering');const seenCars=new Set(),seenRequests=new Set(),vs=cars(t);
    for(const p of pairs){if(!Array.isArray(p)||p.length!==2)fail('Malformed pair');const [rid,vid]=p,r=rows.find(r=>r.id===rid),v=vs.find(v=>v.id===vid);if(!r||!v||seenCars.has(vid)||seenRequests.has(rid)||!legal(r,v,t))fail('Illegal assignment');seenCars.add(vid);seenRequests.add(rid);}
    decisions.push({t,pairs:copy(pairs)});
    for(const [rid,vid]of pairs){const r=rows.find(r=>r.id===rid),v=vs.find(v=>v.id===vid),origin=point(r.origin),destination=point(r.destination),approachEnd=t+length(v.at,origin)*60/1000,pickupEnd=approachEnd+30;const j={rid,vid,start:t,startAt:v.at,origin,destination,approachEnd,pickupEnd,tripEnd:pickupEnd+length(origin,destination)*60/1000};jobs.push(j);r.state='assigned';r.vehicle=vid;emit(t,'assign',vid,rid);}
    for(const j of jobs.filter(j=>j.start===t&&j.approachEnd===t).sort((a,b)=>a.vid.localeCompare(b.vid)))emit(t,'approach_end',j.vid,j.rid);
   }
   for(const r of rows)if(r.state==='pending'&&r.deadline===t){r.state='expired';emit(t,'expire',null,r.id);}
   final=capture(t,t===horizon?'OBSERVATION_END':'POST_BOUNDARY',pairs);ledger.push(final);
  }
  const admitted=rows.filter(r=>r.state!=='future'),waits=admitted.filter(r=>r.pickup!==null).map(r=>r.pickup-r.arrival).sort((a,b)=>a-b),n=waits.length;
  const distanceUntil=(start,finish,t)=>Math.max(0,Math.min(t,finish)-start)*1000/60;
  const metrics={admitted:admitted.length,served:n,completed:admitted.filter(r=>r.state==='completed').length,expired:admitted.filter(r=>r.state==='expired').length,pending:admitted.filter(r=>r.state==='pending').length,assigned:admitted.filter(r=>r.state==='assigned').length,unfinished:admitted.filter(r=>r.state==='riding').length,emptyMeters:jobs.reduce((s,j)=>s+distanceUntil(j.start,j.approachEnd,end),0),passengerMeters:jobs.reduce((s,j)=>s+distanceUntil(j.pickupEnd,j.tripEnd,end),0),medianWait:n?(waits[(n-1)>>1]+waits[n>>1])/2:null,p95Wait:n?waits[Math.ceil(.95*n)-1]:null,serviceRate:admitted.length?{numerator:n,denominator:admitted.length}:null};
  const payload={schema:VERSION,input,inputDigest:hash(input),policy,quantum:30,end,phase:final.phase,decisions,events,ledger,preDecision,final,metrics,authenticity:'NOT_AUTHENTICATED',deploymentPermission:'NONE'};
  equal(record,{...payload,digest:hash(payload)},'record');return {ok:true,errors:[]};
 }catch(error){return {ok:false,errors:[String(error.message||error)]};}
}
export function verifyStudy(records,expectedInput){
 try{if(!Array.isArray(records)||records.length!==2)fail('Exactly two arms required');equal(records.map(r=>r.policy).sort(),['greedy','joint'],'study policies');for(const r of records){const result=verifyDispatch(r);if(!result.ok)fail(result.errors.join('; '));equal(r.input,normalize(expectedInput),'common workload');}return {ok:true,errors:[]};}catch(error){return {ok:false,errors:[String(error.message||error)]};}
}
