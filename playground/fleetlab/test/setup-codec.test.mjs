import test from 'node:test';
import assert from 'node:assert/strict';
import {createSetup, encodeSetup, decodeSetup, MAX_SETUP_LENGTH} from '../src/ui/setup-codec.js';
import {defaultBayAreaConfig, depotReadinessDemoConfig, simulateBayAreaOperations} from '../src/model/bay-operations.js';
import {advancedOperationsDemoConfig, freezeBayExperiment} from '../src/model/bay-experiment-contract.js';
import {createLaunchConfig} from '../src/model/launch-rehearsal.js';
import {defaultStreetConfig, simulateStreets} from '../src/model/street-simulation.js';
import {STREET_NETWORK} from '../src/model/street-network.js';
import {PRESETS, DEFAULT_PRESET_ID} from '../src/model/presets.js';
import {defaultScenario} from '../src/model/schema.js';

const copy = value => structuredClone(value);
const raw = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const paired = {treatment:'charging_redistribution', seeds:[1001,1002], tuning_seeds:[42,43], margin:.02, resamples:1000, null_treatment:false};
const regional = () => ({scenario:defaultScenario(), mode:'sandbox', presetId:DEFAULT_PRESET_ID, draft:null});
function regionalExperiment(preset) {
  const x = copy(preset.experiment);
  return {scenario:copy(preset.scenario), mode:'experiment', presetId:preset.id, draft:{
    question:x.question, baselineScenario:x.scenario, baselineSource:{presetId:preset.id}, axis:x.axis, axisSource:'preset',
    primary:x.primary, guardrails:x.guardrails, seedCount:x.seeds.length, seedSet:x.seed_set, resamples:x.resamples,
  }};
}
const cases = [
  ['fleet-day',defaultBayAreaConfig(),{}],
  ['fleet-day',depotReadinessDemoConfig(),{}],
  ['fleet-day',advancedOperationsDemoConfig('charging'),paired],
  ['fleet-day',advancedOperationsDemoConfig('resources'),{...paired,treatment:'resource_freshness'}],
  ['fleet-day',advancedOperationsDemoConfig('airport'),{...paired,treatment:'airport_forecast'}],
  ['street-lab',defaultStreetConfig(),{}],
  ['launch-rehearsal',createLaunchConfig('peninsula'),{delay:60}],
  ['launch-rehearsal',createLaunchConfig('region_b'),{delay:120}],
  ['regional',regional(),{}],
];

for (const [index,[model,config,options]] of cases.entries()) test(`setup round trip retains every ${model} input (${index})`, () => {
  const input = {model,config:copy(config),options:copy(options)};
  const original = copy(input);
  const envelope = createSetup(input), encoded = encodeSetup(envelope), decoded = decodeSetup(encoded);
  assert.ok(encoded.length <= MAX_SETUP_LENGTH);
  assert.match(encoded,/^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decoded.config,original.config);
  assert.deepEqual(decoded.options,original.options);
  assert.deepEqual(decoded,envelope);
  assert.equal(encodeSetup(decoded),encoded);
  assert.equal(encodeSetup({...envelope,config:Object.fromEntries(Object.entries(config).reverse())}),encoded);
  assert.deepEqual(input,original);
  assert.notEqual(envelope.config,input.config);
  assert.notEqual(decoded.config,envelope.config);
});

test('all registered regional experiment setups fit and preserve the exact declared draft', () => {
  for (const preset of PRESETS.filter(p=>p.experiment)) {
    const config=regionalExperiment(preset), envelope=createSetup({model:'regional',config});
    assert.deepEqual(decodeSetup(encodeSetup(envelope)).config,config,preset.id);
  }
});

test('shared finite Bay replay reproduces the recorded demand and metrics without changing the input', () => {
  const config={...defaultBayAreaConfig(),fleet_size:3,duration_hours:.25,requests_per_hour:20};
  const original=simulateBayAreaOperations(config), restored=decodeSetup(encodeSetup(createSetup({model:'fleet-day',config})));
  const replay=simulateBayAreaOperations(restored.config);
  assert.deepEqual(replay.metrics,original.metrics);
  assert.equal(replay.demand_signature,original.demand_signature);
});

test('Street codec versions agree with the producer and bundled network', () => {
  const config={...defaultStreetConfig(),fleet_size:1,duration_minutes:10,requests_per_hour:0,background_per_hour:0};
  const envelope=createSetup({model:'street-lab',config});
  const recorded=simulateStreets(config,STREET_NETWORK);
  assert.equal(envelope.versions.producer,recorded.version);
  assert.equal(envelope.versions.network,recorded.network_version);
});

