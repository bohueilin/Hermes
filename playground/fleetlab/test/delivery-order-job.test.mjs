import test from 'node:test';import assert from 'node:assert/strict';
import {ORDER_STUDY} from '../src/data/delivery-order-study.js';
const w=await import('../src/runtime/delivery-order-worker.js').catch(()=>({}));
const j=await import('../src/runtime/delivery-order-job.js').catch(()=>({}));
const reconstruct=e=>{assert.equal(typeof w.reconstructOrderStudy,'function');return w.reconstructOrderStudy(e);};
test('worker reconstructs complete checked study and rejects forged manifest summaries',()=>{
 const e=ORDER_STUDY.cases.default,r=reconstruct(e);assert.equal(r.verification.ok,true);assert.equal(r.study.study_digest,e.study_digest);
 for(const edit of [x=>x.study_digest='0'.repeat(64),x=>x.best_metrics.on_time_count=0,x=>x.input.delivery.requests[0].deadline_ms--]){const bad=structuredClone(e);edit(bad);assert.throws(()=>reconstruct(bad),/identity|mismatch/);}
});
const make=()=>{assert.equal(typeof j.createOrderJob,'function');let worker;return {job:j.createOrderJob({createWorker:()=>worker={postMessage(v){this.sent=v;},terminate(){this.stopped=true;}}}),get:()=>worker};};
test('cancel stops owned worker; late results cannot replace new accepted job',async()=>{
 const {job,get}=make(),e=ORDER_STUDY.cases.default,a=job.run(e),old=get();const rejection=assert.rejects(a,/cancel/i);job.cancel();await rejection;assert.equal(old.stopped,true);
 const b=job.run(e),now=get();old.onmessage({data:{token:old.sent.token,type:'done',result:{}}});now.onmessage({data:{token:now.sent.token,type:'done',result:reconstruct(e)}});assert.equal((await b).study.study_digest,e.study_digest);assert.equal(now.stopped,true);
});
test('job rejects incomplete or oversized result instead of accepting worker success alone',async()=>{
 for(const edit of [r=>r.study.records.pop(),r=>r.study.padding='x'.repeat(262144)]){const {job,get}=make(),e=ORDER_STUDY.cases.default,p=job.run(e),r=reconstruct(e);edit(r);get().onmessage({data:{token:get().sent.token,type:'done',result:r}});await assert.rejects(p);assert.equal(get().stopped,true);}
});
test('equal-share operation uses the same new common input and checked NF04 record',()=>{
 assert.equal(typeof w.reconstructOrderEqualShare,'function');const e=ORDER_STUDY.cases.close,r=w.reconstructOrderEqualShare(e);assert.equal(r.record.input_digest,e.equal_share.input_digest);assert.equal(r.record.record_digest,e.equal_share.record_digest);assert.equal(r.verification.ok,true);
});
