import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {conceptPrimer} from '../../../playground/fleetlab/src/ui/concept-primer.js';
import * as brand from '../hosted/brand.mjs';

const cfg={radio:600,client:100,down:20,up:50,read:1000,cache:'cold',capacity:20};
function harness({running=true,reduced=false,observer=true}={}){
 const restore=installFakeDom(globalThis,{media:{'(prefers-reduced-motion: reduce)':reduced}}),mutations=[],intersections=[];
 class MutationObserver{constructor(fn){this.fn=fn;mutations.push(this);}observe(target,options){this.target=target;this.options=options;this.active=true;}disconnect(){this.active=false;}}
 class IntersectionObserver{constructor(fn){this.fn=fn;this.targets=new Set();intersections.push(this);}observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}disconnect(){this.targets.clear();}}
 Object.assign(window,{MutationObserver,...(observer?{IntersectionObserver}:{})});
 if(running!==null)document.documentElement.setAttribute('data-visitor-motion',running?'running':'paused');
 const make=()=>{const page=document.createElement('section'),p=brand.DepotPipe(document,cfg);page.appendChild(p);page.appendChild(conceptPrimer('fleet'));document.body.appendChild(page);brand.decorateFleetCycle(document);return{page,p,targets:[...page.querySelectorAll('[data-concept-motion]')]};};
 const mutate=(target=document.body)=>{for(const o of mutations)if(o.active&&(o.target===target||o.options.subtree&&o.target.contains(target)))o.fn([{target,type:'attributes',addedNodes:target===document.body?[target]:[],removedNodes:[]}]);};
 const show=(target,visible=true)=>{for(const o of intersections)if(o.targets.has(target))o.fn([{target,isIntersecting:visible,intersectionRatio:visible?1:0}]);};
 const state=target=>target.getAttribute('data-concept-motion-state');
 return{restore,make,mutate,show,state,mutations,intersections,install:()=>brand.installConceptMotion(document),running(value){document.documentElement.setAttribute('data-visitor-motion',value?'running':'paused');mutate(document.documentElement);},close(){window.dispatchEvent(new Event('pagehide'));restore();}};
}

test('warm cache motion bypasses only WAN down and keeps actual saturated upload annotation',()=>{
 const restore=installFakeDom();try{
 const p=brand.DepotPipe(document,cfg);document.body.appendChild(p);
 assert.equal(p.querySelector('[data-path="upload"]').getAttribute('data-pipe-active'),'true');
 assert.equal(p.querySelector('[data-path="warm-delivery"]').getAttribute('data-pipe-active'),'false');
 assert.match(p.querySelector('[data-pipe-pressure]').textContent,/WAN up at capacity: 50\.0 \/ 50 Mbps/);
 const before=p.querySelector('[data-pipe-rates]').textContent;
 p.querySelector('select').value='warm';p.querySelector('select').dispatchEvent(new Event('change'));
 assert.equal(p.querySelector('[data-path="software"]').getAttribute('data-pipe-active'),'false');
 assert.equal(p.querySelector('[data-path="warm-delivery"]').getAttribute('data-pipe-active'),'true');
 assert.equal(p.querySelector('[data-path="upload"]').getAttribute('data-pipe-active'),'true');
 assert.equal(p.querySelector('[data-path="cache-fill"]').getAttribute('data-pipe-active'),'false');
 assert.match(p.querySelector('[data-pipe-pressure]').textContent,/WAN up at capacity: 50\.0 \/ 50 Mbps/);
 assert.match(before,/10\.0 Mbps per download/);assert.match(p.querySelector('[data-pipe-rates]').textContent,/100\.0 Mbps per download/);
 p.querySelectorAll('input')[1].value='0';p.querySelectorAll('input')[1].dispatchEvent(new Event('change'));
 assert.equal(p.querySelector('[data-path="upload"]').getAttribute('data-pipe-active'),'false');
 assert.match(p.querySelector('[data-pipe-pressure]').textContent,/WAN up idle: 0\.0 \/ 50 Mbps/);
 }finally{restore();}
});

test('fleet primer has a complete nominal cycle with conditional holds outside it',()=>{
 const restore=installFakeDom();try{
 document.body.appendChild(conceptPrimer('fleet'));brand.decorateFleetCycle(document);brand.decorateFleetCycle(document);
 const f=document.querySelector('[data-concept="fleet"] figure');
 assert.equal(f.querySelectorAll('svg').length,1);
 assert.deepEqual([...f.querySelectorAll('.concept-cycle-steps strong')].map(n=>n.textContent),['Pickup','Passenger trip','Depot','Redispatch']);
 assert.match(f.querySelector('.concept-cycle-conditions').textContent,/Conditional holds/);assert.equal(f.querySelector('.concept-cycle-conditions').getAttribute('aria-label'),'Conditional holds');
 assert.equal(f.querySelector('.concept-cycle-steps .concept-cycle-conditions'),null);
 assert.equal(f.querySelector('figcaption').textContent,'Concept illustration · not simulation output');
 assert.equal(f.querySelectorAll('video,img').length,0);
 }finally{restore();}
});

