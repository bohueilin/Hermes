import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreetLab} from '../src/ui/street-lab.js';
import {defaultStreetConfig} from '../src/model/street-simulation.js';
import {installFakeDom} from './helpers/fake-dom.mjs';

async function withLab(fn){
 const restore=installFakeDom();
 const canceled=[];
 const lab=createStreetLab({requestFrame:()=>123,cancelFrame:id=>canceled.push(id),reducedMotion:()=>false});
 document.body.appendChild(lab.element);
 try{await fn(lab,canceled);}finally{lab.destroy();restore();}
}
const quick={duration_minutes:10,background_per_hour:0,requests_per_hour:0};

test('street shares separate current controls from the submitted result and detach their configs',()=>withLab(async lab=>{
 assert.throws(()=>lab.getSharedSetup('last-run'),/run/i);
 lab.setConfig({...quick,seed:321});
 await lab.run();
 lab.setConfig({seed:987,weather:'rain'});
 const current=lab.getSharedSetup(),submitted=lab.getSharedSetup('last-run');
 assert.equal(current.model,'street-lab');
 assert.deepEqual(current.options,{});
 assert.equal(current.config.seed,987);
 assert.equal(submitted.config.seed,321);
 assert.equal(submitted.config.weather,'clear');
 current.config.seed=1;submitted.config.seed=2;
 assert.equal(lab.getSharedSetup().config.seed,987);
 assert.equal(lab.getState().run.config.seed,321);
 assert.throws(()=>lab.getSharedSetup('unknown'),/source/i);
}));

test('loading street settings replaces all controls, pauses, and keeps an existing result visibly stale',()=>withLab(async(lab,canceled)=>{
 lab.setConfig({...quick,seed:321,weather:'rain',fleet_size:12});await lab.run();
 const previous=lab.getState().run;
 lab.element.querySelector('.street-playback button').click();
 const setup={model:'street-lab',config:{...defaultStreetConfig(),...quick,hotspot:'stockton',seed:678},options:{}};
 lab.loadSharedSetup(setup);
 assert.equal(lab.getState().run,previous);
 assert.equal(lab.getState().playing,false);
 assert.equal(lab.getState().stale,true);
 assert.equal(lab.getState().busy,false);
 assert.ok(canceled.includes(123));
 assert.equal(lab.element.querySelector('[aria-label="Street weather"]').value,'clear');
 assert.equal(lab.element.querySelector('[aria-label="Available AVs"]').value,'24');
 assert.equal(lab.element.querySelector('[aria-label="Street demand seed"]').value,'678');
 assert.match(lab.element.querySelector('.street-status').textContent,/previous run/i);
 assert.match(lab.element.querySelector('.street-replay h2').textContent,/street loses throughput/);
 setup.config.seed=0;
 assert.equal(lab.getSharedSetup().config.seed,678);
 assert.equal(lab.getSharedSetup('last-run').config.seed,321);
}));

test('loading a setup discards pending street output without running or leaving controls disabled',()=>withLab(async lab=>{
 lab.setConfig(quick);
 const pending=lab.run(true);
 lab.loadSharedSetup({model:'street-lab',config:{...defaultStreetConfig(),...quick,seed:678},options:{}});
 await pending;
 assert.equal(lab.getState().run,null);
 assert.equal(lab.getState().playing,false);
 assert.equal(lab.getState().busy,false);
 assert.equal(lab.element.querySelector('fieldset').disabled,false);
 assert.equal(lab.element.querySelector('.street-replay-variant').hidden,true);
 assert.match(lab.element.querySelector('.street-status').textContent,/run/i);
 assert.equal(lab.getSharedSetup().config.seed,678);
 await lab.run();
 assert.equal(lab.getState().run.config.seed,678);
}));

test('loading during a pending rerun preserves the prior result instead of installing the superseded result',()=>withLab(async lab=>{
 lab.setConfig({...quick,seed:123});await lab.run();
 const previous=lab.getState().run;
 lab.setConfig({seed:456});const pending=lab.run(true);
 lab.loadSharedSetup({model:'street-lab',config:{...defaultStreetConfig(),...quick,seed:789},options:{}});
 await pending;
 assert.equal(lab.getState().run,previous);
 assert.equal(lab.getState().stale,true);
 assert.equal(lab.getSharedSetup('last-run').config.seed,123);
 assert.equal(lab.element.querySelector('.street-replay-variant').hidden,true);
}));

test('street result provenance and exact details describe the submitted run even after edits and in the download',()=>withLab(async lab=>{
 lab.setConfig({...quick,seed:321});await lab.run();
 const run=lab.getState().run;
 lab.setConfig({seed:999,weather:'rain'});
 const provenance=lab.element.querySelector('.street-result-provenance');
 assert.ok(provenance,'result has a compact provenance line');
 for(const value of [run.version,run.network_version,'321','NOT_EVIDENCE','NONE'])assert.ok(provenance.textContent.includes(String(value)),String(value));
 const detail=JSON.parse(lab.element.querySelector('.street-result-details pre').textContent);
 assert.deepEqual(detail.config,run.config);
 assert.deepEqual(detail.summary,run.summary);
 assert.deepEqual(detail.metadata,{model_version:run.version,network_version:run.network_version,seed:321,evidence_status:'NOT_EVIDENCE',authority:'NONE'});
 let exported;
 document.body.addEventListener('click',event=>{
  if(event.target.getAttribute('download')==='fleetlab-street-experiment.json')exported=JSON.parse(decodeURIComponent(event.target.getAttribute('href').split(',')[1]));
 });
 lab.element.querySelectorAll('button').find(b=>b.textContent==='Download experiment results').click();
 assert.deepEqual(exported.metadata,detail.metadata);
 assert.deepEqual(exported.config,run.config);
 assert.deepEqual(exported.summary,run.summary);
 assert.equal(exported.version,run.version);
}));
