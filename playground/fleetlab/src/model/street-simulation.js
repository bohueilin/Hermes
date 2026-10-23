import {createStreetRouter} from './street-network.js';
import {createStreetQueue} from './street-queue.js';

export function defaultStreetConfig(){return {hotspot:'first',policy:'free-flow',fleet_size:24,requests_per_hour:36,background_per_hour:900,duration_minutes:120,start_hour:16,weather:'clear',capacity_loss_pct:75,incident_start_minutes:15,incident_end_minutes:90,boarding_seconds:60,curb_bays:2,turnaround_minutes:8,sfo_share_pct:40,east_bay_share_pct:40,seed:42};}
export const STREET_PRESETS=[
 {id:'first',title:'Bridge rush',question:'How does a ramp queue tie up the fleet?',cause:'First Street feeds the Bay Bridge approach. A constrained exit can hold cars across several upstream blocks.',action:'Compare queue-aware routing. Watch airport pickups as well as East Bay arrivals.'},
 {id:'harrison',title:'SoMa ramp feeders',question:'Does a detour move the bottleneck?',cause:'Harrison and Bryant feed freeway approaches through the SoMa grid. Cross-traffic shares finite street capacity.',action:'Inspect the used route and queues on neighboring streets before preferring a detour.'},
 {id:'stockton',title:'Chinatown friction',question:'What happens when the street loses throughput?',cause:'Pedestrian crossings, buses and deliveries motivate a reduced-discharge stress case around Stockton.',action:'Change the capacity loss or pickup dwell. Pedestrians and buses are represented through capacity, not individually simulated.'},
 {id:'van-ness',title:'Van Ness signals',question:'Can more vehicles overcome a street constraint?',cause:'A signalized corridor with BRT and constrained turns motivates a lower general-traffic discharge rate.',action:'Increase fleet size and compare completed trips against time spent waiting. No control of public signals is modeled.'},
 {id:'embarcadero',title:'Waterfront event',question:'What does an event do to airport service?',cause:'A burst of background traffic and constrained waterfront discharge competes with rider journeys near the Ferry Building and Oracle Park.',action:'Increase background demand and inspect pickup waits, pending entries and airport-bound journeys.'},
 {id:'lombard',title:'Lombard visitor queue',question:'Can a short queue spill into the neighborhood?',cause:'Visitor traffic motivates a low-throughput stress case near the crooked-street approach.',action:'Focus the map on Lombard, step through the queue, then inspect nearby blocks and unavailable AV time.'},
];
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const randomFor=seed=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return(s+.5)/4294967296;};};
const hash=text=>[...text].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,7);
function validate(c,network){
 const ranges={fleet_size:[1,60],requests_per_hour:[0,120],background_per_hour:[0,2400],duration_minutes:[10,180],start_hour:[0,23],capacity_loss_pct:[0,95],incident_start_minutes:[0,180],incident_end_minutes:[0,180],boarding_seconds:[10,300],curb_bays:[1,8],turnaround_minutes:[0,30],sfo_share_pct:[0,100],east_bay_share_pct:[0,100],seed:[0,4294967295]};
 for(const[k,[lo,hi]]of Object.entries(ranges))if(!Number.isFinite(c[k])||!Number.isInteger(c[k])||c[k]<lo||c[k]>hi)throw new RangeError(`Invalid ${k}`);
 if(c.sfo_share_pct+c.east_bay_share_pct>100||c.incident_end_minutes<c.incident_start_minutes||!['free-flow','queue-aware'].includes(c.policy)||!['clear','rain'].includes(c.weather)||!network.hotspots.some(h=>h.id===c.hotspot))throw new RangeError('Invalid scenario settings');
}

