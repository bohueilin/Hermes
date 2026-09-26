import {modelHeader,NON_AFFILIATION} from './model-identity.js';
import {bayModelVersion,advancedOperationsDemoConfig,freezeBayExperiment,bayExperimentSteps} from '../model/bay-experiment-contract.js';
import {createAdvancedControls,advancedResultView,resourceFrameView,airportFrameView,advancedComparisonView,createAdvancedExperimentControls} from './advanced-operations-view.js';
import {decisionForConfig,decisionView} from './scenario-learning.js';
import {createRegionalPowerPanel} from './regional-power-view.js';
import {createLaunchPanel} from './launch-view.js';
import {defaultBayAreaConfig as defaultOperationsConfig,simulateBayAreaOperations as simulateOperations,analyzeBayAreaCapacity as analyzeOperationsCapacity,validateBayAreaConfig as validateOperationsConfig,BAY_OPERATIONS_STATES as OPERATIONS_STATES,BAY_OPERATIONS_VERSION as OPERATIONS_VERSION,analyzeVehicleMix,analyzeDepotReadiness,depotReadinessDemoConfig} from '../model/bay-operations.js';
import {BAY_AREA_PLACES,BAY_AREA_MAP,bayAreaSourceJSON} from '../model/bay-area.js';
import {VEHICLE_PROFILES} from '../model/vehicle-profiles.js';
import {createOperations3D} from './operations-3d.js';
import {createVehiclePortrait} from './vehicle-portrait.js';
import {defaultReadiness} from '../model/depot-readiness.js';
import {readinessResultView,readinessComparisonView,blockerText} from './readiness-view.js';
import { el } from './dom.js';
import { ACTIVITY_COLORS } from './operations-map.js';
import { createCarGlyph } from './car-glyph.js';

const button=(text,fn,primary=false)=>el('button',{type:'button',class:primary?'studio-button studio-button-primary':'studio-button',on:{click:fn}},text);
const eyebrow=text=>el('p',{class:'eyebrow'},text);
const fmt=(value,digits=1)=>value===null||value===undefined?'Not available':Number(value).toLocaleString('en-US',{maximumFractionDigits:digits});
export const operationsClock=minutes=>`${minutes>=1440?'Day '+String(Math.floor(minutes/1440)+1)+' · ':''}${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(Math.floor(minutes)%60).padStart(2,'0')}`;
const stateName=id=>OPERATIONS_STATES[id]??String(id).replaceAll('_',' ');
const presets=[
  ['balanced','A regular service day',{}],
  ...['charging','resources','airport'].map(kind=>[kind,`Optional model: ${kind}`,()=>advancedOperationsDemoConfig(kind)]),
  ['staffing','Staffing: an empty bay needs a worker',depotReadinessDemoConfig()],
  ['rain','A rainy evening peak',{start_hour:15,weather:'rain',requests_per_hour:45,fleet_size:24}],
  ['depot','A busy depot',{fleet_size:32,depot_count:1,trips_between_visits:2,chargers:1,cleaning_bays:1}],
  ['power','More ports, limited power',{fleet_size:32,depot_count:2,chargers:4,charger_kw:80,site_power_kw:40,trips_between_visits:2}],
];
const groups=[
  ['Your fleet day',[
    ['fleet_size','AV cars','cars',1,120,1],['requests_per_hour','Base trip demand','requests/hour',0,240,1],
    ['start_hour','Start time','hour of day',0,23,1],['duration_hours','Run length','hours',1,24,1],
    ['road_speed_kph','Uncongested road speed','km/h',5,100,1],
    ['peak_multiplier','Rush-hour demand','× base demand',1,4,.1],['patience_minutes','Assignment patience','minutes',1,120,1],['traffic_multiplier','Road travel time','× typical travel',.5,3,.1],
  ]],
  ['Depots & daily work',[
    ['depot_count','Depots','sites',1,6,1],['trips_between_visits','Visit after','trips',1,20,1],
    ['cleaning_bays','Cleaning bays / depot','bays',1,12,1],['cleaning_minutes','Cleaning / visit','minutes',1,120,1],
    ['software_bays','Update stations / depot','stations',1,12,1],['software_minutes','Software update','minutes',1,180,1],
    ['software_every_visits','Update every','depot visits',1,20,1],['upload_bays','Upload stations / depot','stations',1,12,1],
    ['upload_minutes','Data upload / visit','minutes',1,120,1],
  ]],
  ['Charging & battery',[
    ['chargers','Charge ports / depot','ports',1,12,1],['charger_kw','Power / port','kW',1,350,1],
    ['site_power_kw','Shared power / depot','kW',1,1000,1],
    ['initial_soc_pct','Starting battery','%',10,100,1],['reserve_soc_pct','Return-to-depot reserve','%',5,60,1],
    ['charge_target_pct','Charge until','%',20,100,1],
  ]],
];

