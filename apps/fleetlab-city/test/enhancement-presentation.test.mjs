import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installFakeDom} from '../../../playground/fleetlab/test/helpers/fake-dom.mjs';
import {decorateVisitors} from '../hosted/visitor.mjs';
import * as brand from '../hosted/brand.mjs';
import {parseRoute,routeHref} from '../../../playground/fleetlab/src/ui/routes.js';
import {pairLesson} from '../web/view-model.mjs';

function node(tag,attrs={},text=''){
 const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);n.textContent=text;return n;
}
test('hosted Depot Flow keeps deadline minutes and task durations readable after rerender',()=>{
 const restore=installFakeDom(),prior=globalThis.MutationObserver;const updates=[];
 globalThis.MutationObserver=class{constructor(fn){updates.push(fn);}observe(){}};
 try{
  const hero=node('section',{class:'flow-hero'}),question=node('div',{class:'flow-question'}),table=node('table',{class:'flow-setup-table'});
  const headers=['Due','After upload'].map(t=>node('th',{},t)),cells=['due at minute 15','2 min local step','Already at target'].map(t=>node('td',{},t));
  table.append(...headers,...cells);hero.append(question,table);document.body.appendChild(hero);decorateVisitors(document);
  assert.deepEqual(headers.map(n=>n.textContent),['Due (min)','Local step']);
  assert.deepEqual(cells.map(n=>n.textContent),['15','2 min','At target']);
  cells[0].textContent='due at minute 5';for(const update of updates)update([]);assert.equal(cells[0].textContent,'5');
  assert.equal(hero.querySelectorAll('.visitor-diagram').length,1);
 }finally{globalThis.MutationObserver=prior;restore();}
});
test('Home keeps its thesis, first action, byline and three-stop tour in the approved order',()=>{
 const restore=installFakeDom();try{
  const home=node('main',{class:'studio-overview'});document.body.appendChild(home);
  decorateVisitors(document);decorateVisitors(document);
  const intro=home.querySelector('#visitor-purpose');
  assert.equal(intro.querySelector('h1').textContent,'Explore the work between the rides.');
  const first=intro.querySelector('.visitor-first-action'),byline=intro.querySelector('.visitor-byline');
  assert.equal(byline.textContent,'I’m building this project to learn how autonomous fleets work—and to share what each experiment teaches us.');
  assert.equal(intro.querySelector('h1').nextSibling,intro.querySelector('.visitor-lede'));
  assert.equal(intro.querySelector('.visitor-lede').nextSibling,first);assert.equal(first.nextSibling,byline);
  assert.equal(first.getAttribute('href'),'/#/depot-flow-lab?lesson=two-vehicles');
  const tour=home.querySelector('.visitor-tour');assert.ok(tour);
  assert.equal(tour.querySelector('h2').textContent,'The 15-minute tour');
  assert.deepEqual(tour.querySelectorAll('a').map(a=>a.getAttribute('href')),['/#/walkthrough','/network-flows/dispatch/','/city-explorer/#compare']);
 }finally{restore();}
});
test('brand installs before asynchronous mount and replaces the mark on remount',()=>{
 const restore=installFakeDom(),prior=globalThis.MutationObserver;let changed;
 globalThis.MutationObserver=class{constructor(fn){changed=fn;}observe(){}disconnect(){}};
 try{
  assert.equal(typeof brand.installDesign,'function');brand.installDesign(document);
  for(let i=0;i<2;i++){
   const header=node('header'),mark=node('a',{class:'studio-monogram'},'H');header.appendChild(mark);document.body.appendChild(header);
   changed([{addedNodes:[header]}]);
   assert.equal(mark.querySelector('img').getAttribute('src'),'/site-media/fleetlab-logo.png');
   assert.equal(mark.textContent,'FleetLab');header.remove();
  }
 }finally{globalThis.MutationObserver=prior;restore();}
});
test('scale alias canonicalizes and keeps valid lesson parameters',()=>{
 assert.deepEqual(parseRoute('#/scale'),{page:'scale'});
 assert.equal(routeHref(parseRoute('#/scale?lesson=queue')), '#/scale-lab?lesson=queue');
});
test('trip grammar changes no count, metric, or qualification',()=>{
 for(const delta of [-2,-1,0,1,2]){
  const row={baseline:{completed:10,empty_km_per_completed:3,wait_p90_s:20},candidate:{completed:10+delta,empty_km_per_completed:3,wait_p90_s:20}};
  assert.match(pairLesson(row),new RegExp(`completed ${Math.abs(delta)} (more|fewer|additional) ${Math.abs(delta)===1?'trip,':'trips,'}`));
  assert.ok(pairLesson(row).endsWith('This is one repeat; use all twelve and the stress cases for the broader trade-off.'));
 }
});
test('frozen City presentation singularizes only the exact one-trip sentence',()=>{
 const restore=installFakeDom(),prior=globalThis.MutationObserver;const observers=[];
 globalThis.MutationObserver=class{constructor(fn){observers.push(fn);}observe(){}};
 try{
  const rows=node('tbody',{id:'pair-rows'});document.body.appendChild(rows);
  const story=node('p',{id:'pair-story'},'Repeat 2 · seed 1002. Two depots completed 1 more trips, with 0.2 less empty miles.');document.body.appendChild(story);
  const cell=node('td',{class:'pair-lesson'},'Two depots completed 1 more trips, with 0.2 less empty miles.');rows.appendChild(cell);
  decorateVisitors(document);assert.equal(cell.textContent,'Two depots completed 1 more trip, with 0.2 less empty miles.');
  assert.equal(story.textContent,'Repeat 2 · seed 1002. Two depots completed 1 more trip, with 0.2 less empty miles.');
  cell.textContent='Two depots completed 11 more trips, with 0.2 less empty miles.';for(const fn of observers)fn([]);
  assert.match(cell.textContent,/11 more trips/);
  cell.textContent='Two depots completed 1 fewer trips, with 0.2 less empty miles.';for(const fn of observers)fn([]);
  assert.match(cell.textContent,/1 fewer trip,/);
 }finally{globalThis.MutationObserver=prior;restore();}
});
