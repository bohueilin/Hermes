// Every named configuration (D12-04), both arms, verifies independently; structural nulls compare as ties (D12-04 GN,
// TN, ST; D1-13 A35) and the unreachable required map releases no visit. Wall times are diagnostics, never assertions.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import {preset,PRESET_IDS} from '../src/model/depot-lab/presets.js';
import {validateScenario} from '../src/model/depot-lab/schema.js';
import {checkPairCompatibility,compareDepotRuns} from '../src/model/depot-lab/compare.js';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';
const ms=t0=>Math.round(Number(process.hrtime.bigint()-t0)/1e6);
const RESULTS=new Map();
test('all fourteen presets, both arms, verify VERIFIED with exact partitions',t=>{
 for(const id of PRESET_IDS)for(const arm of ['baseline','candidate']){
  const raw=preset(id)[arm];if(!raw)continue;
  const s=validateScenario(raw,{origin:'editor'}).scenario,r=h.run(s);assert.equal(r.terminal_status,'COMPLETE',`${id}/${arm}`);
  const t0=process.hrtime.bigint(),e=verifyDepotRun(s,JSON.parse(JSON.stringify(r.ledger))),wall=ms(t0);
  assert.equal(e.status,'VERIFIED',`${id}/${arm} ${JSON.stringify(e.primary_violation)}`);
  const p=e.projection,H=s.horizon_tick;
  for(const x of [...p.resources.ports,...p.resources.positions])assert.equal(Object.values(x.partition).reduce((a,b)=>a+b,0),H,`${id}/${arm} ${x.id}`);
  assert.equal(p.metrics['release.released_count']+p.metrics['release.unreleased_count'],s.visits.length);
  RESULTS.set(`${id}/${arm}`,{s,e});
  t.diagnostic(JSON.stringify({preset:id,arm,records:r.ledger.records.length,verify_ms:wall,released:p.metrics['release.released_count']}));
 }
 assert.equal(RESULTS.size,27);
});
const pair=id=>{const b=RESULTS.get(`${id}/baseline`),c=RESULTS.get(`${id}/candidate`),t=checkPairCompatibility(b.s,c.s);assert.equal(t.compatible,true,id);return compareDepotRuns(b.e,c.e,t.treatment);};
test('structural nulls compare as ties: GN, TN, ST and the A35 generation label',()=>{
 for(const id of ['GN','TN','ST'])assert.equal(pair(id).classification,'tie',id);
 const a=h.a35('wifi6'),b=h.a35('wifi7'),v=c=>verifyDepotRun(c.s,h.run(c.s,{harness:c.harness}).ledger,{harness:c.harness});
 assert.equal(compareDepotRuns(v(a),v(b),checkPairCompatibility(a.s,b.s).treatment).classification,'tie');
});
test('M: the unreachable required map releases no visit while other work progresses',()=>{
 const p=RESULTS.get('M/candidate').e.projection;
 assert.equal(p.metrics['release.released_count'],0);assert.ok(p.metrics['charge.energy_credited_mj']>0);
 assert.ok(p.blockage.every(b=>b.classification==='TERMINAL_BLOCKAGE_BEFORE_H'));
 assert.equal(pair('M').classification,'worse');
});
