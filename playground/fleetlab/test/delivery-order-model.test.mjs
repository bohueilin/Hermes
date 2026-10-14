import test from 'node:test';import assert from 'node:assert/strict';
import {deliveryInput,deliveryDigest} from '../src/model/software-delivery-contract.js';
const contract=await import('../src/model/delivery-order-contract.js').catch(()=>({}));
const engine=await import('../src/model/delivery-order.js').catch(()=>({}));
const verifier=await import('../src/model/delivery-order-verify.js').catch(()=>({}));
import {orderInput as input} from './helpers/delivery-order-fixtures.mjs';
const run=(i,o)=>{assert.equal(typeof engine.runDeliveryOrder,'function');return engine.runDeliveryOrder(i,o);};
const verify=r=>{assert.equal(typeof verifier.verifyOrderRecord,'function');return verifier.verifyOrderRecord(r);};
const reseal=r=>{const {record_digest,...payload}=r;r.record_digest=deliveryDigest(payload);return r;};
test('serial receipts overlap independent tails, with literal default metrics',()=>{
 const r=run(input(),['V4','V3','V2','V1']);assert.deepEqual(r.vehicles.map(v=>v.ready_ms),[378000,330000,282000,234000]);
 assert.equal(r.metrics.on_time_count,4);assert.equal(r.metrics.late_ms_total,0);assert.equal(r.metrics.wan_bytes,12000000000);assert.equal(r.metrics.local_bytes,48000000000);assert.equal(verify(r).ok,true);
});
test('raw targets remain inclusive and half-second lateness is never rounded away',()=>{
 const i=input([480,281.5,480,480]);const r=run(i,['V1','V2','V3','V4']);assert.equal(r.metrics.late_ms_total,500);assert.equal(verify(r).ok,true);
 i.delivery.requests[1].deadline_ms=282000;assert.equal(run(i,['V1','V2','V3','V4']).metrics.missed_count,0);
});
for(const [name,edit] of [
 ['source available after zero',x=>x.delivery.artifact.available_at_ms=1],
 ['no initial request',x=>x.delivery.requests[0].arrival_ms=1],
 ['arrival after copy',x=>x.delivery.requests[3].arrival_ms=96001],
 ['lower receiver cap',x=>x.delivery.resources.local.transfer_cap_Bps=125000000],
 ['check failure',x=>x.delivery.requests[0].check_outcome='fail'],
 ['different check duration',x=>x.delivery.requests[0].check_ms=0],
 ['nonempty inventory',x=>x.delivery.inventory=[{}]],
 ['shorter horizon',x=>x.delivery.H_ms=1200000],
 ['extra wrapper field',x=>x.extra=true],
 ['getter',x=>Object.defineProperty(x,'domain',{get(){throw Error('getter executed');},enumerable:true})],
])test(`unsupported domain rejects ${name} before scheduling`,()=>{
 assert.equal(typeof contract.normalizeOrderInput,'function');const i=input();edit(i);assert.throws(()=>contract.normalizeOrderInput(i),e=>e.message!=='getter executed');
});
test('order rejects duplicate, missing and unknown IDs without dropping a vehicle',()=>{
 for(const order of [['V1','V1','V3','V4'],['V1','V2','V3'],['V1','V2','V3','bad']])assert.throws(()=>run(input(),order),/permutation/);
});
for(const [name,edit] of [
 ['receipt before copy',r=>r.vehicles[0].receive_start_ms=95000],
 ['overlap',r=>r.vehicles[1].receive_start_ms=96000],
 ['wrong byte count',r=>r.vehicles[0].received_bytes--],
 ['early check',r=>r.vehicles[0].check_start_ms--],
 ['early activation',r=>r.vehicles[0].activation_start_ms--],
 ['forged metrics',r=>r.metrics.on_time_count=4],
 ['extra interval field',r=>r.vehicles[0].unused=0],
])test(`independent record check rejects ${name} with recomputed digest`,()=>{
 const r=run(input(),['V1','V2','V3','V4']);edit(r);const c=verify(reseal(r));assert.equal(c.ok,false);assert.equal(c.metrics,null);assert.equal(c.record_digest,null);
});
test('both quanta reproduce readiness; one through four vehicles remain in the denominator',()=>{
 for(let n=1;n<=4;n++){const a=run(input(undefined,n,1000),Array.from({length:n},(_,i)=>`V${i+1}`)),b=run(input(undefined,n,250),a.order);assert.deepEqual(a.metrics,b.metrics);assert.equal(a.metrics.request_count,n);assert.equal(verify(b).ok,true);}
});