test('unknown global state, global pause and explicit user pause veto visible concept motion',()=>{
 for(const running of[null,false,true]){const h=harness({running});try{
 const x=h.make();h.install();for(const n of x.targets){assert.equal(h.state(n),'paused');h.show(n);assert.equal(h.state(n),running?'running':'paused');}
 document.documentElement.setAttribute('data-visitor-user-paused','');h.mutate(document.documentElement);
 for(const n of x.targets)assert.equal(h.state(n),'paused');
 h.running(true);for(const n of x.targets)assert.equal(h.state(n),'paused');
 document.documentElement.removeAttribute('data-visitor-user-paused');h.mutate(document.documentElement);
 for(const n of x.targets)assert.equal(h.state(n),'running');
 h.running(false);for(const n of x.targets)assert.equal(h.state(n),'paused');
 }finally{h.close();}}
});

test('offscreen, hidden document, closed primer and reduced motion stop animation with diagrams retained',()=>{
 const h=harness();try{
 const x=h.make();h.install();for(const n of x.targets)h.show(n);
 h.show(x.targets[0],false);assert.equal(h.state(x.targets[0]),'paused');h.show(x.targets[0]);assert.equal(h.state(x.targets[0]),'running');
 document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));for(const n of x.targets)assert.equal(h.state(n),'paused');
 document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));
 x.page.hidden=true;h.mutate(x.page);for(const n of x.targets)assert.equal(h.state(n),'paused');
 x.page.hidden=false;x.page.setAttribute('aria-hidden','true');h.mutate(x.page);for(const n of x.targets)assert.equal(h.state(n),'paused');
 x.page.removeAttribute('aria-hidden');h.mutate(x.page);for(const n of x.targets)assert.equal(h.state(n),'running');
 const details=x.page.querySelector('details');details.removeAttribute('open');h.mutate(details);assert.equal(h.state(x.targets[1]),'paused');assert.equal(h.state(x.targets[0]),'running');
 details.setAttribute('open','');h.mutate(details);assert.equal(h.state(x.targets[1]),'running');
 h.restore.dom.media.set('(prefers-reduced-motion: reduce)',true);for(const n of x.targets)assert.equal(h.state(n),'paused');
 assert.equal(x.page.querySelectorAll('figcaption').length,1);assert.ok(x.page.querySelector('.concept-cycle-steps'));
 h.restore.dom.media.set('(prefers-reduced-motion: reduce)',false);for(const n of x.targets)assert.equal(h.state(n),'running');
 document.documentElement.setAttribute('data-motion','reduce');h.mutate(document.documentElement);for(const n of x.targets)assert.equal(h.state(n),'paused');
 }finally{h.close();}
});

test('route teardown unregisters detached diagrams and stale callbacks cannot resume them',()=>{
 const h=harness();try{
 const x=h.make();h.install();h.install();assert.equal(h.intersections.length,1);
 for(const n of x.targets)h.show(n);
 x.page.remove();h.mutate();for(const n of x.targets)assert.equal(h.state(n),'paused');assert.equal(h.intersections[0].targets.size,0);
 h.intersections[0].fn(x.targets.map(target=>({target,isIntersecting:true,intersectionRatio:1})));for(const n of x.targets)assert.equal(h.state(n),'paused');
 document.body.appendChild(x.page);h.mutate();for(const n of x.targets){assert.equal(h.state(n),'paused');h.show(n);assert.equal(h.state(n),'running');}
 window.dispatchEvent(new Event('pagehide'));for(const n of x.targets)assert.equal(h.state(n),'paused');assert.equal(h.intersections[0].targets.size,0);assert.ok(h.mutations.every(o=>!o.active));
 }finally{h.close();}
});

test('missing viewport observer fails closed with static diagrams',()=>{
 const h=harness({observer:false});try{const x=h.make();h.install();for(const n of x.targets)assert.equal(h.state(n),'paused');}finally{h.close();}
});

test('back-forward cache suspension resumes only under the current global permission',()=>{
 const h=harness();try{
 const x=h.make();h.install();for(const n of x.targets)h.show(n);
 const event=new Event('pagehide');event.persisted=true;window.dispatchEvent(event);for(const n of x.targets)assert.equal(h.state(n),'paused');
 h.running(false);window.dispatchEvent(new Event('pageshow'));for(const n of x.targets)assert.equal(h.state(n),'paused');
 h.running(true);for(const n of x.targets)assert.equal(h.state(n),'running');assert.equal(h.intersections.length,1);
 }finally{h.close();}
});
