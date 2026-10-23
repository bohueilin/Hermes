import {PRESETS,PRESET_SEED_SET,presetById,seedSet} from '../model/presets.js';
import {createInitialState} from './store.js';

// The current regional replay submits these five seeds and records the first seed's log.
// The share codec versions this contract; the adapter test checks the app's submission constants.
const replaySeeds=()=>seedSet(PRESET_SEED_SET,5);

// The setup UI can retain an undefined units field after changing to typed text.
// Remove only that inactive alternative on the detached copy; other undefined data stays invalid.
function omitInactiveThreshold(ref,units,text){
 if(!ref||typeof ref!=='object')return;
 for(const [inactive,active]of [[units,text],[text,units]]){
  if(Object.hasOwn(ref,inactive)&&ref[inactive]===undefined&&Object.hasOwn(ref,active)&&ref[active]!==undefined)delete ref[inactive];
 }
}

/** Returns detached current or completed submitted settings, retaining integer model units. */
export function getRegionalSetup(state,source='current'){
 let config;
 if(source==='current'){
  config={scenario:state.scenario,mode:state.mode,presetId:state.presetId,draft:state.mode==='experiment'?state.experiment.draft:null};
 }else if(source==='last-run'){
  const run=state.run;
  if(run.status!=='done'||!run.scenarioAtQueue||!run.worldAtQueue)throw new Error('A completed regional run is required.');
  const seeds=replaySeeds();
  if(run.summaries.length!==seeds.length||run.summaries.some((summary,i)=>summary.seed!==seeds[i])||run.log?.seed!==seeds[0])throw new Error('The completed run does not match the regional replay seed and replication contract.');
  config={scenario:run.scenarioAtQueue,mode:'sandbox',presetId:run.worldAtQueue.presetId,draft:null};
 }else if(source==='last-experiment'){
  const ex=state.experiment;
  if(ex.status!=='done'||!ex.verdict||!ex.frozen)throw new Error('A completed regional experiment verdict is required.');
  const spec=ex.frozen.spec,preset=PRESETS.find(p=>p.scenario.name===spec.scenario.name);
  if(!preset)throw new Error('The submitted experiment does not name a shareable preset.');
  if(!spec.seeds.every((seed,i)=>seed===1000*spec.seed_set+1+i))throw new Error('The submitted experiment has an unsupported seed population.');
  config={scenario:spec.scenario,mode:'experiment',presetId:preset.id,draft:{
   question:spec.question,baselineScenario:spec.scenario,baselineSource:null,axis:spec.axis,axisSource:'user',primary:spec.primary,guardrails:spec.guardrails,seedCount:spec.seeds.length,seedSet:spec.seed_set,resamples:spec.resamples,
  }};
 }else throw new RangeError('Unknown regional setup source');
 const shared=structuredClone({model:'regional',config,options:{}}),draft=shared.config.draft;
 if(draft){
  omitInactiveThreshold(draft.primary,'margin_units','margin_text');
  if(Array.isArray(draft.guardrails))for(const ref of draft.guardrails)omitInactiveThreshold(ref,'max_harm_units','max_harm_text');
 }
 return shared;
}

/** Loads a validated regional setup without execution; the caller cancels pending host requests first. */
export function loadRegionalSetup(store,envelope){
 if(envelope?.model!=='regional')throw new TypeError('A regional setup is required');
 const {scenario,mode,presetId,draft}=structuredClone(envelope.config),preset=presetById(presetId);
 if(!preset||!['sandbox','learn','experiment'].includes(mode))throw new TypeError('Unsupported regional mode or preset');
 const dispatch=store.dispatch;
 dispatch({type:'playback/pause'});
 dispatch({type:'fork/close'});
 dispatch({type:'inspector/close'});
 dispatch({type:'reference/close'});
 if(draft!==null){
  dispatch({type:'experiment/fromPreset',presetId,scenario,draft});
  // fromPreset supplies its own provenance; restore the imported draft's actual provenance.
  dispatch({type:'experiment/draft',patch:{baselineSource:draft.baselineSource,axisSource:draft.axisSource}});
  dispatch({type:'mode/set',mode});
 }else{
  dispatch({type:'preset/select',presetId,scenario});
  dispatch({type:'mode/set',mode});
  const empty=createInitialState({presetId,scenario}).experiment.draft;
  dispatch({type:'experiment/draft',patch:empty});
  dispatch({type:'experiment/draft',patch:{axisSource:null}});
 }
 if(mode==='learn')dispatch({type:'learn/case',caseId:preset.learnCase??null,clock_s:preset.moments[0]?.clock_s??scenario.window.start_s});
 else dispatch({type:'clock/set',clock_s:scenario.window.start_s});
}
