import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {simulationCatalog,createSimulationCatalog} from '../../../playground/fleetlab/src/ui/simulation-catalog.js';
import {QUESTION_FAMILIES} from '../hosted/visitor-families.mjs';
import {decorateVisitors,animateOutcomeCounts} from '../hosted/visitor.mjs';
import {createDepotFlowLab} from '../../../playground/fleetlab/src/ui/depot-flow-lab.js';
import {requestOutcomes} from '../../../playground/fleetlab/src/ui/operations-lab.js';

test('concept diagrams follow the active lesson without duplicates or changing results',()=>{
 const restore=installFakeDom(),previous=globalThis.MutationObserver;let redraw;
 globalThis.MutationObserver=class{constructor(fn){redraw=fn;}observe(){}};
 const lab=createDepotFlowLab();document.body.appendChild(lab.element);
 try{
  decorateVisitors(document);decorateVisitors(document);
  assert.equal(lab.element.querySelectorAll('.visitor-diagram').length,1);
  assert.equal(lab.element.querySelector('.visitor-diagram img').getAttribute('alt'),'Two autonomous pods sharing one network link, each with a deadline.');
  lab.setLesson({id:'crossed-priorities'});redraw();
  assert.equal(lab.element.querySelectorAll('.visitor-diagram').length,1);
  assert.equal(lab.element.querySelector('.visitor-diagram img').getAttribute('alt'),'Four pods with mismatched upload sizes and deadlines sharing one link.');
  assert.equal(lab.element.querySelector('.visitor-diagram figcaption').textContent,'Concept illustration · not simulation output');
  assert.equal(lab.getState().result,null);
 }finally{lab.destroy();globalThis.MutationObserver=previous;restore();}
});

test('nine curated question families cover all catalogue lessons exactly once',()=>{
 const ids=QUESTION_FAMILIES.flatMap(f=>f.lessons);
 assert.equal(QUESTION_FAMILIES.length,9);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids.sort(),simulationCatalog().map(r=>r.id).sort());
});
test('illustrated navigation delegates filtering, remains idempotent and clears selection',()=>{
 const restore=installFakeDom();try{
  const root=createSimulationCatalog().element;document.body.appendChild(root);
  decorateVisitors(document);decorateVisitors(document);
  assert.equal(document.querySelectorAll('#visitor-families').length,1);
  const buttons=root.querySelectorAll('[data-family]');assert.equal(buttons.length,9);
  buttons[1].click();assert.equal(buttons[1].getAttribute('aria-pressed'),'true');
  assert.equal(root.querySelectorAll('.catalog-card').length,5);
  assert.equal(root.querySelector('.catalog-library-title').textContent,'Charging & energy · lesson library');
  const search=root.querySelector('input');search.value='no such lesson';search.dispatchEvent(new Event('input'));
  assert.equal(root.querySelectorAll('.catalog-card').length,0);
  root.querySelector('.catalog-count-row button').click();
  assert.ok(buttons.every(b=>b.getAttribute('aria-pressed')==='false'));
  assert.equal(root.querySelectorAll('.catalog-card').length,61);
  assert.equal(root.querySelector('.catalog-library-title').textContent,'The complete learning library');
  assert.equal(root.querySelector('#visitor-family-status').textContent,'All question families');
 }finally{restore();}
});
test('City tiles delegate to the existing section controls without adding run state',()=>{
 const restore=installFakeDom();try{
  const welcome=document.createElement('section');welcome.id='welcome-view';document.body.appendChild(welcome);
  const tabs=document.createElement('nav');tabs.className='tabs';document.body.appendChild(tabs);
  let selected=null;for(const name of ['atlas','compare','replay','models']){const b=document.createElement('button');b.setAttribute('data-view',name);b.addEventListener('click',()=>selected=name);tabs.appendChild(b);}
  decorateVisitors(document);decorateVisitors(document);
  assert.equal(document.querySelectorAll('.visitor-city-card').length,4);
  for(const card of document.querySelectorAll('.visitor-city-card')){card.click();assert.equal(selected,card.getAttribute('data-city-section'));}
 }finally{restore();}
});

