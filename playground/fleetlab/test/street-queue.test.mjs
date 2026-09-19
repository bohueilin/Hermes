import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreetQueue} from '../src/model/street-queue.js';

const edges=[{id:'ab',from:'a',to:'b',length_m:15,speed_kph:36,lanes:1},{id:'bc',from:'b',to:'c',length_m:7.5,speed_kph:36,lanes:1}];
const make=options=>createStreetQueue({edges},{stepSeconds:5,capacity:()=>.2,travelSeconds:()=>5,...options});

// Removing downstream storage checks would allow two vehicles into a one-slot block.
test('a full downstream block holds the front car upstream until space is available',()=>{
 const q=make({capacity:e=>e.id==='bc'?0:.2});
 q.enqueue({id:'blocker',edge_ids:['bc']},0);q.enqueue({id:'av',edge_ids:['ab','bc']},0);q.step(0);q.step(5);q.step(10);
 assert.equal(q.position('av').edge_id,'ab');assert.equal(q.position('av').progress,1);
 assert.equal(q.edgeState('ab').spillback,true);assert.equal(q.edgeState('bc').occupancy,1);
 assert.equal(q.edgeState('ab').front_wait_seconds,5);assert.equal(q.position('av').exit_wait_seconds,5);
});
test('red signals cannot bank discharge credit and release a phantom burst',()=>{
 const q=make({green:(e,t)=>t>=20,storageSlots:()=>10});
 for(let i=0;i<4;i++)q.enqueue({id:`c${i}`,edge_ids:['ab']},0);
 q.step(0);q.step(5);q.step(10);q.step(15);assert.equal(q.counts().completed,0);
 const done=q.step(20);assert.deepEqual(done.map(x=>x.id),['c0']);assert.equal(q.counts().on_road,3);
});
test('FIFO and external insertion queues conserve every submitted journey',()=>{
 const q=make({storageSlots:()=>1});
 for(let i=0;i<3;i++)q.enqueue({id:`c${i}`,edge_ids:['ab','bc']},0);
 q.step(0);assert.deepEqual(q.counts(),{submitted:3,completed:0,on_road:1,pending:2});
 const done=[];for(let t=5;t<=40;t+=5){done.push(...q.step(t));const n=q.counts();assert.equal(n.submitted,n.completed+n.on_road+n.pending);}
 assert.deepEqual(done.map(x=>x.id),['c0','c1','c2']);assert.equal(q.position('c0'),null);
});
test('a queued vehicle stops and a following car never overtakes it',()=>{
 const q=make({capacity:()=>0});q.enqueue({id:'front',edge_ids:['ab']},0);q.enqueue({id:'back',edge_ids:['ab']},0);q.step(0);q.step(5);
 const a=q.position('front'),b=q.position('back');q.step(10);
 assert.equal(q.position('front').progress,a.progress);assert.equal(q.position('front').edge_id,a.edge_id);assert.equal(a.progress,1);assert.equal(b.progress,.5);
});
test('invalid or disconnected paths are rejected without adding phantom journeys',()=>{
 const q=make();assert.throws(()=>q.enqueue({id:'x',edge_ids:['bc','ab']},0),/contiguous/);
 assert.throws(()=>q.enqueue({id:'x',edge_ids:['missing']},0),/Unknown/);assert.equal(q.counts().submitted,0);
 q.enqueue({id:'x',edge_ids:['ab']},0);assert.throws(()=>q.enqueue({id:'x',edge_ids:['ab']},0),/Duplicate/);
 q.step(0);assert.throws(()=>q.step(-5),/time/);
});
test('fractional discharge is preserved so 0.32 vehicles per second serves 288 in 900 seconds',()=>{
 const q=make({capacity:()=>.32,storageSlots:()=>1000});for(let i=0;i<500;i++)q.enqueue({id:`v${i}`,edge_ids:['ab']},0);
 q.step(0);for(let t=5;t<=900;t+=5)q.step(t);assert.equal(q.counts().completed,288);
});
test('a severely constrained signal still makes progress across green phases',()=>{
 const q=make({capacity:()=>.016,green:(e,t)=>t%90<45,storageSlots:()=>100});for(let i=0;i<30;i++)q.enqueue({id:`v${i}`,edge_ids:['ab']},0);
 q.step(0);for(let t=5;t<=900;t+=5)q.step(t);assert.equal(q.counts().completed,7);
});
