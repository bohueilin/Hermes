import {VERSION,normalize,manualTape,canonical,copy,hash} from './dispatch-contract.js';
const meters=p=>p.map(n=>n*1000);
const distance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
export function runDispatch(raw,policy,{end=raw.horizon,decisions=[]}={}){
 const input=normalize(raw);if(!['greedy','joint','manual'].includes(policy)||!Number.isSafeInteger(end)||end<0||end>input.horizon||end%30||policy!=='manual'&&end!==input.horizon)throw Error('Unsupported run endpoint or policy');
 const tape=policy==='manual'?manualTape(decisions,end):[];
 if(policy!=='manual'&&decisions.length)throw Error('Automatic policy cannot accept manual actions');
 const vehicles=input.vehicles.map(v=>({id:v.id,at:meters(v.at),mode:'idle',request:null,target:null,until:null}));
 const requests=input.requests.map(r=>({...copy(r),state:'future',vehicle:null,pickup:null,complete:null}));
 const events=[],ledger=[],actions=[],preDecision=[];let emptyMeters=0,passengerMeters=0;
 const emit=(t,kind,v=null,r=null)=>events.push({seq:events.length,t,kind,vehicle:v?.id??null,request:r?.id??null});
 const snapshot=(t,phase,pairs=[])=>({t,phase,vehicles:copy(vehicles),requests:copy(requests.filter(r=>r.state!=='future')),pairs:copy(pairs),edges:requests.flatMap(r=>vehicles.filter(v=>feasible(r,v,t)).map(v=>({request:r.id,vehicle:v.id,meters:distance(v.at,meters(r.origin)),pickupAt:t+distance(v.at,meters(r.origin))*60/1000+30})))});
 for(const v of vehicles)emit(0,'ready',v);
 const close=t=>{
  let changed=true;
  while(changed){changed=false;for(const mode of ['approach','pickup','trip'])for(const v of vehicles){
   if(v.mode!==mode||v.until!==t)continue;changed=true;const r=requests.find(r=>r.id===v.request);
   if(mode==='approach'){v.at=meters(r.origin);v.mode='pickup';v.target=null;v.until=t+30;emit(t,'approach_end',v,r);}
   else if(mode==='pickup'){r.state='riding';r.pickup=t;v.mode='trip';v.target=meters(r.destination);v.until=t+distance(v.at,v.target)*60/1000;emit(t,'pickup_end',v,r);}
   else {v.at=meters(r.destination);r.state='completed';r.complete=t;v.mode='idle';v.until=null;v.target=null;v.request=null;emit(t,'trip_end',v,r);}
  }}
 };
 const feasible=(r,v,t)=>r.state==='pending'&&v.mode==='idle'&&t+distance(v.at,meters(r.origin))*60/1000+30<=Math.min(r.deadline,input.horizon);
 const choose=t=>{
  const pending=requests.filter(r=>r.state==='pending').sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id));
  if(policy==='manual')return tape[t/30].pairs;
  if(policy==='greedy'){const used=new Set(),pairs=[];for(const r of pending){const v=vehicles.filter(v=>!used.has(v.id)&&feasible(r,v,t)).sort((a,b)=>distance(a.at,meters(r.origin))-distance(b.at,meters(r.origin))||a.id.localeCompare(b.id))[0];if(v){used.add(v.id);pairs.push([r.id,v.id]);}}return pairs.sort((a,b)=>canonical(a).localeCompare(canonical(b)));}
  let best=[],cost=Infinity;
  const visit=(i,pairs,used,sum)=>{if(i===pending.length){const ordered=[...pairs].sort((a,b)=>canonical(a).localeCompare(canonical(b)));if(ordered.length>best.length||ordered.length===best.length&&(sum<cost||sum===cost&&canonical(ordered)<canonical(best))){best=ordered;cost=sum;}return;}
   visit(i+1,pairs,used,sum);const r=pending[i];for(const v of vehicles)if(!used.has(v.id)&&feasible(r,v,t))visit(i+1,[...pairs,[r.id,v.id]],new Set([...used,v.id]),sum+distance(v.at,meters(r.origin)));
  };visit(0,[],new Set(),0);return best;
 };
 let final;
 for(let t=0;t<=end;t+=30){
  if(t)for(const v of vehicles)if(v.mode==='approach'||v.mode==='trip'){
   let left=Math.min(500,distance(v.at,v.target)),moved=left;for(let a=0;a<2;a++){const step=Math.min(left,Math.abs(v.target[a]-v.at[a]));v.at[a]+=Math.sign(v.target[a]-v.at[a])*step;left-=step;}if(v.mode==='approach')emptyMeters+=moved;else passengerMeters+=moved;
  }
  close(t);for(const r of requests)if(r.arrival===t){r.state='pending';emit(t,'admit',null,r);}
  if(t<input.horizon)preDecision.push(snapshot(t,'PRE_DISPATCH'));
  if(policy==='manual'&&t===end&&t<input.horizon){final=snapshot(t,'PRE_DISPATCH');break;}
  let pairs=[];
  if(t<input.horizon){pairs=choose(t);const rv=new Set(),rr=new Set();for(const [rid,vid]of pairs){const r=requests.find(x=>x.id===rid),v=vehicles.find(x=>x.id===vid);if(!r||!v||rv.has(vid)||rr.has(rid)||!feasible(r,v,t))throw Error('Batch contains duplicate or infeasible assignment');rv.add(vid);rr.add(rid);}
   actions.push({t,pairs:copy(pairs)});for(const [rid,vid]of pairs){const r=requests.find(x=>x.id===rid),v=vehicles.find(x=>x.id===vid);r.state='assigned';r.vehicle=vid;v.mode='approach';v.request=rid;v.target=meters(r.origin);v.until=t+distance(v.at,v.target)*60/1000;emit(t,'assign',v,r);}close(t);
  }
  for(const r of requests)if(r.state==='pending'&&r.deadline===t){r.state='expired';emit(t,'expire',null,r);}
  final=snapshot(t,t===input.horizon?'OBSERVATION_END':'POST_BOUNDARY',pairs);ledger.push(final);
 }
 const admitted=requests.filter(r=>r.state!=='future'),waits=admitted.filter(r=>r.pickup!==null).map(r=>r.pickup-r.arrival).sort((a,b)=>a-b),n=waits.length;
 const metrics={admitted:admitted.length,served:n,completed:admitted.filter(r=>r.state==='completed').length,expired:admitted.filter(r=>r.state==='expired').length,pending:admitted.filter(r=>r.state==='pending').length,assigned:admitted.filter(r=>r.state==='assigned').length,unfinished:admitted.filter(r=>r.state==='riding').length,emptyMeters,passengerMeters,medianWait:n?(waits[Math.floor((n-1)/2)]+waits[Math.floor(n/2)])/2:null,p95Wait:n?waits[Math.ceil(n*.95)-1]:null,serviceRate:admitted.length?{numerator:n,denominator:admitted.length}:null};
 const payload={schema:VERSION,input,inputDigest:hash(input),policy,quantum:30,end,phase:final.phase,decisions:actions,events,ledger,preDecision,final,metrics,authenticity:'NOT_AUTHENTICATED',deploymentPermission:'NONE'};
 return {...payload,digest:hash(payload)};
}
