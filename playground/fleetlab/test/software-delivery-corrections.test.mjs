import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {DELIVERY_STUDY} from '../src/data/software-delivery-study.js';
import {reconstructDeliveryPair} from '../src/runtime/software-delivery-worker.js';
import {createDeliveryProjection,deliveryCaption} from '../src/ui/software-delivery-view.js';
import {createDeliveryPage} from '../src/ui/software-delivery-page.js';
import {startSoftwareDelivery} from '../src/ui/software-delivery-app.js';
const pairs=new Map();
const pair=id=>{if(!pairs.has(id))pairs.set(id,reconstructDeliveryPair(DELIVERY_STUDY.cases[id]));return pairs.get(id);};
const create=opts=>{const p=createDeliveryPage({manifest:DELIVERY_STUDY,runPair:e=>Promise.resolve(reconstructDeliveryPair(e)),...opts});document.body.appendChild(p.element);return p;};
const click=(p,label)=>{const b=[...p.element.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b, label);b.click();return b;};
test('receipt ownership, complete copies and causal task order agree at the selected boundary',()=>{
 const c=createDeliveryProjection(pair('default').records.cold),r=createDeliveryProjection(pair('default').records.repeated);
 assert.equal(c.at(0,'V1').chain.receipt,'waiting');assert.equal(c.at(96000,'V1').chain.receipt,'active');
 assert.equal(r.at(480000,'V1').chain.receipt,'active');assert.equal(c.at(288000,'V1').chain.receipt,'complete');
 assert.deepEqual(c.at(96000).whole_copies,{complete:1,total:1});assert.deepEqual(r.at(96000).whole_copies,{complete:0,total:4});
 const labels=c.events.filter(e=>e.t_ms===288000).map(e=>e.label);
 assert.ok(labels.indexOf('V1: local received')<labels.indexOf('V1: check started'));
 const caption=deliveryCaption({projections:{cold:c,repeated:r}},{t_ms:96000,vehicle:'V1'});
 assert.match(caption,/Cold shared cache/);assert.match(caption,/Repeated download/);assert.match(caption,/whole cop/);
});
test('accepted lifecycle suspension is status neutral; active cancellation stops late acceptance',async()=>{
 const restore=installFakeDom();let p;try{
 p=create();await p.load();const status=p.element.querySelector('.delivery-status').textContent;
 p.suspend();p.historyRestore();assert.equal(p.element.querySelector('.delivery-status').textContent,status);
 p.selectPreset('default');assert.doesNotMatch(p.element.querySelector('.delivery-status').textContent,/Previous setup/);
 p.destroy();let finish,stops=0;p=create({runPair:()=>new Promise(r=>finish=r),cancelPair:()=>stops++});
 const load=p.load();p.suspend();finish(pair('default'));await load;assert.equal(p.getState().accepted,null);assert.ok(stops>=2);
 }finally{p?.destroy();restore();}
});
test('restricted playback presents working snapshots and stateful accessible controls',async()=>{
 const restore=installFakeDom();let p;try{
 p=create({reducedMotion:()=>true});await p.load();
 assert.match(p.element.querySelector('.delivery-guide').textContent,/Six held snapshots/);
 const play=[...p.element.querySelectorAll('button')].find(b=>b.textContent==='Play timeline · 30×');assert.ok(play.hidden);
 click(p,'Next chapter');assert.equal(p.player().state().time_ms,96000);assert.equal(p.player().state().playing,false);
 assert.equal(p.element.querySelector('input[type="range"]').getAttribute('aria-valuetext'),'96 s of 2400 s');
 const cold=p.element.querySelector('.delivery-arm.cold').querySelector('[data-vehicle="V1"]');assert.match(cold.getAttribute('aria-label'),/Cold shared cache.*V1.*receiving/);
 }finally{p?.destroy();restore();}
});
test('counterexample opens at cause with whole-run individual outcomes already available',async()=>{
 const restore=installFakeDom();let p;try{p=create();p.selectPreset('two-arrivals');await p.load();assert.equal(p.player().state().time_ms,150000);
 assert.match(p.element.querySelector('.delivery-vehicle-outcome').textContent,/234 s.*278 s/);
 click(p,'See outcomes');assert.equal(p.player().state().time_ms,334000);click(p,'See why');assert.equal(p.player().state().time_ms,150000);
 }finally{p?.destroy();restore();}
});
test('explicit watch focus moves to comparison, cancel restores trigger, unrelated focus is preserved',async()=>{
 const restore=installFakeDom();let p;try{p=create();const watch=p.element.querySelector('.delivery-primary');watch.focus();await p.load();assert.ok(document.activeElement===p.element.querySelector('.delivery-guide h2'),'focus enters comparison');
 p.destroy();let finish;p=create({runPair:()=>new Promise(r=>finish=r)});const pending=p.load();const cancel=[...p.element.querySelectorAll('button')].find(b=>b.textContent==='Cancel computation');cancel.focus();p.cancel();assert.ok(document.activeElement===p.element.querySelector('.delivery-primary'),'focus returns to Watch');finish(pair('default'));await pending;
 }finally{p?.destroy();restore();}
});
test('failed boot preserves readable static fallback and does not claim checked results',()=>{
 const restore=installFakeDom();try{const root=document.createElement('div');root.id='delivery-root';root.textContent='Software delivery is loading. Home';document.body.appendChild(root);
 assert.doesNotThrow(()=>startSoftwareDelivery({manifest:{}}));assert.match(root.textContent,/could not start/i);assert.doesNotMatch(root.textContent,/Loaded records checked/);
 }finally{restore();}
});
