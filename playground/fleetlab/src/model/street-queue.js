/** Finite FIFO road links. Geometry/routing and fleet decisions belong to callers. */
export function createStreetQueue(network,options={}){
 const dt=options.stepSeconds??5;
 if(!Number.isFinite(dt)||dt<=0)throw new RangeError('Invalid step');
 const capacity=options.capacity??(e=>Math.max(1,e.lanes)*.32);
 const travel=options.travelSeconds??(e=>e.length_m/(e.speed_kph/3.6));
 const green=options.green??(()=>true);
 const slots=options.storageSlots??(e=>Math.max(1,Math.floor(e.length_m*Math.max(1,e.lanes)/7.5)));
 const links=new Map(network.edges.map(e=>[e.id,{edge:e,cars:[],slots:slots(e),tokens:0,fraction:0}]));
 for(const link of links.values())if(!Number.isInteger(link.slots)||link.slots<1)throw new RangeError('Invalid storage');
 const all=new Map(),active=new Map();let pending=[],clock=0,started=false,completed=0;
 function enqueue(journey,time){
  if(!Number.isFinite(time)||time<clock)throw new RangeError('Invalid departure time');
  if(all.has(journey.id))throw new RangeError('Duplicate journey id');
  if(!Array.isArray(journey.edge_ids)||journey.edge_ids.length===0)throw new RangeError('A road journey needs an edge');
  const path=journey.edge_ids.map(id=>{const l=links.get(id);if(!l)throw new RangeError(`Unknown road edge ${id}`);return l;});
  for(let i=1;i<path.length;i++)if(path[i-1].edge.to!==path[i].edge.from)throw new RangeError('Path is not contiguous');
  const item={...journey,edge_ids:[...journey.edge_ids],requested:time,index:0,entered:null,ready:null};
  all.set(item.id,item);active.set(item.id,item);pending.push(item);
 }
 function enter(item,link,time){
  const seconds=travel(link.edge,time);if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Invalid road travel time');
  item.entered=time;item.ready=time+Math.max(dt,seconds);link.cars.push(item);
 }
 function step(time){
  if(!Number.isFinite(time)||time<clock||(started&&Math.abs(time-clock-dt)>1e-8))throw new RangeError('Invalid step time');
  const elapsed=started?dt:0;clock=time;started=true;const arrived=[];
  for(const link of links.values()){
   const rate=capacity(link.edge,time);if(!Number.isFinite(rate)||rate<0)throw new RangeError('Invalid discharge capacity');
   const isGreen=green(link.edge,time);
   // Carry only the fractional service opportunity. Unused whole departures never bank through a red or blockage.
   const credit=link.fraction+(isGreen?rate*elapsed:0);
   link.tokens=isGreen?Math.floor(credit+1e-9):0;
   link.fraction=Math.max(0,credit-link.tokens);
   while(isGreen&&link.tokens>=1-1e-9&&link.cars[0]?.ready<=time){
    const item=link.cars[0],next=links.get(item.edge_ids[item.index+1]);
    if(next&&next.cars.length>=next.slots)break;
    link.cars.shift();link.tokens=Math.max(0,link.tokens-1);
    if(next){item.index++;enter(item,next,time);}
    else {completed++;active.delete(item.id);arrived.push({id:item.id,time,entered:item.requested,last_edge:link.edge.id});}
   }
  }
  const waiting=[];
  for(const item of pending){const first=links.get(item.edge_ids[0]);if(item.requested<=time&&first.cars.length<first.slots)enter(item,first,time);else waiting.push(item);}
  pending=waiting;return arrived;
 }
 function edgeState(id){
  const link=links.get(id);if(!link)throw new RangeError('Unknown road edge');
  const first=link.cars[0],next=first?links.get(first.edge_ids[first.index+1]):null;
  return {id,occupancy:link.cars.length,queued:link.cars.filter(c=>c.ready<=clock).length,storage:link.slots,front_wait_seconds:first?Math.max(0,clock-first.ready):null,
   spillback:!!(first&&first.ready<=clock&&next&&next.cars.length>=next.slots)};
 }
 function position(id){
  const car=active.get(id);if(!car)return null;
  const edge_id=car.edge_ids[car.index];
  if(car.entered===null)return {edge_id:null,pending_edge_id:edge_id,progress:0,distance_m:0,exit_wait_seconds:null,waiting:true};
  const link=links.get(edge_id),index=link.cars.indexOf(car);let progress=1;
  for(let i=0;i<=index;i++){const c=link.cars[i];progress=Math.max(0,Math.min(progress-(i?1/link.slots:0),(clock-c.entered)/(c.ready-c.entered),1));}
  const distance_m=car.edge_ids.slice(0,car.index).reduce((sum,id)=>sum+links.get(id).edge.length_m,0)+link.edge.length_m*progress;
  return {edge_id,progress,distance_m,exit_wait_seconds:Math.max(0,clock-car.ready),waiting:car.ready<=clock};
 }
 return {enqueue,step,position,edgeState,
  counts:()=>({submitted:all.size,completed,on_road:active.size-pending.length,pending:pending.length}),
  roadStates:()=>[...links.keys()].map(edgeState).filter(e=>e.occupancy>0),
 };
}
