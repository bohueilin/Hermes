import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOperationsLab, operationsClock } from '../src/ui/operations-lab.js';
import { installFakeDom } from './helpers/fake-dom.mjs';

test('a day runs only on request; reduced motion stays paused and edited results are marked stale', async()=>{
  const restore=installFakeDom();
  try{
    const lab=createOperationsLab({reducedMotion:()=>true});
    assert.equal(lab.getState().result,null);
    lab.setConfig({fleet_size:8,requests_per_hour:8,duration_hours:2});
    await lab.run();
    assert.ok(lab.getState().result.frames.length>1);
    assert.equal(lab.getState().playing,false);
    lab.seek(30); assert.equal(lab.getState().minute,30);
    lab.setConfig({fleet_size:10});
    assert.equal(lab.getState().stale,true);
    assert.equal(lab.getState().result.config.fleet_size,8);
    assert.match(lab.element.textContent,/previous settings/i);
    lab.destroy();
  }finally{restore();}
});

test('a pending run preserves its submitted settings and cannot resume after navigation pauses it',async()=>{
  const restore=installFakeDom();
  try{
    const lab=createOperationsLab({reducedMotion:()=>false,requestFrame:()=>77,cancelFrame:()=>{}});
    lab.setConfig({fleet_size:8,requests_per_hour:8,duration_hours:2});
    const pending=lab.run();
    lab.pause();
    await pending;
    assert.equal(lab.getState().playing,false);
    const next=lab.run();lab.setConfig({fleet_size:12});await next;
    assert.equal(lab.getState().result.config.fleet_size,8);
    assert.equal(lab.getState().config.fleet_size,12);
    assert.equal(lab.getState().stale,true);
    assert.equal(lab.getState().playing,false);
    lab.destroy();
  }finally{restore();}
});

test('the day clock identifies a midnight crossing',()=>{
  assert.equal(operationsClock(1439),'23:59');
  assert.equal(operationsClock(1440),'Day 2 · 00:00');
  assert.equal(operationsClock(1505),'Day 2 · 01:05');
});

test('fleet counters account for every vehicle including queues and depot work',async()=>{
  const restore=installFakeDom();
  try{
    const lab=createOperationsLab({reducedMotion:()=>true});
    await lab.run();lab.seek(300);
    const counts=[...lab.element.querySelector('.ops-frame-counts').querySelectorAll('strong')].map(x=>Number(x.textContent));
    assert.equal(counts.reduce((a,b)=>a+b,0),lab.getState().result.config.fleet_size);
    assert.ok(counts[4]+counts[5]>0);
    lab.destroy();
  }finally{restore();}
});

test('explicit run starts playback; pause and next activity retain the recorded day',async()=>{
  const restore=installFakeDom();
  try{
    const lab=createOperationsLab({reducedMotion:()=>false,requestFrame:()=>77,cancelFrame:()=>{}});
    lab.setConfig({fleet_size:8,requests_per_hour:8,duration_hours:2});
    await lab.run(); assert.equal(lab.getState().playing,true);
    lab.pause(); assert.equal(lab.getState().playing,false);
    const result=lab.getState().result;
    lab.nextActivity(); assert.ok(lab.getState().minute>0);
    assert.equal(lab.getState().result,result);
    lab.destroy();
  }finally{restore();}
});

test('all Bay locations and editable vehicle profiles are available before running',()=>{
  const restore=installFakeDom();try{
    const lab=createOperationsLab({reducedMotion:()=>true});
    assert.equal(lab.element.querySelectorAll('[data-location-checkbox]').length,18);
    assert.match(lab.element.textContent,/Jaguar I-PACE/);assert.match(lab.element.textContent,/Ojai/);
    assert.ok(lab.element.querySelector('[aria-label="Ojai share of fleet"]'));
    assert.ok(lab.element.querySelector('[aria-label="Ojai modeled battery"]'));
    assert.ok(lab.element.querySelector('[aria-label="Map view"]'));
    const selected=lab.getState().config.place_ids;assert.equal(selected.length,18);
    lab.destroy();
  }finally{restore();}
});

test('selected car details use its own vehicle battery and identify its type',async()=>{
 const restore=installFakeDom();try{
  const lab=createOperationsLab({reducedMotion:()=>true});lab.setConfig({fleet_size:4,ojai_share_pct:100,requests_per_hour:3,duration_hours:1});await lab.run();
  const result=lab.getState().result;assert.ok(result);const car=result.frames[0].vehicles[0];
  assert.equal(Number(lab.element.querySelector('meter').getAttribute('max')),car.battery_kwh);
  assert.match(lab.element.querySelector('.ops-vehicle-detail').textContent,/Ojai/);lab.destroy();
 }finally{restore();}
});
