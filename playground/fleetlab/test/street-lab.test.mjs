import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreetLab} from '../src/ui/street-lab.js';
import {installFakeDom} from './helpers/fake-dom.mjs';
test('street replay is explicit, changing settings preserves the prior result, and pause cancels animation',async()=>{
 const restore=installFakeDom();const canceled=[];let lab;try{
  lab=createStreetLab({requestFrame:()=>123,cancelFrame:id=>canceled.push(id),reducedMotion:()=>false});document.body.appendChild(lab.element);
  assert.equal(lab.getState().run,null);lab.setConfig({duration_minutes:10,background_per_hour:0});await lab.run();
  const run=lab.getState().run;assert.ok(run.frames.length>0);assert.equal(lab.getState().playing,false);
  assert.equal(document.activeElement,lab.element.querySelector('.street-results h2'));
  assert.equal(document.activeElement.textContent,'Result summary');
  assert.match(lab.element.querySelector('.street-status').textContent,/complete/i);
  lab.element.querySelector('.street-playback button').click();assert.equal(lab.getState().playing,true);
  lab.setConfig({fleet_size:12});assert.equal(lab.getState().run,run);assert.equal(lab.getState().stale,true);assert.equal(lab.getState().playing,false);assert.ok(canceled.includes(123));
  lab.seek(300);assert.equal(lab.getState().time,300);assert.match(lab.element.textContent,/previous run/i);
 }finally{lab?.destroy();restore();}
});
test('street model identity matches the submitted version and remains attached to stale results',async()=>{
 const restore=installFakeDom();let lab;try{
  lab=createStreetLab();document.body.appendChild(lab.element);
  const header=lab.element.querySelector('.model-identity');assert.ok(header);assert.equal(header.tagName,'P');
  assert.match(header.textContent,/Street lab.*OpenStreetMap San Francisco street extracts.*street-lab-v1/);
  assert.match(header.textContent,/Results are not interchangeable with other FleetLab models\./);
  lab.setConfig({duration_minutes:10,background_per_hour:0});await lab.run();
  assert.equal(lab.getState().run.version,'street-lab-v1');assert.ok(header.textContent.includes(lab.getState().run.version));
  lab.setConfig({seed:987});assert.match(header.textContent,/previous|stale/i);assert.ok(header.textContent.includes(lab.getState().run.version));
 }finally{lab?.destroy();restore();}
});
test('reduced-motion Street Play lands on whole minutes and advances once per second without fractional replay',async()=>{
 const restore=installFakeDom();let lab;try{
  lab=createStreetLab({reducedMotion:()=>true});document.body.appendChild(lab.element);
  lab.setConfig({duration_minutes:10,background_per_hour:0});await lab.run();lab.seek(62.5);
  lab.element.querySelector('.street-playback button').click();assert.equal(lab.getState().time,60);
  restore.dom.frames.flush(0);restore.dom.frames.flush(500);assert.equal(lab.getState().time,60);
  restore.dom.frames.flush(1000);assert.equal(lab.getState().time,120);assert.match(lab.element.querySelector('.street-clock').textContent,/:02:00$/);
  restore.dom.frames.flush(1999);assert.equal(lab.getState().time,120);
  restore.dom.frames.flush(2000);assert.equal(lab.getState().time,180);
  restore.dom.frames.flush(9000);assert.equal(lab.getState().time,240);
 }finally{lab?.destroy();restore();}
});
test('Street replay uses the effective motion override and stops interpolating when it changes',async()=>{
 const restore=installFakeDom(globalThis,{media:{'(prefers-reduced-motion: reduce)':true}});let lab,reduced=false;try{
  lab=createStreetLab({reducedMotion:()=>reduced});document.body.appendChild(lab.element);
  lab.setConfig({duration_minutes:10,background_per_hour:0});await lab.run();lab.seek(60);
  lab.element.querySelector('.street-playback button').click();restore.dom.frames.flush(0);restore.dom.frames.flush(110);
  assert.equal(lab.getState().time,66);reduced=true;restore.dom.frames.flush(126);assert.equal(lab.getState().time,60);
  const view=lab.element.querySelector('[aria-label="Flat San Francisco street simulation"]');
  const positions=()=>view.querySelectorAll('g').map(g=>g.getAttribute('transform'));
  lab.seek(300);const recorded=positions();lab.seek(302.5);assert.deepEqual(positions(),recorded);
  reduced=false;lab.seek(302.5);assert.notDeepEqual(positions(),recorded);
 }finally{lab?.destroy();restore();}
});
test('Street start action leaves summary focus without scrolling to the scene',async()=>{
 const restore=installFakeDom();let lab;try{
  lab=createStreetLab();document.body.appendChild(lab.element);lab.setConfig({duration_minutes:10,background_per_hour:0});
  let scrolls=0;lab.element.querySelector('.street-map').scrollIntoView=()=>scrolls++;
  lab.element.querySelector('.street-intro button').click();await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(scrolls,0);assert.equal(document.activeElement,lab.element.querySelector('.street-results h2'));assert.equal(lab.getState().playing,false);
 }finally{lab?.destroy();restore();}
});
test('a new run clears the selected block observation from the previous run',async()=>{
 const restore=installFakeDom();let lab;try{
  lab=createStreetLab({reducedMotion:()=>true});document.body.appendChild(lab.element);lab.setConfig({duration_minutes:30,requests_per_hour:0});await lab.run();lab.seek(1200);
  lab.element.querySelector('.street-queue-list button').click();assert.match(lab.element.querySelector('.street-block-detail').textContent,/storage slots/);
  lab.setConfig({background_per_hour:0});await lab.run();assert.equal(lab.element.querySelector('.street-block-detail').textContent,'');
 }finally{lab?.destroy();restore();}
});
test('invalid replacement run preserves a usable previous comparison',async()=>{
 const restore=installFakeDom();let lab;try{
  lab=createStreetLab({reducedMotion:()=>true});lab.setConfig({duration_minutes:10,background_per_hour:0});await lab.run(true);lab.setConfig({fleet_size:0});await lab.run();
  lab.element.querySelector('.street-replay-variant').querySelectorAll('button')[1].click();assert.equal(lab.getState().run.config.policy,'queue-aware');
 }finally{lab?.destroy();restore();}
});
test('navigation pause while a run is pending prevents hidden autoplay',async()=>{
 const restore=installFakeDom();let lab;try{
  lab=createStreetLab({requestFrame:()=>123,cancelFrame:()=>{},reducedMotion:()=>false});lab.setConfig({duration_minutes:10,background_per_hour:0});const pending=lab.run();lab.pause();lab.element.hidden=true;await pending;
  assert.ok(lab.getState().run);assert.equal(lab.getState().playing,false);
 }finally{lab?.destroy();restore();}
});
test('Street summary focus preserves the user scroll position after Run',async()=>{const restore=installFakeDom();let lab;try{
 lab=createStreetLab();lab.setConfig({duration_minutes:10,background_per_hour:0});const heading=lab.element.querySelector('.street-results h2'),focus=heading.focus.bind(heading);let options;
 heading.focus=value=>{options=value;focus(value);};await lab.run();assert.deepEqual(options,{preventScroll:true});
}finally{lab?.destroy();restore();}});
