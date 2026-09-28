/** Density ladder: a page-only composer over the public Fleet day engine. It edits no engine file, runs nothing at import and
 * is never reachable from the worker. Every rate is an invented teaching assumption. Road distances come from the Fleet day
 * map, which is frozen public map geometry of a real region. Simulation only, NOT_EVIDENCE. */
import {u32} from '../core/keyed.js';
import {BAY_AREA_PLACES,bayAreaRoute} from './bay-area.js';
import {defaultBayAreaConfig,simulateBayAreaOperations} from './bay-operations.js';
import {freezeScale,scalePairSteps} from './scale-contract.js';
const VERSION='scale-density-1.0.0',SEEDS=Object.freeze(Array.from({length:10},(_,i)=>31001+i));
const RUNGS=[24,48,72,96,120],TOP=120,FROM=240,TO=480,PROMPT=15,KW=50,TRIPS=2,SPEED=38,KWH_KM=.24,CLEAN=8,SOFT=6,UPLOAD=6,CEILING=.9;
const TRIP='completed trips per 100 car-hours in hours 5 to 8',FAST='prompt pickup fraction of requests in hours 5 to 8',OPEN='unfinished depot visits per 100 cars at the end',STORE='stored energy at the end, kilowatt-hours per car';
const BANDS=[['street','Street load at the first rung',.64,.72,'of car time'],['depot','Depot load at the first rung',.4,.6,'of capacity at the busier site']];
/** Growth rules at step s = fleet / 24: [sites, per-site factor of the base site]. Every rule is the base depot at the first rung. */
const RULES={fixed:()=>[2,1],step:s=>[2,s],spare:s=>[2,2*s],sites:s=>[Math.max(2,s),Math.min(2,s)],one:s=>s>1?[1,2*s]:[2,1]};
/** Comparisons: control rule, tested rule, tested plan in words, control plan in words. */
const STEP='both sites scaled in step',PLANS={capacity:['fixed','step',STEP,'both sites as sized for 24 cars'],sites:['step','sites','sites added at equal capacity',STEP],one:['step','one','one site of equal capacity at the cell edge',STEP]};
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length,minutes=km=>Math.ceil(km/SPEED*60),memo={};
/** Hand quantities of the cell for a site count, from the road table and the stated rules of the engine. No engine call. */
const facts=sites=>memo[sites]??=(()=>{
  const cell=BAY_AREA_PLACES.slice(2,11),km=(a,b)=>bayAreaRoute(a.id,b.id).distance_km,ends=cell.map(()=>0),order=[...cell].sort((a,b)=>b.y-a.y||a.x-b.x);
  const at=Array.from({length:sites},(_,i)=>order[Math.floor(i*9/sites)]),share=at.map(()=>0);let trip=0,ride=0,leg=0,legMin=0;
  for(const a of cell){const w=cell.map(b=>b===a?0:(2+km(a,b))**-1.5),all=w.reduce((x,y)=>x+y,0);cell.forEach((b,j)=>{const p=w[j]/all/9;trip+=p*km(a,b);ride+=p*minutes(km(a,b));ends[j]+=p;});}
  cell.forEach((p,j)=>{const d=at.map(s=>km(p,s)),near=Math.min(...d),tied=d.filter(x=>x===near).length;d.forEach((x,i)=>{if(x===near)share[i]+=ends[j]/tied;});leg+=ends[j]*near;legMin+=ends[j]*minutes(near);});
  return {ids:cell.map(p=>p.id),trip,ride,leg,legMin,busier:Math.max(...share)};
})();
/** Energy per visit and busy minutes per trip by hand, for a site count and an empty distance per trip. Boarding takes 2 minutes. */
const hand=(sites,empty)=>{const f=facts(sites),kwh=KWH_KM*(TRIPS*(f.trip+empty)+f.leg);return {kwh,busy:2+f.ride+(f.legMin+CLEAN+SOFT+UPLOAD+1+kwh/KW*60)/TRIPS};};
/** Sizing rule: the two load ratios in, requests per car-hour and one base site out. Work is sized at the busier site, in whole units. */
function size({street,depot}){
  const f=facts(2),h=hand(2,f.trip),q=street*60/h.busy,visits=24*q/TRIPS*f.busier,bays=m=>Math.max(1,Math.ceil(visits*m/60/depot)),kw=Math.ceil(visits*h.kwh/depot/10)*10;
  return {q,kw,ports:Math.max(2,Math.ceil(kw/KW)),bays:[CLEAN,SOFT,UPLOAD].map(bays)};
}
/** Depot load by hand at the busier site of a rule and fleet: work asked over capacity, the largest of the four stages. */
function load(arm){
  const p=size(arm),[sites,m]=RULES[arm.rule](arm.fleet/24),visits=arm.fleet*p.q/TRIPS*facts(sites).busier/m;
  return Math.max(visits*hand(sites,facts(2).trip).kwh/p.kw,...[CLEAN,SOFT,UPLOAD].map((x,i)=>visits*x/60/p.bays[i]));
}
function engine(arm,seed){
  const p=size(arm),[sites,m]=RULES[arm.rule](arm.fleet/24);
  return {...defaultBayAreaConfig(),place_ids:facts(2).ids,ojai_share_pct:0,peak_multiplier:1,start_hour:19,duration_hours:TO/60,initial_soc_pct:85,charge_target_pct:85,trips_between_visits:TRIPS,
    fleet_size:arm.fleet,requests_per_hour:p.q*arm.fleet,depot_count:sites,charger_kw:KW,site_power_kw:p.kw*m,chargers:p.ports*m,cleaning_bays:p.bays[0]*m,software_bays:p.bays[1]*m,upload_bays:p.bays[2]*m,seed:u32('density-ladder',seed)};
}
/** One run read inside the measured window: the metric map of the declared test and the readings the ladder shows by rung.
 * Idle time is what no recorded interval claims, so the run is sound only if no minute claims more cars than the fleet holds. */