test('Home has one purpose heading, a first lesson and the existing film retained',()=>{
 const restore=installFakeDom();try{
  const home=document.createElement('main');home.className='studio-overview';document.body.appendChild(home);
  const feature=document.createElement('section');feature.className='design-readiness';home.appendChild(feature);
  const link=document.createElement('a');link.className='design-primary';link.href='/network-flows/capacity/';feature.appendChild(link);
  const copy=document.createElement('div');copy.className='film-copy';home.appendChild(copy);
  const title=document.createElement('h1');title.textContent='Old heading';copy.appendChild(title);
  const video=document.createElement('video');video.setAttribute('src','original-film.mp4');home.appendChild(video);
  decorateVisitors(document);decorateVisitors(document);
  assert.equal(home.querySelectorAll('h1').length,1);
  assert.equal(home.querySelector('.visitor-first-action').textContent,'Start with a 3-minute lesson →');
  assert.equal(link.getAttribute('href'),'/#/depot-flow-lab?lesson=two-vehicles');
  assert.equal(home.querySelector('video'),video);assert.equal(video.getAttribute('src'),'original-film.mp4');
 }finally{restore();}
});
test('dispatch opportunity-cost art has the supplied alt, concept caption and no duplicate insertion',()=>{
 const restore=installFakeDom();try{
  const bench=document.createElement('div'),copy=document.createElement('p');copy.id='chapter-copy';bench.appendChild(copy);document.body.appendChild(bench);
  decorateVisitors(document);decorateVisitors(document);
  const art=bench.querySelector('.dispatch-concept');assert.ok(art);assert.equal(bench.querySelectorAll('.dispatch-concept').length,1);
  assert.equal(art.querySelector('img').getAttribute('alt'),'Dispatching the car now strands the next rider.');
  assert.equal(art.querySelector('figcaption').textContent,'Concept illustration · not simulation output');
 }finally{restore();}
});

test('replay ribbon moves before the scrubber without cloning intervals or losing seek listeners',()=>{
 const restore=installFakeDom();try{
  const panel=document.createElement('section');document.body.appendChild(panel);
  const timeline=document.createElement('div');timeline.className='timeline';const time=document.createElement('input');time.id='time';timeline.appendChild(time);panel.appendChild(timeline);
  const bar=document.createElement('div');bar.id='shift-bar';const interval=document.createElement('button');bar.appendChild(interval);panel.appendChild(bar);let sought=0;interval.addEventListener('click',()=>sought++);
  const axis=document.createElement('div');axis.className='shift-axis';panel.appendChild(axis);
  decorateVisitors(document);decorateVisitors(document);
  assert.equal(document.querySelectorAll('#shift-bar').length,1);assert.equal(panel.querySelector('.visitor-shift-preview').querySelector('#shift-bar'),bar);
  assert.ok(panel.children.indexOf(panel.querySelector('.visitor-shift-preview'))<panel.children.indexOf(timeline));interval.click();assert.equal(sought,1);
  assert.match(document.querySelector('.visitor-hold-key').textContent,/15-second/);assert.match(document.querySelector('.visitor-hold-key').textContent,/No interpolation/);
 }finally{restore();}
});

test('accepted count-up eases for 1200 ms while accessible counts remain exact, and runs once per result',()=>{
 const restore=installFakeDom();try{
  const root=document.createElement('section');document.body.appendChild(root);root.setAttribute('data-stale','false');root.setAttribute('data-result-accepted','true');
  const row=document.createElement('li');row.setAttribute('data-request-count','177');row.textContent='Completed: 177';root.appendChild(row);
  let frame,requested=0;
  const options={request:fn=>(frame=fn,++requested),cancel:()=>{},allowed:()=>true,now:()=>0};
  const stop=animateOutcomeCounts(root,options);
  frame(600);assert.equal(row.textContent,'Completed: 154');assert.equal(row.getAttribute('aria-label'),'Completed: 177');assert.equal(row.querySelector('span').getAttribute('aria-hidden'),'true');
  assert.equal(root.style.getPropertyValue('--count-progress'),'0.875');
  frame(1200);assert.equal(row.textContent,'Completed: 177');assert.equal(row.getAttribute('aria-label'),'Completed: 177');
  assert.equal(root.classList.contains('visitor-count-reveal'),false);stop();assert.equal(row.getAttribute('data-request-count'),'177');
  const before=requested;animateOutcomeCounts(root,options);assert.equal(requested,before);
 }finally{restore();}
});

