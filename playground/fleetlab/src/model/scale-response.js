/** STUB for the shell stage. Satisfies the lab contract with a closed-form toy; the Lab A engineer replaces this file. */
import {u32} from '../core/keyed.js';
import {freezeScale,scalePairSteps} from './scale-contract.js';
const VERSION='scale-response-0.0.0';
const SEEDS=Object.freeze(Array.from({length:12},(_,i)=>1001+i));
const FLEETS=[1000,3000,10000],RATE=.05,HANDLE_S=45,UTILIZATION=.65,WINDOW_MIN=120;
const draw=(seed,...key)=>u32('scale-response',seed,...key)/4294967296;
const pool=fleet=>Math.ceil(fleet*RATE*HANDLE_S/3600/UTILIZATION);
function derive(config){
  const fleet=Number(config.fleet),index=Number(config.index);
  if(!FLEETS.includes(fleet))return {ok:false,reason:'choose one of the listed fleet sizes'};
  if(!['reserve','null'].includes(config.compare))return {ok:false,reason:'choose one of the listed comparisons'};
  if(!(index>=1.1&&index<=1.6))return {ok:false,reason:'the window load index must sit between 1.1 and 1.6, where the queue is readable'};
  const staff=pool(fleet),extra=config.compare==='null'?0:Math.max(1,Math.round(staff*.25));
  const arm=reserve=>({fleet,index,staff,reserve});
  const declare=(candidate,control)=>freezeScale({lab:'response-reserve',version:VERSION,control,change:control?'None. Both arms use the same desk.':`Reserve responders during the event window: 0 to ${extra}.`,baseline:arm(0),candidate,seeds:SEEDS,
    primary:{name:'stopped vehicle-minutes',direction:'lower_is_better',equivalence_margin:30},
    guardrails:[{metric:'late answer fraction',direction:'lower_is_better',max_harm:.01},{metric:'responder idle fraction',direction:'lower_is_better',max_harm:.1}]});
  return {ok:true,setup:{fleet,index,staff,extra,main:declare(arm(extra),null),nullCheck:declare(arm(0),'null')},rows:[
    ['Fleet in service',{v:fleet,d:0,u:'vehicles'},'You choose'],
    ['Help requests',{v:RATE,d:2,u:'per vehicle-hour'},'Teaching assumption'],
    ['Handling time',{v:HANDLE_S,d:0,u:'s'},'Teaching assumption'],
    ['Pooled responders',{v:staff,d:0,u:'people'},`Sizing rule: ordinary load at ${UTILIZATION*100}% use`],
    ['Window load index',{v:index,d:2,u:''},'Governing ratio. The burst size follows from it.'],
  ]};
}
function* measure(arm,seed){
  yield;
  const served=(arm.staff+arm.reserve)*WINDOW_MIN*60/HANDLE_S,asked=arm.staff*UTILIZATION*arm.index*WINDOW_MIN*60/HANDLE_S/UTILIZATION*(.97+.06*draw(seed,arm.fleet,'burst'));
  const backlog=Math.max(0,asked-served);
  return {'stopped vehicle-minutes':backlog*WINDOW_MIN/4+asked*HANDLE_S/60,'late answer fraction':asked?backlog/asked:undefined,'responder idle fraction':Math.max(0,1-asked/served)};
}
function* steps(setup){
  const main=yield* scalePairSteps(setup.main,measure),nullCheck=yield* scalePairSteps(setup.nullCheck,measure,'Null control');
  const mean=arm=>main.per_seed.reduce((n,p)=>n+p[arm]['stopped vehicle-minutes'],0)/main.per_seed.length;
  return {...main,controls:[{...nullCheck,title:'Null control, same desk in both arms'}],
    chart:{title:'Responders per 1,000 vehicles',category:'Fleet in service',axis:{d:2,u:'responders per 1,000 vehicles'},categories:FLEETS.map(String),
      series:[{id:'pooled',label:'One pooled desk',mark:'bar',values:FLEETS.map(f=>pool(f)/f*1000)},{id:'split',label:'Four area desks',mark:'bar',values:FLEETS.map(f=>f<3000?{absent:'an area desk of this size is outside the readable range'}:4*pool(f/4)/f*1000)}],
      summary:{t:'Across {n} paired seeds: the pooled desk holds {a} responders at {f} vehicles.',v:{n:{v:main.replications,d:0},a:{v:setup.staff,d:0},f:{v:setup.fleet,d:0}}}},
    tables:[{caption:'Event window, mean over paired seeds',heads:['Arm','Stopped vehicle-minutes'],rows:[['Pooled desk',{v:mean('baseline'),d:1,u:'min'}],['Pooled desk with reserve',{v:mean('candidate'),d:1,u:'min'}]]}],
    notes:['The staffing level follows from the sizing rule and the invented request rate. It is an input, not a finding.','The burst size follows from the window load index.']};
}
export const LAB=Object.freeze({id:'response-reserve',version:VERSION,short:'Response reserve',title:'Response reserve for an area-wide event',geography:'Fictional market, counts only, no map',seeds:SEEDS,
  frame:['Stopped cars ask a shared human support desk for help. How many responders keep answers quick on an ordinary day, and when one area stalls at once?','Counts only, no map: 1,000 to 10,000 vehicles send help requests to one pooled desk sized by a rule. An event day adds a burst in one area. Both arms replay the same requests on paired seeds.','Read stopped vehicle-minutes, then answer delay and the share of requests answered within the target.','An ops team would size its reserve against a burst in one area, not against the daily average.','decision'],
  limits:'Invented request rates and handling times; no vehicle behavior, no road map, no responder skill mix, shifts or breaks.',
  unknowns:['Whether a real support desk pools across areas, and how its people are trained and rostered.','How often a real vehicle asks for help, and how long a real answer takes.','How an area-wide event spreads through a real fleet. The burst here is one declared shape.'],
  controls:[{key:'fleet',label:'Fleet in service',unit:'vehicles',options:FLEETS.map(f=>[f,f.toLocaleString('en-US')])},{key:'index',label:'Window load index',unit:'ratio',min:1.1,max:1.6,step:.1},{key:'compare',label:'Comparison',options:[['reserve','Reserve responders in the event window'],['null','Null control: same desk in both arms']]}],
  defaults:()=>({fleet:3000,index:1.3,compare:'reserve'}),derive,steps});
