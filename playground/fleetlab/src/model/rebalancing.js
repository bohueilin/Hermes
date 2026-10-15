import {ZONES,normalizeInput,normalizePlan,canonicalBatch,copy,freeze,hash,rational,addRational} from './rebalancing-contract.js';
const idle=v=>{v.activity='idle';v.zone=v.to;v.from=null;v.to=null;v.start=null;v.end=null;v.request=null;v.move=null;};
function summarize(input,requests,events,t){
 const states=['pending','assigned','picked_up','completed','expired'],result=Object.fromEntries(states.map(s=>[s,requests.filter(r=>r.state===s).length]));
 result.admitted=requests.length;result.served=result.picked_up+result.completed;result.service_rate=result.admitted?{n:result.served,d:result.admitted}:null;
 result.empty_m=rational(0);result.pickup_m=rational(0);result.rebalancing_m=rational(0);result.passenger_m=rational(0);
 for(const e of events)if(['assign','pickup','rebalance_start'].includes(e.kind)){
  const distance=rational(e.meters*Math.max(0,Math.min(t,e.end)-e.t),e.end-e.t),key=e.kind==='assign'?'pickup_m':e.kind==='pickup'?'passenger_m':'rebalancing_m';result[key]=addRational(result[key],distance);
 }
 result.empty_m=addRational(result.pickup_m,result.rebalancing_m);const all=addRational(result.empty_m,result.passenger_m);result.deadhead_ratio=all.n?rational(result.empty_m.n*all.d,result.empty_m.d*all.n):null;
 result.wait=Object.fromEntries(ZONES.map(z=>{const rows=requests.filter(r=>r.origin===z),a=rows.filter(r=>r.pickup!==null).map(r=>r.pickup-r.arrival).sort((a,b)=>a-b),n=a.length;return[z,{n,median:n?(a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2:null,p95:n?a[Math.ceil(.95*n)-1]:null,unserved:rows.filter(r=>r.state==='expired').length,pending:rows.filter(r=>['pending','assigned'].includes(r.state)).length}];}));return result;
}
function snapshot(input,vehicles,requests,events,t,phase){
 const fleet=copy(vehicles),stateDigest=hash(fleet),metrics=summarize(input,requests,events,t),forecast=input.forecasts.find(f=>f.t===t)?.counts??null;
 const zones=Object.fromEntries(ZONES.map(z=>[z,{ready:fleet.filter(v=>v.zone===z&&v.activity==='idle').length,cod:fleet.filter(v=>v.zone===z&&v.activity==='pickup').length,vor:0,
  inbound:fleet.filter(v=>v.zone===null&&v.to===z).length,outbound:fleet.filter(v=>v.zone===null&&v.from===z).length,forecast:forecast?.[z]??null,
  arrivals:events.filter(e=>e.kind==='admit'&&e.origin===z&&(t===0?e.t===0:e.t>t-600&&e.t<=t)).length,
  pickups:events.filter(e=>e.kind==='pickup'&&e.from===z&&(t===0?e.t===0:e.t>t-600&&e.t<=t)).length,
  expired:events.filter(e=>e.kind==='expire'&&e.origin===z&&(t===0?e.t===0:e.t>t-600&&e.t<=t)).length,stateDigest}]));
 const payload={t,phase,vehicles:fleet,zones,transit:fleet.filter(v=>v.zone===null).length,metrics,stateDigest};return {...payload,digest:hash(payload)};
}
function policyMoves(input,policy,vehicles,requests,t){
 const target=policy==='forecast'?input.forecasts.find(f=>f.t===t).counts:Object.fromEntries(ZONES.map(z=>[z,requests.filter(r=>r.origin===z&&r.state==='expired'&&r.deadline>t-600&&r.deadline<=t).length]));
 if(!target)return [];
 const pool=vehicles.filter(v=>v.activity==='idle'),ready=Object.fromEntries(ZONES.map(z=>[z,pool.filter(v=>v.zone===z).length]));
 const supply=Object.fromEntries(ZONES.map(z=>[z,Math.max(0,ready[z]-Math.max(1,target[z]))])),need=Object.fromEntries(ZONES.map(z=>[z,Math.max(0,target[z]-ready[z])]));
 const chosen=[];while(true){const to=ZONES.filter(z=>need[z]>0).sort((a,b)=>need[b]-need[a]||a.localeCompare(b))[0];if(!to)break;const from=ZONES.filter(z=>supply[z]>0).sort((a,b)=>input.distances[a][to]-input.distances[b][to]||a.localeCompare(b))[0];if(!from)break;const v=pool.find(v=>v.zone===from&&!chosen.some(m=>m.vehicle===v.id));chosen.push({vehicle:v.id,from,to});supply[from]--;need[to]--;}
 return chosen;
}
export function runRebalancing(raw,policy,{decisions=[],end=raw.horizon}={}){
 const input=normalizeInput(raw);if(!['reactive','forecast','manual'].includes(policy)||!Number.isSafeInteger(end)||end<0||end>input.horizon||end%600)throw Error('R1: unsupported policy or endpoint');
 if(policy!=='manual'&&(decisions.length||end!==input.horizon))throw Error('R1: recorded policy requires complete horizon');
 const plan=normalizePlan(decisions,end),accepted=[],vehicles=input.vehicles.map(v=>({...v,activity:'idle',from:null,to:null,start:null,end:null,request:null,move:null})),requests=[],events=[],boundaries=[],decisionSnapshots=[];
 const emit=(t,kind,fields)=>events.push({seq:events.length,t,kind,...fields});
 for(let t=0;t<=end;t++){
  for(const v of vehicles)if(v.end===t){const r=requests.find(r=>r.id===v.request);if(v.activity==='pickup'){
   r.state='picked_up';r.pickup=t;v.activity='passenger_trip';v.zone=null;v.from=r.origin;v.to=r.destination;v.start=t;v.end=t+input.distances[v.from][v.to]*input.seconds_per_km/1000;
   emit(t,'pickup',{vehicle:v.id,request:r.id,from:v.from,to:v.to,end:v.end,meters:input.distances[v.from][v.to]});
  }else{emit(t,v.activity==='passenger_trip'?'trip_end':'rebalance_end',{vehicle:v.id,...(r?{request:r.id}:{move:v.move}),zone:v.to});if(r)r.state='completed';idle(v);}}
  for(const r of input.requests)if(r.arrival===t){requests.push({...r,state:'pending',vehicle:null,pickup:null});emit(t,'admit',{request:r.id,origin:r.origin});}
  for(const r of requests)if(r.state==='pending'&&t+input.pickup_seconds<=r.deadline&&t+input.pickup_seconds<=input.horizon){const v=vehicles.find(v=>v.activity==='idle'&&v.zone===r.origin);if(v){r.state='assigned';r.vehicle=v.id;v.activity='pickup';v.from=r.origin;v.to=r.origin;v.start=t;v.end=t+input.pickup_seconds;v.request=r.id;emit(t,'assign',{vehicle:v.id,request:r.id,from:r.origin,to:r.origin,end:v.end,meters:input.pickup_meters});}}
  for(const r of requests)if(['pending','assigned'].includes(r.state)&&r.deadline===t){r.state='expired';emit(t,'expire',{request:r.id,origin:r.origin});}
  if(t%600===0){boundaries.push(snapshot(input,vehicles,requests,events,t,'before-decision'));if(t<end){let chosen;
   if(policy==='manual'){const moves=canonicalBatch(plan.find(d=>d.t===t)?.moves??[],vehicles);accepted.push({t,moves});chosen=[];for(const m of moves)for(let n=0;n<m.count;n++){const v=vehicles.find(v=>v.activity==='idle'&&v.zone===m.from&&!chosen.some(x=>x.vehicle===v.id));chosen.push({vehicle:v.id,from:m.from,to:m.to});}}
   else chosen=policyMoves(input,policy,vehicles,requests,t);
   for(const m of chosen){const v=vehicles.find(v=>v.id===m.vehicle),move=`move-${t}-${v.id}`;v.activity='rebalancing';v.zone=null;v.from=m.from;v.to=m.to;v.start=t;v.end=t+input.distances[m.from][m.to]*input.seconds_per_km/1000;v.move=move;emit(t,'rebalance_start',{vehicle:v.id,move,from:m.from,to:m.to,end:v.end,meters:input.distances[m.from][m.to]});}
   decisionSnapshots.push(snapshot(input,vehicles,requests,events,t,'after-decision'));
  }}
 }
 const payload={schema:'fleetlab.rebalancing-record/1',input,inputDigest:hash(input),policy:{id:policy,version:1},end,decisions:accepted,events,eventsDigest:hash(events),boundaries,decisionSnapshots,metrics:summarize(input,requests,events,end),requests:copy(requests)};
 return freeze({...payload,digest:hash(payload)});
}
