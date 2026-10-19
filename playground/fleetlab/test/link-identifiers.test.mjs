import test from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {displayText} from '../src/ui/display-text.js';
import {pretty} from '../src/ui/rebalancing-view.js';
import {createLaunchPanel} from '../src/ui/launch-view.js';
import {createRegionalPowerPanel} from '../src/ui/regional-power-view.js';
import {createSetup,encodeSetup,decodeSetup} from '../src/ui/setup-codec.js';
import {advancedOperationsDemoConfig,freezeBayExperiment} from '../src/model/bay-experiment-contract.js';
import {createLaunchConfig} from '../src/model/launch-rehearsal.js';
import {regionalPowerDemoConfig} from '../src/model/regional-power.js';
import {validateDraft} from '../src/model/experiment.js';
import {PRESETS} from '../src/model/presets.js';

// Share links may carry any identifier the codec's id rules accept, including Object.prototype names.
const NAMES=['constructor','__proto__','toString','valueOf','hasOwnProperty'];
const launchLink=(port,region='peninsula')=>{
  const config=createLaunchConfig(region),old=JSON.stringify(config.launch.depots[0].ports[0].id);
  const renamed=JSON.parse(JSON.stringify(config).split(old).join(JSON.stringify(port)));
  return decodeSetup(encodeSetup(createSetup({model:'launch-rehearsal',config:renamed,options:{delay:60}})));
};

test('display words treat prototype names as plain text',()=>{
  for(const name of NAMES){assert.equal(displayText(name),name);assert.equal(pretty(name),name);}
});

test('a prototype-named treatment is refused with a RangeError',()=>{
  for(const treatment of NAMES){
    assert.throws(()=>freezeBayExperiment(advancedOperationsDemoConfig('charging'),{treatment}),RangeError);
    const options={treatment,seeds:[1001],tuning_seeds:[42,43,44],margin:.02,resamples:1000,null_treatment:true};
    assert.throws(()=>createSetup({model:'fleet-day',config:advancedOperationsDemoConfig('charging'),options}),/supported single treatment/);
  }
});

test('a launch link with a prototype-named port loads as text, and the next valid link still loads',()=>{
  const restore=installFakeDom();try{
    const panel=createLaunchPanel();
    for(const name of NAMES){
      panel.loadSharedSetup(launchLink(name));
      assert.equal(panel.getState().config.launch.depots[0].ports[0].id,name);
      assert.ok(panel.element.textContent.includes(name));assert.doesNotMatch(panel.element.textContent,/native code/);
      panel.chooseTemplate('region_b');assert.equal(panel.validate().ok,true);
    }
    panel.loadSharedSetup(launchLink('port-1','region_b'));assert.equal(panel.getState().config.launch.region.id,'region_b');panel.destroy();
  }finally{restore();}
});

test('a launch setup that fails to render leaves the previous setup in place',()=>{
  const restore=installFakeDom();try{
    const panel=createLaunchPanel(),before=panel.getState().config,create=document.createElement;let armed=true;
    document.createElement=function(tag){if(tag==='h4'&&armed){armed=false;throw new TypeError('render failed');}return create.call(this,tag);};
    try{assert.throws(()=>panel.loadSharedSetup(launchLink('port-1','region_b')),/render failed/);}finally{document.createElement=create;}
    assert.deepEqual(panel.getState().config,before);
    assert.equal(panel.element.querySelector('[aria-label="Launch region template"]').value,'peninsula');
    assert.equal(armed,false);assert.ok(panel.element.textContent.includes(before.launch.depots[0].id));
    panel.chooseTemplate('region_b');assert.equal(panel.validate().ok,true);panel.destroy();
  }finally{restore();}
});

test('a regional power run with a prototype-named condition reads as a custom condition',async()=>{
  const restore=installFakeDom(),panel=createRegionalPowerPanel();try{
    const config=regionalPowerDemoConfig();config.duration_hours=1;
    config.site_power_profile.segments=[{start_minute:0,end_minute:60,fraction:.5}];config.site_power_profile.condition_id='constructor';
    panel.loadSharedSetup({model:'regional-power',config,options:{treatment:'charging_deadlines',seeds:[1001],tuning_seeds:[42,43,44],margin:.02,resamples:1000,null_treatment:true}});
    assert.ok(await panel.run());
    const text=panel.element.querySelector('.regional-power-results').textContent;
    assert.match(text,/Custom power condition/);assert.doesNotMatch(text,/native code/);
  }finally{panel.destroy();restore();}
});

test('a null scope window is a setup error, not an exception',()=>{
  const draft=structuredClone(PRESETS.find(p=>p.experiment).experiment);draft.guardrails[0].scope={window:null};
  const result=validateDraft(draft);
  assert.equal(result.ok,false);assert.ok(result.errors.some(e=>e.check==='scopes valid'));
});
