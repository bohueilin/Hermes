import test from 'node:test';import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';import {ORDER_STUDY} from '../src/data/delivery-order-study.js';
import {searchDeliveryOrders} from '../src/model/delivery-order-search.js';import {runDeliveryOrder} from '../src/model/delivery-order.js';
import {verifyOrderStudy} from '../src/model/delivery-order-study-verify.js';import {createOrderProjection} from '../src/ui/delivery-order-view.js';
import {reconstructOrderStudy,reconstructOrderEqualShare,checkPublishedOrder} from '../src/runtime/delivery-order-worker.js';
import {createOrderJob} from '../src/runtime/delivery-order-job.js';import {createOrderPage} from '../src/ui/delivery-order-page.js';
// Step A truth table: on time out of 4, total late, worst late and all ready, in exact ms. Literals, never read from the manifest.
// shown is the spec table's First come cell, verbatim: the text the outcome cards display. It never passes through the page's formatter.
const fig=(on_time_count,late_ms_total,max_late_ms,all_ready_ms)=>({on_time_count,late_ms_total,max_late_ms,all_ready_ms});
const pick=m=>fig(m.on_time_count,m.late_ms_total,m.max_late_ms,m.all_ready_ms);
const FIRST_COME=['V1','V2','V3','V4'];
const TRUTH={
 default:{name:'Different targets',shown:'2/4 · 178 s · 138 s · 378 s',first:fig(2,178000,138000,378000),best:fig(4,0,0,378000),order:['V4','V3','V2','V1'],ties:1},
 // Best raises the worst late time here: 138 s under First come, 158 s under Best.
 impossible:{name:'One impossible target',shown:'1/4 · 192 s · 138 s · 378 s',first:fig(1,192000,138000,378000),best:fig(3,158000,158000,378000),order:['V4','V3','V2','V1'],ties:1},
 close:{name:'Close targets',shown:'2/4 · 4 s · 2 s · 378 s',first:fig(2,4000,2000,378000),best:fig(3,50000,50000,378000),order:['V1','V3','V2','V4'],ties:1},
 tie:{name:'Equal targets',shown:'4/4 · 0 s · 0 s · 378 s',first:fig(4,0,0,378000),best:fig(4,0,0,378000),order:['V1','V2','V3','V4'],ties:24},
};
test('the published study holds exactly the four truth-table scenarios',()=>{assert.deepEqual(Object.keys(ORDER_STUDY.cases),Object.keys(TRUTH));for(const [id,t] of Object.entries(TRUTH))assert.equal(ORDER_STUDY.cases[id].name,t.name);});
for(const [id,t] of Object.entries(TRUTH))test(`${t.name}: First come and Best of 24 match the truth table in exact milliseconds`,()=>{
 const entry=ORDER_STUDY.cases[id],requests=entry.input.delivery.requests;
 assert.deepEqual(requests.slice().sort((a,b)=>a.arrival_ms-b.arrival_ms||(a.id<b.id?-1:1)).map(r=>r.id),FIRST_COME);assert.deepEqual(requests.map(r=>r.id),FIRST_COME);
 const study=searchDeliveryOrders(entry.input),v=verifyOrderStudy(study),projection=createOrderProjection(study);
 assert.equal(v.ok,true,JSON.stringify(v.errors));assert.deepEqual(v.coverage,{expected:24,verified:24,complete:true});
 assert.deepEqual(pick(runDeliveryOrder(entry.input,FIRST_COME).metrics),t.first);assert.deepEqual(pick(projection.outcome(FIRST_COME).metrics),t.first);
 assert.deepEqual(study.representative_order,t.order);assert.deepEqual(v.representative_order,t.order);
 assert.equal(study.best_orders.length,t.ties);assert.deepEqual(v.best_orders,study.best_orders);
 for(const order of study.best_orders)assert.deepEqual(pick(projection.outcome(order).metrics),t.best);
 // All ready is when the last vehicle is ready: one value for every order, not a total.
 assert.ok(study.records.every(r=>r.metrics.request_count===4&&r.metrics.all_ready_ms===378000));
 assert.deepEqual(pick(entry.fcfs_metrics),t.first);assert.deepEqual(pick(entry.best_metrics),t.best);assert.deepEqual(entry.representative_order,t.order);assert.equal(entry.best_orders.length,t.ties);
});
const setup=t=>{const restore=installFakeDom();t.after(restore);const p=createOrderPage({manifest:ORDER_STUDY,runStudy:async e=>reconstructOrderStudy(e),runEqualShare:async e=>reconstructOrderEqualShare(e)});document.body.appendChild(p.element);t.after(()=>p.destroy());return p;};
const settle=()=>new Promise(r=>setTimeout(r,0));
// An outcome card as read: its eyebrow, its on-time count, and each dt label paired with the dd value after it.
const readCard=a=>{const k=a.querySelector('dl').children;assert.deepEqual(k.map(c=>c.localName),['dt','dd','dt','dd','dt','dd']);
 return {eyebrow:a.querySelector('.eyebrow').textContent,count:a.querySelector('.big-count').textContent,pairs:[0,2,4].map(i=>[k[i].textContent,k[i+1].textContent])};};