test('rejects unsupported schema, model, versions, top-level keys and incomplete envelopes', () => {
  const good=createSetup({model:'fleet-day',config:defaultBayAreaConfig()});
  for (const mutated of [{...good,schema:'future'}, {...good,model:'unknown'}, {...good,extra:true}, {...good,versions:{}}, {...good,versions:{...good.versions,unknown:'v1'}}]) assert.throws(()=>decodeSetup(raw(mutated)));
  for (const key of Object.keys(good.versions)) assert.throws(()=>decodeSetup(raw({...good,versions:{...good.versions,[key]:'unsupported'}})),/version/i);
  for (const key of Object.keys(good)) {const bad=copy(good);delete bad[key];assert.throws(()=>encodeSetup(bad));}
  assert.throws(()=>createSetup({model:'fleet-day',config:defaultBayAreaConfig(),versions:{producer:'user'}}),/unknown/i);
});

test('rejects unknown and missing fields at every config layer', () => {
  for (const [model,config,options] of cases) {
    assert.throws(()=>createSetup({model,config:{...config,unknown:1},options}),/unknown/i);
    for (const key of Object.keys(config)) {
      if (['readiness','charging','resources','airport'].includes(key)) continue;
      const bad=copy(config);delete bad[key];assert.throws(()=>createSetup({model,config:bad,options}),`${model} missing ${key}`);
    }
  }
  for (const path of [c=>c.vehicle_profiles.ipace,c=>c.readiness,c=>c.charging,c=>c.resources,c=>c.launch,c=>c.launch.region,c=>c.launch.region.places[0],c=>c.launch.depots[0],c=>c.launch.depots[0].calendar,c=>c.launch.depots[0].tasks[0],c=>c.launch.depots[0].ports[0],c=>c.launch.events[0]]) {
    const bad=createLaunchConfig();path(bad).unknown=true;
    assert.throws(()=>createSetup({model:'launch-rehearsal',config:bad,options:{delay:60}}),/unknown/i);
  }
});

test('rejects malformed, oversized, deeply nested and dangerous payloads before producer consumption', () => {
  for (const input of ['', '%%%', 'a', raw('{'), raw('null'), 'a'.repeat(MAX_SETUP_LENGTH+1)]) assert.throws(()=>decodeSetup(input));
  const envelope=createSetup({model:'fleet-day',config:defaultBayAreaConfig()});
  for (const key of ['__proto__','constructor','prototype']) {
    const text=JSON.stringify(envelope).replace('"config":{',`"config":{"${key}":{},`);
    assert.throws(()=>decodeSetup(raw(text)),/dangerous/i);
  }
  assert.throws(()=>decodeSetup(raw('{"x":'.repeat(40)+'0'+'}'.repeat(40))),/depth|nest/i);
  assert.throws(()=>decodeSetup(raw({x:Array(13000).fill(0)})),/limit|large|count|size/i);
  assert.throws(()=>createSetup({model:'fleet-day',config:{...defaultBayAreaConfig(),unknown:'x'.repeat(MAX_SETUP_LENGTH)}}),/limit|large|length|size/i);
  for (const value of [Infinity,NaN,-Infinity,undefined,()=>{},-0]) assert.throws(()=>createSetup({model:'fleet-day',config:{...defaultBayAreaConfig(),seed:value}}));
  const getter=defaultBayAreaConfig();Object.defineProperty(getter,'seed',{enumerable:true,get(){assert.fail('accessors must not run');}});
  assert.throws(()=>createSetup({model:'fleet-day',config:getter}),/plain|accessor|data/i);
  const circular=defaultBayAreaConfig();circular.extra=circular;
  assert.throws(()=>createSetup({model:'fleet-day',config:circular}),/nest|cycle|depth/i);
});

test('preserves paired semantics and rejects nested options, invalid ranges and cross-model options', () => {
  const config=advancedOperationsDemoConfig('charging');
  const restored=decodeSetup(encodeSetup(createSetup({model:'fleet-day',config,options:paired})));
  assert.deepEqual(freezeBayExperiment(restored.config,restored.options),freezeBayExperiment(config,paired));
  for (const options of [{...paired,seeds:[42]},{...paired,resamples:999},{...paired,margin:0},{...paired,null_treatment:'false'},{...paired,treatment:'custom'},{...paired,seeds:[{}]},{...paired,extra:{}},{...paired,tuning_seeds:[42,42]}]) assert.throws(()=>createSetup({model:'fleet-day',config,options}));
  assert.throws(()=>createSetup({model:'street-lab',config:defaultStreetConfig(),options:{delay:0}}));
  assert.throws(()=>createSetup({model:'launch-rehearsal',config:createLaunchConfig(),options:{delay:1441}}));
  assert.throws(()=>createSetup({model:'launch-rehearsal',config:createLaunchConfig(),options:{delay:.5}}));
});

