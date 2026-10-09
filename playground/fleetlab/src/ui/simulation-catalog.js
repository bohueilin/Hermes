import {LESSON_FRAMES,frameView,glossaryView} from './teaching-frames.js';
import {routeHref,followLink} from './routes.js';
import {CHOOSER_PRESET_IDS,differenceText} from './experiment.js';
import {DEFAULT_EVALUATION_SEEDS} from './advanced-operations-view.js';
import {applyAxis,describeDifferences} from '../model/schema.js';
import { PRESETS } from '../model/presets.js';
import { el } from './dom.js';
import { STREET_PRESETS } from '../model/street-simulation.js';
import {depotReadinessDemoConfig} from '../model/bay-operations.js';
import {advancedOperationsDemoConfig} from '../model/bay-experiment-contract.js';
import {SCALE_LABS} from './scale-labs.js';

const extensionLessons=[
  ['staffing-readiness','Staffing: workers versus bays',depotReadinessDemoConfig],
  ['power-redistribution','Use acceptance-limited power shares',()=>advancedOperationsDemoConfig('charging')],
  ['deadline-charging','Prioritize readiness deadlines',()=>{const c=advancedOperationsDemoConfig('charging');c.charging.policy='deadline';return c;}],
  ['resource-freshness','Stale resource status and recovery',()=>advancedOperationsDemoConfig('resources')],
  ['airport-preparation','Prepare for a synthetic airport wave',()=>advancedOperationsDemoConfig('airport')],
  ['region-launch','Rehearse commissioning in Region B',()=>({launch_rehearsal:'region_b'})],
].map(([id,title,patch])=>({id,title,patch,limits:LESSON_FRAMES[id].limits}));

export const OPERATIONAL_LESSONS=Object.freeze([
  {id:'bay-area',title:'Real Bay Area routes in 3D',limits:'Sparse undirected major-road routes between anchors; no turn rules, local access or service-area verification.',patch:{}},
  {id:'vehicle-mix',title:'I-PACE versus Ojai assumptions',limits:'Ojai numerical specifications are illustrative; no validated fleet performance or charge taper.',patch:{ojai_share_pct:50}},
  {id:'fleet-day',title:'Fleet size versus trip demand',limits:'Synthetic trip distribution and dispatch; no actual market data.',patch:{}},
  {id:'weather-day',title:'Rain and hot-weather service',limits:'Declared multipliers; no tire grip, visibility or sensor model.',patch:{weather:'rain'}},
  {id:'rush-hour',title:'Morning and evening peaks',limits:'Synthetic clock profiles; no external traffic feed in this model.',patch:{start_hour:16,requests_per_hour:45}},
  {id:'depot-count',title:'How many depots are sufficient?',limits:'First sufficient tested count; no site economics or global optimum.',patch:{depot_count:1}},
  {id:'cleaning',title:'Cleaning capacity and queues',limits:'Fixed service times and unlimited staff.',patch:{cleaning_bays:1,trips_between_visits:2}},
  {id:'charging',title:'Battery and charging constraints',limits:'No charge taper, battery aging, temperature physics or V2G.',patch:{initial_soc_pct:40}},
  {id:'shared-power',title:'Charge ports versus site power',limits:'Equal power sharing; no tariff or optimized energy scheduler.',patch:{chargers:4,charger_kw:80,site_power_kw:40}},
  {id:'software',title:'Software-update scheduling',limits:'Occupied-resource delay only; no actual update or failure/rollback model.',patch:{software_minutes:30,software_every_visits:1}},
  {id:'upload',title:'Trip-data transfer bottlenecks',limits:'Fixed transfer duration; no bytes, bandwidth contention or retry model.',patch:{upload_minutes:30,upload_bays:1}},
  {id:'full-cycle',title:'Follow a car through its day',limits:'One-minute model resolution; motion between snapshots is explanatory.',patch:{trips_between_visits:2}},
  ...extensionLessons,
]);

const treatmentOf={ 'power-redistribution':'charging_redistribution','deadline-charging':'charging_deadlines','resource-freshness':'resource_freshness','airport-preparation':'airport_forecast'};
const lessonSeeds=r=>r.seeds??r.preset?.experiment?.seeds.length??(treatmentOf[r.id]?DEFAULT_EVALUATION_SEEDS.length:undefined);
const lessonChange=r=>{const x=r.preset?.experiment;if(!x)return null;return describeDifferences(applyAxis(x.scenario,x.axis.id,x.axis.baseline),applyAxis(x.scenario,x.axis.id,x.axis.candidate)).map(d=>differenceText(d).replaceAll('_',' ')).join('; ');};
const axisValue=value=>value&&typeof value==='object'?Object.entries(value).map(([key,v])=>`${key}: ${axisValue(v)}`).join(', '):String(value);

export function simulationCatalog(){
  return [
    {id:'two-vehicles',title:'Two vehicles, one uplink',model:'Depot flow lab',target:'flows',limits:'Constructed visits and capacities; no packet loss, charge taper or operational authority. No random draws.'},
    ...OPERATIONAL_LESSONS.map(x=>({...x,model:'Fleet day',target:'operations'})),
    ...STREET_PRESETS.map(p=>({id:`street-${p.id}`,title:p.title,model:'Street lab',target:'streets',hotspot:p.id,limits:'Frozen OSM subset and supported turn rules; synthetic signals/capacity/demand; no lane changing, calibrated traffic, actual curb permission or depot energy model.'})),
    ...SCALE_LABS.map(l=>({id:l.id,title:l.title,model:'Scale lab',target:'scale',seeds:l.seeds.length,limits:l.limits})),
    ...PRESETS.map(p=>({id:p.id,title:p.title,model:'Four-area experiments',target:'regional',preset:p,
      controls:p.experiment?`One declared change: ${p.experiment.axis.id}. ${axisValue(p.experiment.axis.baseline)} → ${axisValue(p.experiment.axis.candidate)}.`:'Fleet, demand, traffic, depot capacity, recall and release.',
      limits:Array.isArray(p.outsideModel)?p.outsideModel.join('; '):'Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.',
    })),
  ].map(r=>({...r,frame:LESSON_FRAMES[r.id]}));
}

