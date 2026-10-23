import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
const api=await import('../src/model/software-delivery-contract.js').catch(()=>({}));
function preset(name='default',q=1000){assert.equal(typeof api.deliveryInput,'function','the frozen input contract exists');return api.deliveryInput(name,q);}
function reject(edit,pattern){const value=preset();edit(value);assert.throws(()=>api.normalizeDeliveryInput(value),pattern);}

test('public presets have explicit canonical caps and exact fixed exogenous inputs',()=>{
  const d=preset();assert.equal(d.schema,'fleetlab.software-delivery-input/1.0.0');
  assert.deepEqual([d.P_ms,d.H_ms,d.quantum_ms,d.artifact.size_bytes],[0,2400000,1000,12000000000]);
  assert.deepEqual(d.requests.map(r=>[r.id,r.arrival_ms,r.deadline_ms,r.check_ms,r.activation_ms,r.check_outcome]),['V1','V2','V3','V4'].map(id=>[id,0,480000,60000,30000,'pass']));
  assert.deepEqual(d.resources,{wan:{aggregate_Bps:125000000,transfer_cap_Bps:125000000},local:{aggregate_Bps:250000000,transfer_cap_Bps:250000000}});
  assert.deepEqual(d.inventory,[]);assert.equal(preset('one').requests.length,1);
  assert.deepEqual(preset('two-arrivals').requests.map(r=>[r.id,r.arrival_ms,r.deadline_ms]),[['V1',0,250000],['V2',100000,250000]]);
  assert.deepEqual(preset('slow-local').resources.local,{aggregate_Bps:31250000,transfer_cap_Bps:250000000});
  assert.equal(preset('default',250).quantum_ms,250);
  assert.throws(()=>preset('unsupported'),/preset/);assert.throws(()=>preset('default',500),/quantum/);
});

test('normalization is detached, ASCII sorted and identity excludes caller ordering',()=>{
  const a=preset();a.requests[0].id='a';a.requests[1].id='A0';a.requests[2].id='A';a.requests[3].id='_';
  const b=api.normalizeDeliveryInput(a);assert.deepEqual(b.requests.map(r=>r.id),['A','A0','_','a']);
  const c=structuredClone(a);c.requests.reverse();assert.deepEqual(api.normalizeDeliveryInput(c),b);
  assert.equal(api.deliveryDigest(api.normalizeDeliveryInput(c)),api.deliveryDigest(b));
  a.requests[0].id='changed';a.resources.wan.aggregate_Bps=0;assert.equal(b.requests.at(-1).id,'a');assert.equal(b.resources.wan.aggregate_Bps,125000000);
  const fresh=preset();fresh.requests[0].id='X';assert.equal(preset().requests[0].id,'V1');
});

test('contract rejects unsupported inventory and any undeclared policy/input field',()=>{
  reject(v=>v.inventory.push({artifact_id:'update'}),/unsupported-mode: inventory/);
  reject(v=>{delete v.inventory;},/inventory/);reject(v=>{delete v.resources.local.transfer_cap_Bps;},/transfer_cap_Bps/);
  reject(v=>{v.policy='cold';},/unknown.*policy/);reject(v=>{v.requests[0].extra=1;},/unknown.*extra/);
  reject(v=>{v.artifact.size=1;},/unknown.*size/);reject(v=>{v.P_ms=-1000;},/P_ms/);
});

test('exact integer/rate/time/id boundaries are enforced before execution',()=>{
  for(const q of [1000,250]) for(const rate of [1,6,-4,1e9+4,Infinity,NaN,1.5,-0]){
    reject(v=>{v.quantum_ms=q;v.resources.wan.transfer_cap_Bps=rate;},/transfer_cap_Bps/);
    reject(v=>{v.quantum_ms=q;v.resources.local.aggregate_Bps=rate;},/aggregate_Bps/);
  }
  for(const size of [0,-1,64000000001,Number.MAX_SAFE_INTEGER+1,-0]) reject(v=>{v.artifact.size_bytes=size;},/size_bytes/);
  for(const horizon of [0,2400001,2001,-0]) reject(v=>{v.H_ms=horizon;},/H_ms/);
  for(const key of ['arrival_ms','deadline_ms','check_ms','activation_ms']){
    reject(v=>{v.requests[0][key]=-1;},new RegExp(key));reject(v=>{v.requests[0][key]=2400001;},new RegExp(key));
  }
  reject(v=>{v.artifact.available_at_ms=2400001;},/available_at_ms/);
  for(const id of ['', 'a'.repeat(29),'é','a.b','a b']) reject(v=>{v.requests[0].id=id;},/id/);
  reject(v=>{v.requests[1].id='V1';},/duplicate/);reject(v=>{v.requests=[];},/requests/);
  reject(v=>{v.requests.push({...v.requests[0],id:'V5'});},/requests/);
  reject(v=>{v.artifact.digest='A'.repeat(64);},/digest/);reject(v=>{v.artifact.version='';},/version/);
  reject(v=>{v.requests[0].check_outcome='unknown';},/check_outcome/);
  const edge=preset();edge.artifact.size_bytes=64000000000;edge.artifact.available_at_ms=edge.H_ms;edge.requests[0].arrival_ms=edge.H_ms;
  edge.requests[0].deadline_ms=1999;edge.requests[0].check_ms=0;edge.resources.wan.aggregate_Bps=0;edge.resources.local.transfer_cap_Bps=1e9;
  assert.deepEqual(api.normalizeDeliveryInput(edge),edge);
});