/** Deterministic mesoscopic street experiment. Road queues, fleet state and demand are independent of presentation. */
export function simulateStreets(input,network){
 const config={...defaultStreetConfig(),...input};validate(config,network);
 const c=config,step=5,end=c.duration_minutes*60,router=createStreetRouter(network),routeCache=new Map();
 const anchors=new Map(network.anchors.map(a=>[a.id,a])),nodes=new Map(network.nodes.map(n=>[n.id,n])),edges=new Map(network.edges.map(e=>[e.id,e]));
 const local=network.anchors.filter(a=>!['sfo','east-bay'].includes(a.id));
 if(!local.length||!anchors.has('sfo')||!anchors.has('east-bay'))throw new RangeError('Invalid network anchors');
 const focus=network.hotspots.find(h=>h.id===c.hotspot),focusEdges=new Set(focus.edge_ids);
 const focusAnchor=anchors.get(({first:'fidi',harrison:'soma',stockton:'chinatown','van-ness':'van-ness',embarcadero:'waterfront',lombard:'lombard'})[c.hotspot])??local[0];
 const incident={hotspot:c.hotspot,start_seconds:c.incident_start_minutes*60,end_seconds:c.incident_end_minutes*60,capacity_loss_pct:c.capacity_loss_pct};
 const wet=c.weather==='rain';
 const flowMultiplier=(e,t)=>wet?.85:1;
 const reduction=(e,t)=>focusEdges.has(e.id)&&t>=incident.start_seconds&&t<incident.end_seconds?1-c.capacity_loss_pct/100:1;
 const discharge=(e,t)=>Math.max(1,Math.min(4,e.lanes))*.32*flowMultiplier(e,t)*reduction(e,t);
 const green=(e,t)=>!e.signal||((t+hash(e.id)%90)%90)<45;
 const travel=e=>e.length_m/(e.speed_kph/3.6)*(wet?1.2:1);
 const q=createStreetQueue(network,{stepSeconds:step,capacity:discharge,green,travelSeconds:travel});
 const freeRoute=(from,to,via)=>{const key=`${from}|${to}|${via??''}`;if(!routeCache.has(key))routeCache.set(key,router(from,to,{viaEdge:via}));return routeCache.get(key);};
 let now=0;
 const route=(from,to,via)=>c.policy==='free-flow'?freeRoute(from,to,via):router(from,to,{viaEdge:via,edgeCost:e=>{const state=q.edgeState(e.id);return travel(e)+(e.signal?11.25:0)+state.queued/Math.max(.01,discharge(e,now))+(state.spillback?90:0)+(1/reduction(e,now)-1)*10;}});
 const rand=randomFor(c.seed),bgRand=randomFor(c.seed^0x6c8e9cf5),pick=(list,rng=rand)=>list[Math.floor(rng()*list.length)];
 const arrivals=(rate,make,rng)=>{if(!rate)return[];const out=[];let t=0;while(true){t+=-Math.log(1-rng())*3600/rate;if(t>=end)break;out.push(make(Math.ceil(t/step)*step,out.length));}return out.filter(x=>x.time<end);};
 const requests=arrivals(c.requests_per_hour,(time,i)=>{
  let from=rand()<.6?focusAnchor:pick(local),to;const destination=rand()*100;
  if(destination<c.sfo_share_pct)to=anchors.get('sfo');else if(destination<c.sfo_share_pct+c.east_bay_share_pct)to=anchors.get('east-bay');else to=pick(local.filter(a=>a.node!==from.node))??anchors.get('sfo');
  // One in five journeys reverses: commuter return demand is declared, not inferred from observations.
  if(rand()<.2)[from,to]=[to,from];
  return {id:`R${i+1}`,time,from:from.id,to:to.id,state:'future',assigned:null,boarded:null,completed:null};
 },randomFor(c.seed^0x9e3779b9));
 const samples=network.hotspots.filter(h=>h.sample_route?.length);
 const background=arrivals(c.background_per_hour,(time,i)=>{
  let path;const draw=bgRand();if(draw<.6)path=focus.sample_route;else if(draw<.8)path=pick(samples,bgRand)?.sample_route;
  else {const dest=bgRand()<.5?anchors.get('sfo'):anchors.get('east-bay');path=freeRoute(focusAnchor.node,dest.node).edge_ids;}
  return {id:`B${i+1}`,time,edge_ids:[...(path??[])]};
 },randomFor(c.seed^0xa511e9b3));
 const demand={requests:requests.map(r=>({id:r.id,time:r.time,from:r.from,to:r.to})),background};
 const cars=Array.from({length:c.fleet_size},(_,i)=>({id:`AV-${String(i+1).padStart(2,'0')}`,vehicle_type:i%2?'ojai':'ipace',node:local[i%local.length].node,anchor:local[i%local.length].id,state:'available',incoming:undefined,request:null,route_id:null,journey_id:null,ready:0,empty_m:0,completed:0,log:[]}));
 const routes={},legs=new Map(),frames=[],hotspotStats=new Map(network.hotspots.map(h=>[h.id,{id:h.id,peak_queued:0,blocked_link_minutes:0}]));
 let ri=0,bi=0,legNumber=0,busySeconds=0,peakQueue=0,unavailableBackground=0;
 const event=(car,text)=>car.log.push({time:now,text});
 function arrive(car){
  const req=car.request;
  if(car.state==='pickup'){car.node=anchors.get(req.from).node;car.anchor=req.from;car.state='curb_queue';event(car,'Arrived at modeled pickup; waiting for a curb berth');}
  else if(car.state==='occupied'){
   req.completed=now;req.state='completed';car.completed++;car.node=anchors.get(req.to).node;car.anchor=req.to;car.state='turnaround';car.ready=now+c.turnaround_minutes*60;
   event(car,`Journey completed at ${anchors.get(req.to).label}; off-road turnaround`);car.request=null;
  }
  car.journey_id=null;
 }
 function launch(car,path,state){
  car.state=state;
  if(!path.edge_ids.length){car.route_id=null;arrive(car);return;}
  const id=`${car.id}-leg-${++legNumber}`;routes[id]={...path,from:car.node,to:edges.get(path.edge_ids.at(-1)).to};car.route_id=id;car.journey_id=id;legs.set(id,car);q.enqueue({id,edge_ids:path.edge_ids},now);
  event(car,`${state==='pickup'?'Empty pickup leg':'Passenger leg'}: ${(path.distance_m/1000).toFixed(1)} km on the chosen route`);
 }
 function snapshot(){
  const roads=q.roadStates(),queued=roads.reduce((sum,e)=>sum+e.queued,0);peakQueue=Math.max(peakQueue,queued);
  for(const h of network.hotspots){const ids=new Set(h.edge_ids),states=roads.filter(e=>ids.has(e.id)),s=hotspotStats.get(h.id);s.peak_queued=Math.max(s.peak_queued,states.reduce((n,e)=>n+e.queued,0));if(now>0)s.blocked_link_minutes+=states.filter(e=>e.spillback).length*step/60;}
  return {time:now,roads,traffic:q.counts(),queued,vehicles:cars.map(car=>{const p=car.journey_id?q.position(car.journey_id):null;return {id:car.id,vehicle_type:car.vehicle_type,state:car.state,node:car.node,anchor:car.anchor,route_id:car.route_id,request_id:car.request?.id??null,from:car.request?.from??null,to:car.request?.to??null,completed:car.completed,...(p??{edge_id:null,progress:0,waiting:false})};}),requests:{completed:requests.filter(r=>r.state==='completed').length,waiting:requests.filter(r=>r.state==='waiting').length,in_progress:requests.filter(r=>['assigned','boarded'].includes(r.state)).length}};
 }
 for(now=0;now<=end;now+=step){
  if(now>0)busySeconds+=cars.filter(v=>v.state!=='available').length*step;
  while(ri<requests.length&&requests[ri].time<=now){const r=requests[ri++];r.state=freeRoute(anchors.get(r.from).node,anchors.get(r.to).node).available?'waiting':'unroutable';}
  while(bi<background.length&&background[bi].time<=now){const b=background[bi++];if(b.edge_ids.length)q.enqueue(b,now);else unavailableBackground++;}
  for(const done of q.step(now)){
   const car=legs.get(done.id);if(!car)continue;car.incoming=done.last_edge;if(car.state==='pickup')car.empty_m+=routes[car.route_id].distance_m;legs.delete(done.id);arrive(car);
  }
  for(const car of cars){
   if(car.state==='turnaround'&&car.ready<=now){car.state='available';event(car,'Available at the same network endpoint');}
   if(car.state==='boarding'&&car.ready<=now){
    const req=car.request,path=route(car.node,anchors.get(req.to).node,car.incoming);
    if(path.available){req.boarded=now;req.state='boarded';launch(car,path,'occupied');}
    else {req.state='unroutable';event(car,'No modeled onward route under the incoming turn restriction');car.request=null;car.state='available';}
   }
  }
  for(const car of cars.filter(v=>v.state==='curb_queue')){
   if(cars.filter(v=>v.state==='boarding'&&v.node===car.node).length<c.curb_bays){car.state='boarding';car.ready=now+c.boarding_seconds;event(car,'In an off-road pickup berth; boarding');}
  }
  for(const req of requests){
   if(req.state!=='waiting')continue;
   if(now-req.time>=1800){req.state='expired';continue;}
   const origin=anchors.get(req.from),available=cars.filter(v=>v.state==='available').sort((a,b)=>{const an=nodes.get(a.node),bn=nodes.get(b.node),on=nodes.get(origin.node);return Math.hypot(an.x-on.x,an.y-on.y)-Math.hypot(bn.x-on.x,bn.y-on.y)||a.id.localeCompare(b.id);});
   for(const car of available){const path=route(car.node,origin.node,car.incoming);if(!path.available)continue;
    const incoming=path.edge_ids.at(-1)??car.incoming;if(!freeRoute(origin.node,anchors.get(req.to).node,incoming).available)continue;
    req.assigned=now;req.state='assigned';car.request=req;event(car,`Assigned ${req.id}: ${origin.label} to ${anchors.get(req.to).label}`);launch(car,path,'pickup');break;}
  }
  frames.push(snapshot());
 }
 const completed=requests.filter(r=>r.state==='completed'),boarded=requests.filter(r=>r.boarded!==null);
 const empty= cars.reduce((sum,car)=>sum+car.empty_m+(car.state==='pickup'?(q.position(car.journey_id)?.distance_m??0):0),0)/1000;
 const summary={requests:requests.length,completed:completed.length,expired:requests.filter(r=>r.state==='expired').length,waiting:requests.filter(r=>r.state==='waiting').length,in_progress:requests.filter(r=>['assigned','boarded'].includes(r.state)).length,unroutable:requests.filter(r=>r.state==='unroutable').length,
  mean_pickup_minutes:mean(boarded.map(r=>(r.boarded-r.time)/60)),mean_trip_minutes:mean(completed.map(r=>(r.completed-r.boarded)/60)),boarded:boarded.length,empty_km:empty,busy_vehicle_minutes:busySeconds/60,peak_queued:peakQueue,traffic:q.counts(),unavailable_background:unavailableBackground,
  destinations:['sfo','east-bay','local'].map(id=>{const group=requests.filter(r=>id==='local'?!['sfo','east-bay'].includes(r.to):r.to===id);return {id,requests:group.length,completed:group.filter(r=>r.state==='completed').length};})};
 return {version:'street-lab-v1',network_version:network.version,config,demand,incident,requests,routes,frames,summary,hotspots:[...hotspotStats.values()],vehicles:cars.map(({id,log})=>({id,log}))};
}
export function compareStreetPolicies(config,network){
 const baseline=simulateStreets({...config,policy:'free-flow'},network),candidate=simulateStreets({...config,policy:'queue-aware'},network),delta={};
 for(const key of ['completed','mean_pickup_minutes','mean_trip_minutes','empty_km','busy_vehicle_minutes','peak_queued','waiting','in_progress'])delta[key]=baseline.summary[key]===null||candidate.summary[key]===null?null:candidate.summary[key]-baseline.summary[key];
 return {baseline,candidate,delta};
}
