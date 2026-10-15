import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fixture,hash,copy} from '../src/model/dispatch-contract.js';import {runDispatch} from '../src/model/dispatch.js';import {verifyDispatch,verifyStudy} from '../src/model/dispatch-verify.js';
const rehash=r=>{delete r.digest;r.digest=hash(r);return r;};
test('checker independently accepts both fixtures and all manual phases',()=>{for(const id of ['default','counterexample','neutral']){const x=fixture(id),pair=['greedy','joint'].map(p=>runDispatch(x,p));assert.equal(verifyStudy(pair,x).ok,true);for(const r of pair)assert.deepEqual(verifyDispatch(r),{ok:true,errors:[]});}for(const end of [0,30,1200])assert.equal(verifyDispatch(runDispatch(fixture(),'manual',{end,decisions:Array.from({length:end/30},(_,i)=>({t:i*30,pairs:[]}))})).ok,true);});
test('rehashed metric, missing event, ledger, phase and policy decisions fail closed',()=>{const source=runDispatch(fixture(),'joint');for(const mutate of [r=>r.metrics.served++,r=>r.events.splice(3,1),r=>r.ledger.splice(1,1),r=>r.phase='PRE_DISPATCH',r=>r.final.vehicles[0].at[0]++,r=>r.decisions[0].pairs.pop(),r=>r.events.reverse(),r=>r.extra=1]){const r=copy(source);mutate(r);assert.equal(verifyDispatch(rehash(r)).ok,false);}});
test('complete individually valid foreign records do not make a study',()=>{const x=fixture(),y=copy(x);y.requests[0].deadline=180;const pair=[runDispatch(x,'greedy'),runDispatch(y,'joint')];assert.equal(verifyDispatch(pair[1]).ok,true);assert.equal(verifyStudy(pair,x).ok,false);assert.equal(verifyStudy([pair[0],pair[0]],x).ok,false);});
test('bounded checker rejects oversized and malformed evidence before acceptance',()=>{assert.equal(verifyDispatch(null).ok,false);assert.equal(verifyDispatch({padding:'x'.repeat(262145)}).ok,false);const r=runDispatch(fixture(),'joint');r.events=Array(257).fill(r.events[0]);assert.equal(verifyDispatch(rehash(r)).ok,false);});
test('checker has no producer or shared scheduling import',()=>{const text=readFileSync(new URL('../src/model/dispatch-verify.js',import.meta.url),'utf8');assert.doesNotMatch(text,/from ['"].*dispatch\.js|runDispatch\s*\(/);});
test('analytical zero trip and deadline phase independently checked',()=>{const x={horizon:60,vehicles:[{id:'ev-001',at:[0,0]}],requests:[{id:'r-001',arrival:0,origin:[0,0],destination:[0,0],deadline:30},{id:'r-002',arrival:30,origin:[0,0],destination:[0,0],deadline:60}]};assert.equal(verifyDispatch(runDispatch(x,'joint')).ok,true);});
test('all small grid workloads independently reconstruct, including clipped runs and idle waits',()=>{
 let seed=17;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let k=0;k<160;k++){
  const horizon=30*(1+random(40)),vehicles=Array.from({length:1+random(4)},(_,i)=>({id:`ev-00${i+1}`,at:[random(5),random(5)]}));
  const requests=Array.from({length:random(9)},(_,i)=>{const arrival=30*random(horizon/30+1);return {id:`r-00${i+1}`,arrival,origin:[random(5),random(5)],destination:[random(5),random(5)],deadline:arrival+30*random((horizon-arrival)/30+1)};});
  for(const policy of ['greedy','joint']){const r=runDispatch({horizon,vehicles,requests},policy);assert.deepEqual(verifyDispatch(r),{ok:true,errors:[]},`${k} ${policy}`);const m=r.metrics;assert.equal(m.admitted,m.completed+m.unfinished+m.assigned+m.pending+m.expired);assert.equal(m.served,m.completed+m.unfinished);}
 }
});
test('rehashed pre-decision feasibility and terminal identity alterations are rejected',()=>{
 const source=runDispatch(fixture(),'joint');for(const mutate of [r=>r.preDecision[0].edges.pop(),r=>r.preDecision[0].edges[0].pickupAt++,r=>r.preDecision[0].phase='POST_BOUNDARY',r=>r.end=1170,r=>r.quantum=60,r=>r.final.pairs.push(['r-001','ev-001'])]){const r=copy(source);mutate(r);assert.equal(verifyDispatch(rehash(r)).ok,false);}
});
