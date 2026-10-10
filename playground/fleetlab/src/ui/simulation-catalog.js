import {LESSON_FRAMES,frameView} from './teaching-frames.js';
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
    {id:'crossed-priorities',title:'Four visits, crossed priorities',model:'Depot flow lab',target:'flows',limits:'Constructed visits on one shared link; known upload sizes and constant capacity. No random draws.'},
    ...OPERATIONAL_LESSONS.map(x=>({...x,model:'Fleet day',target:'operations'})),
    ...STREET_PRESETS.map(p=>({id:`street-${p.id}`,title:p.title,model:'Street lab',target:'streets',hotspot:p.id,limits:'Frozen OSM subset and supported turn rules; synthetic signals/capacity/demand; no lane changing, calibrated traffic, actual curb permission or depot energy model.'})),
    ...SCALE_LABS.map(l=>({id:l.id,title:l.title,model:'Scale lab',target:'scale',seeds:l.seeds.length,limits:l.limits})),
    ...PRESETS.map(p=>({id:p.id,title:p.title,model:'Four-area experiments',target:'regional',preset:p,
      controls:p.experiment?`One declared change: ${p.experiment.axis.id}. ${axisValue(p.experiment.axis.baseline)} → ${axisValue(p.experiment.axis.candidate)}.`:'Fleet, demand, traffic, depot capacity, recall and release.',
      limits:Array.isArray(p.outsideModel)?p.outsideModel.join('; '):'Invented regional network; charging, software and upload are absent in this older model. Replication seeds vary travel on fixed demand.',
    })),
  ].map(r=>({...r,frame:LESSON_FRAMES[r.id]}));
}

const COLLECTIONS=Object.freeze([
  {name:'Depot readiness & data',families:['Depot work and capacity','Energy and charging'],questions:'Why can a charged vehicle still wait? Which upload goes first? Would another bay or worker help?'},
  {name:'Fleet service & capacity',families:['Fleet size and supply','Demand, crowds and weather','Reading a run and a result','Launching a new area','Recall, release and depot choice','Scaling the fleet'],questions:'Can the fleet meet demand? What changes as a fleet grows? Does a policy help across repeats?'},
  {name:'Streets & cities',families:['Roads and streets'],questions:'Where do queues form? Can one block tie up the fleet?'},
]);
const collectionOf=frame=>COLLECTIONS.find(c=>c.families.includes(frame.family)).name;
const minutes=r=>r.frame.evidence==='paired'?5:3;

