import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,createStore} from '../src/ui/store.js';
import {getRegionalSetup,loadRegionalSetup} from '../src/ui/regional-setup.js';
import {presetById,PRESET_SEED_SET,seedSet} from '../src/model/presets.js';
import {freezeSpec} from '../src/model/experiment.js';
import {presetDraft,renderSetup,specDraftOf} from '../src/ui/experiment.js';
import {SANDBOX_REPLICATIONS} from '../src/ui/app.js';
import {createSetup,decodeSetup,encodeSetup} from '../src/ui/setup-codec.js';
import {installFakeDom} from './helpers/fake-dom.mjs';

const clone=value=>structuredClone(value);
function makeStore(id='L3'){
 return createStore(createInitialState({presetId:id,scenario:clone(presetById(id).scenario)}));
}
function completeRun(store){
 store.dispatch({type:'run/queued',id:'replay-1',total:5});
 store.dispatch({type:'run/done',id:'replay-1',payload:{runs:[1001,1002,1003,1004,1005].map(seed=>({seed,metrics:{},series:{},world_digest:String(seed),invariant_violations:[]})),log:{seed:1001,events:[]}}});
}
function completeExperiment(store){
 const preset=presetById('L3');
 store.dispatch({type:'experiment/fromPreset',presetId:preset.id,scenario:clone(preset.scenario),draft:presetDraft(preset.id)});
 store.dispatch({type:'experiment/draft',patch:{seedSet:3,seedCount:10,resamples:5000}});
 const frozen=freezeSpec(specDraftOf(store.getState().experiment.draft));
 store.dispatch({type:'experiment/freeze',...frozen,frozenAt:'12:00',id:'experiment-1'});
 store.dispatch({type:'experiment/verdict',id:'experiment-1',payload:{digest:frozen.digest,verdict:{validity:'VALID',outcome:'UNCHANGED',recommendation:'HOLD',primary:{paired_deltas:Array(10).fill(0)}}}});
 return frozen;
}

test('regional current setup is detached and excludes results, session history, and hidden experiment drafts',()=>{
 const store=makeStore();completeExperiment(store);store.dispatch({type:'mode/set',mode:'sandbox'});completeRun(store);
 const shared=getRegionalSetup(store.getState());
 assert.deepEqual(Object.keys(shared).sort(),['config','model','options']);
 assert.deepEqual(Object.keys(shared.config).sort(),['draft','mode','presetId','scenario']);
 assert.equal(shared.model,'regional');assert.deepEqual(shared.options,{});
 assert.equal(shared.config.mode,'sandbox');assert.equal(shared.config.draft,null);
 shared.config.scenario.sigma_permille=777;
 assert.notEqual(store.getState().scenario.sigma_permille,777);
 assert.equal(SANDBOX_REPLICATIONS,5);
 assert.deepEqual(seedSet(PRESET_SEED_SET,SANDBOX_REPLICATIONS),[1001,1002,1003,1004,1005]);
});

test('last regional replay uses submitted scenario and preset after current settings change',()=>{
 const store=makeStore();completeRun(store);const submitted=clone(store.getState().scenario);
 store.dispatch({type:'preset/select',presetId:'UC-08a',scenario:clone(presetById('UC-08a').scenario)});
 const shared=getRegionalSetup(store.getState(),'last-run');
 assert.equal(shared.config.presetId,'L3');assert.equal(shared.config.mode,'sandbox');assert.equal(shared.config.draft,null);
 assert.deepEqual(shared.config.scenario,submitted);
 shared.config.scenario.sigma_permille=999;
 assert.notEqual(store.getState().run.scenarioAtQueue.sigma_permille,999);
});

test('last regional replay refuses pending snapshots and incomplete replication populations',()=>{
 const store=makeStore();
 assert.throws(()=>getRegionalSetup(store.getState(),'last-run'),/completed|run/i);
 completeRun(store);store.dispatch({type:'run/queued',id:'pending',total:5});
 assert.throws(()=>getRegionalSetup(store.getState(),'last-run'),/completed|run/i);
 store.dispatch({type:'run/done',id:'pending',payload:{runs:[{seed:1001,metrics:{},series:{},invariant_violations:[]}],log:{seed:1001,events:[]}}});
 assert.throws(()=>getRegionalSetup(store.getState(),'last-run'),/seed|replication/i);
 assert.throws(()=>getRegionalSetup(store.getState(),'other'),/source/i);
});

