// Independent transcript checker. No producer, simulator, UI or worker import.
import {ZONES,normalizeInput,defaultInput,canonical,hash,copy,rational,addRational} from './rebalancing-contract.js';
const requireThat=(yes,message)=>{if(!yes)throw Error(message);};
const equal=(a,b,label)=>requireThat(canonical(a)===canonical(b),`${label} mismatch`);
export function verifyRebalancing(record){
 try{
  requireThat(record&&Array.isArray(record.events)&&record.events.length<=4000&&Array.isArray(record.boundaries)&&record.boundaries.length<=13&&Array.isArray(record.decisionSnapshots)&&record.decisionSnapshots.length<=12,'record bounds');
  requireThat(canonical(record).length<=2000000,'record byte bound');
  const {digest,...payload}=record;equal(hash(payload),digest,'record digest');
  equal(Object.keys(payload).sort(),['schema','input','inputDigest','policy','end','decisions','events','eventsDigest','boundaries','decisionSnapshots','metrics','requests'].sort(),'record fields');
  requireThat(record.schema==='fleetlab.rebalancing-record/1','schema');
  const input=normalizeInput(record.input);equal(input,record.input,'normalized input');equal(hash(input),record.inputDigest,'input digest');equal(hash(record.events),record.eventsDigest,'event digest');
  const policy=record.policy.id,end=record.end;equal(record.policy,{id:policy,version:1},'policy version');requireThat(['reactive','forecast','manual'].includes(policy)&&Number.isSafeInteger(end)&&end>=0&&end<=input.horizon&&end%600===0,'policy or endpoint');
  requireThat(policy==='manual'||end===input.horizon,'recorded horizon');requireThat(Array.isArray(record.decisions)&&record.decisions.length===(policy==='manual'?end/600:0),'decision coverage');
  const fleet=input.vehicles.map(x=>({id:x.id,zone:x.zone,activity:'idle',from:null,to:null,start:null,end:null,request:null,move:null})),riders=[],legs=[],seen=[];
  let cursor=0,boundary=0,decision=0;
  const take=(t,kind,data)=>{const expected={seq:cursor,t,kind,...data};equal(record.events[cursor],expected,`event ${cursor}`);seen.push(expected);cursor++;};
  const idle=v=>{v.zone=v.to;v.activity='idle';v.from=v.to=v.start=v.end=v.request=v.move=null;};
  const metrics=t=>{
   const counts={pending:0,assigned:0,picked_up:0,completed:0,expired:0};for(const r of riders)counts[r.state]++;
   const result={...counts,admitted:riders.length,served:counts.picked_up+counts.completed};result.service_rate=riders.length?{n:result.served,d:riders.length}:null;
   for(const key of ['empty_m','pickup_m','rebalancing_m','passenger_m'])result[key]=rational(0);
   for(const leg of legs){const traveled=rational(leg.meters*Math.max(0,Math.min(t-leg.start,leg.end-leg.start)),leg.end-leg.start);result[leg.key]=addRational(result[leg.key],traveled);}
   result.empty_m=addRational(result.pickup_m,result.rebalancing_m);const total=addRational(result.empty_m,result.passenger_m);result.deadhead_ratio=total.n?rational(result.empty_m.n*total.d,total.n*result.empty_m.d):null;
   result.wait={};for(const zone of ZONES){const all=riders.filter(r=>r.origin===zone),waits=all.flatMap(r=>r.pickup===null?[]:[r.pickup-r.arrival]).sort((x,y)=>x-y),n=waits.length;result.wait[zone]={n,median:n?(n%2?waits[(n-1)/2]:(waits[n/2-1]+waits[n/2])/2):null,p95:n?waits[Math.ceil(n*95/100)-1]:null,unserved:all.filter(r=>r.state==='expired').length,pending:all.filter(r=>r.state==='pending'||r.state==='assigned').length};}
   return result;
  };
  const checkSnapshot=(t,phase,actual)=>{
   const vehicles=copy(fleet),stateDigest=hash(vehicles),zones={};
   for(const zone of ZONES){const local=vehicles.filter(v=>v.zone===zone),intervalEvents=seen.filter(e=>t===0?e.t===0:e.t>t-600&&e.t<=t);zones[zone]={ready:local.filter(v=>v.activity==='idle').length,cod:local.filter(v=>v.activity==='pickup').length,vor:0,inbound:vehicles.filter(v=>v.zone===null&&v.to===zone).length,outbound:vehicles.filter(v=>v.zone===null&&v.from===zone).length,forecast:input.forecasts.find(f=>f.t===t)?.counts?.[zone]??null,arrivals:intervalEvents.filter(e=>e.kind==='admit'&&e.origin===zone).length,pickups:intervalEvents.filter(e=>e.kind==='pickup'&&e.from===zone).length,expired:intervalEvents.filter(e=>e.kind==='expire'&&e.origin===zone).length,stateDigest};}
   const expected={t,phase,vehicles,zones,transit:vehicles.filter(v=>v.zone===null).length,metrics:metrics(t),stateDigest};equal(actual,{...expected,digest:hash(expected)},`${phase} snapshot ${t}`);
  };
  for(let t=0;t<=end;t++){
   for(const v of fleet)if(v.end===t){const r=riders.find(r=>r.id===v.request);
    if(v.activity==='pickup'){const until=t+input.distances[r.origin][r.destination]*120/1000;take(t,'pickup',{vehicle:v.id,request:r.id,from:r.origin,to:r.destination,end:until,meters:input.distances[r.origin][r.destination]});r.state='picked_up';r.pickup=t;v.activity='passenger_trip';v.zone=null;v.from=r.origin;v.to=r.destination;v.start=t;v.end=until;legs.push({start:t,end:until,meters:input.distances[r.origin][r.destination],key:'passenger_m'});}
    else{requireThat(v.activity==='passenger_trip'||v.activity==='rebalancing','invalid completing activity');take(t,v.activity==='passenger_trip'?'trip_end':'rebalance_end',{vehicle:v.id,...(r?{request:r.id}:{move:v.move}),zone:v.to});if(r)r.state='completed';idle(v);}
   }
   for(const source of input.requests.filter(r=>r.arrival===t)){take(t,'admit',{request:source.id,origin:source.origin});riders.push({...source,state:'pending',vehicle:null,pickup:null});}
   // Mandatory local assignment: omitted or reordered assignments cannot disappear from the transcript.
   for(const r of riders.filter(r=>r.state==='pending').sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id))){const due=t+60;if(due>r.deadline||due>input.horizon)continue;const v=fleet.filter(v=>v.zone===r.origin&&v.activity==='idle').sort((a,b)=>a.id.localeCompare(b.id))[0];if(!v)continue;
    take(t,'assign',{vehicle:v.id,request:r.id,from:r.origin,to:r.origin,end:due,meters:200});r.state='assigned';r.vehicle=v.id;Object.assign(v,{activity:'pickup',from:r.origin,to:r.origin,start:t,end:due,request:r.id});legs.push({start:t,end:due,meters:200,key:'pickup_m'});
   }
   for(const r of riders)if((r.state==='pending'||r.state==='assigned')&&r.deadline===t){take(t,'expire',{request:r.id,origin:r.origin});r.state='expired';}
   if(t%600===0){checkSnapshot(t,'before-decision',record.boundaries[boundary++]);if(t===end)continue;
    const available=fleet.filter(v=>v.activity==='idle'),moves=[];
    if(policy==='manual'){
     const entry=record.decisions[t/600];requireThat(entry&&entry.t===t&&Array.isArray(entry.moves)&&entry.moves.length<=12,'manual decision');equal(Object.keys(entry).sort(),['moves','t'],'manual fields');
     let previous='';const used=new Set();for(const m of entry.moves){equal(Object.keys(m).sort(),['count','from','to'],'move fields');requireThat(ZONES.includes(m.from)&&ZONES.includes(m.to)&&m.from!==m.to&&Number.isSafeInteger(m.count)&&m.count>0&&m.count<=24&&m.from+m.to>previous,'canonical move');previous=m.from+m.to;
      for(let n=0;n<m.count;n++){const v=available.find(v=>v.zone===m.from&&!used.has(v.id));requireThat(v,'manual supply');used.add(v.id);moves.push({vehicle:v.id,from:m.from,to:m.to});}
     }
    }else{
     const targets=policy==='forecast'?input.forecasts[t/600].counts:Object.fromEntries(ZONES.map(z=>[z,riders.filter(r=>r.state==='expired'&&r.origin===z&&r.deadline>t-600&&r.deadline<=t).length]));
     if(targets){const deficit={},supply={};for(const z of ZONES){const n=available.filter(v=>v.zone===z).length;deficit[z]=Math.max(0,targets[z]-n);supply[z]=Math.max(0,n-Math.max(1,targets[z]));}
      const used=new Set();for(let k=0;k<input.vehicles.length;k++){let receiver=null;for(const z of ZONES)if(deficit[z]>0&&(receiver===null||deficit[z]>deficit[receiver]))receiver=z;if(receiver===null)break;
       let donor=null;for(const z of ZONES)if(supply[z]>0&&(donor===null||input.distances[z][receiver]<input.distances[donor][receiver]))donor=z;if(donor===null)break;
       const v=available.find(v=>v.zone===donor&&!used.has(v.id));requireThat(v,'policy supply');used.add(v.id);moves.push({vehicle:v.id,from:donor,to:receiver});supply[donor]--;deficit[receiver]--;
      }
     }
    }
    for(const m of moves){const v=fleet.find(v=>v.id===m.vehicle),meters=input.distances[m.from][m.to],until=t+meters*120/1000,move=`move-${t}-${v.id}`;take(t,'rebalance_start',{vehicle:v.id,move,from:m.from,to:m.to,end:until,meters});Object.assign(v,{activity:'rebalancing',zone:null,from:m.from,to:m.to,start:t,end:until,move});legs.push({start:t,end:until,meters,key:'rebalancing_m'});}
    checkSnapshot(t,'after-decision',record.decisionSnapshots[decision++]);
   }
  }
  requireThat(cursor===record.events.length&&boundary===record.boundaries.length&&decision===record.decisionSnapshots.length,'extra events or snapshots');equal(metrics(end),record.metrics,'final metrics');equal(riders,record.requests,'request lifecycle');return {ok:true,errors:[]};
 }catch(error){return {ok:false,errors:[String(error.message||error)]};}
}
export function verifyRebalancingStudy(records,expected=defaultInput()){
 try{requireThat(Array.isArray(records)&&records.length===2,'study requires exactly two arms');const policies=new Set();for(const record of records){const checked=verifyRebalancing(record);requireThat(checked.ok,checked.errors.join('; '));requireThat(['reactive','forecast'].includes(record.policy.id)&&!policies.has(record.policy.id),'study policy coverage');policies.add(record.policy.id);equal(record.input,normalizeInput(expected),'common study input');requireThat(record.end===expected.horizon,'study horizon');}return {ok:true,errors:[]};}catch(error){return {ok:false,errors:[String(error.message||error)]};}
}