export function createSimulationCatalog({onOperations=()=>{},onRegional=()=>{},onStreets=()=>{},onLesson=null,labLinks=null,hrefForLesson=r=>routeHref({page:r.target==='flows'?'flows':r.target==='scale'?'scale':r.target==='operations'?'simulation':r.target==='streets'?'streets':CHOOSER_PRESET_IDS.includes(r.id)?'depots':'operations',lesson:r.id})}={}){
  const records=simulationCatalog();const cards=el('div',{class:'catalog-grid'});const count=el('p',{class:'catalog-count',role:'status'});
  const search=el('input',{type:'search',placeholder:'Search questions, topics or lab names…','aria-label':'Search lessons',on:{input:()=>render()}});
  const filter=el('select',{'aria-label':'Simulation model',on:{change:()=>render()}},['All labs','Fleet day','Street lab','Four-area experiments','Scale lab','Depot flow lab'].map(x=>el('option',{value:x},x)));
  let topic='All topics';
  const chips=['All topics',...COLLECTIONS.map(c=>c.name)].map(name=>el('button',{type:'button',class:'studio-button',on:{click:()=>{topic=name;render();}}},name));
  const questions=el('p',{class:'catalog-topic-questions'});
  const clear=el('button',{type:'button',class:'studio-button',on:{click:()=>{search.value='';filter.value='All labs';topic='All topics';render();search.focus();}}},'Clear filters');
  const element=el('main',{class:'simulation-catalog'},[
    el('section',{class:'catalog-intro'},[el('p',{class:'eyebrow'},'EXPLORE'),el('h1',{},'What would you like to understand?'),el('p',{class:'hero-lede'},'Every lesson answers one fleet question with a small synthetic model.')]),
    el('section',{class:'network-flows-feature','aria-labelledby':'network-flows-title'},[
      el('p',{class:'eyebrow'},'START WITH NETWORK FLOWS'),el('h2',{id:'network-flows-title'},'A parked vehicle still has work to do.'),
      el('p',{class:'network-feature-scope'},'Synthetic interactive models · trace the constraint, compare a decision, inspect who waits.'),
      el('div',{class:'network-question-list'},[
        ['two-vehicles','Why is the vehicle still waiting?','A charged battery is only one prerequisite. Follow upload and local work.'],
        ['crossed-priorities','Whose work should go first?','Urgency and short jobs pull in different directions. See who benefits and who waits longer.'],
      ].map(([id,title,text])=>{const r=records.find(x=>x.id===id);return el('article',{class:'network-question'},[
        el('p',{class:'eyebrow'},id==='two-vehicles'?'01 / READINESS':'02 / TRADE-OFFS'),el('h3',{},title),el('p',{class:'network-description'},text),
        el('a',{href:hrefForLesson(r),class:'studio-button',on:{click:event=>{if(onLesson)followLink(event,()=>onLesson(r));}}},'Open experiment  →'),
      ]);}))]),
    el('h2',{class:'catalog-library-title'},'The complete learning library'),
    el('div',{class:'catalog-search'},[['Search lessons',search],['Simulation model',filter]].map(([name,control])=>el('label',{},[el('span',{},name),control]))),
    el('div',{class:'catalog-topics',role:'group','aria-label':'Topic'},chips),questions,
    labLinks&&[el('p',{class:'eyebrow catalog-jump'},'JUMP TO A LAB'),labLinks],
    el('h2',{class:'fl-sr-only'},'All lessons'),el('div',{class:'catalog-count-row'},[count,clear]),cards,
    el('p',{},'Fleet day also hosts separate contracts: staffing, charging, charger status, airport wave, launch rehearsal and the Austin power lab.'),el('p',{},'Each model has its own assumptions, so numbers from different models are not interchangeable.'),el('section',{class:'catalog-outside'},[el('h2',{},'What is still outside this playground?'),el('p',{},'Physical autonomous driving, lane changes and collisions; calibrated demand; staff shifts; repair failures; electrical network dynamics; globally optimal fleet routing; real dispatch or vehicle commands. A computed recommendation never authorizes an operational change.')]),
  ]);
  function render(){
    const query=search.value.toLowerCase().trim();
    const shown=records.filter(r=>(filter.value==='All labs'||r.model===filter.value)&&(topic==='All topics'||collectionOf(r.frame)===topic)&&`${r.title} ${Object.values(r.frame).join(' ')} ${r.id} ${r.model}`.toLowerCase().includes(query));
    count.textContent=`${shown.length} of ${records.length} lessons`;
    for(const chip of chips){const on=chip.textContent===topic;chip.setAttribute('aria-pressed',String(on));chip.classList.toggle('is-selected',on);}
    const picked=COLLECTIONS.find(c=>c.name===topic);questions.hidden=!picked;questions.textContent=picked?.questions??'';
    cards.replaceChildren(...shown.map(r=>el('article',{class:'catalog-card','data-simulation':r.id},[
      el('span',{class:'catalog-card-id'},r.id),
      el('h3',{},r.frame.what_why),
      el('p',{class:'catalog-outcome'},r.frame.look_for),
      el('p',{class:'catalog-meta'},`Run a model · About ${minutes(r)} min · ${r.model}`),
      el('a',{href:hrefForLesson(r),class:'studio-button',on:{click:event=>followLink(event,()=>onLesson?onLesson(r):r.target==='operations'?onOperations(typeof r.patch==='function'?r.patch():structuredClone(r.patch)):r.target==='streets'?onStreets(r.hotspot):onRegional(r.preset))}},'Open lesson  →'),
      el('details',{},[el('summary',{},'More about this lesson'),frameView(r.frame,{titleNode:el('p',{class:'teaching-title'},r.title),seeds:lessonSeeds(r),change:lessonChange(r),limits:r.limits})]),
    ])));
    if(!shown.length)cards.append(el('p',{},'No lesson matches. Clear the filters or try a resource word such as charging or queue.'));
  }
  render();return {element};
}
