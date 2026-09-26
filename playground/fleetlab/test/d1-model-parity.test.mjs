import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultBayAreaConfig,simulateBayAreaOperations} from '../src/model/bay-operations.js';
import {regionalPowerDemoConfig} from '../src/model/regional-power.js';

for(const [label,config,partition] of [
  ['Fleet day',defaultBayAreaConfig(),[95,176,4,9,284]],
  ['Austin 60%',regionalPowerDemoConfig('moderate'),[77,391,11,1,480]],
])test(`D1 preserves ${label} model provenance and the complete request partition`,()=>{
  const r=simulateBayAreaOperations(config),m=r.metrics;
  assert.equal(r.config.seed,42);
  assert.deepEqual([m.completed_trips,m.unserved_requests,m.pending_requests,m.in_progress_trips,m.total_requests],partition);
  assert.equal(partition.slice(0,4).reduce((a,b)=>a+b,0),m.total_requests);
  if(label==='Fleet day')assert.equal(r.version,'fleetlab-bay-operations-1.0.0');
  else {
    assert.equal(r.config.site_power_profile.condition_id,'tx-aus-moderate-v1');
    assert.equal(r.config.site_power_profile.site_id,'depot-1');
    assert.equal(r.config.charging.policy,'redistribute');
    assert.equal(r.frames.at(-1).minute,480);
    assert.deepEqual(r.config.site_power_profile.segments,[
      {start_minute:0,end_minute:90,fraction:1},
      {start_minute:90,end_minute:180,fraction:.6},
      {start_minute:180,end_minute:480,fraction:1},
    ]);
  }
});
