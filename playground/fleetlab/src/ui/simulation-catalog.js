import {routeHref,followLink} from './routes.js';
import {CHOOSER_PRESET_IDS} from './experiment.js';
import { PRESETS } from '../model/presets.js';
import { el } from './dom.js';
import { STREET_PRESETS } from '../model/street-simulation.js';
import {depotReadinessDemoConfig} from '../model/bay-operations.js';
import {advancedOperationsDemoConfig} from '../model/bay-experiment-contract.js';
import {decisionForConfig} from './scenario-learning.js';

const extensionLessons=[
  ['staffing-readiness','Staffing: workers versus bays',depotReadinessDemoConfig],
  ['power-redistribution','Use acceptance-limited power shares',()=>advancedOperationsDemoConfig('charging')],
  ['deadline-charging','Prioritize readiness deadlines',()=>{const c=advancedOperationsDemoConfig('charging');c.charging.policy='deadline';return c;}],
  ['resource-freshness','Stale resource status and recovery',()=>advancedOperationsDemoConfig('resources')],
  ['airport-preparation','Prepare for a synthetic airport wave',()=>advancedOperationsDemoConfig('airport')],
  ['region-launch','Rehearse commissioning in Region B',()=>({launch_rehearsal:'region_b'})],
].map(([id,title,patch])=>{const d=decisionForConfig(id==='region-launch'?{launch:{}}:patch());return {id,title,patch,question:d.question,controls:d.change,outputs:d.watch,lesson:d.meaning+' Next experiment: '+d.next,limits:d.limits};});

export const OPERATIONAL_LESSONS=Object.freeze([
  {id:'bay-area',title:'Real Bay Area routes in 3D',question:'How does the geography of service change the fleet day?',controls:'18 named places, city focus, orbit, zoom and road speed',outputs:'Recorded cars on OpenStreetMap routes; distance and travel time',lesson:'Longer road routes consume vehicle time and energy before the next rider.',limits:'Sparse undirected major-road routes between anchors; no turn rules, local access or service-area verification.',patch:{}},
  {id:'vehicle-mix',title:'I-PACE versus Ojai assumptions',question:'Which vehicle assumptions affect fleet throughput?',controls:'Mix percentage; per-type battery, energy, charge limit, boarding and service factors',outputs:'Same-demand fleet comparison; trip completion, depot time and energy',lesson:'A vehicle choice changes capacity through explicit operating assumptions, not its brand.',limits:'Ojai numerical specifications are illustrative; no validated fleet performance or charge taper.',patch:{ojai_share_pct:50}},
  {id:'fleet-day',title:'Fleet size versus trip demand',question:'How many requests can this fleet complete?',controls:'AV count, demand, selected places, road speed, rider patience',outputs:'Completed, unserved, waiting and in-progress trips; trips per AV',lesson:'A vehicle count alone is not service capacity. Time away from riders matters.',limits:'Synthetic trip distribution and dispatch; no actual market data.',patch:{}},
  {id:'weather-day',title:'Rain and hot-weather service',question:'What happens when trips slow down or energy use rises?',controls:'Weather, start time, travel factor',outputs:'Trip completion, wait, energy and depot queues',lesson:'Weather can affect several constraints at once.',limits:'Declared multipliers; no tire grip, visibility or sensor model.',patch:{weather:'rain'}},
  {id:'rush-hour',title:'Morning and evening peaks',question:'Can the same fleet handle a different time of day?',controls:'Start hour, run length, peak demand multiplier, traffic factor',outputs:'Minute-by-minute replay and end-of-day service',lesson:'Time-dependent demand and travel can create temporary shortages.',limits:'Synthetic clock profiles; no external traffic feed in this model.',patch:{start_hour:16,requests_per_hour:45}},
  {id:'depot-count',title:'How many depots are sufficient?',question:'Which tested depot count meets the chosen service target?',controls:'Depot count, fleet count and resources per site',outputs:'Same-demand comparison across 1 to 6 sites; explicit unmet target',lesson:'More sites help only when depot access or service is the limiting resource.',limits:'First sufficient tested count; no site economics or global optimum.',patch:{depot_count:1}},
  {id:'cleaning',title:'Cleaning capacity and queues',question:'Do more bays or shorter cleaning times change readiness?',controls:'Cleaning bays, cleaning minutes and visit frequency',outputs:'Cleaning queues, active work and completed turnaround',lesson:'Service rate is capacity divided by work time; queues add delay.',limits:'Fixed service times and unlimited staff.',patch:{cleaning_bays:1,trips_between_visits:2}},
  {id:'charging',title:'Battery and charging constraints',question:'Can vehicles recharge in time to serve another trip?',controls:'Battery size, energy use, reserve/target SOC and charger count',outputs:'Vehicle battery, delivered energy, charger queues and service outcomes',lesson:'Fleet availability depends on energy as well as cars.',limits:'No charge taper, battery aging, temperature physics or V2G.',patch:{initial_soc_pct:40}},
  {id:'shared-power',title:'Charge ports versus site power',question:'Will adding ports help under the same site power cap?',controls:'Ports, kW per port and shared kW per depot',outputs:'Per-depot charging power and charging time',lesson:'A power-constrained site can remain slow after adding ports.',limits:'Equal power sharing; no tariff or optimized energy scheduler.',patch:{chargers:4,charger_kw:80,site_power_kw:40}},
  {id:'software',title:'Software-update scheduling',question:'What happens when updates take longer or occur more often?',controls:'Update duration, update stations and visit cadence',outputs:'Update queues and time away from riders',lesson:'Fleet software operations consume real service capacity.',limits:'Occupied-resource delay only; no actual update or failure/rollback model.',patch:{software_minutes:30,software_every_visits:1}},
  {id:'upload',title:'Trip-data transfer bottlenecks',question:'Can data-upload work delay the return to service?',controls:'Upload minutes and simultaneous upload stations',outputs:'Upload queues, active work and depot turnaround',lesson:'Data operations belong in the readiness path.',limits:'Fixed transfer duration; no bytes, bandwidth contention or retry model.',patch:{upload_minutes:30,upload_bays:1}},
  {id:'full-cycle',title:'Follow a car through its day',question:'Where does one vehicle spend its time?',controls:'Vehicle selector, next activity, stage buttons and clock',outputs:'Pickup, trip, depot journey, queues, work and return to readiness',lesson:'The activity trail connects fleet outcomes to individual transitions.',limits:'One-minute model resolution; motion between snapshots is explanatory.',patch:{trips_between_visits:2}},
  ...extensionLessons,
]);

