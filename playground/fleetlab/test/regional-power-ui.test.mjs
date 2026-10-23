import test from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {regionalPowerDemoConfig} from '../src/model/regional-power.js';
import {createOperationsLab} from '../src/ui/operations-lab.js';
import {createSetup,encodeSetup,decodeSetup} from '../src/ui/setup-codec.js';

const options={treatment:'charging_deadlines',seeds:[1001],tuning_seeds:[42,43,44],margin:.02,resamples:1000,null_treatment:true};
test('Fleet day accepts a regional setup without executing, and keeps Bay inputs intact',async()=>{
  const restore=installFakeDom(),lab=createOperationsLab({reducedMotion:()=>true});try{
    const bay=lab.getSharedSetup(),setup={model:'regional-power',config:regionalPowerDemoConfig(),options};
    lab.loadSharedSetup(decodeSetup(encodeSetup(createSetup(setup))));
    assert.equal(lab.element.querySelector('[aria-label="Regional power condition"]').value,'moderate');
    assert.deepEqual(lab.getSharedSetup('current','regional-power'),setup);assert.deepEqual(lab.getSharedSetup(),bay);
    assert.match(lab.element.textContent,/Austin-inspired/);assert.match(lab.element.textContent,/Schematic graph/);
    assert.equal(lab.getState().result,null);assert.throws(()=>lab.getSharedSetup('last-run','regional-power'),/run/i);
  }finally{lab.destroy();restore();}
});
test('regional panel records exact submissions, preserves last-run after edits and cancels pending results',async()=>{
  const {createRegionalPowerPanel}=await import('../src/ui/regional-power-view.js');
  const restore=installFakeDom(),p=createRegionalPowerPanel();try{
    p.loadSharedSetup({model:'regional-power',config:regionalPowerDemoConfig(),options});
    const run=await p.run();assert.equal(run.extensions.validity,'VALID');
    const view=p.element.querySelector('.regional-power-results');
    for(const label of ['Unfinished required tasks','Terminal fleet energy','Ready by deadline','Not available','Recorded minute'])assert.ok(view.textContent.includes(label),label);
    const before=p.getSharedSetup('last-run'),field=p.element.querySelector('[aria-label="Regional nominal site power (kW)"]');field.value='90';field.dispatchEvent(new Event('input'));
    assert.equal(p.getSharedSetup().config.site_power_kw,90);assert.deepEqual(p.getSharedSetup('last-run'),before);
    assert.equal(p.getState().stale,true);assert.match(p.element.textContent,/previous settings/i);
    const pending=p.run();p.cancel();await pending;assert.deepEqual(p.getSharedSetup('last-run'),before);
    const comparison=await p.compare();assert.equal(comparison.validity,'VALID');assert.equal(comparison.analysis,null);
    assert.match(p.element.textContent,/One seed is descriptive/);assert.deepEqual(p.getSharedSetup('last-experiment').options,options);
  }finally{p.destroy();restore();}
});
test('a shared short horizon shows its actual condition and supports recorded-minute inspection',async()=>{
  const {createRegionalPowerPanel}=await import('../src/ui/regional-power-view.js');
  const restore=installFakeDom(),p=createRegionalPowerPanel();try{
    const config=regionalPowerDemoConfig();config.duration_hours=1;config.site_power_profile.segments=[{start_minute:0,end_minute:60,fraction:.5}];
    p.loadSharedSetup({model:'regional-power',config,options});const r=await p.run();assert.ok(r);
    assert.match(p.element.querySelector('.regional-power-results').textContent,/Recorded minute 60/);
    assert.doesNotMatch(p.element.textContent,/Eight-hour rehearsal/);
    const condition=p.element.querySelector('[aria-label="Regional power condition"]');condition.value='full';condition.dispatchEvent(new Event('change'));
    assert.equal(p.getSharedSetup().config.duration_hours,1);assert.ok(await p.run());
    assert.deepEqual(p.getSharedSetup().config.site_power_profile.segments,[{start_minute:0,end_minute:60,fraction:1}]);
  }finally{p.destroy();restore();}
});