test('Street sharing applies the producer bounds without defaulting missing fields', () => {
  const config=defaultStreetConfig();
  for (const patch of [{fleet_size:61},{duration_minutes:9},{sfo_share_pct:70,east_bay_share_pct:40},{policy:'new'},{hotspot:'unknown'},{incident_start_minutes:91,incident_end_minutes:90},{boarding_seconds:9},{weather:'fog'},{seed:4294967296}]) assert.throws(()=>createSetup({model:'street-lab',config:{...config,...patch}}));
});

test('private free text is rejected explicitly, never silently removed or replaced', () => {
  for (const change of [c=>{c.launch.depots[0].tasks[0].owner='Person private';},c=>{c.launch.events[0].owner='Person private';},c=>{c.launch.region.label='Private region';},c=>{c.launch.depots[0].label='Private site';}]) {
    const config=createLaunchConfig();change(config);const before=copy(config);
    assert.throws(()=>createSetup({model:'launch-rehearsal',config,options:{delay:60}}),/private|custom|synthetic/i);
    assert.deepEqual(config,before);
  }
  const preset=PRESETS.find(p=>p.experiment),config=regionalExperiment(preset);
  config.draft.question='Private plans for a real customer';
  assert.throws(()=>createSetup({model:'regional',config}),/private|custom|question/i);
});

test('regional setup validates preset, mode, provenance and complete experiment grammar', () => {
  for (const patch of [{mode:'present'},{presetId:'unknown'}]) assert.throws(()=>createSetup({model:'regional',config:{...regional(),...patch}}));
  const good=regionalExperiment(PRESETS.find(p=>p.experiment));
  for (const mutate of [d=>{d.extra=true;},d=>{d.baselineSource.extra=true;},d=>{d.axis.extra=true;},d=>{d.primary.scope.unknown=true;},d=>{d.seedCount=10000;},d=>{d.resamples=1;},d=>{d.axisSource='external';}]) {
    const config=copy(good);mutate(config.draft);assert.throws(()=>createSetup({model:'regional',config}));
  }
});

test('large valid setup remains exportable while its overlong link fails without truncation', () => {
  const config=createLaunchConfig();
  const depot=config.launch.depots[0], port=copy(depot.ports[0]);
  depot.ports=Array.from({length:70},(_,index)=>({...port,id:`${depot.id}:expanded-port-${index+1}`}));
  config.launch.events=config.launch.depots.flatMap(d=>d.ports.map(p=>({version:config.launch.events[0].version,id:`${p.id}:commission`,sequence:1,effective_minute:0,depot_id:d.id,resource_id:p.id,task_id:p.commissioning_task_id,owner:'Synthetic commissioning lead',action:'commission'}))).map((event,index)=>({...event,sequence:index+1}));
  const envelope=createSetup({model:'launch-rehearsal',config,options:{delay:120}});
  assert.deepEqual(envelope.config,config);
  assert.ok(Buffer.byteLength(JSON.stringify(envelope),'utf8')<=65536);
  assert.throws(()=>encodeSetup(envelope),/link size/i);
});

test('privacy restricts owners to owner defaults, not another field\'s label', () => {
  const config=createLaunchConfig();config.launch.events[0].owner=config.launch.region.label;
  assert.throws(()=>createSetup({model:'launch-rehearsal',config,options:{delay:60}}),/custom|private/i);
});

test('regional versions bind the fixed sandbox seed set and replication count', async () => {
  const {SANDBOX_REPLICATIONS}=await import('../src/ui/app.js');
  const {PRESET_SEED_SET}=await import('../src/model/presets.js');
  const envelope=createSetup({model:'regional',config:regional()});
  assert.equal(envelope.versions.sandbox_seed_set,PRESET_SEED_SET);
  assert.equal(envelope.versions.sandbox_replications,SANDBOX_REPLICATIONS);
});

test('paired setup requires the full effective options instead of relying on future defaults', () => {
  const config=advancedOperationsDemoConfig('charging');
  for (const key of Object.keys(paired)) {
    const options=copy(paired);delete options[key];
    assert.throws(()=>createSetup({model:'fleet-day',config,options}),`missing ${key}`);
  }
});

