import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {deliveryDigest,normalizeDeliveryInput,DELIVERY_MANIFEST_SCHEMA} from '../src/model/software-delivery-contract.js';
import {reconstructDeliveryPair} from '../src/runtime/software-delivery-worker.js';
const tool=await import('../tools/software-delivery-study.mjs').catch(()=>({}));
const published=await import('../src/data/software-delivery-study.js').catch(()=>({}));
let cached;
function study(){assert.equal(typeof tool.generateDeliveryStudy,'function','independently checked generator exists');return cached??=tool.generateDeliveryStudy();}

test('published module deterministically reproduces sixteen independently checked runs without records',()=>{
  const manifest=study();assert.equal(manifest.schema,DELIVERY_MANIFEST_SCHEMA);assert.deepEqual(Object.keys(manifest.cases),['default','one','slow-local','two-arrivals']);
  assert.deepEqual(manifest,published.DELIVERY_STUDY);
  const text=tool.deliveryStudyModule(manifest);assert.equal(text,readFileSync(new URL('../src/data/software-delivery-study.js',import.meta.url),'utf8'));
  assert.ok(Buffer.byteLength(text)<20000);assert.ok(!text.includes('"boundaries":'));assert.ok(!text.includes('"tasks":'));assert.ok(!text.includes('"eligible":'));
  for(const [id,entry]of Object.entries(manifest.cases)){
    assert.equal(entry.id,id);assert.equal(entry.input_digest,deliveryDigest(normalizeDeliveryInput(entry.input)));assert.equal(entry.input.quantum_ms,1000);
    const refined={...entry.input,quantum_ms:250};assert.equal(entry.refinement.input_digest,deliveryDigest(refined));assert.equal(entry.refinement.quantum_ms,250);
    assert.ok(entry.refinement.differences,'refinement differences are nested inside the refinement result');
    for(const policy of ['repeated','cold']){assert.match(entry.primary[policy].record_digest,/^[0-9a-f]{64}$/);assert.match(entry.refinement.arms[policy].record_digest,/^[0-9a-f]{64}$/);assert.equal(entry.refinement.differences[policy].all_ready_ms.delta_ms,0);assert.equal(entry.refinement.differences[policy].on_time_count.delta,0);assert.deepEqual(entry.refinement.differences[policy].metric_changes,{});assert.equal(entry.refinement.differences[policy].ready_ms.length,entry.input.requests.length);}
  }
  assert.equal(manifest.versions.verifier,'fleetlab.software-delivery-verifier/1.0.0');
  assert.equal(manifest.cases.default.primary.cold.metrics.all_ready_ms,378000);
  assert.equal(manifest.cases['two-arrivals'].primary.repeated.metrics.on_time_count,1);
});

test('reconstruction accepts exact published facts and rejects a forged manifest metric',()=>{
  const entry=study().cases.default;const accepted=reconstructDeliveryPair(entry);assert.equal(accepted.records.cold.metrics.all_ready_ms,378000);assert.equal(accepted.verification.repeated.ok,true);
  const forged=structuredClone(entry);forged.primary.cold.metrics.on_time_count=3;
  assert.throws(()=>reconstructDeliveryPair(forged),/Published metric mismatch \(cold\)/);
});

test('generator stops at independent verification failure before producing a study',()=>{
  study();assert.throws(()=>tool.generateDeliveryStudy({verify:()=>({ok:false,errors:['fixture-rejection'],metrics:null,record_digest:null,input_digest:null})}),/fixture-rejection/);
});

test('generator command checks exact generated output and rejects arbitrary output or conflicting modes',()=>{
  study();const messages=[];const opts={log:s=>messages.push(s),error:s=>messages.push(s)};
  assert.equal(tool.main(['--out','/tmp/unowned-output.js'],opts),2);
  assert.equal(tool.main(['--check','--write-module'],opts),2);
  assert.equal(tool.main([],opts),2);
  assert.equal(tool.main(['--check'],opts),0);assert.ok(messages.some(m=>/match/.test(m)));
});

test('refinement differences retain a changed raw deadline result instead of normalizing it away',async()=>{
  assert.equal(typeof tool.deliveryRefinementDifferences,'function','refinement comparison is available');
  const {deliveryInput}=await import('../src/model/software-delivery-contract.js');
  const {runDelivery}=await import('../src/model/software-delivery.js');
  const input=deliveryInput('one');input.artifact.size_bytes=12000000001;Object.assign(input.requests[0],{arrival_ms:100,check_ms:60001,deadline_ms:236000});
  const primary=runDelivery(input,'cold');input.quantum_ms=250;const refined=runDelivery(input,'cold');
  const d=tool.deliveryRefinementDifferences(primary,refined);
  assert.deepEqual(d.all_ready_ms,{primary:238000,refinement:235000,delta_ms:-3000});
  assert.deepEqual(d.on_time_count,{primary:0,refinement:1,delta:1});
  assert.deepEqual(d.ready_ms,[{id:'V1',primary:238000,refinement:235000,delta_ms:-3000}]);
  assert.deepEqual(d.metric_changes,{on_time_count:{primary:0,refinement:1},all_ready_ms:{primary:238000,refinement:235000},terminal_ms:{primary:238000,refinement:235000}});
});
