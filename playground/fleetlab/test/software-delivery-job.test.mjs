import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/runtime/software-delivery-job.js').catch(()=>({}));
const make=()=>{assert.equal(typeof api.createDeliveryJob,'function');let worker;const job=api.createDeliveryJob({createWorker:()=>worker={postMessage(v){this.sent=v;},terminate(){this.stopped=true;}}});return {job,get:()=>worker};};
test('cancel terminates computation and late messages cannot replace a newer result',async()=>{
 const {job,get}=make();const a=job.run({id:'default'});const first=get();const reject=assert.rejects(a,/cancel/i);job.cancel();assert.equal(first.stopped,true);await reject;
 const b=job.run({id:'one'});const second=get();first.onmessage({data:{token:first.sent.token,type:'done',result:'stale'}});second.onmessage({data:{token:second.sent.token,type:'done',result:'current'}});assert.equal(await b,'current');assert.equal(second.stopped,true);
});
test('worker failures preserve caller state and every phase can be cancelled synchronously',async()=>{
 for(const phase of ['generation','verification','hashing']){const {job,get}=make();const promise=job.run({id:'default'});const w=get();w.onmessage({data:{token:w.sent.token,type:'progress',phase}});const rejection=assert.rejects(promise,/cancel/i);job.cancel();await rejection;assert.equal(w.stopped,true);}
 const {job,get}=make();const p=job.run({id:'one'});get().onmessage({data:{token:get().sent.token,type:'error',message:'Digest mismatch'}});await assert.rejects(p,/Digest mismatch/);assert.equal(get().stopped,true);
});
