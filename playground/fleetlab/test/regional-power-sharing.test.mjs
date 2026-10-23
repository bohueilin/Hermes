import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalPowerDemoConfig} from '../src/model/regional-power.js';
import {AUSTIN_REGION} from '../src/model/region-package.js';
import {createSetup,encodeSetup,decodeSetup} from '../src/ui/setup-codec.js';
const setup=()=>({model:'regional-power',config:regionalPowerDemoConfig(),options:{treatment:'charging_deadlines',seeds:[1001,1002],tuning_seeds:[42,43,44],margin:.02,resamples:1000,null_treatment:false}});
test('regional power sharing preserves all inputs and binds the synthetic graph instead of the Bay map',()=>{
  const input=setup(),envelope=createSetup(input),roundtrip=decodeSetup(encodeSetup(envelope));
  assert.deepEqual(roundtrip,envelope);assert.deepEqual(roundtrip.config,input.config);assert.deepEqual(roundtrip.options,input.options);
  assert.equal(envelope.versions.map,AUSTIN_REGION.graph_digest);assert.equal(envelope.versions.region_sources,AUSTIN_REGION.provenance.version);
});
test('regional power sharing rejects future versions, incomplete tapes and cross-model confusion',()=>{
  for(const mutate of [s=>s.config.region.graph_version='future',s=>s.config.site_power_profile.version='future',s=>s.config.site_power_profile.segments.pop(),s=>s.config.site_power_profile.segments[0].surprise=1,s=>s.model='fleet-day',s=>delete s.config.region,s=>s.options.treatment='resource_freshness']){
    const s=setup();mutate(s);assert.throws(()=>createSetup(s));
  }
  const e=createSetup(setup());e.versions.map='wrong';assert.throws(()=>encodeSetup(e),/version/i);
});
