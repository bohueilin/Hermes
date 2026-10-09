import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {flowComparisonSteps} from '../src/model/depot-flow.js';
const ui=await import('../src/ui/depot-flow-lab.js').catch(()=>({}));
test('lesson has inputs before Run; a completed run shows all rules and readable checks',async()=>{
  assert.equal(typeof ui.createDepotFlowLab,'function');const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});document.body.appendChild(lab.element);
    assert.match(lab.element.textContent,/Nothing has run yet/);assert.equal(lab.element.querySelector('[data-flow-outcomes]'),null);
    await lab.run();assert.equal(lab.getState().result.comparison_eligible,true);
    assert.ok(lab.element.querySelector('[data-flow-outcomes]'));assert.match(lab.element.textContent,/Vehicle A becomes ready 1 min later/);
    assert.ok(lab.element.querySelector('caption'));assert.match(lab.element.textContent,/Individual earliest readiness/);
    assert.equal(lab.element.querySelectorAll('input[type="range"]').length,1);lab.destroy();
  }finally{restore();}
});
test('new settings and cancellation retain explicitly old results, with partial diagnostics',async()=>{
  const restore=installFakeDom();let release;let block=false;
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>block?new Promise(r=>release=r):Promise.resolve()});
    await lab.run();lab.setOptions({b_gb:15});assert.match(lab.element.textContent,/Result from previous setup/);assert.match(lab.element.textContent,/7.5 GB → 15 GB/);
    block=true;const pending=lab.run();release();await Promise.resolve();await Promise.resolve();lab.cancel();release();await pending;
    assert.equal(lab.getState().attempt.status,'cancelled');assert.equal(lab.getState().result.scenario.vehicles[1].upload_bytes,7.5e9);assert.match(lab.element.textContent,/No new comparison/);lab.destroy();
  }finally{restore();}
});
test('superseded callback, rejected verification and invalid input cannot publish new results',async()=>{
  const restore=installFakeDom();const queue=[];
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>new Promise(r=>queue.push(r))});
    const first=lab.run();lab.setOptions({b_gb:45});queue.shift()();await first;assert.equal(lab.getState().result,null);
    lab.setOptions({b_gb:99});await lab.run();assert.equal(lab.getState().attempt.status,'invalid');lab.destroy();
    const bad=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve(),steps:function*(o){const g=flowComparisonSteps(o);let n;do{n=g.next();if(!n.done)yield n.value;}while(!n.done);n.value.arms[0].verification.model_validity='INVALID';n.value.arms[0].verification.comparison_eligible=false;n.value.comparison_eligible=false;return n.value;}});
    await bad.run();assert.equal(bad.getState().result,null);assert.match(bad.element.textContent,/withheld/);bad.destroy();
  }finally{restore();}
});
test('cursor uses exact events and route departure cancels pending work',async()=>{
  const restore=installFakeDom();
  try{const lab=ui.createDepotFlowLab({yieldPage:()=>Promise.resolve()});await lab.run();
    const cursor=lab.element.querySelector('input[type="range"]');assert.equal(cursor.getAttribute('step'),'60');
    lab.element.querySelector('[data-next-event]').click();assert.match(lab.element.querySelector('[data-cursor-state]').textContent,/Minute 1/);
    assert.match(lab.exportJSON(),/NOT_AUTHENTICATED/);lab.pause();lab.destroy();
  }finally{restore();}
});

test('control changes preserve keyboard focus and a named lesson restores its setup',()=>{
  const restore=installFakeDom();try{const lab=ui.createDepotFlowLab();document.body.appendChild(lab.element);
    const select=lab.element.querySelector('[aria-label="Vehicle B upload"]');select.focus();select.value='45';select.dispatchEvent(new Event('change'));
    assert.equal(document.activeElement,select);assert.equal(lab.getState().options.b_gb,45);
    lab.setLesson({id:'two-vehicles'});assert.equal(lab.getState().options.b_gb,7.5);lab.destroy();
  }finally{restore();}
});
