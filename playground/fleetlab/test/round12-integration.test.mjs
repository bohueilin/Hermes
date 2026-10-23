import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {frozenExperiment} from './helpers/model-payloads.mjs';
import {mountStudio} from '../src/ui/studio.js';
import {CHAPTERS} from '../src/ui/present.js';
import {startRebalancing} from '../src/ui/rebalancing-app.js';
import {createInitialState,createStore} from '../src/ui/store.js';
import {defaultScenario} from '../src/model/schema.js';
import {moduleGraph,parseModule} from '../tools/pack.mjs';
import {COPY_MODULES,copyProblems,literalsOf} from '../tools/check-dist.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modulePath='src/ui/methodology-explainer.js';
const sourceRoot=fileURLToPath(new URL('../src',import.meta.url));

function studioFixture(){
 const restore=installFakeDom(),root=document.createElement('div');document.body.appendChild(root);
 const store=createStore(createInitialState({presetId:'bay_teaching_map',scenario:defaultScenario()}));
 const studio=mountStudio({root,store,playback:{pause(){}},present:{open(){},close(){}}});
 return {studio,store,frames:restore.dom.frames,close(){studio.destroy();restore();}};
}

test('Round 12 experiments lesson deep links keep one paired explainer without computing results',()=>{
 const x=studioFixture();try{
  for(const route of ['#/experiments','#/experiments?lesson=OPS-01','#/experiments?lesson=UC-08a']){
   x.studio.applyRoute(route);
   assert.equal(x.studio.element.getAttribute('data-page'),'depots',route);
   const intro=x.studio.element.querySelector('.workspace-intro');
   assert.equal(intro.querySelectorAll('[data-explainer-kind="paired"]').length,1,route);
   assert.equal(x.store.getState().run.log,null,'explanation does not prepare a run');
   assert.equal(x.store.getState().experiment.verdict,null,'explanation does not produce a verdict');
  }
  x.studio.navigate('operations');
  assert.equal(x.studio.element.querySelector('.workspace-intro [data-explainer-kind="paired"]'),null,'placement is the experiments page, not the neighboring workspace');
 }finally{x.close();}
});

test('Round 12 Fleet day explanation persists through lesson changes and stops when its route is hidden',()=>{
 const x=studioFixture();try{
  x.studio.applyRoute('#/fleet-day?lesson=staffing-readiness');
  const root=x.studio.operations.element,explainer=root.querySelector('[data-explainer-kind="guardrails"]');
  assert.ok(explainer);assert.equal(root.querySelector('.ops-result-summary').contains(explainer),false,'illustration is outside the accepted-result region');
  explainer.querySelector('[data-explainer-replay]').click();x.frames.flush(0);x.frames.flush(100);
  assert.equal(explainer.getAttribute('data-explainer-state'),'playing');
  assert.equal(x.studio.operations.getState().result,null,'Replay is presentation only');
  x.studio.navigate('overview');x.frames.flush(200);
  assert.notEqual(explainer.getAttribute('data-explainer-state'),'playing');
  x.studio.applyRoute('#/fleet-day?lesson=depot-count');
  assert.equal(root.querySelectorAll('[data-explainer-kind="guardrails"]').length,1);
  assert.equal(root.querySelector('[data-explainer-kind="guardrails"]'),explainer);
 }finally{x.close();}
});

test('Round 12 walkthrough examples occupy the two specified beats and do not overwrite invalid evidence',()=>{
 const restore=installFakeDom();try{
  const beats=CHAPTERS.flatMap(c=>c.beats),arms=beats.find(b=>b.key==='arms'),verdict=beats.find(b=>b.key==='verdict');
  const paired=arms.content({spec:{seeds:[1001]},verdictSeed:1001,pair:null}).find(n=>n.getAttribute('data-explainer-kind')==='paired');
  assert.ok(paired);
  const frozen=frozenExperiment({presetId:'OPS-01',replications:20});
  const nodes=verdict.content({frozen,verdict:{validity:'INVALID_EXPERIMENT',invalidity_reason:'NOT_COMPARABLE',invalidity_detail:null,outcome:null,recommendation:'NO_RECOMMENDATION'}});
  const illustration=nodes.find(n=>n.getAttribute('data-explainer-kind')==='guardrails'),readout=nodes.find(n=>n.classList.contains('fl-readout'));
  assert.ok(illustration);assert.ok(readout);
  assert.match(illustration.textContent,/Illustration · not simulation output/);
  assert.match(readout.textContent,/INVALID_EXPERIMENT/);assert.match(readout.textContent,/NO_RECOMMENDATION/);
  assert.equal(readout.querySelector('[data-explainer-kind]'),null,'teaching HOLD stays outside the accepted gate readout');
 }finally{restore();}
});

test('Round 12 rebalancing Replay leaves the existing study worker request count unchanged',()=>{
 const restore=installFakeDom();let app;try{
  for(const m of read('rebalancing/index.html').matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const n=document.createElement(m[1]);n.id=m[2];document.body.appendChild(n);}
  const hero=document.createElement('section');hero.className='r1-hero';document.body.appendChild(hero);
  for(let i=0;i<6;i++){const n=document.createElement('button');n.setAttribute('data-chapter',i);document.body.appendChild(n);}
  const messages=[],worker={postMessage:m=>messages.push(m),terminate(){}};
  app=startRebalancing({createWorker:()=>worker});
  const explainer=hero.querySelector('[data-explainer-kind="deadhead"]');assert.ok(explainer);
  assert.equal(messages.length,1,'only the pre-existing checked-study request starts');
  explainer.querySelector('[data-explainer-replay]').click();restore.dom.frames.flush(0);restore.dom.frames.flush(17000);
  assert.equal(messages.length,1,'Replay never starts or changes a model');
  assert.equal(explainer.getAttribute('data-empty-distance'),'45');assert.equal(explainer.getAttribute('data-total-distance'),'100');
 }finally{app?.dispose();restore();}
});

test('Round 12 explainer source is captured by root and R1 graphs but does not enter the NF-03 module closure',()=>{
 const paths=entry=>new Set(moduleGraph(fileURLToPath(new URL('../'+entry,import.meta.url)),sourceRoot).order.map(x=>x.label));
 assert.ok(paths('src/ui/app.js').has(modulePath));
 assert.ok(paths('src/ui/rebalancing-app.js').has(modulePath));
 assert.equal(paths('src/ui/capacity-app.js').has(modulePath),false);
 const source=read(modulePath),parsed=parseModule(source,modulePath);
 assert.deepEqual(parsed.imports.map(x=>x.specifier),['./dom.js'],'presentation has no model, runtime or evidence imports');
 assert.doesNotMatch(source,/\b(?:new\s+Worker|fetch\s*\(|simulate\w*\s*\(|runRebalancing\s*\()/);
 assert.ok(COPY_MODULES.includes(modulePath));
 assert.deepEqual(copyProblems(literalsOf(source).map(text=>({where:modulePath+' string',text}))),[]);
});

test('Round 12 shared and standalone explainer CSS copies are byte-identical and do not add autonomous motion',()=>{
 const block=source=>{const match=source.match(/\/\* Methodology explainers\. \*\/[\s\S]*?\/\* End methodology explainers\. \*\//);assert.ok(match,'bounded explainer block exists');return match[0];};
 const shared=block(read('styles.css')),r1=block(read('rebalancing/visual.css'));
 assert.equal(shared,r1);
 assert.doesNotMatch(shared,/@keyframes|\banimation(?:-name)?\s*:/,'all explanatory motion is owned by the pausable component clock');
});