const outcomeMetrics={completed_trips:80,unserved_requests:12,pending_requests:5,in_progress_trips:3,total_requests:100};
test('unaccepted, stale, incomplete and initially restricted summaries remain exact without count-up',()=>{
 const restore=installFakeDom();try{
  for(const [metrics,stale,accepted,allowed] of [[outcomeMetrics,false,false,true],[outcomeMetrics,true,true,true],[null,false,true,true],[outcomeMetrics,false,true,false]]){
   const root=requestOutcomes(metrics,stale,{accepted});document.body.appendChild(root);const exact=root.textContent;let requested=0;
   const options={request:()=>requested++,cancel:()=>{},allowed:()=>allowed,now:()=>0};animateOutcomeCounts(root,options);assert.equal(requested,0);assert.equal(root.textContent,exact);assert.equal(root.classList.contains('visitor-count-reveal'),false);
   if(accepted&&!stale&&metrics&&!allowed){animateOutcomeCounts(root,{...options,allowed:()=>true});assert.equal(requested,0,'lifting a restriction does not restart acceptance motion');}
  }
 }finally{restore();}
});

test('restriction, staleness, detachment and cancellation restore final counts and never restart',()=>{
 const restore=installFakeDom();try{
  for(const kind of ['restriction','stale','detach','cancel']){
   const root=requestOutcomes(outcomeMetrics,false,{accepted:true});document.body.appendChild(root);const row=root.querySelector('[data-request-count]');let frame,allowed=true,requested=0;
   const options={request:fn=>(frame=fn,++requested),cancel:()=>{},allowed:()=>allowed,now:()=>0};const stop=animateOutcomeCounts(root,options);frame(600);assert.equal(row.textContent,'Completed: 70');assert.equal(row.getAttribute('aria-label'),'Completed: 80');
   if(kind==='restriction')allowed=false;else if(kind==='stale')root.setAttribute('data-stale','true');else if(kind==='detach')root.remove();else stop();frame(700);
   assert.equal(row.textContent,'Completed: 80');assert.equal(row.getAttribute('aria-label'),'Completed: 80');assert.equal(root.classList.contains('visitor-count-reveal'),false);
   allowed=true;root.setAttribute('data-stale','false');document.body.appendChild(root);const before=requested;animateOutcomeCounts(root,options);assert.equal(requested,before);
  }
 }finally{restore();}
});

