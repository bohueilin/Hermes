import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {simulationCatalog,createSimulationCatalog} from '../../../playground/fleetlab/src/ui/simulation-catalog.js';
import {QUESTION_FAMILIES} from '../hosted/visitor-families.mjs';
import {decorateVisitors} from '../hosted/visitor.mjs';
import {createDepotFlowLab} from '../../../playground/fleetlab/src/ui/depot-flow-lab.js';

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
  const search=root.querySelector('input');search.value='no such lesson';search.dispatchEvent(new Event('input'));
  assert.equal(root.querySelectorAll('.catalog-card').length,0);
  root.querySelector('.catalog-count-row button').click();
  assert.ok(buttons.every(b=>b.getAttribute('aria-pressed')==='false'));
  assert.equal(root.querySelectorAll('.catalog-card').length,61);
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
  assert.equal(home.querySelector('.visitor-first-action').textContent,'Start with a 3-minute lesson ↗');
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