test('last experiment restores the complete frozen scope, thresholds, axis and seeds after draft replacement',()=>{
 const store=makeStore();const frozen=completeExperiment(store);
 store.dispatch({type:'experiment/fromPreset',presetId:'UC-08a',scenario:clone(presetById('UC-08a').scenario),draft:presetDraft('UC-08a')});
 const shared=getRegionalSetup(store.getState(),'last-experiment');
 assert.equal(shared.config.mode,'experiment');assert.equal(shared.config.presetId,'L3');
 assert.deepEqual(shared.config.scenario,frozen.spec.scenario);
 const d=shared.config.draft;
 assert.equal(d.seedSet,3);assert.equal(d.seedCount,10);assert.equal(d.resamples,5000);
 assert.deepEqual(d.primary.scope,{area:'SF',window:{start_s:111600,end_s:118800}});
 assert.equal(d.primary.margin_units,60);
 assert.deepEqual(d.guardrails[1].scope,{depot:'SJ-1'});
 assert.deepEqual(d.axis,{id:'policy:depot_assignment',baseline:'home_depot',candidate:'nearest_depot'});
 assert.equal(freezeSpec(specDraftOf(d)).digest,frozen.digest);
 d.primary.scope.area='SJ';
 assert.equal(store.getState().experiment.frozen.spec.primary.scope.area,'SF');
});

test('last experiment sharing requires a completed verdict, not a pending frozen spec',()=>{
 const store=makeStore();
 assert.throws(()=>getRegionalSetup(store.getState(),'last-experiment'),/completed|experiment/i);
 const frozen=freezeSpec(presetById('L3').experiment);
 store.dispatch({type:'experiment/freeze',...frozen,frozenAt:'12:00',id:'pending'});
 assert.throws(()=>getRegionalSetup(store.getState(),'last-experiment'),/completed|experiment/i);
});

test('loading an experiment keeps previous results stale, restores the full draft, and only dispatches setup actions',()=>{
 const source=makeStore();completeExperiment(source);const setup=getRegionalSetup(source.getState(),'current');
 const target=makeStore('UC-08a');completeRun(target);completeExperiment(target);
 const before=target.getState(),verdict=before.experiment.verdict,log=before.run.log;
 target.dispatch({type:'playback/play'});target.dispatch({type:'inspector/open',target:{depot:'SF-1'}});
 const actions=[];target.subscribe((state,action)=>actions.push(action.type));
 loadRegionalSetup(target,setup);
 const after=target.getState();
 assert.equal(after.playing,false);assert.equal(after.inspector,null);assert.equal(after.fork.status,'closed');
 assert.equal(after.run.log,log);assert.equal(after.run.stale,true);
 assert.equal(after.experiment.verdict,verdict);assert.equal(after.experiment.verdictStale,true);
 assert.deepEqual(after.scenario,setup.config.scenario);
 assert.deepEqual(after.experiment.draft,setup.config.draft);
 assert.equal(after.mode,'experiment');
 assert.ok(actions.every(type=>!['run/queued','fork/open','experiment/freeze','experiment/verdict','present/open'].includes(type)));
 setup.config.scenario.sigma_permille=999;setup.config.draft.seedCount=100;
 assert.notEqual(target.getState().scenario.sigma_permille,999);assert.equal(target.getState().experiment.draft.seedCount,10);
});

test('loading a Learn setup restores its case and full scenario without rerunning it',()=>{
 const target=makeStore('UC-08a');const config={scenario:clone(presetById('L2b').scenario),mode:'learn',presetId:'L2b',draft:null};
 config.scenario.sigma_permille=125;
 loadRegionalSetup(target,{model:'regional',config,options:{}});
 assert.equal(target.getState().learn.case,'L2');assert.equal(target.getState().learn.moment,0);
 assert.equal(target.getState().scenario.sigma_permille,125);
 assert.equal(target.getState().mode,'learn');assert.equal(target.getState().run.status,'idle');
 assert.equal(target.getState().playing,false);
});