test('untrusted shape validation rejects getters, inheritance, symbols, sparse and decorated arrays without executing accessors',()=>{
  let calls=0;
  reject(v=>Object.defineProperty(v.artifact,'size_bytes',{enumerable:true,get(){calls++;return 1;}}),/plain|accessor/);
  reject(v=>Object.defineProperty(v.requests,'0',{enumerable:true,get(){calls++;return {};}}),/plain|accessor/);
  assert.equal(calls,0);
  reject(v=>Object.setPrototypeOf(v,{extra:1}),/plain|inherited/);
  reject(v=>{v.resources.wan=new (class Rate{constructor(){this.aggregate_Bps=4;this.transfer_cap_Bps=4;}})();},/plain/);
  reject(v=>{v[Symbol('hidden')]=1;},/symbol|plain/);
  reject(v=>{delete v.requests[1];},/sparse|hole|array/);
  reject(v=>{v.requests.extra=1;},/array/);
  reject(v=>Object.defineProperty(v,'hidden',{value:1}),/unknown|plain/);
});

test('canonical utility validates plain data and uses stable SHA256 encoding',()=>{
  preset();const data={z:[0,null,false,'x'],a:4};assert.equal(api.canonicalDelivery(data),'{"a":4,"z":[0,null,false,"x"]}');
  assert.equal(api.deliveryDigest(data),createHash('sha256').update(api.canonicalDelivery(data)).digest('hex'));
  for(const value of [NaN,Infinity,-0,1.1,undefined,new Date(),()=>{}]) assert.throws(()=>api.canonicalDelivery(value),/plain|integer|unsupported/);
  const cyclic={};cyclic.self=cyclic;assert.throws(()=>api.canonicalDelivery(cyclic),/cycle/);
  let calls=0;const getter={get x(){calls++;return 1;}};assert.throws(()=>api.canonicalDelivery(getter),/accessor|plain/);assert.equal(calls,0);
  assert.throws(()=>api.canonicalDelivery('x'.repeat(20),8),/size|bytes/);
  assert.equal(api.DELIVERY_BOUNDS.maxEntries,130000);assert.equal(api.DELIVERY_BOUNDS.maxRecordBytes,32*1024*1024);
  assert.equal(api.DELIVERY_BOUNDS.maxPairBytes,64*1024*1024);
});

test('eligible row order is canonical while duplicates and other array ordering remain visible',()=>{
  preset();const a={eligible:[{id:'B',grant_bytes:2},{id:'A',grant_bytes:1}],tasks:[{id:'B'},{id:'A'}]};
  const b=structuredClone(a);b.eligible.reverse();assert.equal(api.deliveryDigest(a),api.deliveryDigest(b));
  b.tasks.reverse();assert.notEqual(api.deliveryDigest(a),api.deliveryDigest(b));
  b.tasks.reverse();b.eligible.push({id:'A',grant_bytes:1});assert.notEqual(api.deliveryDigest(a),api.deliveryDigest(b));
  b.eligible[2].id='unknown';assert.notEqual(api.deliveryDigest(a),api.deliveryDigest(b));
});

test('non-enumerable data cannot disappear from canonical evidence',()=>{
  preset();const hidden={};Object.defineProperty(hidden,'evidence',{value:7});
  assert.throws(()=>api.canonicalDelivery(hidden),/enumerable|plain/);
  const array=[1];Object.defineProperty(array,'0',{value:1,enumerable:false});
  assert.throws(()=>api.canonicalDelivery(array),/enumerable|plain/);
});