function canonicalRaw(value) {
  const sorted=item=>Array.isArray(item)?item.map(sorted):item&&typeof item==='object'?Object.fromEntries(Object.keys(item).sort().map(key=>[key,sorted(item[key])])):item;
  return raw(sorted(value));
}

test('regional metric references require explicit scope and direction before any codec entry point accepts them', () => {
  const original=regionalExperiment(PRESETS.find(p=>p.id==='L2b'));
  for (const index of [-1,...original.draft.guardrails.map((_,i)=>i)]) for (const key of ['metric','scope','direction']) {
    const envelope=createSetup({model:'regional',config:original});
    const ref=index===-1?envelope.config.draft.primary:envelope.config.draft.guardrails[index];
    delete ref[key];
    assert.throws(()=>createSetup({model:'regional',config:envelope.config}),`missing ${key} in metric ${index}`);
    assert.throws(()=>encodeSetup(envelope),`encode missing ${key} in metric ${index}`);
    assert.throws(()=>decodeSetup(canonicalRaw(envelope)),`decode missing ${key} in metric ${index}`);
  }
});

test('regional mode requires a matching draft and an available Learn case', () => {
  assert.throws(()=>createSetup({model:'regional',config:{...regional(),mode:'experiment'}}),/draft/i);
  for (const mode of ['sandbox','learn']) {
    const config=regionalExperiment(PRESETS.find(p=>p.id==='L2b'));config.mode=mode;
    assert.throws(()=>createSetup({model:'regional',config}),/draft/i);
  }
  for (const preset of PRESETS) {
    const config={scenario:copy(preset.scenario),presetId:preset.id,mode:'learn',draft:null};
    if(preset.learnCase)assert.deepEqual(decodeSetup(encodeSetup(createSetup({model:'regional',config}))).config,config);
    else assert.throws(()=>createSetup({model:'regional',config}),/learn/i);
  }
});

test('regional references preserve explicit global scope and supported text thresholds', () => {
  const config=regionalExperiment(PRESETS.find(p=>p.id==='L2b'));
  config.draft.primary.scope={};
  delete config.draft.primary.margin_units;config.draft.primary.margin_text='60';
  delete config.draft.guardrails[0].max_harm_units;config.draft.guardrails[0].max_harm_text='0.02';
  assert.deepEqual(decodeSetup(encodeSetup(createSetup({model:'regional',config}))).config,config);
});

test('regional nested scopes and axes reject missing structural fields and unknown keys', () => {
  const config=regionalExperiment(PRESETS.find(p=>p.id==='L2b'));
  for (const path of [['axis'],['primary','scope','window']]) {
    const get=draft=>path.reduce((value,key)=>value[key],draft);
    for (const key of Object.keys(get(config.draft))) {
      const bad=copy(config);delete get(bad.draft)[key];
      assert.throws(()=>createSetup({model:'regional',config:bad}),`${path.join('.')} missing ${key}`);
    }
    const bad=copy(config);get(bad.draft).unknown=1;
    assert.throws(()=>createSetup({model:'regional',config:bad}),`${path.join('.')} unknown key`);
  }
  const layout=regionalExperiment(PRESETS.find(p=>p.experiment&&typeof p.experiment.axis.baseline==='object'));
  for (const arm of ['baseline','candidate']) {
    const bad=copy(layout);delete bad.draft.axis[arm][Object.keys(bad.draft.axis[arm])[0]];
    assert.throws(()=>createSetup({model:'regional',config:bad}),`${arm} incomplete layout`);
    const extra=copy(layout);extra.draft.axis[arm].unknown=1;
    assert.throws(()=>createSetup({model:'regional',config:extra}),`${arm} extra layout entry`);
  }
});

test('regional scenario object fields cannot disappear or acquire unknown keys at nested paths', () => {
  const original=regional(),paths=[];
  function collect(value,path=[]) {
    if(Array.isArray(value)){if(value.length)collect(value[0],[...path,0]);return;}
    if(!value||typeof value!=='object')return;
    paths.push(path);
    for(const [key,item]of Object.entries(value))collect(item,[...path,key]);
  }
  collect(original.scenario);
  for(const path of paths){
    const get=config=>path.reduce((value,key)=>value[key],config.scenario);
    for(const key of Object.keys(get(original))){
      const bad=copy(original);delete get(bad)[key];
      assert.throws(()=>createSetup({model:'regional',config:bad}),`${path.join('.')} missing ${key}`);
    }
    const bad=copy(original);get(bad).unknown=1;
    assert.throws(()=>createSetup({model:'regional',config:bad}),`${path.join('.')} extra key`);
  }
});