function visualMotionHarness({duration='1200ms'}={}){
 const restore=installFakeDom(),previous=globalThis.MutationObserver,mutations=[],intersections=[];
 class MutationObserver{constructor(fn){this.fn=fn;mutations.push(this);}observe(target,options){this.target=target;this.options=options;}}
 class IntersectionObserver{constructor(fn){this.fn=fn;this.targets=new Set();intersections.push(this);}observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}}
 globalThis.MutationObserver=MutationObserver;Object.assign(window,{MutationObserver,IntersectionObserver,performance:{now:()=>0},getComputedStyle:()=>({getPropertyValue:()=>duration})});
 const container=document.createElement('div');container.className='ops-outcome-visual';document.body.appendChild(container);decorateVisitors(document);
 return {container,restore,replace(root){container.replaceChildren(root);mutations.find(o=>o.target===container&&o.options.childList).fn();},attributes(target){for(const observer of mutations)if(observer.target===target&&observer.options.attributes)observer.fn();},show(root,visible=true){for(const observer of intersections)if(observer.targets.has(root))observer.fn([{target:root,isIntersecting:visible}]);},close(){globalThis.MutationObserver=previous;restore();}};
}
test('accepted summary waits until visible, uses the CSS count duration and ignores arbitrary rerenders',()=>{
 const x=visualMotionHarness({duration:'2s'});try{
  const root=requestOutcomes(outcomeMetrics,false,{accepted:true}),row=root.querySelector('[data-request-count]');x.replace(root);
  assert.equal(x.restore.dom.frames.pending,0);assert.equal(row.textContent,'Completed: 80');x.show(root,false);assert.equal(x.restore.dom.frames.pending,0);
  x.show(root);x.restore.dom.frames.flush(1000);assert.equal(row.textContent,'Completed: 70');assert.equal(row.getAttribute('aria-label'),'Completed: 80');
  x.replace(root);x.restore.dom.frames.flush(1500);assert.equal(row.textContent,'Completed: 78','same accepted node keeps its original start time');x.restore.dom.frames.flush(2000);assert.equal(row.textContent,'Completed: 80');
  x.replace(root);x.show(root);assert.equal(x.restore.dom.frames.pending,0);
  const restored=requestOutcomes(outcomeMetrics,false);x.replace(restored);x.show(restored);assert.equal(x.restore.dom.frames.pending,0);
 }finally{x.close();}
});
test('pause, hidden tab or page and reduced motion consume pending or active acceptance without resuming it',()=>{
 for(const kind of ['pause','hidden','page','system','override'])for(const active of [false,true]){
  const x=visualMotionHarness();try{
   const root=requestOutcomes(outcomeMetrics,false,{accepted:true}),row=root.querySelector('[data-request-count]');x.replace(root);if(active){x.show(root);x.restore.dom.frames.flush(600);assert.equal(row.textContent,'Completed: 70');}
   const control=document.querySelector('.visitor-motion-control');
   if(kind==='pause')control.click();else if(kind==='hidden'){document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));}else if(kind==='page'){x.container.hidden=true;x.attributes(x.container);}else if(kind==='system')x.restore.dom.media.set('(prefers-reduced-motion: reduce)',true);else{document.documentElement.setAttribute('data-motion','reduce');x.attributes(document.documentElement);}
   assert.equal(row.textContent,'Completed: 80');assert.equal(x.restore.dom.frames.pending,0);
   if(kind==='pause')control.click();else if(kind==='system')x.restore.dom.media.set('(prefers-reduced-motion: reduce)',false);else if(kind==='page'){x.container.hidden=false;x.attributes(x.container);}else if(kind==='override'){document.documentElement.removeAttribute('data-motion');x.attributes(document.documentElement);}else{document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));}
   x.show(root);x.replace(root);assert.equal(x.restore.dom.frames.pending,0);assert.equal(row.textContent,'Completed: 80');
  }finally{x.close();}
 }
});

test('replacing a summary finishes the old count-up and never revives it when reinserted',()=>{
 const x=visualMotionHarness();try{
  const first=requestOutcomes(outcomeMetrics,false,{accepted:true}),row=first.querySelector('[data-request-count]');x.replace(first);x.show(first);x.restore.dom.frames.flush(600);assert.equal(row.textContent,'Completed: 70');
  const second=requestOutcomes(outcomeMetrics,false,{accepted:true});x.replace(second);assert.equal(row.textContent,'Completed: 80');assert.equal(x.restore.dom.frames.pending,0);
  x.replace(first);x.show(second);x.show(first);assert.equal(x.restore.dom.frames.pending,0);assert.equal(row.textContent,'Completed: 80');
 }finally{x.close();}
});

test('detaching a pending summary consumes its reveal before the same page is reattached',()=>{
 const x=visualMotionHarness();try{
  const root=requestOutcomes(outcomeMetrics,false,{accepted:true});x.replace(root);x.container.remove();x.show(root,false);
  document.body.appendChild(x.container);x.show(root);assert.equal(x.restore.dom.frames.pending,0);assert.equal(root.querySelector('[data-request-count]').textContent,'Completed: 80');
 }finally{x.close();}
});