export function createOperationsLab({reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),onCatalog=()=>{}}={}){
  let advancedComparison=null,comparisonVersion=0,requestVersion=0,lastExperimentSetup=null,lastExperimentRun=null;
  let config=defaultOperationsConfig(),result=null,capacity=null,readinessComparison=null,minute=0,playing=false,stale=false,selected='car-1',speed=5,raf=null,lastTime=null,stepCarry=0,busy=false,destroyed=false,lastDetailKey=null,interactionVersion=0;
  const inputs=new Map();
  const element=el('main',{class:'operations-lab',id:'operations-lab'});
  const learningContent=el('div',{},decisionView(decisionForConfig(config)));
  const learning=el('details',{class:'ops-scenario-learning'},[el('summary',{},'Learning notes'),learningContent]);
  const identity=modelHeader('Fleet day','OpenStreetMap Bay Area roads, 18 places',bayModelVersion(config));
  const summaryHeading=el('h2',{tabindex:-1},'Result summary'),shareSlot=el('div'),partition=el('p',{},'Run a fleet day to see the complete request partition.');
  const resultSummary=el('section',{class:'ops-result-summary'},[summaryHeading,partition,shareSlot]);
  const launchPanel=createLaunchPanel(),regionalPanel=createRegionalPowerPanel();
  const status=el('p',{class:'ops-status',role:'status'},'Choose your fleet and press Run fleet day.');
  const error=el('p',{class:'ops-error',role:'alert',hidden:true});
  const runButton=button('Run fleet day  ▶',()=>run(),true);
  const preset=el('select',{'aria-label':'Start with a situation',on:{change:()=>{const p=presets.find(x=>x[0]===preset.value);if(!p)return;loadScenario(typeof p[2]==='function'?p[2]():p[2]);preset.value=p[0];}}},[...presets.map(([id,label])=>el('option',{value:id},label)),el('option',{value:'custom',disabled:true},'Custom or shared setup')]);
  const weather=el('select',{'aria-label':'Weather',on:{change:()=>setConfig({weather:weather.value})}},[['clear','Clear'],['rain','Rain'],['heat','Hot day']].map(([value,label])=>el('option',{value},label)));
  const controls=el('aside',{class:'ops-controls','aria-label':'Simulation settings'},[eyebrow('1 / SET UP YOUR DAY'),el('label',{class:'ops-preset'},['Start with a situation',preset]),el('label',{class:'ops-weather'},['Weather',weather])]);
  const readinessMode=el('select',{'aria-label':'Depot work model',on:{change:()=>setConfig({readiness:readinessMode.value==='staffing'?defaultReadiness():undefined})}},[
    el('option',{value:'legacy'},'Historical serial work'),el('option',{value:'staffing'},'M1: staffing-aware serial work')]);
  const workerInput=el('input',{type:'number',min:0,max:120,step:1,value:1,'aria-label':'Qualified cleaning workers / depot',on:{change:()=>setConfig({readiness:{...config.readiness,cleaning_workers:workerInput.value===''?NaN:Number(workerInput.value)}})}});
  const schedulerInput=el('select',{'aria-label':'Cleaning policy',on:{change:()=>setConfig({readiness:{...config.readiness,scheduler:schedulerInput.value}})}},[
    ['fifo','FIFO: do required work'],['defer_cleaning','Counterexample: defer cleaning'],['skip_cleaning','Counterexample: attempt to skip cleaning'],['cancel_cleaning','Counterexample: attempt to cancel cleaning']].map(([value,label])=>el('option',{value},label)));
  const readinessFields=el('div',{},[el('label',{class:'ops-field'},['Qualified cleaning workers / depot',workerInput]),el('label',{class:'ops-field'},['Cleaning policy',schedulerInput]),el('p',{},'One qualified worker and one bay per active cleaning task. Serial work; no shifts. Every visit requires cleaning. Counterexample policies deliberately fail named checks.')]);
  controls.appendChild(el('details',{open:true},[el('summary',{},'Depot readiness extension'),el('label',{class:'ops-field'},['Depot work model',readinessMode]),readinessFields]));
  function syncReadinessControls(){readinessMode.value=config.readiness?'staffing':'legacy';readinessFields.hidden=!config.readiness;workerInput.value=String(config.readiness?.cleaning_workers??1);schedulerInput.value=config.readiness?.scheduler??'fifo';}
  const advancedControls=createAdvancedControls(()=>config,setConfig);controls.appendChild(advancedControls.element);
  const cityInputs=new Map();
  const cityCount=el('strong',{},'18 locations selected');
  const cityOptions=el('div',{class:'bay-place-options'},BAY_AREA_PLACES.map(p=>{
    const input=el('input',{type:'checkbox',checked:true,'data-location-checkbox':p.id,'aria-label':`Include ${p.label}`,on:{change:()=>setConfig({place_ids:BAY_AREA_PLACES.filter(p=>cityInputs.get(p.id).checked).map(p=>p.id)})}});cityInputs.set(p.id,input);
    return el('label',{},[input,el('span',{},p.label)]);
  }));
  controls.appendChild(el('details',{class:'bay-place-picker'},[el('summary',{},['Bay Area locations · ',cityCount]),el('p',{},'Select at least two places. Each has one representative road anchor. Trips between anchors use sourced road geometry.'),button('Include all 18 places',()=>setConfig({place_ids:BAY_AREA_PLACES.map(p=>p.id)})),button('San Francisco ↔ SFO',()=>setConfig({place_ids:['san-francisco','sfo']})),cityOptions,el('small',{},'Simulation locations, not a verified operator service area. Depot sites are hypothetical.') ]));
  const mixInput=el('input',{type:'number',min:0,max:100,step:1,value:config.ojai_share_pct,'aria-label':'Ojai share of fleet',on:{change:()=>setConfig({ojai_share_pct:mixInput.value===''?NaN:Number(mixInput.value)})}});inputs.set('ojai_share_pct',mixInput);
  const mixLabel=el('p',{class:'bay-mix-label'});
  controls.appendChild(el('section',{class:'bay-fleet-picker'},[el('h3',{},'Choose your vehicle mix'),el('label',{class:'ops-field'},[el('span',{},'Ojai share of fleet'),el('span',{class:'ops-input-unit'},[mixInput,el('small',{},'%')])]),mixLabel,el('div',{class:'bay-mix-shortcuts'},[button('All I-PACE',()=>setConfig({ojai_share_pct:0})),button('50 / 50',()=>setConfig({ojai_share_pct:50})),button('All Ojai',()=>setConfig({ojai_share_pct:100}))])]));
  const portraits=['ipace','ojai'].map(type=>createVehiclePortrait(type,VEHICLE_PROFILES[type].label));
  controls.appendChild(el('p',{},NON_AFFILIATION));
  controls.appendChild(el('div',{class:'bay-profile-portraits'},portraits.map((portrait,i)=>el('figure',{},[portrait.element,el('figcaption',{},i?'Ojai · minivan':'I-PACE · SUV')]))));
  const profileInputs=new Map();
  const profileFields=[['battery_kwh','modeled battery','kWh',10,200,1],['charge_limit_kw','vehicle charge limit','kW',1,350,1],['energy_kwh_per_km','driving energy','kWh/km',.05,1,.01],['boarding_minutes','boarding time','min',.1,20,.1],['cleaning_multiplier','cleaning time factor','× base',.1,5,.1],['software_multiplier','software time factor','× base',.1,5,.1],['upload_multiplier','upload time factor','× base',.1,5,.1]];
  controls.appendChild(el('details',{class:'bay-profile-editor'},[el('summary',{},'Vehicle assumptions · editable'),el('p',{},'Jaguar I-PACE and Ojai are real vehicle names. Energy, charging and service values below are editable, synthetic teaching assumptions, not validated fleet measurements. Both profiles allow up to four riders. Ojai numerical defaults are illustrative, not published vehicle specifications.'),...['ipace','ojai'].map(type=>el('section',{},[el('h3',{},VEHICLE_PROFILES[type].label),...profileFields.map(([key,label,unit,min,max,step])=>{
    const input=el('input',{type:'number',value:config.vehicle_profiles[type][key],min,max,step,'aria-label':`${VEHICLE_PROFILES[type].label} ${label}`,on:{change:()=>setConfig({vehicle_profiles:{...config.vehicle_profiles,[type]:{...config.vehicle_profiles[type],[key]:input.value===''?NaN:Number(input.value)}}})}});profileInputs.set(`${type}.${key}`,input);
    return el('label',{class:'ops-field'},[el('span',{},label),el('span',{class:'ops-input-unit'},[input,el('small',{},unit)])]);
  })])),el('p',{},'Retail I-PACE nominal battery: 90 kWh. The modeled usable capacity here is an assumption. Both types use the same road-speed rules; profile names never add a speed advantage.')]));
  function syncVehicleControls(){
    for(const [id,input]of cityInputs)input.checked=config.place_ids.includes(id);cityCount.textContent=`${config.place_ids.length} selected`;
    const vans=Math.round(config.fleet_size*config.ojai_share_pct/100);mixLabel.textContent=`${config.fleet_size-vans} Jaguar I-PACE SUVs + ${vans} Ojai minivans`;
    for(const [path,input]of profileInputs){const [type,key]=path.split('.');input.value=String(config.vehicle_profiles[type][key]);}
  }
  for(const [index,[title,fields]] of groups.entries()){
    const detail=el('details',{open:index===0},[el('summary',{},title)]);
    const grid=el('div',{class:'ops-fields'});
    for(const [key,label,unit,min,max,step] of fields){
      const input=el('input',{type:'number',min,max,step,value:config[key],'aria-label':label,on:{change:()=>setConfig({[key]:input.value===''?NaN:Number(input.value)})}});
      inputs.set(key,input);grid.appendChild(el('label',{class:'ops-field'},[el('span',{},label),el('span',{class:'ops-input-unit'},[input,el('small',{},unit)])]));
    }
    detail.appendChild(grid);controls.appendChild(detail);
  }
  const seedInput=el('input',{type:'number',min:1,max:2147483647,value:config.seed,'aria-label':'Demand seed',on:{change:()=>setConfig({seed:Number(seedInput.value)})}});inputs.set('seed',seedInput);
  controls.appendChild(el('details',{},[el('summary',{},'Repeatability & assumptions'),el('label',{class:'ops-field'},['Demand seed',seedInput]),el('p',{},'A seed recreates demand and trip variation. Fleet/depot comparisons reuse that demand. One-minute resolution. Sequential depot stages. No staff shifts, charge taper, road lanes or collisions.')]));
  controls.appendChild(el('p',{class:'ops-settings-note'},'All values are editable teaching assumptions, not measurements from an operator.'));
  const runSettingsButton=button('Run with these settings ▶',()=>run());controls.appendChild(runSettingsButton);
  const clock=el('strong',{class:'ops-clock'},operationsClock(config.start_hour*60));
  const weatherLabel=el('span',{class:'ops-weather-chip'},'☀ Clear · synthetic traffic');
  const map=createOperations3D({places:BAY_AREA_PLACES,mapData:BAY_AREA_MAP,onDownloadMap:()=>{const link=el('a',{href:'data:application/json;charset=utf-8,'+encodeURIComponent(bayAreaSourceJSON()),download:'fleetlab-bay-area-osm-odbl.json'});document.body.appendChild(link);link.click();link.remove();},onSelect:id=>{selected=id;vehicleSelect.value=id;lastDetailKey=null;renderFrame();}});
  const mapEmpty=el('div',{class:'ops-map-empty'},[el('div',{class:'ops-empty-car'}),el('h2',{},'The Bay Area is your testbed.'),el('p',{},'Explore the real road network below, then run the day to send your I-PACE and Ojai fleet to work.'),button('Show me what I can simulate',onCatalog)]);
  const carIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');carIcon.setAttribute('viewBox','-24 -18 48 36');carIcon.setAttribute('aria-hidden','true');carIcon.appendChild(createCarGlyph());mapEmpty.children[0].appendChild(carIcon);
  const play=button('Play',()=>playing?pause():resume());
  const slider=el('input',{type:'range',min:0,max:config.duration_hours*60,step:1,value:0,'aria-label':'Minute of simulated day',on:{input:()=>seek(Number(slider.value))}});
  const speedSelect=el('select',{'aria-label':'Replay speed',on:{change:()=>{speed=Number(speedSelect.value);}}},[[1,'1 min / second'],[5,'5 min / second'],[15,'15 min / second']].map(([value,label])=>el('option',{value,selected:value===5},label)));
  const transport=el('div',{class:'ops-transport'},[play,button('Next minute',()=>seek(Math.floor(minute)+1)),button('Next activity',()=>nextActivity()),button('Start',()=>seek(0)),speedSelect,slider]);
  const counters=el('div',{class:'ops-frame-counts'});
  const vehicleSelect=el('select',{'aria-label':'Follow a car',on:{change:()=>{selected=vehicleSelect.value;renderFrame();}}});
  const vehicleDetail=el('div',{class:'ops-vehicle-detail'});
  const trail=el('ol',{class:'ops-car-trail'});
  const selectedPanel=el('section',{class:'ops-follow'},[el('div',{class:'ops-follow-heading'},[el('h3',{},'Follow one AV'),vehicleSelect]),vehicleDetail,el('details',{},[el('summary',{},'Its latest activities'),trail])]);
  const stageStates=[['available','Ready for a rider'],['pickup','Pickup'],['boarding','Boarding'],['passenger_trip','Passenger trip'],['drive_to_depot','Return to depot'],['software','Software'],['cleaning','Clean'],['charging','Charge'],['upload','Upload'],['airport_reposition','Airport staging']];
  const lifecycle=el('div',{class:'ops-lifecycle'},stageStates.map(([state,label])=>button(label,()=>jumpToStage(state))));
  const stageNote=el('p',{class:'ops-stage-note'},'Tap a stage to find it in this day. Software runs only on scheduled visits; queues hold cars until a resource is free.');
  const vehicleTable=el('div',{class:'ops-table-wrap'});
  const depotStatus=el('div',{class:'ops-depot-status'});
  const airportStatus=el('div',{class:'ops-airport-frame'});
  const stage=el('section',{class:'ops-stage'},[
    el('div',{class:'ops-stage-header'},[el('div',{},[eyebrow('2 / WATCH THE DAY'),clock]),weatherLabel]),
    counters,transport,mapEmpty,map.element,airportStatus,
    el('div',{class:'ops-lifecycle-section'},[el('h3',{},'One car. A complete work cycle.'),lifecycle,stageNote]),selectedPanel,
    el('details',{class:'ops-depot-detail'},[el('summary',{},'Depot queues & resources at this minute'),depotStatus]),
    el('details',{class:'ops-vehicle-table'},[el('summary',{},'All vehicles as a table'),vehicleTable]),
  ]);
  const outcomeCards=el('div',{class:'ops-outcome-cards'});
  const outcomesNote=el('p',{class:'ops-outcomes-note'},'Run a day to see outcomes.');
  const serviceBreakdown=el('div',{class:'ops-service-breakdown'});
  const resultProvenance=el('div',{class:'ops-result-provenance'});
  const outcomeSection=el('section',{class:'ops-results'},[eyebrow('3 / UNDERSTAND THE RESULT'),el('h2',{},'How much service did this fleet deliver?'),resultProvenance,outcomeCards,outcomesNote,serviceBreakdown]);
  const readinessResult=el('div',{class:'ops-readiness-result'});
  outcomeSection.appendChild(readinessResult);
  const advancedResult=el('div',{class:'ops-advanced-result'});outcomeSection.appendChild(advancedResult);
  const advancedContent=el('div',{class:'ops-advanced-comparison'});
  const experimentControls=createAdvancedExperimentControls(compareAdvanced,()=>{comparisonVersion++;advancedComparison=null;advancedContent.replaceChildren(el('p',{},'Experiment settings changed. Run the comparison again.'));});
  experimentControls.button.classList.remove('studio-button-primary');
  const advancedSection=el('section',{class:'ops-capacity'},[eyebrow('PAIRED POLICY EXPERIMENT'),el('h2',{},'Compare one operating policy'),el('p',{},'Submit a fresh fleet day first. Hold all other inputs fixed, separate tuning from evaluation seeds, and inspect guardrails alongside the primary metric. Each paired repetition runs baseline and candidate against the same seed.'),experimentControls.element,advancedContent]);
  const readinessButton=button('Compare staffing and bays',()=>compareReadiness());
  const readinessContent=el('div',{class:'ops-readiness-comparison'});
  const readinessSection=el('section',{class:'ops-capacity'},[eyebrow('TEST DEPOT READINESS'),el('h2',{},'Would another worker help? Would another bay?'),el('p',{},'Enable M1 or select the staffing situation, then run the day. Compare two separate changes against your submitted baseline.'),readinessButton,readinessContent]);
  const capacityButton=button('Compare fleet & depot sizes',()=>compareCapacity());
  const capacityContent=el('div',{class:'ops-capacity-content'});
  const capacitySection=el('section',{class:'ops-capacity'},[eyebrow('4 / TEST THE CAPACITY QUESTION'),el('h2',{},'More cars, more depots, or a different constraint?'),el('p',{},'Run the same demand across a bounded set of fleet and depot sizes. The target is completing at least 95% of all requests by the end of the chosen day, including late arrivals in the denominator.'),capacityButton,capacityContent]);
  const mixButton=button('Compare I-PACE · mixed · Ojai',()=>compareMix());
  const mixContent=el('div',{class:'bay-mix-results'});
  const mixSection=el('section',{class:'ops-capacity'},[eyebrow('5 / COMPARE VEHICLE ASSUMPTIONS'),el('h2',{},'What changes when the fleet changes?'),el('p',{},'Run all I-PACE, a 50/50 mix and all Ojai against identical demand. Compare the effects of your battery, charging, energy and service-time assumptions.'),mixButton,mixContent]);
  const traffic=el('details',{class:'ops-traffic-boundary'},[el('summary',{},'Where do traffic and weather come from?'),el('p',{},'This diagram uses synthetic rush-hour congestion and declared rain/heat effects. Weather changes travel time and energy use; it does not simulate visibility, tire grip or autonomous-driving capability.'),el('p',{},'Google Maps traffic is a separate optional local companion that needs API configuration. It does not power this synthetic replay. Its route information stays on an attributed Google map or in an attributed result panel.')]);
  const assumptions=el('ul',{class:'ops-assumptions'});
  traffic.appendChild(assumptions);
  element.appendChild(el('section',{class:'ops-intro'},[eyebrow('FLEET SIMULATION / LEARN BY CHANGING ONE THING'),el('h1',{},'How many trips can your fleet serve today?'),identity.element,el('p',{},'Build a Jaguar I-PACE and Ojai fleet across 18 Bay Area locations. Follow real road routes in 3D, change the depot resources and see what keeps a car from its next rider.'),el('div',{class:'ops-run-line'},[runButton,status]),error]));
  element.appendChild(resultSummary);element.appendChild(el('div',{class:'ops-workspace'},[controls,stage]));element.appendChild(outcomeSection);element.appendChild(readinessSection);element.appendChild(advancedSection);element.appendChild(capacitySection);element.appendChild(mixSection);element.appendChild(traffic);
  const modelBoundary=el('p',{class:'ops-model-boundary'},`Operational teaching model ${OPERATIONS_VERSION}. Real OpenStreetMap geography with synthetic demand and vehicle assumptions. This is a capacity experiment, not a calibrated digital twin or operational authorization. The regional A/B workbench uses its own unchanged model.`);element.appendChild(modelBoundary);element.appendChild(learning);element.appendChild(el('section',{class:'ops-other-experiments'},[el('h2',{},'Other experiments on this page'),regionalPanel.element,launchPanel.element]));

  function loadScenario(patch){requestVersion++;setConfig({...defaultOperationsConfig(),...patch},{replace:true});experimentControls.setOptions();experimentControls.setTreatment(config.airport?'airport_forecast':config.resources?'resource_freshness':config.charging?.policy==='deadline'?'charging_deadlines':'charging_redistribution');}
  function setConfig(patch,{replace=false}={}){config=structuredClone(replace?patch:{...config,...patch});preset.value='custom';learningContent.replaceChildren(decisionView(decisionForConfig(config)));for(const key of ['readiness','charging','resources','airport'])if(config[key]===undefined)delete config[key];comparisonVersion++;advancedComparison=null;advancedContent.replaceChildren(el('p',{},'Settings changed. Run fleet day and compare again.'));advancedControls.sync();syncReadinessControls();syncVehicleControls();for(const [key,input]of inputs)input.value=String(config[key]);weather.value=config.weather;pause();stale=!!result&&JSON.stringify(config)!==JSON.stringify(result.config);readinessComparison=null;readinessContent.replaceChildren(el('p',{},hasExtensions()?'M1 comparison unavailable with optional charging, resources or airport models.':'Settings changed. Compare again with the current settings.'));capacity=null;capacityContent.replaceChildren();mixContent.replaceChildren();error.hidden=true;renderStatus();if(!result)clock.textContent=operationsClock(config.start_hour*60);}
  /** Return complete inputs in native model units; sharing never executes a model. */
  function getSharedSetup(source='current',model='fleet-day'){
    if(model==='regional-power')return regionalPanel.getSharedSetup(source);
    if(model==='launch-rehearsal')return launchPanel.getSharedSetup(source);
    if(model!=='fleet-day')throw new RangeError('Unsupported setup model.');
    if(source==='last-experiment'){
      if(!lastExperimentSetup)throw new RangeError('No completed paired experiment. Run a comparison first.');
      return structuredClone(lastExperimentSetup);
    }
    if(source==='last-run'){
      if(!result)throw new RangeError('No completed fleet run. Run fleet day first.');
      return structuredClone({model,config:result.config,options:lastExperimentRun===result?lastExperimentSetup.options:{}});
    }
    if(source!=='current')throw new RangeError('Unsupported setup source.');
    const options=experimentControls.options(),group={charging_redistribution:'charging',charging_deadlines:'charging',resource_freshness:'resources',airport_forecast:'airport'}[options.treatment];
    return structuredClone({model,config,options:group&&config[group]?options:{}});
  }
  /** Load an already validated setup, replacing effective inputs without running or replaying. */
  function loadSharedSetup(envelope){
    if(envelope?.model==='regional-power'){pause();return regionalPanel.loadSharedSetup(envelope);}
    if(envelope?.model==='launch-rehearsal'){pause();return launchPanel.loadSharedSetup(envelope);}
    if(envelope?.model!=='fleet-day')throw new RangeError('Unsupported setup model.');
    const next=structuredClone(envelope),issues=validateOperationsConfig(next.config);
    if(issues.length)throw new RangeError(issues.join(' '));
    if(Object.keys(next.options??{}).length)freezeBayExperiment(next.config,next.options);
    requestVersion++;setConfig(next.config,{replace:true});experimentControls.setOptions(next.options??{});
    if(!Object.keys(next.options??{}).length)experimentControls.setTreatment(config.airport?'airport_forecast':config.resources?'resource_freshness':config.charging?.policy==='deadline'?'charging_deadlines':'charging_redistribution');
    return getSharedSetup();
  }
  function renderStatus(){identity.update(result?.version??bayModelVersion(config),stale);status.textContent=busy?'Computing your simulated day…':stale?'Settings changed. These results use previous settings; run again to update.':result?`Day computed · ${result.config.fleet_size} AVs · ${result.config.depot_count} depots · seed ${result.config.seed}. ${playing?'Replay moving.':'Replay paused.'}`:'Choose your fleet and press Run fleet day.';status.classList.toggle('is-stale',stale);runButton.disabled=busy;runSettingsButton.disabled=busy;capacityButton.disabled=busy;mixButton.disabled=busy;readinessButton.disabled=busy||!config.readiness||!result||stale||hasExtensions();experimentControls.button.disabled=busy||!result||stale;}
  function pause(){interactionVersion++;playing=false;if(raf!==null)cancelFrame(raf);raf=null;lastTime=null;stepCarry=0;play.textContent='Play';renderStatus();}
  function resume(){if(!result||stale||destroyed)return;if(minute>=result.frames.length-1)minute=0;playing=true;lastTime=null;play.textContent='Pause';renderStatus();raf=requestFrame(tick);}
  function tick(time){if(!playing||destroyed)return;if(lastTime!==null){const elapsed=Math.min(.25,(time-lastTime)/1000);if(reducedMotion()){stepCarry+=elapsed;minute=Math.floor(minute);if(stepCarry>=1){minute=Math.min(result.frames.length-1,minute+1);stepCarry-=1;}}else{stepCarry=0;minute=Math.min(result.frames.length-1,minute+elapsed*speed);}}lastTime=time;renderFrame();if(minute>=result.frames.length-1){pause();return;}raf=requestFrame(tick);}
  function seek(value){pause();if(!result)return;minute=Math.max(0,Math.min(result.frames.length-1,value));renderFrame();}
  function nextActivity(){if(!result)return;const event=result.events.find(e=>e.minute>minute&&(!selected||e.vehicle_id===selected));seek(event?.minute??result.frames.length-1);}
  function jumpToStage(state){if(!result)return;let frame=result.frames.find(f=>f.minute>minute&&f.vehicles.some(c=>c.id===selected&&c.state===state));if(!frame)frame=result.frames.find(f=>f.vehicles.some(c=>c.state===state));if(!frame){stageNote.textContent=`No ${stateName(state).toLowerCase()} activity occurred in this day. Try a longer day or more frequent depot visits.`;return;}const car=frame.vehicles.find(c=>c.id===selected&&c.state===state)??frame.vehicles.find(c=>c.state===state);selected=car.id;vehicleSelect.value=selected;seek(frame.minute);stageNote.textContent=`${car.id} at ${operationsClock(Math.round(result.config.start_hour*60)+frame.minute)}: ${stateName(state)}. This is a recorded minute from the simulated day.`;}
  async function run(){
    if(busy)return;comparisonVersion++;advancedComparison=null;advancedContent.replaceChildren();pause();const issues=validateOperationsConfig(config);
    if(issues.length){error.hidden=false;error.textContent=issues.join(' ');return;}
    const submitted=JSON.parse(JSON.stringify(config)),version=interactionVersion,request=requestVersion;
    error.hidden=true;busy=true;renderStatus();await new Promise(resolve=>setTimeout(resolve,0));
    if(destroyed||request!==requestVersion){busy=false;if(!destroyed)renderStatus();return;}
    try{
      result=simulateOperations(submitted);modelBoundary.textContent=`Operational teaching model ${result.version}. Real OpenStreetMap geography with synthetic demand and vehicle assumptions. Simulation-only, NOT_EVIDENCE, decision authority NONE. Street lab, regional experiments and Python evidence remain separate.`;readinessComparison=null;readinessContent.replaceChildren(...(hasExtensions()?[el('p',{},'M1 comparison unavailable with optional charging, resources or airport models.')]:[]));advancedResult.replaceChildren(...(result.extensions?[advancedResultView(result)]:[]));readinessResult.replaceChildren(...(result.readiness?[readinessResultView(result)]:[]));capacity=null;capacityContent.replaceChildren();minute=0;lastDetailKey=null;
      stale=JSON.stringify(config)!==JSON.stringify(submitted);
      resultProvenance.replaceChildren(el('p',{},`Fleet day model ${result.version}. Demand seed ${result.config.seed}. NOT_EVIDENCE; simulation-only; decision authority NONE.`),el('details',{class:'ops-result-details'},[el('summary',{},'Exact submitted configuration and recorded metrics'),el('pre',{},JSON.stringify({model_version:result.version,config:result.config,metrics:result.metrics,evidence_status:'NOT_EVIDENCE',decision_authority:'NONE'},null,2))]));
      selected=result.frames[0].vehicles[0]?.id??null;
      vehicleSelect.replaceChildren(...result.frames[0].vehicles.map(c=>el('option',{value:c.id},`${c.id} · ${VEHICLE_PROFILES[c.vehicle_type]?.label??''}`)));
      vehicleSelect.value=selected;slider.max=String(result.frames.length-1);renderOutcomes();renderMeasuredStages();renderFrame();
      assumptions.replaceChildren(...result.assumptions.map(text=>el('li',{},text)));
    }catch(e){error.hidden=false;error.textContent=`The day could not run: ${e.message}`;}
    finally{busy=false;renderStatus();}
    if(error.hidden&&result&&!stale&&version===interactionVersion){
      summaryHeading.focus({preventScroll:true});
    }
    return result;
  }
  function renderFrame(){
    const frame=result?.frames[Math.floor(minute)];map.element.hidden=false;mapEmpty.hidden=!!frame;transport.hidden=!frame;selectedPanel.hidden=!frame;
    for(const b of lifecycle.querySelectorAll('button'))b.disabled=!frame;
    if(!frame){map.refresh();return;}
    map.render(result,frame,result.frames[Math.floor(minute)+1],reducedMotion()?0:minute%1,selected);clock.textContent=operationsClock(Math.round(result.config.start_hour*60)+frame.minute);slider.value=String(Math.floor(minute));
    const detailKey=`${Math.floor(minute)}|${selected}|${element.querySelector('.ops-vehicle-table').open}|${element.querySelector('.ops-depot-detail').open}`;
    if(lastDetailKey===detailKey)return;lastDetailKey=detailKey;
    weatherLabel.textContent=`${result.config.weather==='rain'?'☂ Rain':result.config.weather==='heat'?'☀ Hot day':'☀ Clear'} · synthetic traffic ×${fmt(frame.traffic_multiplier??result.config.traffic_multiplier,2)}`;
    const counts=[
      ['Available','available',c=>['available','ready'].includes(c.state)],
      ['Pickup / boarding','pickup',c=>['pickup','boarding'].includes(c.state)],['On a trip','passenger_trip',c=>c.state==='passenger_trip'],
      ['Returning','drive_to_depot',c=>c.state==='drive_to_depot'],
      ['In depot queues','queued_charging',c=>c.state.startsWith('queued_')],
      ['Depot work','charging',c=>['software','cleaning','charging','upload'].includes(c.state)],
      ['Airport staging travel','airport_reposition',c=>c.state==='airport_reposition'],
    ];
    counters.replaceChildren(...counts.map(([label,state,predicate])=>el('span',{},[el('i',{style:`background:${ACTIVITY_COLORS[state]??'#a87560'}`}),el('strong',{},String(frame.vehicles.filter(predicate).length)),label])));
    airportStatus.replaceChildren(...(frame.airport?[airportFrameView(frame.airport)]:[]));
    const car=frame.vehicles.find(c=>c.id===selected);if(car){
      const battery=Math.max(0,Math.min(100,car.soc_kwh/car.battery_kwh*100));
      vehicleDetail.replaceChildren(el('strong',{},`${VEHICLE_PROFILES[car.vehicle_type]?.label??car.vehicle_type} · ${stateName(car.state)}`),el('span',{},`${fmt(battery,0)}% battery · ${fmt(car.soc_kwh)} kWh`),el('meter',{min:0,max:car.battery_kwh,value:car.soc_kwh,'aria-label':`${car.id} battery energy`}),el('p',{},car.from&&car.to?`${result.locations.find(p=>p.id===car.from)?.label??car.from} → ${result.locations.find(p=>p.id===car.to)?.label??car.to} · ${fmt(result.routes?.[car.route_id]?.distance_km)} km${car.request_id?' · '+car.request_id:''}`:car.depot_id?`At ${result.locations.find(p=>p.id===car.depot_id)?.label??car.depot_id}`:`${result.locations.find(p=>p.id===car.node)?.label??'Road anchor'} · ${car.request_id??'Ready for assignment'}`));
      if(result.extensions)vehicleDetail.appendChild(el('p',{},`Recorded charging power: ${fmt(car.power_kw)} kW; port: ${car.port_id??'Not available'}; resource blocker: ${car.resource_blocked??'None recorded'}.`));
      if(car.readiness)vehicleDetail.appendChild(el('p',{},`Required work remaining: ${car.readiness.mandatory_remaining.join(', ')}. Blocked reason: ${car.readiness.blocked_reason?blockerText(car.readiness.blocked_reason):'None; task active or transitioning'}. ${car.readiness.worker_id?'Worker: '+car.readiness.worker_id+'; bay: '+car.readiness.bay_id:''}`));
      const events=result.events.filter(e=>e.vehicle_id===selected&&e.minute<=minute).slice(-7).reverse();trail.replaceChildren(...events.map(e=>el('li',{},[el('time',{},operationsClock(result.config.start_hour*60+e.minute)),`${String(e.kind).replaceAll('_',' ')}${typeof e.detail==='string'?' · '+e.detail:''}`])));
    }
    if(element.querySelector('.ops-vehicle-table').open)vehicleTable.replaceChildren(table(['Vehicle','Activity','Battery (kWh)'],frame.vehicles.map(c=>[c.id,stateName(c.state),fmt(c.soc_kwh)])));
    if(element.querySelector('.ops-depot-detail').open)depotStatus.replaceChildren(...frame.depot_queues.map(d=>el('article',{},[
      el('h4',{},d.depot_id.replace('depot-','Depot ')),
      ...(d.resources?[resourceFrameView(d.resources)]:[]),
      el('p',{},`${fmt(d.charging_kw)} / ${result.config.site_power_kw} kW charging power in use`),
      ...(d.cleaning_workers?[el('p',{},`Qualified cleaning workers: ${d.cleaning_workers.in_use} working / ${d.cleaning_workers.capacity} total; ${d.cleaning_workers.free} free.`)]:[]),
      table(['Stage','Waiting','Working','Capacity'],['software','cleaning','charging','upload'].map(s=>[stateName(s),String(d[s]),String(d.active[s]),String(result.config[{software:'software_bays',cleaning:'cleaning_bays',charging:'chargers',upload:'upload_bays'}[s]])])),
    ])));
  }
  function metricCard(label,value,note){return el('article',{},[el('span',{},label),el('strong',{},value),el('small',{},note)]);}
  function renderOutcomes(){if(!result)return;const m=result.metrics;partition.textContent=`${m.completed_trips} completed · ${m.unserved_requests} unserved · ${m.pending_requests} waiting · ${m.in_progress_trips} in progress = ${m.total_requests} requests`;
    outcomeCards.replaceChildren(
      metricCard('Trips completed',`${fmt(m.completed_trips,0)} / ${fmt(m.total_requests,0)}`,'All requests created during this day'),
      metricCard('Trips per AV',fmt(m.trips_per_vehicle),'Completed trips ÷ starting fleet'),
      metricCard('Unserved',fmt(m.unserved_requests,0),'Riders who left before assignment'),
      metricCard('Time at depot',m.avg_depot_onsite_min===null?'Not available':`${fmt(m.avg_depot_onsite_min)} min`,'Mean completed on-site time; includes queues'),
    );
    outcomesNote.textContent=`At the end: ${fmt(m.pending_requests,0)} requests still waiting; ${fmt(m.in_progress_trips,0)} assigned or on a trip. ${fmt(m.censored_visits,0)} depot visits unfinished. Completed-trip mean wait: ${m.avg_wait_min_completed===null?'not available':fmt(m.avg_wait_min_completed)+' min'}. Mean active work per completed depot visit: ${m.avg_active_service_min===null?'not available':fmt(m.avg_active_service_min)+' min'}.`;
    serviceBreakdown.replaceChildren(el('h3',{},'What happens at the depot?'),el('div',{class:'ops-service-cards'},[
      ['Software',`${result.config.software_minutes} min`,`Every ${result.config.software_every_visits} visits; ${result.config.software_bays} stations/site`],
      ['Cleaning',`${result.config.cleaning_minutes} min`,`${result.config.cleaning_bays} bays/site`],
      ['Charging','Energy + power limited',`${result.config.chargers} ports × ${result.config.charger_kw} kW; shared ${result.config.site_power_kw} kW/site`],
      ['Data upload',`${result.config.upload_minutes} min`,`${result.config.upload_bays} stations/site`],
    ].map(([title,value,note])=>el('article',{},[el('h4',{},title),el('strong',{},value),el('p',{},note)]))),el('p',{},'Software, cleaning and upload show base times; each vehicle profile applies its editable time factor. These stages run in sequence. Queues add to on-site time. Charging stops at the configured target; it is not a fixed timer. Software and upload are occupied-resource delays, not actual device operations.'));
  }
  function renderMeasuredStages(){
    const breakdown=result?.metrics.service_breakdown;
    if(!breakdown)return;
    serviceBreakdown.appendChild(el('h3',{},'Measured work and waiting time'));
    serviceBreakdown.appendChild(table(['Stage','Completed visits with stage','Mean work (min)','Mean queue (min)'],Object.entries(breakdown).map(([stage,m])=>[stateName(stage),fmt(m.completed_count,0),fmt(m.avg_active_min),fmt(m.avg_queue_min)])));
    serviceBreakdown.appendChild(el('p',{},'Each row includes only completed depot visits containing that stage. Unfinished visits are excluded and counted above. Return travel is excluded from on-site time.'));
    serviceBreakdown.appendChild(el('details',{},[el('summary',{},'Outcomes by vehicle type and pickup location'),table(['Type','AVs','Trips','Trips / AV','Distance (km)','Energy (kWh)'],result.metrics.by_vehicle_type.map(t=>[t.label,fmt(t.vehicle_count,0),fmt(t.completed_trips,0),fmt(t.trips_per_vehicle),fmt(t.distance_km),fmt(t.energy_consumed_kwh)])),table(['Pickup location','Requests','Completed','Unserved','Waiting','In progress'],result.metrics.by_place.map(p=>[p.label,...['total_requests','completed_trips','unserved_requests','pending_requests','in_progress_trips'].map(key=>fmt(p[key],0))]))]));
  }
  async function compareCapacity(){if(busy)return;const issues=validateOperationsConfig(config);if(issues.length){error.hidden=false;error.textContent=issues.join(' ');return;}pause();error.hidden=true;const submitted=JSON.parse(JSON.stringify(config)),request=requestVersion;busy=true;renderStatus();capacityContent.replaceChildren(el('p',{},'Comparing the same demand across fleet and depot counts…'));await new Promise(resolve=>setTimeout(resolve,0));if(destroyed||request!==requestVersion){busy=false;if(!destroyed)renderStatus();return;}if(JSON.stringify(config)!==JSON.stringify(submitted)){busy=false;capacityContent.replaceChildren(el('p',{},'Settings changed. Compare again with the current settings.'));renderStatus();return;}try{
    capacity=analyzeOperationsCapacity(submitted);
    const trialsTable=trials=>table(['AV cars','Depots','Trips done','Requests','Completed','95% target','Unserved'],trials.map(t=>{const m=t.metrics??t;return [String(t.fleet_size??m.fleet_size),String(t.depot_count??m.depot_count),fmt(m.completed_trips,0),fmt(m.total_requests,0),t.completion_fraction===null?'Not available':`${fmt(t.completion_fraction*100)}%`,t.completion_fraction===null?'Not available':t.completion_fraction>=capacity.target_completion_fraction?'Met':'Below target',fmt(m.unserved_requests,0)];}));
    capacityContent.replaceChildren(el('p',{class:'ops-capacity-answer'},capacity.min_depots===null?'No tested depot count met the 95% end-of-day completion target. Inspect fleet supply, the time window and service constraints.':`${capacity.min_depots} depot${capacity.min_depots===1?'':'s'} is the first tested count to meet the 95% target for this fleet and these assumptions.`),el('p',{},'This is a bounded scenario comparison, not an optimal site plan. Late unfinished trips remain in the denominator. Depot size and resources per site are held fixed.'),el('div',{class:'ops-capacity-tables'},[el('section',{},[el('h3',{},'Change fleet size; keep depots fixed'),trialsTable(capacity.fleet_trials)]),el('section',{},[el('h3',{},'Change depot count; keep fleet fixed'),trialsTable(capacity.depot_trials)])]));
  }catch(e){capacityContent.replaceChildren(el('p',{},`Capacity comparison unavailable: ${e.message}`));}finally{busy=false;renderStatus();}}
  async function compareMix(){
    if(busy)return;const issues=validateOperationsConfig(config);if(issues.length){error.hidden=false;error.textContent=issues.join(' ');return;}
    pause();error.hidden=true;const submitted=JSON.parse(JSON.stringify(config)),request=requestVersion;busy=true;renderStatus();mixContent.replaceChildren(el('p',{},'Reusing the same demand for all three fleets…'));await new Promise(resolve=>setTimeout(resolve,0));
    if(destroyed||request!==requestVersion){busy=false;if(!destroyed)renderStatus();return;}if(JSON.stringify(config)!==JSON.stringify(submitted)){busy=false;mixContent.replaceChildren(el('p',{},'Settings changed. Compare again.'));renderStatus();return;}
    try{const comparison=analyzeVehicleMix(submitted);mixContent.replaceChildren(table(['Fleet','Trips done','Trips / AV','Mean trip (min)','Depot time (min)','Energy used (kWh)'],comparison.trials.map(t=>[t.ojai_share_pct===0?'All I-PACE':t.ojai_share_pct===100?'All Ojai':'50 / 50',fmt(t.metrics.completed_trips,0),fmt(t.metrics.trips_per_vehicle),fmt(t.metrics.avg_trip_min_completed??t.metrics.avg_trip_minutes_completed),fmt(t.metrics.avg_depot_onsite_min),fmt(t.metrics.energy_consumed_kwh)])),el('p',{},'Differences reflect the declared profiles and this scenario. They do not establish the performance of either commercial fleet. Charging is linear; taper and thermal limits are not modeled.'));}
    catch(e){mixContent.replaceChildren(el('p',{},`Comparison unavailable: ${e.message}`));}finally{busy=false;renderStatus();}
  }
  async function compareReadiness(){
    if(hasExtensions()){readinessContent.replaceChildren(el('p',{},'M1 comparison unavailable with optional charging, resources or airport models.'));return;}
    if(busy||!config.readiness)return;
    if(!result||stale){readinessContent.replaceChildren(el('p',{},'Run fleet day with these settings before comparing.'));return;}
    const issues=validateOperationsConfig(config);
    if(issues.length){error.hidden=false;error.textContent=issues.join(' ');return;}
    pause();error.hidden=true;const submitted=structuredClone(config),request=requestVersion;busy=true;renderStatus();
    readinessContent.replaceChildren(el('p',{},'Comparing staffing and bays with the same external demand…'));
    await new Promise(resolve=>setTimeout(resolve,0));
    if(destroyed||request!==requestVersion){busy=false;if(!destroyed)renderStatus();return;}
    if(JSON.stringify(config)!==JSON.stringify(submitted)){busy=false;readinessContent.replaceChildren(el('p',{},'Settings changed. Compare again.'));renderStatus();return;}
    try{readinessComparison=analyzeDepotReadiness(submitted);readinessContent.replaceChildren(readinessComparisonView(readinessComparison));}
    catch(e){readinessComparison=null;readinessContent.replaceChildren(el('p',{},`Comparison unavailable: ${e.message}`));}
    finally{busy=false;renderStatus();}return readinessComparison;
  }
  function hasExtensions(){return !!(config.charging||config.resources||config.airport);}
  async function compareAdvanced(options=experimentControls.options()){
    if(busy)return;
    if(!result||stale){advancedContent.replaceChildren(el('p',{},'Run fleet day with these settings before comparing.'));return;}
    pause();advancedComparison=null;const token=++comparisonVersion,submitted=structuredClone(config),submittedRun=result;let frozen;
    try{frozen=freezeBayExperiment(submitted,structuredClone(options));}catch(e){advancedContent.replaceChildren(el('p',{},`Experiment unavailable: ${e.message}`));return;}
    busy=true;renderStatus();advancedContent.replaceChildren(el('p',{},'Preparing paired repetitions…'));
    const iterator=bayExperimentSteps(frozen);
    try{
      for(;;){
        await new Promise(resolve=>setTimeout(resolve,0));
        if(destroyed||token!==comparisonVersion){iterator.return?.();return;}
        const next=iterator.next();
        if(next.done){advancedComparison=next.value;const s=frozen.spec;lastExperimentSetup={model:'fleet-day',config:submitted,options:structuredClone({treatment:s.treatment,seeds:s.seeds,tuning_seeds:s.tuning_seeds,margin:s.margin,resamples:s.resamples,null_treatment:s.null_treatment})};lastExperimentRun=submittedRun;advancedContent.replaceChildren(advancedComparisonView(advancedComparison));return advancedComparison;}
        advancedContent.replaceChildren(el('p',{role:'status'},`${next.value.phase}: ${next.value.completed} / ${next.value.total}. Paired teaching simulations, NOT_EVIDENCE.`));
      }
    }catch(e){if(!destroyed&&token===comparisonVersion)advancedContent.replaceChildren(el('p',{},`Experiment unavailable: ${e.message}`));}
    finally{busy=false;if(!destroyed)renderStatus();}
  }
  function table(headings,rows){return el('div',{class:'ops-table-wrap'},el('table',{},[el('thead',{},el('tr',{},headings.map(x=>el('th',{scope:'col'},x)))),el('tbody',{},rows.map(row=>el('tr',{},row.map(x=>el('td',{},x)))))]));}
  for(const selector of ['.ops-vehicle-table','.ops-depot-detail'])element.querySelector(selector).addEventListener('toggle',()=>renderFrame());
  advancedControls.sync();syncReadinessControls();syncVehicleControls();renderFrame();renderStatus();
  return {element,summaryHeading,shareSlot,launchPanel,regionalPanel,run,pause,seek,nextActivity,setConfig,loadScenario,getSharedSetup,loadSharedSetup,compareCapacity,compareReadiness,compareAdvanced,chooseLaunchTemplate:name=>launchPanel.chooseTemplate(name),getState:()=>({config:structuredClone(config),result,capacity,readinessComparison,advancedComparison,minute,playing,stale}),destroy(){comparisonVersion++;requestVersion++;pause();destroyed=true;launchPanel.destroy();regionalPanel.destroy();map.destroy();portraits.forEach(p=>p.destroy());}};
}