test('an untouched order is First come in all four scenarios, and both outcome cards show the First come figures',async t=>{
 const p=setup(t);
 for(const [id,row] of Object.entries(TRUTH)){
  p.selectCase(id);assert.deepEqual(p.getState().pendingOrder,FIRST_COME);assert.equal(await p.load(),true);
  const s=p.getState();assert.equal(s.acceptedCase,id);assert.deepEqual(s.viewedOrder,FIRST_COME);
  const [count,total,worst,ready]=row.shown.split(' · '),pairs=[['Total late time',total],['Worst late time',worst],['All ready',ready]];
  assert.deepEqual([...p.element.querySelectorAll('.outcome-grid article')].slice(0,2).map(readCard),['First come','Your order'].map(eyebrow=>({eyebrow,count,pairs})),id);
 }
});
test('Equal targets is reachable only through Inspect all 24 tied orders',async t=>{
 const p=setup(t),buttons=()=>[...p.element.querySelectorAll('button')];
 assert.deepEqual([...p.element.querySelectorAll('.case-buttons button')].map(b=>[b.textContent,b.getAttribute('data-case')]),[['Different targets','default'],['One impossible target','impossible'],['Close targets','close']]);
 const inspect=buttons().filter(b=>b.textContent==='Inspect all 24 tied orders');assert.equal(inspect.length,1);
 // Every other control, including those rendered by earlier clicks, neither selects nor accepts Equal targets.
 const clicked=new Set(inspect);
 for(let pass=0;pass<2;pass++)for(const b of buttons())if(!clicked.has(b)){clicked.add(b);b.click();await settle();const s=p.getState();
  assert.notEqual(s.pendingCase,'tie',b.textContent);assert.notEqual(s.acceptedCase,'tie',b.textContent);}
 assert.ok(clicked.size>=10,`only ${clicked.size} buttons clicked`);assert.ok(p.getState().acceptedCase,'the other buttons accepted a scenario');
 inspect[0].click();assert.equal(p.getState().pendingCase,'tie');await settle();
 assert.equal(p.getState().acceptedCase,'tie');assert.match(p.element.querySelector('[data-result-case]').textContent,/Equal targets/);
});
// Fake workers: answer(message, reply, fail) runs after each post; reply feeds onmessage and fail fires onerror.
// A fixture that throws answers at once with its reason, so a broken model fails fast instead of timing out.
const harness=(answer,options={})=>{const made=[];const job=createOrderJob({createWorker:()=>{const w={terminated:false,terminate(){w.terminated=true;},postMessage(m){queueMicrotask(()=>{const reply=data=>w.onmessage({data});try{answer(m,reply,()=>w.onerror());}catch(error){reply({token:m.token,type:'error',message:`fixture threw: ${error.message}`});}});}};made.push(w);return w;},...options});return {job,made};};
const like=(m,reply,compute)=>{try{reply({token:m.token,type:'done',result:compute(m.entry)});}catch(error){reply({token:m.token,type:'error',message:error.message});}};
const entry=ORDER_STUDY.cases.default;
test('the job resolves a checked study when the fake worker runs the real reconstruction',async()=>{
 const {job,made}=harness((m,reply)=>like(m,reply,reconstructOrderStudy));const r=await job.run(entry);
 assert.equal(r.verification.ok,true);assert.equal(r.study.study_digest,entry.study_digest);assert.equal(made[0].terminated,true);
});
// The 10 s test bound sits below the job's 15 s default, so an ignored timeoutMs fails rather than passing slowly.
for(const [message,answer,options={},run=job=>job.run(entry)] of [
 ['Computation timed out.',()=>{},{timeoutMs:10}],
 ['The lesson worker could not finish. Try again.',(m,reply,fail)=>fail()],
 ['Published input identity mismatch.',(m,reply)=>like(m,reply,reconstructOrderStudy),{},job=>{const e=structuredClone(entry);e.input_digest='0'.repeat(64);return job.run(e);}],
 ['Published study identity or metric mismatch.',(m,reply)=>like(m,reply,reconstructOrderStudy),{},job=>{const e=structuredClone(entry);e.best_metrics.on_time_count=3;return job.run(e);}],
 ['Returned record rejected: incomplete-coverage',(m,reply)=>{const s=reconstructOrderStudy(m.entry).study;s.records.pop();reply({token:m.token,type:'done',result:{study:s}});}],
 ['Returned study identity mismatch.',(m,reply)=>reply({token:m.token,type:'done',result:{study:reconstructOrderStudy(ORDER_STUDY.cases.close).study}})],
 ['Equal-share identity or metric mismatch.',(m,reply)=>like(m,reply,reconstructOrderEqualShare),{},job=>{const e=structuredClone(entry);e.equal_share.record_digest='0'.repeat(64);return job.run(e,'equal-share');}],
 ['Returned equal-share identity mismatch.',(m,reply)=>reply({token:m.token,type:'done',result:{record:reconstructOrderEqualShare(ORDER_STUDY.cases.close).record}}),{},job=>job.run(entry,'equal-share')],
 ['Computation cancelled.',()=>{},{},job=>{const p=job.run(entry);job.cancel();return p;}],
])test(`job failure message is exactly "${message}" and the worker is stopped`,{timeout:10000},async()=>{const {job,made}=harness(answer,options);await assert.rejects(run(job),{name:'Error',message});assert.equal(made.length,1);assert.equal(made[0].terminated,true);});
test('the worker check names an incomplete study; worker construction and posting errors pass through unchanged',async()=>{
 const s=reconstructOrderStudy(entry).study;s.records.pop();assert.throws(()=>checkPublishedOrder(s,entry),{name:'Error',message:'Study rejected: incomplete-coverage'});
 const broken=Error('fixture');await assert.rejects(createOrderJob({createWorker:()=>{throw broken;}}).run(entry),e=>e===broken);
 let stopped=false;await assert.rejects(createOrderJob({createWorker:()=>({terminate(){stopped=true;},postMessage(){throw broken;}})}).run(entry),e=>e===broken);assert.equal(stopped,true);
});