export function createSimulationCatalog({onOperations=()=>{},onRegional=()=>{},onStreets=()=>{},onLesson=null,hrefForLesson=r=>routeHref({page:r.target==='flows'?'flows':r.target==='scale'?'scale':r.target==='operations'?'simulation':r.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(r.id)?'depots':'operations',lesson:r.id})}={}){
  const records=simulationCatalog();const cards=el('div',{class:'catalog-grid'});const count=el('p',{class:'catalog-count',role:'status'});
  const search=el('input',{type:'search',placeholder:'Try charging, rain, depot, recall…','aria-label':'Search simulations',on:{input:()=>render()}});
  const filter=el('select',{'aria-label':'Simulation model',on:{change:()=>render()}},['All simulations','Fleet day','Street lab','Four-area experiments','Scale lab','Depot flow lab'].map(x=>el('option',{value:x},x)));
  const family=el('select',{'aria-label':'Operations question family',on:{change:()=>render()}},['All questions',...new Set(Object.values(LESSON_FRAMES).map(f=>f.family))].map(x=>el('option',{value:x},x)));
  const element=el('main',{class:'simulation-catalog'},[
    el('section',{class:'catalog-intro'},[el('p',{class:'eyebrow'},'THE COMPLETE LEARNING CATALOG'),el('h1',{},'Which lesson answers my question?'),el('p',{class:'hero-lede'},'Every lesson answers one fleet operations question. Find yours by the decision you face, not by the model behind it.'),el('div',{class:'catalog-models'},[
      el('article',{},[el('h2',{},'Fleet day'),el('p',{},'Fleet day: a minute by minute synthetic Bay Area day with batteries, charging and depot work. One replay per setting; comparisons rerun the same demand.')]),
      el('article',{},[el('h2',{},'Street lab'),el('p',{},'Street lab: directed San Francisco streets with finite block queues in 5 second steps. It compares two route rules on one demand.')]),
      el('article',{},[el('h2',{},'Four-area experiments'),el('p',{},'Four-area experiments: four schematic zones over a day and a night, with no charging. Each lesson is a frozen paired test on 20 seeds.')]),
      el('article',{},[el('h2',{},'Depot flow lab'),el('p',{},'Depot flow lab: two invented vehicles, one upload link, three allocation rules. Follow bytes, energy and dependencies to understand readiness and deadline tradeoffs.')]),
      el('article',{},[el('h2',{},'Scale lab'),el('p',{},'Scale lab: three labs on scaling a fleet. Two use counts with no map and one reruns the Fleet day engine at rungs. Each derives its setup from its governing ratios and ends in a paired test with guardrails.')]),
    ])]),
    el('section',{class:'catalog-start'},[el('h2',{},'Start here'),...['fleet-day','staffing-readiness','density-ladder'].map(id=>el('a',{href:hrefForLesson(records.find(r=>r.id===id))},records.find(r=>r.id===id).title)),el('a',{href:'#/walkthrough'},'Guided walkthrough'),el('p',{},['Next: ',...['L2a','L2b','UC-08a','UC-10','street-first'].filter(id=>records.some(r=>r.id===id)).map(id=>el('a',{href:hrefForLesson(records.find(r=>r.id===id))},id+' '))])]),el('div',{class:'catalog-search'},[family,filter,search]),count,cards,glossaryView(),
    el('p',{},'Fleet day also hosts separate contracts: staffing, charging, charger status, airport wave, launch rehearsal and the Austin power lab.'),el('p',{},'Each model has its own assumptions, so numbers from different models are not interchangeable.'),el('section',{class:'catalog-outside'},[el('h2',{},'What is still outside this playground?'),el('p',{},'Physical autonomous driving, lane changes and collisions; calibrated demand; staff shifts; repair failures; electrical network dynamics; globally optimal fleet routing; real dispatch or vehicle commands. A computed recommendation never authorizes an operational change.')]),
  ]);
  function render(){
    const query=search.value.toLowerCase().trim();const model=filter.value;
    const shown=records.filter(r=>(model==='All simulations'||model===''||r.model===model)&&(family.value==='All questions'||family.value===''||r.frame.family===family.value)&&`${r.title} ${Object.values(r.frame).join(' ')}`.toLowerCase().includes(query));
    count.textContent=`${shown.length} of ${records.length} simulations and lessons`;
    cards.replaceChildren(...shown.map(r=>el('article',{class:'catalog-card','data-simulation':r.id},[
      el('span',{class:'catalog-card-id'},r.id),frameView(r.frame,{title:r.title,seeds:lessonSeeds(r),change:lessonChange(r),limits:r.limits}),
      el('a',{href:hrefForLesson(r),class:'studio-button',on:{click:event=>followLink(event,()=>onLesson?onLesson(r):r.target==='operations'?onOperations(typeof r.patch==='function'?r.patch():structuredClone(r.patch)):r.target==='streets'?onStreets(r.hotspot):onRegional(r.preset))}},'Run this lesson'),
    ])));
    if(!shown.length)cards.appendChild(el('p',{},'No matching simulation. Try a resource or a different model.'));
  }
  render();return {element};
}