test('loading a sandbox setup clears a prior experiment draft without removing its stale verdict',()=>{
 const target=makeStore();completeExperiment(target);const verdict=target.getState().experiment.verdict;
 loadRegionalSetup(target,{model:'regional',config:{scenario:clone(presetById('UC-08a').scenario),mode:'sandbox',presetId:'UC-08a',draft:null},options:{}});
 assert.equal(target.getState().mode,'sandbox');assert.equal(target.getState().experiment.draft.axis,null);
 assert.equal(target.getState().experiment.draft.question,'');assert.equal(target.getState().experiment.verdict,verdict);
 assert.equal(target.getState().experiment.verdictStale,true);
});

test('editing a guardrail in the real setup UI shares exact text thresholds through the codec without changing the spec',()=>{
 const restore=installFakeDom();
 try{
  const store=makeStore();completeExperiment(store);
  const view=renderSetup(store.getState(),{dispatch:store.dispatch,ui:{open:new Set()},rerender(){},onFreeze(){throw new Error('Sharing must not run an experiment');}});
  document.body.appendChild(view);
  const input=view.querySelector('[data-focus-key="guardrail-2-threshold"]');
  input.value='0.015000';input.dispatchEvent(new Event('input',{bubbles:true}));
  const edited=store.getState().experiment.draft;
  assert.equal(edited.guardrails[2].max_harm_text,'0.015000');
  assert.equal(Object.hasOwn(edited.guardrails[2],'max_harm_units'),true);
  assert.equal(edited.guardrails[2].max_harm_units,undefined);
  const frozen=freezeSpec(specDraftOf(edited));
  assert.equal(frozen.spec.guardrails[2].max_harm_units,15000);
  const decoded=decodeSetup(encodeSetup(createSetup(getRegionalSetup(store.getState()))));
  assert.equal(decoded.config.draft.guardrails[2].max_harm_text,'0.015000');
  assert.equal(Object.hasOwn(decoded.config.draft.guardrails[2],'max_harm_units'),false);
  const target=makeStore();loadRegionalSetup(target,decoded);
  assert.equal(freezeSpec(specDraftOf(target.getState().experiment.draft)).digest,frozen.digest);
  assert.equal(Object.hasOwn(edited.guardrails[2],'max_harm_units'),true,'sharing does not alter the source store');
 }finally{restore();}
});

test('sharing removes only inactive undefined threshold alternatives, including exact zero units',()=>{
 for(const [field,threshold] of [
  ['primary',{margin_units:undefined,margin_text:'61'}],
  ['primary',{margin_text:undefined,margin_units:61}],
  ['guardrail',{max_harm_text:undefined,max_harm_units:0}],
 ]){
  const store=makeStore();completeExperiment(store);
  if(field==='primary')store.dispatch({type:'experiment/draft',patch:{primary:{...store.getState().experiment.draft.primary,...threshold}}});
  else store.dispatch({type:'experiment/guardrailUpdate',index:2,patch:threshold});
  const expected=freezeSpec(specDraftOf(store.getState().experiment.draft));
  const decoded=decodeSetup(encodeSetup(createSetup(getRegionalSetup(store.getState()))));
  assert.equal(freezeSpec(specDraftOf(decoded.config.draft)).digest,expected.digest);
 }
});

test('sharing still rejects unrelated undefined fields and thresholds with no active alternative',()=>{
 for(const patch of [{direction:undefined},{margin_units:undefined,margin_text:undefined}]){
  const store=makeStore();completeExperiment(store);
  store.dispatch({type:'experiment/draft',patch:{primary:{...store.getState().experiment.draft.primary,...patch}}});
  assert.throws(()=>createSetup(getRegionalSetup(store.getState())),/plain JSON/i);
 }
});