const axisValue=value=>value&&typeof value==='object'?Object.entries(value).map(([key,v])=>`${key}: ${axisValue(v)}`).join(', '):String(value);

export function simulationCatalog(){
  return [
    ...OPERATIONAL_LESSONS.map(x=>({...x,model:'Fleet day',target:'operations'})),
    ...STREET_PRESETS.map(p=>({id:`street-${p.id}`,title:p.title,model:'Street lab',target:'streets',hotspot:p.id,question:p.question,controls:'AV count, rider/background demand, capacity loss, routing, weather, pickup dwell and trip mix',outputs:'Directed street replay, queues and spillback; completed and unfinished journeys; same-demand route comparison',lesson:p.action,limits:'Frozen OSM subset and supported turn rules; synthetic signals/capacity/demand; no lane changing, calibrated traffic, actual curb permission or depot energy model.'})),
    ...PRESETS.map(p=>({id:p.id,title:p.title,model:'Regional experiments',target:'regional',preset:p,
      question:p.experiment?.question??'How do supply, demand, routes and depot rules interact across four areas?',
      controls:p.experiment?`One declared change: ${p.experiment.axis.id}. ${axisValue(p.experiment.axis.baseline)} → ${axisValue(p.experiment.axis.candidate)}.`:'Fleet, demand, traffic, depot capacity, recall and release.',
      outputs:p.experiment?`Primary: ${p.experiment.primary.metric}; ${(p.experiment.guardrails??[]).length} guardrails; paired uncertainty and recommendation.`:'Recorded replay, rider wait, unserved demand, fleet state and depot queues.',
      lesson:p.situation??(p.kind==='learn'?'Compare moments in one day, then inspect the population and constraint behind the number.':'Change one decision and inspect its trade-offs rather than assuming the primary metric tells the whole story.'),
      limits:Array.isArray(p.outsideModel)?p.outsideModel.join('; '):'Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.',
    })),
  ];
}

