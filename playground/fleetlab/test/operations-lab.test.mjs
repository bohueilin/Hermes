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

test('staffing demo displays recorded work, comparisons, denominators and stale warnings',async()=>{
  const restore=installFakeDom();try{
    const lab=createOperationsLab({reducedMotion:()=>true});
    const preset=lab.element.querySelector('[aria-label="Start with a situation"]');
    assert.ok([...preset.children].some(o=>o.value==='staffing'));
    preset.value='staffing';preset.dispatchEvent(new Event('change'));
    await lab.run();const r=lab.getState().result;assert.ok(r.readiness);
    const frame=r.frames.find(f=>f.vehicles.some(v=>v.readiness?.blocked_reason==='WORKER_UNAVAILABLE'));
    const vehicle=frame.vehicles.find(v=>v.readiness?.blocked_reason==='WORKER_UNAVAILABLE');
    const picker=lab.element.querySelector('[aria-label="Follow a car"]');picker.value=vehicle.id;picker.dispatchEvent(new Event('change'));lab.seek(frame.minute);
    assert.match(lab.element.querySelector('.ops-vehicle-detail').textContent,/WORKER_UNAVAILABLE/);
    assert.match(lab.element.querySelector('.ops-readiness-result').textContent,/Unfinished required tasks/);
    await lab.compareReadiness();assert.equal(lab.getState().readinessComparison.replications,1);
    assert.match(lab.element.querySelector('.ops-readiness-comparison').textContent,/Cleaning workers per depot: 1 → 2/);
    assert.match(lab.element.querySelector('.ops-readiness-comparison').textContent,/Cleaning bays per depot: 3 → 4/);
    assert.match(lab.element.textContent,/NOT_EVIDENCE/);
    const input=lab.element.querySelector('[aria-label="Qualified cleaning workers / depot"]');input.value='2';input.dispatchEvent(new Event('change'));
    assert.equal(lab.getState().stale,true);assert.match(lab.element.querySelector('.ops-readiness-comparison').textContent,/Settings changed/);
    assert.equal(r.config.readiness.cleaning_workers,1);lab.destroy();
  }finally{restore();}
});

test('initial preset matches legacy config and readiness comparison requires a fresh replay',async()=>{
  const restore=installFakeDom();try{
    const lab=createOperationsLab({reducedMotion:()=>true});
    assert.equal(lab.element.querySelector('[aria-label="Start with a situation"]').value,'balanced');
    const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='staffing';preset.dispatchEvent(new Event('change'));
    await lab.compareReadiness();assert.equal(lab.getState().readinessComparison,null);
    await lab.run();const pending=lab.compareReadiness();lab.setConfig({requests_per_hour:20});await pending;
    assert.equal(lab.getState().readinessComparison,null);assert.equal(lab.getState().stale,true);
    await lab.compareReadiness();assert.equal(lab.getState().readinessComparison,null);
    lab.destroy();
  }finally{restore();}
});

test('empty readiness populations display unavailable values rather than null',async()=>{
  const restore=installFakeDom();try{
    const lab=createOperationsLab({reducedMotion:()=>true});
    const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='staffing';preset.dispatchEvent(new Event('change'));
    lab.setConfig({requests_per_hour:0});await lab.run();
    const rows=lab.element.querySelector('.ops-readiness-result').querySelectorAll('tr');
    assert.match([...rows].find(r=>r.textContent.includes('Oldest unfinished')).textContent,/Not available/);
    lab.destroy();
  }finally{restore();}
});

test('an unavailable resource treatment is rendered without hiding the valid trial',async()=>{
  const restore=installFakeDom();try{
    const lab=createOperationsLab({reducedMotion:()=>true});const preset=lab.element.querySelector('[aria-label="Start with a situation"]');preset.value='staffing';preset.dispatchEvent(new Event('change'));
    lab.setConfig({cleaning_bays:120});await lab.run();await lab.compareReadiness();
    const content=lab.element.querySelector('.ops-readiness-comparison');
    assert.match(content.textContent,/Cleaning bays per depot: 120 → 121. Not available/);
    assert.match(content.textContent,/Cleaning workers per depot: 1 → 2/);
    assert.ok(content.querySelector('table'));lab.destroy();
  }finally{restore();}
});
