import test from 'node:test';
import assert from 'node:assert/strict';
import {createStreetLab} from '../src/ui/street-lab.js';
import {installFakeDom} from './helpers/fake-dom.mjs';
test('street replay is explicit, changing settings preserves the prior result, and pause cancels animation',async()=>{
 const restore=installFakeDom();const canceled=[];let lab;try{
  lab=createStreetLab({requestFrame:()=>123,cancelFrame:id=>canceled.push(id),reducedMotion:()=>false});document.body.appendChild(lab.element);
  assert.equal(lab.getState().run,null);lab.setConfig({duration_minutes:10,background_per_hour:0});await lab.run();
  const run=lab.getState().run;assert.ok(run.frames.length>0);assert.equal(lab.getState().playing,true);
  lab.setConfig({fleet_size:12});assert.equal(lab.getState().run,run);assert.equal(lab.getState().stale,true);assert.equal(lab.getState().playing,false);assert.ok(canceled.includes(123));
  lab.seek(300);assert.equal(lab.getState().time,300);assert.match(lab.element.textContent,/previous run/i);
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
