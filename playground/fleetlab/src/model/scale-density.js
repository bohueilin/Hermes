/** STUB for the shell stage. Runs the public Fleet day engine on a short ladder; the Lab C engineer replaces this file. */
import {defaultBayAreaConfig,simulateBayAreaOperations} from './bay-operations.js';
import {freezeScale,scalePairSteps} from './scale-contract.js';
const VERSION='scale-density-0.0.0';
const SEEDS=Object.freeze([3001,3002,3003,3004]);
const RUNGS=[24,48,72],PER_CAR=1.25;
const config=(fleet,rule)=>({...defaultBayAreaConfig(),fleet_size:fleet,requests_per_hour:fleet*PER_CAR,duration_hours:4,chargers:rule==='scaled'?Math.ceil(fleet/6):4,cleaning_bays:rule==='scaled'?Math.ceil(fleet/12):2});
function derive(setting){
  if(!['fixed','scaled'].includes(setting.rule))return {ok:false,reason:'choose one of the listed growth rules'};
  const top=RUNGS.at(-1);
  return {ok:true,setup:{rule:setting.rule,main:freezeScale({lab:'density-ladder',version:VERSION,change:`Fleet and demand together: ${RUNGS[0]} to ${top} cars at ${PER_CAR} requests per car-hour.`,baseline:{fleet:RUNGS[0],rule:setting.rule},candidate:{fleet:top,rule:setting.rule},seeds:SEEDS,
    primary:{name:'mean wait of completed trips, minutes',direction:'lower_is_better',equivalence_margin:1},
    guardrails:[{metric:'completed fraction of requests',direction:'higher_is_better',max_harm:.02},{metric:'unfinished depot visits',direction:'lower_is_better',max_harm:2}]})},rows:[
    ['Demand per car',{v:PER_CAR,d:2,u:'requests per car-hour'},'Governing ratio, fixed at every rung'],
    ['Rungs',`${RUNGS.join(', ')} cars`,'Teaching assumption'],
    ['Depot resources',setting.rule==='scaled'?'Scaled with the fleet':'Fixed at the first rung','You choose'],
  ]};
}
const cache=new Map();
function* measure(arm,seed){
  yield;const key=`${arm.fleet}|${arm.rule}|${seed}`;
  if(!cache.has(key)){const m=simulateBayAreaOperations({...config(arm.fleet,arm.rule),seed},{capture:false}).metrics;
    cache.set(key,{'mean wait of completed trips, minutes':m.avg_wait_min_completed??undefined,'completed fraction of requests':m.total_requests?m.completed_trips/m.total_requests:undefined,'unfinished depot visits':m.censored_visits});}
  return cache.get(key);
}
function* steps(setup){
  const main=yield* scalePairSteps(setup.main,measure);
  const values=[];
  for(const [i,fleet] of RUNGS.entries()){
    let sum=0;for(const seed of SEEDS){sum+=(yield* measure({fleet,rule:setup.rule},seed))['mean wait of completed trips, minutes'];}
    values.push(sum/SEEDS.length);
    yield {done:i+1,total:RUNGS.length,label:'Ladder rungs',partial:{chart:chart(values,main.replications)}};
  }
  return {...main,chart:chart(values,main.replications),tables:[],notes:['Demand per car is fixed by the ladder rule, so total demand is an input, not a finding.']};
}
const chart=(values,n)=>({title:'Pickup wait by fleet rung',category:'Fleet size',axis:{d:1,u:'min'},categories:RUNGS.map(r=>`${r} cars`),
  series:[{id:'wait',label:'Mean wait of completed trips',mark:'line',values:RUNGS.map((_,i)=>values[i]??{absent:'this rung has not run yet'})}],
  summary:{t:'Across {n} paired seeds: {k} of {r} rungs have run.',v:{n:{v:n,d:0},k:{v:values.length,d:0},r:{v:RUNGS.length,d:0}}}});
export const LAB=Object.freeze({id:'density-ladder',version:VERSION,short:'Density ladder',title:'Density ladder: fleet and demand growing together',geography:'OpenStreetMap Bay Area roads, the Fleet day engine',seeds:SEEDS,
  frame:['Fleet and demand growing together from 24 to 120 cars: how does pickup time change with density, and which gives way first, the street or the depot?','The Fleet day engine runs at rungs of 24 to 120 cars with demand per car fixed. One growth rule per press: depots fixed, depot resources scaled with the fleet, or added sites. Paired seeds share demand.','Read pickup time by rung, then depot queue minutes by rung, and note the rung where the depot queue starts to bind.','An ops team would measure pickup time and depot queues at each fleet step before adding cars.','condition'],
  limits:'At most 120 cars; synthetic demand on sparse major roads; one-minute steps; no charge taper, staff shifts or street queues.',
  unknowns:['How demand responds to a fleet that answers quicker. Demand per car is fixed here.','What happens past 120 cars. The engine stops there, so the ladder stops there.','Street queues and curb space. The Fleet day engine has neither.'],
  controls:[{key:'rule',label:'Growth rule',options:[['fixed','Depots fixed'],['scaled','Depot resources scaled with the fleet']]}],
  defaults:()=>({rule:'fixed'}),derive,steps});
