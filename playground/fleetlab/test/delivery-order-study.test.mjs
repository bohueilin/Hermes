import test from 'node:test';import assert from 'node:assert/strict';
import {orderInput as input} from './helpers/delivery-order-fixtures.mjs';
import {runDeliveryOrder} from '../src/model/delivery-order.js';
import {verifyOrderRecord} from '../src/model/delivery-order-verify.js';
import {orderDigest} from '../src/model/delivery-order-contract.js';
const search=await import('../src/model/delivery-order-search.js').catch(()=>({}));
const check=await import('../src/model/delivery-order-study-verify.js').catch(()=>({}));
const study=i=>{assert.equal(typeof search.searchDeliveryOrders,'function');return search.searchDeliveryOrders(i);};
const verify=s=>{assert.equal(typeof check.verifyOrderStudy,'function');return check.verifyOrderStudy(s);};
const seal=s=>{const {study_digest,...body}=s;s.study_digest=orderDigest(body);return s;};
for(const [name,targets,best,miss,late,hist,ties]of [
 ['default',[480,340,290,240],['V4','V3','V2','V1'],0,0,[1,11,11,1,0],1],
 ['impossible',[220,340,290,240],['V4','V3','V2','V1'],1,158000,[0,1,11,11,1],1],
 ['close',[235,280,328,480],['V1','V3','V2','V4'],1,50000,[0,4,16,4,0],1],
 ['tie',[480,480,480,480],['V1','V2','V3','V4'],0,0,[24,0,0,0,0],24],
])test(`${name}: exact coverage, all ties and independently tabulated optimum`,()=>{
 const s=study(input(targets)),v=verify(s);assert.equal(v.ok,true,JSON.stringify(v.errors));assert.deepEqual(v.coverage,{expected:24,verified:24,complete:true});assert.deepEqual(s.representative_order,best);assert.equal(s.best_orders.length,ties);
 const r=s.records.find(r=>r.order.join()===best.join());assert.equal(r.metrics.missed_count,miss);assert.equal(r.metrics.late_ms_total,late);
 assert.deepEqual(Array.from({length:5},(_,i)=>s.records.filter(r=>r.metrics.missed_count===i).length),hist);
});
for(const [name,edit]of [
 ['missing candidate',s=>s.records.pop()],['duplicate candidate',s=>s.records[1]=s.records[0]],
 ['reordered candidates',s=>s.records.reverse()],['wrong best',s=>s.representative_order=['V1','V2','V3','V4']],
 ['incomplete ties',s=>s.best_orders.pop()],['wrong policy',s=>s.policy_version='other'],['wrong quantum',s=>s.quantum_ms=250],
 ['valid foreign workload',s=>{const foreign=runDeliveryOrder(input([480,480,480,480]),s.records[0].order);assert.equal(verifyOrderRecord(foreign).ok,true);s.records[0]=foreign;}],
])test(`resealed study rejects ${name}`,()=>{
 const s=study(input());edit(s);const v=verify(seal(s));assert.equal(v.ok,false);assert.equal(v.study_digest,null);assert.equal(v.best_orders,null);assert.equal(v.coverage.complete,false);
});
test('tie coverage cannot discard any optimum even after resealing',()=>{const s=study(input([480,480,480,480]));s.best_orders.pop();assert.equal(verify(seal(s)).ok,false);});
test('factorial coverage handles each supported fleet size and both quanta',()=>{
 for(let n=1;n<=4;n++)for(const q of [1000,250]){const s=study(input(undefined,n,q));const v=verify(s);assert.equal(v.ok,true);assert.equal(v.coverage.expected,[1,1,2,6,24][n]);}
});