test('approved hero treatment adds concept artwork without numeric overlays or replay controls',()=>{
 const restore=installFakeDom();try{
  const main=document.createElement('main');main.id='main';document.body.appendChild(main);
  const hero=document.createElement('section');hero.className='hero';main.appendChild(hero);
  const control=document.createElement('button');control.textContent='Run comparison';let runs=0;control.addEventListener('click',()=>runs++);hero.appendChild(control);
  decorateVisitors(document);decorateVisitors(document);
  assert.equal(hero.querySelectorAll('.visitor-ambient-art').length,1);assert.match(hero.textContent,/Concept illustration · not simulation output/);
  assert.equal(hero.querySelectorAll('button').length,1);assert.equal(runs,0);assert.doesNotMatch(hero.textContent,/48.hours|V12|65 min|countdown/);
 }finally{restore();}
});

test('public reporting is sourced, labeled and separate from model results without starting a run',()=>{
 const restore=installFakeDom();try{
  const hero=document.createElement('section');hero.className='r1-hero';document.body.appendChild(hero);
  const art=document.createElement('figure');hero.appendChild(art);
  const results=document.createElement('section');results.id='results';document.body.appendChild(results);
  let runs=0;const run=document.createElement('button');run.addEventListener('click',()=>runs++);document.body.appendChild(run);
  decorateVisitors(document);decorateVisitors(document);
  const note=hero.querySelector('.visitor-field');assert.ok(note);
  assert.equal(hero.querySelectorAll('.visitor-field').length,1);
  assert.match(note.textContent,/Public reporting · not FleetLab simulation evidence/);
  const citation=note.querySelector('a');assert.equal(new URL(citation.getAttribute('href')).protocol,'https:');assert.match(citation.textContent,/↗$/);
  assert.ok(hero.children.indexOf(note)>hero.children.indexOf(art));assert.equal(results.textContent,'');assert.equal(runs,0);
 }finally{restore();}
});

test('fleet-day field notes follow lesson replacement and disappear for unsupported or generic frames',()=>{
 const restore=installFakeDom(),previous=globalThis.MutationObserver,callbacks=new Map();
 globalThis.MutationObserver=class{constructor(fn){this.fn=fn;}observe(target){callbacks.set(target,this.fn);}};
 try{
  const intro=document.createElement('div');document.body.appendChild(intro);
  const teaching=document.createElement('div');teaching.className='ops-teaching';intro.appendChild(teaching);
  const select=id=>{const frame=document.createElement('section');frame.className='teaching-frame';frame.setAttribute('data-frame',id);teaching.replaceChildren(frame);callbacks.get(teaching)?.();};
  select('depot-count');decorateVisitors(document);decorateVisitors(document);
  assert.equal(intro.querySelectorAll('.visitor-field').length,1);assert.match(intro.querySelector('.visitor-field').textContent,/Lyft/);
  select('staffing-readiness');assert.equal(intro.querySelectorAll('.visitor-field').length,1);assert.match(intro.querySelector('.visitor-field').textContent,/Waymo/);assert.doesNotMatch(intro.querySelector('.visitor-field').textContent,/Lyft/);
  select('region-launch');assert.equal(intro.querySelectorAll('.visitor-field').length,1);assert.match(intro.querySelector('.visitor-field').textContent,/As of late September 2026/);assert.match(intro.querySelector('.visitor-field a').textContent,/Covington · October 1, 2026 ↗/);
  for(const id of ['charging','capacity','unavailable']){select(id);assert.equal(intro.querySelectorAll('.visitor-field').length,0);}
  select('upload');assert.match(intro.querySelector('.visitor-field').textContent,/NTT/);assert.equal(teaching.querySelector('.visitor-field'),null);
 }finally{globalThis.MutationObserver=previous;restore();}
});
