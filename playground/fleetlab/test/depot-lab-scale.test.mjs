// Scale and resource refusal (D1-07, C2.3): every preset arm ends COMPLETE or with an explicit resource-limit status,
// with exact byte accounting. Measurements are diagnostics only; no withdrawn record or byte bound is asserted.
// Wall-clock budgets run only with FLEET_PLAYGROUND_PERF=1.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {preset,PRESET_IDS} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {jcs,utf8Length} from '../src/model/depot-lab/canonical.js';
const PERF=process.env.FLEET_PLAYGROUND_PERF==='1';
const ms=t0=>Number(process.hrtime.bigint()-t0)/1e6;
test('all fourteen presets, both arms, end COMPLETE or explicitly incomplete with exact bytes',t=>{
 const rows=[];
 for(const id of PRESET_IDS)for(const a of ['baseline','candidate']){
  const raw=preset(id)[a];if(!raw)continue;
  const s=validateScenario(raw,{origin:'editor'}).scenario,t0=process.hrtime.bigint(),r=h.run(s),wall=ms(t0),recs=r.ledger.records;
  assert.ok(['COMPLETE','INCOMPLETE_RESOURCE_LIMIT'].includes(r.terminal_status),`${id}/${a}`);
  assert.equal(r.guard===null,r.terminal_status==='COMPLETE');
  assert.ok(recs.length<=100000);assert.ok(recs.every((x,i)=>x.seq===i));
  assert.equal(r.bytes,utf8Length(jcs(r.ledger)));assert.ok(r.bytes<=33554432);
  if(r.terminal_status==='COMPLETE'){
   const hz=h.horizon(recs),H=s.horizon_tick;
   assert.equal(hz.arrived.length,s.visits.length);assert.equal(hz.released.length+hz.unreleased.length,s.visits.length);
   assert.ok(!recs.some(x=>x.tick===H&&x.kind==='TASK_TRANSITION'&&/START|RESUME/.test(x.payload.transition)&&x.phase===4));
  }
  rows.push({preset:id,arm:a,status:r.terminal_status,records:recs.length,bytes:r.bytes,released:h.horizon(recs).released.length,wall_ms:Math.round(wall)});
  if(PERF&&id==='B')assert.ok(wall<1000,`B/${a} ${wall} ms`);
  if(PERF&&id==='S200')assert.ok(wall<10000,`S200 ${wall} ms`);
 }
 assert.equal(rows.length,27);
 for(const x of rows)t.diagnostic(JSON.stringify(x));
});
test('the default B run is a fresh, repeatable computation',()=>{
 const s=validateScenario(preset('B').baseline,{origin:'editor'}).scenario;
 assert.deepEqual(h.run(s).ledger,h.run(s).ledger);
});
