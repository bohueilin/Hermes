import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createFakeDom,FakeEvent} from './helpers/fake-dom.mjs';
import {createMethodologyExplainer} from '../src/ui/methodology-explainer.js';

function setup(kind='paired',options={}){
 const dom=createFakeDom(options),observers=[];
 dom.window.MutationObserver=class{constructor(fn){this.fn=fn;this.active=false;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}};
 const root=createMethodologyExplainer(kind,dom.document);dom.document.body.append(root);
 return {...dom,root,replay:root.querySelector('[data-explainer-replay]'),pause:root.querySelector('[data-explainer-pause]'),mutate(){for(const o of observers)if(o.active)o.fn();},observers};
}
function start(x){x.replay.click();x.frames.flush(0);}
test('all explainers start static, disclose their illustrative scope, and expose text without animation',()=>{
 for(const kind of ['paired','guardrails','deadhead']){
  const x=setup(kind);assert.equal(x.frames.pending,0);assert.equal(x.root.getAttribute('data-explainer-state'),'idle');
  assert.match(x.root.textContent,/Illustration · not simulation output/);assert.ok(x.root.querySelector('.explainer-equivalent').textContent.length>100);
  assert.equal(x.root.querySelector('svg').getAttribute('aria-hidden'),'true');assert.ok(x.pause.disabled);
 }
 assert.throws(()=>createMethodologyExplainer('unknown',createFakeDom().document),/Unknown explainer/);
});
test('paired lanes fill together before one supply change and the delta reveal',()=>{
 const x=setup();start(x);x.frames.flush(450);
 const lanes=x.root.querySelectorAll('[data-paired-lane]');assert.equal(lanes[0].getAttribute('width'),lanes[1].getAttribute('width'));assert.ok(Number(lanes[0].getAttribute('width'))>0);
 assert.equal(x.root.querySelector('[data-paired-supply]').textContent,'40 cars');
 x.frames.flush(1100);assert.equal(x.root.querySelector('[data-paired-supply]').textContent,'52 cars');
 x.frames.flush(1800);assert.equal(x.root.getAttribute('data-explainer-state'),'complete');assert.equal(x.frames.pending,0);assert.match(x.root.textContent,/Pairing reduces noise; it does not remove uncertainty/);
 assert.equal(x.observers.filter(o=>o.active).length,0);
});
test('guardrail only turns red after crossing its declared limit, then reveals HOLD',()=>{
 const x=setup('guardrails');start(x);x.frames.flush(900);
 const bar=x.root.querySelector('[data-guardrail-bar]');assert.ok(Number(bar.getAttribute('width'))<234);assert.equal(bar.classList.contains('explainer-danger'),false);
 x.frames.flush(1440);assert.ok(Number(bar.getAttribute('width'))>234);assert.ok(bar.classList.contains('explainer-danger'));
 x.frames.flush(1800);assert.equal(x.root.querySelector('.explainer-hold').getAttribute('opacity'),'1');assert.match(x.root.textContent,/mean change in wait p90/);assert.match(x.root.textContent,/validity first/);
});
test('guardrail wash and HOLD entrance share the pausable clock and reduced-motion final frame',()=>{
 const x=setup('guardrails'),wash=x.root.querySelector('.explainer-wash'),hold=x.root.querySelector('.explainer-hold');
 assert.equal(wash.getAttribute('opacity'),'0.4');assert.equal(hold.getAttribute('transform'),'translate(0 0)');
 start(x);assert.equal(wash.getAttribute('opacity'),'0');assert.equal(hold.getAttribute('transform'),'translate(0 8)');
 x.frames.flush(1620);assert.ok(Math.abs(Number(wash.getAttribute('opacity'))-.2)<1e-9);assert.ok(Math.abs(Number(hold.getAttribute('opacity'))-.5)<1e-9);
 x.pause.click();const stopped=hold.getAttribute('transform');x.frames.flush(5000);assert.equal(hold.getAttribute('transform'),stopped);assert.equal(x.frames.pending,0);
 x.media.set('(prefers-reduced-motion: reduce)',true);assert.equal(wash.getAttribute('opacity'),'0.4');assert.equal(hold.getAttribute('transform'),'translate(0 0)');assert.equal(hold.getAttribute('opacity'),'1');assert.equal(x.frames.pending,0);
 x.replay.click();assert.equal(wash.getAttribute('opacity'),'0.4');assert.equal(x.frames.pending,0);
});
test('deadhead counts illustrative distance, including half the fifth circuit, rather than trip fractions',()=>{
 const x=setup('deadhead');start(x);x.frames.flush(6400);assert.equal(x.root.getAttribute('data-empty-distance'),'40');
 x.frames.flush(7200);assert.equal(x.root.getAttribute('data-empty-distance'),'45');assert.equal(x.root.getAttribute('data-total-distance'),'45');
 x.frames.flush(8000);assert.equal(x.root.getAttribute('data-empty-distance'),'45');assert.equal(x.root.querySelector('[data-car]').getAttribute('data-empty'),'false');
 x.frames.flush(16000);assert.equal(x.root.getAttribute('data-total-distance'),'100');assert.equal(x.root.querySelector('[data-empty-share]').textContent,'45% empty');assert.equal(x.frames.pending,0);assert.match(x.root.textContent,/four circuits and half of a fifth/);
});
test('local and global pause stop elapsed time; resuming requires a user gesture',()=>{
 const x=setup();start(x);x.frames.flush(300);x.pause.click();const before=x.root.querySelector('[data-paired-lane]').getAttribute('width');assert.equal(x.frames.pending,0);
 x.pause.click();x.frames.flush(5000);assert.equal(x.root.querySelector('[data-paired-lane]').getAttribute('width'),before);x.frames.flush(5100);
 x.document.documentElement.dataset.visitorMotion='paused';x.mutate();assert.equal(x.root.getAttribute('data-explainer-state'),'paused');assert.equal(x.frames.pending,0);
 x.pause.click();assert.equal(x.frames.pending,0);x.document.documentElement.dataset.visitorMotion='running';x.mutate();assert.equal(x.frames.pending,0);
 x.pause.click();assert.equal(x.frames.pending,1);x.frames.flush(6000);x.frames.flush(8000);assert.equal(x.frames.pending,0);
});
test('system or application reduced motion shows final immediately, including mid-flight changes',()=>{
 const query='(prefers-reduced-motion: reduce)',x=setup('deadhead',{media:{[query]:true}});x.replay.click();assert.equal(x.frames.pending,0);assert.equal(x.root.getAttribute('data-total-distance'),'100');
 x.media.set(query,false);start(x);x.frames.flush(1000);x.media.set(query,true);assert.equal(x.frames.pending,0);assert.equal(x.root.getAttribute('data-total-distance'),'100');
 const y=setup();start(y);y.document.documentElement.dataset.motion='reduce';y.mutate();assert.equal(y.frames.pending,0);assert.equal(y.root.querySelector('[data-paired-supply]').textContent,'52 cars');
});
test('hidden, detached and navigated explainers release active observers and frames without replaying',()=>{
 for(const mode of ['hidden','detached','navigation','document-hidden']){
  const x=setup('deadhead');start(x);x.frames.flush(400);
  if(mode==='hidden'){x.root.hidden=true;x.mutate();}
  if(mode==='detached'){x.pause.click();x.root.remove();x.mutate();}
  if(mode==='navigation')x.window.dispatchEvent(new FakeEvent('hashchange'));
  if(mode==='document-hidden'){x.document.hidden=true;x.document.dispatchEvent(new FakeEvent('visibilitychange'));}
  assert.equal(x.frames.pending,0);assert.equal(x.observers.filter(o=>o.active).length,0);assert.equal(x.root.getAttribute('data-explainer-state'),'complete');
  x.document.body.append(x.root);x.root.hidden=false;x.mutate();assert.equal(x.frames.pending,0);
 }
});