function read(r){
  const n=r.config.fleet_size,busy=new Int32Array(TO+2),use=[0,0,0,0,0],x=r.metrics;
  const mark=(k,a,b)=>{if(a===null)return;const lo=Math.min(a,TO),hi=Math.min(b??TO,TO);if(hi>lo){busy[lo]++;busy[hi]--;use[k]+=Math.max(0,hi-Math.max(lo,FROM));}};
  let sent=0,km=0,trips=0,asked=0,fast=0;
  for(const q of r.requests){
    if(q.created_minute>=FROM&&q.created_minute<TO-PROMPT){asked++;if(q.picked_up_minute!==null&&q.picked_up_minute-q.created_minute<=PROMPT)fast++;}
    if(q.completed_minute>FROM)trips++;
    if(q.assigned_minute===null)continue;
    if(q.assigned_minute>=FROM){sent++;km+=q.pickup_distance_km;}
    mark(0,q.assigned_minute,q.picked_up_minute);mark(1,q.picked_up_minute,q.completed_minute);
  }
  for(const v of r.visits){mark(2,v.started_minute,v.arrived_minute);for(const s of v.stages){mark(3,s.queued_minute,s.started_minute);mark(4,s.started_minute,s.completed_minute);}if(v.completed_minute!==null)mark(4,v.completed_minute,v.completed_minute+1);}
  let b=0,low=0,idle=0;
  for(let t=0;t<TO;t++){b+=busy[t];if(n<b)low++;if(t>=FROM)idle+=n-b;}
  const all=n*(TO-FROM);
  return {sig:r.demand_signature,busy:(use[1]+use[2]+use[4])/trips,km:km/sent,drive:use[0]/all,queue:use[3]/all,idle:idle/all,trips:trips*6000/all,
    sound:!low&&Math.abs(x.energy_balance_error_kwh)<=1e-6&&x.total_requests===x.completed_trips+x.unserved_requests+x.pending_requests+x.in_progress_trips,
    map:{[TRIP]:trips*6000/all,[FAST]:fast/asked,[OPEN]:x.censored_visits*100/n,[STORE]:x.final_energy_kwh/n}};
}
const label=s=>s[0].toUpperCase()+s.slice(1),cars=n=>`${n} cars`;
/** A cell. A value that would round to zero at its decimals keeps two significant digits; an absent value says why. */
const cell=(v,d,u)=>Number.isFinite(v)?{v:Math.abs(v)<.5/10**d?+v.toPrecision(2):v,d,u}:{absent:'no request was given a car in the measured hours'};
/** Rung labels. The control plan has two sites at every rung; a tested plan with another site count says so in the label. */
const rungs=c=>RUNGS.map(n=>{const k=RULES[PLANS[c.plan][1]](n/24)[0];return cars(n)+(k===2?'':k>1?`, ${k} sites tested`:', 1 site tested');});
function derive(c){
  const plan=PLANS[c?.plan];
  if(!plan)return {ok:false,reason:'the comparison is one of the three listed plans'};
  for(const [k,name,lo,hi] of BANDS)if(typeof c[k]!=='number'||!(c[k]>=lo&&c[k]<=hi))return {ok:false,reason:`${name.toLowerCase()} takes a number from ${lo} to ${hi}; outside that range the lab has no tested reading`};
  const arm=(rule,fleet=TOP)=>({rule,fleet,street:c.street,depot:c.depot}),p=size(c),tested=load(arm(plan[1]));
  if(+tested.toFixed(2)>CEILING)return {ok:false,reason:`by hand the busier site of the tested plan would stand at ${tested.toFixed(2)} of its capacity at ${TOP} cars, past the ${CEILING} this lab allows, so siting would mix with a capacity shortfall`};
  const declare=(a,b,change,control=null)=>freezeScale({lab:'density-ladder',version:VERSION,change,control,baseline:arm(a),candidate:arm(b),seeds:SEEDS,primary:{name:TRIP,direction:'higher_is_better',equivalence_margin:3},
    guardrails:[{metric:FAST,direction:'higher_is_better',max_harm:.02},{metric:OPEN,direction:'lower_is_better',max_harm:5},{metric:STORE,direction:'higher_is_better',max_harm:2}]});
  return {ok:true,setup:{...c,main:declare(plan[0],plan[1],`Depot plan at ${TOP} cars: ${plan[3]} in the control arm, ${plan[2]} in the tested arm.`),
    replay:declare(plan[0],plan[0],'None. Both arms are the control plan, and the engine runs again for the second arm.','null'),
    spare:declare('step','spare',`Depot plan at ${TOP} cars: ${STEP} in the control arm, the same sites doubled again in the tested arm.`,'non-binding')},rows:[
    ['Comparison',label(plan[2]),'You choose'],
    ...BANDS.map(([k,name,,,unit],i)=>[name,{v:c[k],d:2,u:unit},'Governing ratio. You choose. '+(i?'Depot work asked over capacity':'Rider, depot leg and depot work time by hand, every request served')]),
    ['Requests per car-hour',{v:p.q,d:3},'Sizing rule: street load over busy hours per trip by hand'],
    ['Each base site: power, ports, cleaning, software and upload bays',`${p.kw} kW, ${p.ports}, ${p.bays.join(', ')}`,'Sizing rule: work at the busier site over depot load, in whole units and steps of 10 kW'],
    ['Depot load by hand, control plan by rung',RUNGS.map(n=>load(arm(plan[0],n)).toFixed(2)).join(', '),'Sizing rule: busier site, after whole units'],
    [`Depot load by hand, tested plan at ${TOP} cars`,{v:tested,d:2},'Sizing rule: busier site, after whole units'],
    ['Held fixed',`9 places, 8 hours from 19:00 with hours 5 to 8 measured, flat requests, ${SPEED} km per hour, rider patience 12 min, prompt pickup within ${PROMPT} min`,'Teaching assumption'],
    ['Car and depot, held fixed',`84 kWh, ${KWH_KM} kWh per km, charged to 85%, a visit after every ${TRIPS} trips: cleaning ${CLEAN} min, software 12 min every second visit, upload ${UPLOAD} min, ${KW} kW ports`,'Teaching assumption'],
    ['Pickup allowance in the sizing rule','1 empty km per rider km','Teaching assumption: an allowance, not a result'],
    ['Road distances','Road table of the Fleet day map, nine places','Fleet day map: frozen OpenStreetMap road geometry of a real region, under its open licence. Distances only. No fleet, depot or service in those places is described'],
  ]};
}
function chart(rows,c,n){
  const j=PLANS[c.plan][0]==='fixed'?0:1,who=['control','tested'],at=(j,k)=>RUNGS.map((_,i)=>rows[j][i]?cell(rows[j][i][k],3).v:{absent:'this rung has not run yet'}),last=(i,k)=>cell(rows[i].at(-1)[k],3);
  return {title:'Car time by fleet rung, hours 5 to 8',category:'Fleet size',axis:{d:3,u:'of car time'},categories:rungs(c),
    series:[...who.map((w,i)=>({id:w,label:`Pickup driving, ${w} plan`,mark:'line',values:at(i,'drive')})),{id:'queue',label:`Depot queue, ${who[j]} plan`,mark:'bar',values:at(j,'queue')}],
    summary:{t:'Across {n} paired seeds: at {f} pickup driving takes {a} of car time in the control plan and {b} in the tested plan, and the depot queue shown takes {c}.',v:{n,f:cars(RUNGS[rows[0].length-1]),a:last(0,'drive'),b:last(1,'drive'),c:last(j,'queue')}}};
}
/** The second argument is a seam for tests, which hand in an engine with a defect. The page always uses the public function. */
function* steps(setup,simulate=simulateBayAreaOperations){
  const spec=setup.main.spec,base=spec.baseline,rules=[base.rule,spec.candidate.rule],store=new Map(),seen=new Map(),rows=[[],[]];
  const key=(a,seed)=>`${RULES[a.rule](a.fleet/24)}|${a.fleet}|${seed}`,total=new Set(RUNGS.flatMap(fleet=>rules.map(rule=>key({rule,fleet},0)))).size*spec.seeds.length;
  let runs=0,fault=null;
  const run=(arm,seed)=>{
    const x=read(simulate(engine(arm,seed),{capture:false})),k=arm.fleet+'|'+seed;runs++;
    if(!x.sound)fault='car time, requests or energy did not reconcile in a run';
    if((seen.get(k)??x.sig)!==x.sig)fault='external demand differs between the arms, so the runs cannot be paired';
    seen.set(k,x.sig);return x;
  };
  for(const fleet of RUNGS){
    for(const seed of spec.seeds)for(const rule of rules){const arm={...base,rule,fleet},k=key(arm,seed);if(!store.has(k)){store.set(k,run(arm,seed));yield {done:runs,total,label:'Ladder runs'};}}
    rules.forEach((rule,j)=>{const all=spec.seeds.map(seed=>store.get(key({rule,fleet},seed))),row={};for(const k of ['busy','km','drive','queue','idle','trips'])row[k]=mean(all.map(x=>x[k]));rows[j].push(row);});
    yield {done:runs,total,label:'Ladder runs',partial:{chart:chart(rows,setup,spec.seeds.length)}};
  }
  /** A stored ladder run is handed out once per comparison. A repeat request, the replay and the null arm among them, runs the engine again. */
  const pair=()=>{const taken=new Set();return function*(arm,seed){const k=key(arm,seed);if(store.has(k)&&!taken.has(k)){taken.add(k);return store.get(k).map;}return run(arm,seed).map;};};
  const checked=r=>r.validity==='VALID'&&(fault||r.per_seed.some(p=>[TRIP,FAST,OPEN,STORE].some(k=>!(k in p.baseline&&k in p.candidate))))?{...r,validity:'INVALID_EXPERIMENT',reason:fault??'a required measure was not available in a run, so there is no comparison',analysis:null}:r;
  const main=checked(yield* scalePairSteps(setup.main,pair()));
  if(main.validity!=='VALID')return {...main,work:{engine_runs:runs}};
  const replay=checked(yield* scalePairSteps(setup.replay,pair(),'Replay control')),spare=checked(yield* scalePairSteps(setup.spare,pair(),'Control with room'));
  return {...main,controls:[{...replay,title:'Null control, a replay of the control plan, declared to read zero on every measure'},{...spare,as_declared:spare.analysis?.outcome==='UNCHANGED'&&!spare.analysis.guardrail_regressions.length,title:'Non-binding control, the in-step depot doubled, declared to stay within the margin with no guardrail past its allowance'}],chart:chart(rows,setup,main.replications),...report(rows,setup,rules),work:{engine_runs:runs}};
}
function report(rows,c,rules){
  const top=rows[1][4],by=hand(RULES[rules[1]](5)[0],top.km).busy,at=fleet=>({...c,rule:rules[0],fleet}),full=RUNGS.find(n=>load(at(n))>1);
  return {tables:[
    {caption:'Density and the depot limit. By rung, hours 5 to 8, mean of the paired seeds. The control plan has two sites at every rung',heads:['Fleet','Pickup distance, control','Pickup distance, tested','Depot load by hand, control','Idle, control','Idle, tested','Trips per 100 car-hours, control','Trips per 100 car-hours, tested'],
      rows:rungs(c).map((n,i)=>[n,cell(rows[0][i].km,2,'km'),cell(rows[1][i].km,2,'km'),cell(load(at(RUNGS[i])),2),...[['idle',3],['trips',1]].flatMap(([k,d])=>[0,1].map(j=>cell(rows[j][i][k],d)))])},
    {caption:`Check by hand, tested plan at ${TOP} cars: busy minutes per trip. It checks the trip, depot leg and depot work times of the inputs, and no law of the ladder`,heads:['By hand, from the inputs and the recorded pickup distance','Simulated','Simulated over by hand','Declared tolerance'],rows:[[cell(by,2,'min'),cell(top.busy,2,'min'),cell(top.busy/by,3),'0.95 to 1.05']]}],
  notes:[
    full?{t:'By hand the busier control site passes its capacity at {n} and stands at {x} times its capacity at 120 cars. The direction of the main result and the rung at which the depot queue passes pickup driving follow from the sizing rule. The size belongs to hours 5 to 8 of this window. The tested plan adds capacity and takes nothing from the fleet, so the guardrails have nothing to catch in this comparison. The press shows that a limit was passed, not how small a depot would have served the same trips: read trips per 100 car-hours beside the depot load by hand.',v:{n:cars(full),x:cell(load(at(TOP)),2)}}
      :{t:'At 120 cars pickups read {a} in the control plan and {b} in the tested plan. '+(rules[1]==='one'?'The single site stands at the northern edge of the cell by the spacing rule of the engine, so the size of the harm follows from that placement.':'The tested plan has 2, 2, 3, 4 and 5 sites by rung, so its pickup distance mixes layout with density. Trips per car are capped by requests per car, so the primary measure cannot register a closer pickup.'),v:{a:cell(rows[0][4].km,2,'km'),b:cell(top.km,2,'km')}},
    'A comparison whose control is the in-step depot, the non-binding control included, can read within the margin or worse and cannot read improved: that control already serves the requests it is given.',
    'Requests per car are equal at every rung, so density shows as pickup distance and idle car time, not as added trips.',
    {t:'In the in-step plan pickups read {a} at the first rung and {b} to {c} from the second rung on: a car returns to service from a depot site after every second trip, so that floor follows from the visit rule and the two sites.',v:(k=>({a:cell(k[0],2,'km'),b:cell(Math.min(...k.slice(1)),2),c:cell(Math.max(...k.slice(1)),2,'km')}))(rows[rules.indexOf('step')].map(x=>x.km))}]};
}
export const LAB=Object.freeze({id:'density-ladder',version:VERSION,short:'Density ladder',title:'Density ladder: one depot cell, five fleet sizes',geography:'Nine neighbouring places of the Fleet day road map',seeds:SEEDS,
  frame:['One depot cell takes five times the cars and the requests. At which fleet size does the depot pass its capacity, and does siting matter at equal capacity?',
    'The Fleet day engine runs rungs of 24 to 120 cars in one cell of nine places at equal requests per car. Two load ratios set demand and depot size. Hours 5 to 8 are measured.',
    'Compare depot queue time with pickup driving at each rung, then depot load by hand with trips per car.',
    'An ops team would compare depot load at each planned fleet size before ordering cars.','decision'],
  limits:'One cell of nine places and at most 120 cars, not a city; every rate is invented; road distances are those of the Fleet day map; idle cars wait where they finish; one window of 8 hours from a fresh start, so another window length gives another size of effect; no fleet, depot or service in those places is described.',
  unknowns:['A fleet past 120 cars. The engine stops there, so the ladder spans a factor of five inside one depot cell.',
    'How riders respond. Requests per car are equal at every rung, so the ladder cannot say how many added requests the spare car time could carry.',
    'Where idle cars or sites would be moved, or whether adding, enlarging or merging sites suits any network. Cars wait where a trip or a depot visit ends and use the nearest site, and the engine spaces the sites.',
    'What depot capacity takes to buy, staff or permit, and when it would arrive. Lead times are the subject of the fleet intake lab.'],
  controls:[{key:'plan',label:'Comparison',options:Object.entries(PLANS).map(([k,p])=>[k,`${label(p[2])}, against ${p[3]}`])},...BANDS.map(([key,label,min,max,unit],i)=>({key,label,unit,min,max,step:i?.05:.02}))],
  defaults:()=>({plan:'capacity',street:.68,depot:.5}),derive,steps});
