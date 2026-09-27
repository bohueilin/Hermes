/** STUB for the shell stage. Satisfies the lab contract with a weekly count toy; the Lab B engineer replaces this file. */
import {u32} from '../core/keyed.js';
import {freezeScale,scalePairSteps} from './scale-contract.js';
const VERSION='scale-intake-0.0.0';
const SEEDS=Object.freeze(Array.from({length:12},(_,i)=>2001+i));
const WEEKS=26,DELIVERED=20,TRANCHE=80,LEAD=[4,8,12];
const draw=(seed,...key)=>u32('scale-intake',seed,...key)/4294967296;
function derive(config){
  const slip=Number(config.slip);
  if(!Number.isInteger(slip)||slip<0||slip>8)return {ok:false,reason:'the depot tranche slip must be a whole number of weeks from 0 to 8'};
  const declare=(weeks,control)=>freezeScale({lab:'fleet-intake',version:VERSION,control,change:`Depot tranche arrival: on the declared week to ${weeks} weeks late.`,baseline:{slip:0},candidate:{slip:weeks},seeds:SEEDS,
    primary:{name:'in-service fraction of delivered vehicles',direction:'higher_is_better',equivalence_margin:.02},
    guardrails:[{metric:'vehicle-weeks waiting at the depot gate',direction:'lower_is_better',max_harm:40}]});
  return {ok:true,setup:{slip,main:declare(slip,null),nullCheck:declare(0,'null')},rows:[
    ['Vehicles delivered',{v:DELIVERED,d:0,u:'per week'},'Teaching assumption'],
    ['Depot capacity tranche',{v:TRANCHE,d:0,u:'stalls'},'Teaching assumption'],
    ['Tranche lead time',{v:LEAD[0],d:0,u:'weeks'},'Teaching assumption'],
    ['Depot headroom on time',{v:1.1,d:2,u:''},'Governing ratio. Which gate binds follows from it.'],
  ]};
}
function series(arm,seed){
  let stock=0,service=0;const waiting=[],inService=[];
  for(let w=0;w<WEEKS;w++){
    const capacity=TRANCHE*LEAD.filter(l=>w>=l+arm.slip).length+60;
    stock+=DELIVERED;const admit=Math.min(stock,Math.max(0,capacity-service));
    service+=admit;stock-=admit;service-=Math.round(service*.02*draw(seed,w,'drain'));
    waiting.push(stock);inService.push(service);
  }
  return {waiting,inService};
}
function* measure(arm,seed){
  yield;const s=series(arm,seed);
  return {'in-service fraction of delivered vehicles':s.inService.at(-1)/(DELIVERED*WEEKS),'vehicle-weeks waiting at the depot gate':s.waiting.reduce((a,b)=>a+b,0)};
}
function* steps(setup){
  const main=yield* scalePairSteps(setup.main,measure),nullCheck=yield* scalePairSteps(setup.nullCheck,measure,'Null control');
  const late=series({slip:setup.slip},SEEDS[0]),onTime=series({slip:0},SEEDS[0]);
  return {...main,controls:[{...nullCheck,title:'Null control, zero weeks late'}],
    chart:{title:'Vehicles in rider service by week',category:'Week',axis:{d:0,u:'vehicles'},categories:Array.from({length:WEEKS},(_,w)=>String(w+1)),seed:SEEDS[0],
      series:[{id:'delivered',label:'Delivered so far',mark:'line',values:Array.from({length:WEEKS},(_,w)=>DELIVERED*(w+1))},{id:'on-time',label:'In rider service, tranche on time',mark:'line',values:onTime.inService},{id:'late',label:'In rider service, tranche late',mark:'line',values:late.inService}],
      summary:{t:'This replay: {a} of {b} delivered vehicles are in rider service at week {w} with the tranche {s} weeks late.',v:{a:{v:late.inService.at(-1),d:0},b:{v:DELIVERED*WEEKS,d:0},w:{v:WEEKS,d:0},s:{v:setup.slip,d:0}}}},
    tables:[],notes:['Which gate binds follows from the declared headroom of each resource. It is an input, not a finding.']};
}
export const LAB=Object.freeze({id:'fleet-intake',version:VERSION,short:'Fleet intake',title:'From delivered vehicles to vehicles in rider service',geography:'Fictional market, weekly counts, no map',seeds:SEEDS,
  frame:['A delivered vehicle is not yet a vehicle in rider service. Which gate keeps the stock waiting: integration, validation, release or depot intake?','Weekly cohorts, counts only: vehicles pass integration, validation and commissioning, a market release gate, then depot intake limited by stalls, power, ports and staff that arrive in tranches after a lead time.','Read vehicles in rider service beside vehicles delivered, then the stock waiting at each gate by week.','An ops team would map the lead time of each gate against its delivery schedule before ordering vehicles.','decision'],
  limits:'Invented delivery schedule, gate times and lead times; one fleet, one market; no vehicle defects by type and no contract terms.',
  unknowns:['How long each gate takes in a real programme, and how often a vehicle is sent back.','How a real site is permitted, built and energised. Lead times here are declared numbers.','Whether delivered vehicles differ from one another. Every vehicle here is the same.'],
  controls:[{key:'slip',label:'Depot tranche arrives late by',unit:'weeks',min:0,max:8,step:1}],
  defaults:()=>({slip:4}),derive,steps});
