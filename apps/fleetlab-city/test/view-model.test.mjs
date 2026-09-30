import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleAt, formatMetric, validateCatalog, safeDataPath, comparisonRows } from '../web/view-model.mjs';
test('missing evidence never formats as zero',()=>{
  assert.equal(formatMetric(null),'Not available');
  assert.equal(formatMetric(undefined),'Not available');
  assert.equal(formatMetric(0),'0');
});
test('pose gaps do not invent movement',()=>{
  const samples=[[15,-122,37,0,'idle',30],[30,-121.9,37,90,'pickup',29],[90,-121.8,37,90,'pickup',28]];
  assert.equal(sampleAt(samples,20,15).status,'recorded');
  assert.deepEqual(sampleAt(samples,20,15).sample,samples[0]);
  assert.equal(sampleAt(samples,60,15).status,'gap');
  assert.equal(sampleAt(samples,1,15).status,'unavailable');
});
test('untrusted paths cannot invoke external locations or traversal',()=>{
  for(const bad of ['https://evil.test/x','../x.json','data/../../x','//evil/x','data/x.js','data/%2e%2e/x.json']) assert.throws(()=>safeDataPath(bad));
  assert.equal(safeDataPath('data/run-1001-baseline-ev-001.json'),'data/run-1001-baseline-ev-001.json');
});
test('unsupported schema and nonfinite source values fail',()=>{
  assert.throws(()=>validateCatalog({schema:'fleetlab.city-view/2.0.0'}));
  assert.throws(()=>validateCatalog({schema:'fleetlab.city-view/1.0.0',coverage:{candidate_count:NaN}}));
});
test('incompatible comparison produces no paired numeric rows',()=>{
  assert.deepEqual(comparisonRows({eligibility:'INCOMPATIBLE',pairs:[{seed:1}]}),[]);
});

test('stale asynchronous trace cannot replace the selected vehicle', async () => {
  const { requestGate } = await import('../web/view-model.mjs');
  const gate = requestGate();
  const old = gate.issue();
  const selected = gate.issue();
  assert.equal(gate.current(old), false);
  assert.equal(gate.current(selected), true);
  gate.issue(); // selection changed before its fetch finished
  assert.equal(gate.current(selected), false);
});