export function createSimulationCatalog({onOperations=()=>{},onRegional=()=>{},onStreets=()=>{},onLesson=null,hrefForLesson=r=>routeHref({page:r.target==='operations'?'simulation':r.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(r.id)?'depots':'operations',lesson:r.id})}={}){
  const records=simulationCatalog();const cards=el('div',{class:'catalog-grid'});const count=el('p',{class:'catalog-count',role:'status'});
  const search=el('input',{type:'search',placeholder:'Try charging, rain, depot, recall…','aria-label':'Search simulations',on:{input:()=>render()}});
  const filter=el('select',{'aria-label':'Simulation model',on:{change:()=>render()}},['All simulations','Fleet day','Street lab','Regional experiments'].map(x=>el('option',{value:x},x)));
  const element=el('main',{class:'simulation-catalog'},[
    el('section',{class:'catalog-intro'},[el('p',{class:'eyebrow'},'THE COMPLETE LEARNING CATALOG'),el('h1',{},'What can I simulate?'),el('p',{class:'hero-lede'},'Start with a question. Know what to change, what to watch and what the result cannot tell you.'),el('div',{class:'catalog-models'},[
      el('article',{},[el('h2',{},'Fleet day'),el('p',{},'3D I-PACE and Ojai cars on real Bay Area roads, battery, weather and a complete depot work cycle. Start here to learn capacity and bottlenecks.')]),
      el('article',{},[el('h2',{},'Street lab'),el('p',{},'Six downtown SF bottlenecks, directed street routes to SFO and the East Bay, finite road queues and same-demand routing comparisons. Start here to inspect congestion at block level.')]),
      el('article',{},[el('h2',{},'Regional experiments'),el('p',{},'The existing four-area workbench: declared A/B changes, paired uncertainty and guardrails. Its model has different scope; results are not interchangeable.')]),
    ])]),
    el('div',{class:'catalog-search'},[search,filter]),count,cards,
    el('section',{class:'catalog-outside'},[el('h2',{},'What is still outside this playground?'),el('p',{},'Physical autonomous driving, lane changes and collisions; calibrated demand; staff shifts; repair failures; electrical network dynamics; globally optimal fleet routing; real dispatch or vehicle commands. A computed recommendation never authorizes an operational change.')]),
  ]);
  function render(){
    const query=search.value.toLowerCase().trim();const model=filter.value;
    const shown=records.filter(r=>(model==='All simulations'||model===''||r.model===model)&&`${r.title} ${r.question} ${r.controls} ${r.lesson}`.toLowerCase().includes(query));
    count.textContent=`${shown.length} of ${records.length} simulations and lessons`;
    cards.replaceChildren(...shown.map(r=>el('article',{class:'catalog-card','data-simulation':r.id},[
      el('div',{class:'catalog-card-meta'},[el('span',{},r.model),el('span',{},r.id)]),el('h2',{},r.title),el('p',{class:'catalog-question'},r.question),
      el('dl',{},[['Change',r.controls],['Watch',r.outputs],['Learn',r.lesson]].flatMap(([label,value])=>[el('dt',{},label),el('dd',{},value)])),
      el('details',{},[el('summary',{},'Limits of this example'),el('p',{},r.limits)]),
      el('a',{href:hrefForLesson(r),class:'studio-button',on:{click:event=>followLink(event,()=>onLesson?onLesson(r):r.target==='operations'?onOperations(typeof r.patch==='function'?r.patch():structuredClone(r.patch)):r.target==='streets'?onStreets(r.hotspot):onRegional(r.preset))}},r.target==='operations'?'Try this in Fleet day  →':r.target==='streets'?'Open Street lab  →':'Open regional example  →'),
    ])));
    if(!shown.length)cards.appendChild(el('p',{},'No matching simulation. Try a resource or a different model.'));
  }
  render();return {element};
}
