import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {capacityScenario} from '../src/model/depot-capacity-contract.js';
const bench=await import('../src/ui/depot-capacity-bench.js').catch(()=>({}));

const visit={vehicle:'A1',present:true,ready:false,tasks:{upload:'active',charge:'waiting',post:'waiting'},upload_bytes:500,upload_total:1000,energy_j:0,energy_total:3600000,post_s:0,post_total_s:120,upload_rate_bytes_s:1,charge_rate_j_s:0,deadline_s:600,wait_reason:'Vehicle A1 waits for a charging port.'};
const arm={case:'base',label:'Base',time_s:10,visits:[visit],selected:visit,upload:{used:1,capacity:1000,fraction:.001},energy:{used:0,capacity:60000,fraction:0},ports:[{port:1,vehicle:null,rate_j_s:0},{port:2,vehicle:null,rate_j_s:0}]};
const projection={available:true,time_s:10,scales:{upload_bytes_s:1000,energy_j_s:120000},arms:[arm]};

test('static preview names fixture inputs without inventing a current state or enabling replay',()=>{
  const restore=installFakeDom();
  try{
    assert.equal(typeof bench.createCapacityPreview,'function');
    const e=bench.createCapacityPreview(capacityScenario({regime:'energy_heavy',treatment:'base'}),'Energy-heavy');
    assert.match(e.textContent,/System preview/);assert.match(e.textContent,/Energy-heavy/);
    assert.match(e.textContent,/Upload/);assert.match(e.textContent,/Energy/);
    assert.equal(e.querySelectorAll('[data-preview-vehicle]').length,12);
    assert.equal(e.querySelectorAll('[data-link-moving="true"]').length,0);
    assert.equal(e.querySelectorAll('[role="meter"]').length,0,'preview has no fabricated rates');
  }finally{restore();}
});

test('quantitative rate widths have no minimum and direction motion only marks active links during play',()=>{
  const restore=installFakeDom();
  try{
    assert.equal(typeof bench.createCapacityBench,'function');
    let selected=null;const b=bench.createCapacityBench({onSelect:id=>{selected=id;}});b.update(projection,false);
    const e=b.element,rate=e.querySelector('[data-rate="upload"]');
    assert.equal(Number(rate.querySelector('rect.cap-rate-fill').getAttribute('width')),.1);
    assert.equal(rate.getAttribute('aria-valuenow'),'1');assert.equal(rate.getAttribute('aria-valuemax'),'1000');
    assert.match(e.querySelector('.flow-wait-reason').textContent,/waits for a charging port/);
    const marker=e.querySelector('button[data-vehicle="A1"]');marker.click();assert.equal(selected,'A1');
    b.update(projection,true);
    assert.equal(e.querySelectorAll('[data-link-moving="true"]').length,1,'idle energy does not move');
    assert.equal(e.querySelector('button[data-vehicle="A1"]'),marker,'the interactive marker stays mounted across frames');
    b.update(projection,false);assert.equal(e.querySelectorAll('[data-link-moving="true"]').length,0);
    b.update({available:false,reason:'Comparison not available.',arms:[]},true);
    assert.equal(e.querySelectorAll('[role="meter"]').length,0);assert.equal(e.querySelectorAll('button').length,0);
    assert.match(e.textContent,/not available/);
  }finally{restore();}
});

test('selected identity, immediate wait and fixed outcome stay together while inspection changes',()=>{
  const restore=installFakeDom();try{const b=bench.createCapacityBench();const final={on_time:3,total:12,vehicle:'A1',ready_s:600,outcome:'on_time'};b.update({...projection,arms:[{...arm,final}]});
    const selected=b.element.querySelector('.cap-selected');assert.ok(selected.querySelector('.cap-selected-symbol'),'selected vehicle has a focal identity');
    assert.match(selected.querySelector('.cap-selected-outcome').textContent,/ready at minute 10.*on time/);
    b.update({...projection,time_s:20,arms:[{...arm,time_s:20,final}]});assert.match(selected.querySelector('.cap-selected-outcome').textContent,/ready at minute 10.*on time/);
    assert.match(b.element.querySelector('.cap-pair-label').textContent,/fixed while replay moves/);
  }finally{restore();}
});

test('phone arm controls show projected treatment names and preserve the selected side across frames and comparisons',()=>{
  const restore=installFakeDom();try{
    const b=bench.createCapacityBench(),base={...arm,arm_label:'Equal uplink share'},pair={...projection,arms:[base,{...arm,case:'rule',label:'Different rule',arm_label:'Departure deadline first'}]};b.update(pair);
    let controls=b.element.querySelector('.capacity-mobile-arms').querySelectorAll('button');
    assert.deepEqual(controls.map(n=>n.textContent),['Equal uplink share','Departure deadline first']);
    assert.equal(controls[1].getAttribute('aria-label'),'Show Departure deadline first');
    controls[1].click();assert.equal(controls[1].getAttribute('aria-pressed'),'true');
    assert.equal(b.element.querySelector('[data-case="base"]').getAttribute('data-mobile-visible'),'false');
    const current=controls[1];b.update({...pair,time_s:20,arms:pair.arms.map(a=>({...a,time_s:20}))});
    controls=b.element.querySelector('.capacity-mobile-arms').querySelectorAll('button');
    assert.equal(controls[1],current);assert.equal(controls[1].getAttribute('aria-pressed'),'true');
    assert.equal(b.element.querySelector('[data-case="rule"]').getAttribute('data-mobile-visible'),'true');
    b.update({...pair,arms:[base,{...pair.arms[1],arm_label:'Shortest upload first'}]});
    assert.equal(current.textContent,'Shortest upload first');assert.equal(current.getAttribute('aria-label'),'Show Shortest upload first');assert.equal(current.getAttribute('aria-pressed'),'true');
    b.update({...projection,arms:[base,{...arm,case:'power',label:'More power',arm_label:'More power'}]});
    controls=b.element.querySelector('.capacity-mobile-arms').querySelectorAll('button');
    assert.deepEqual(controls.map(n=>n.textContent),['Equal uplink share','More power']);assert.equal(controls[1].getAttribute('aria-pressed'),'true');
    assert.equal(b.element.querySelector('[data-case="power"]').getAttribute('data-mobile-visible'),'true');
    assert.equal(b.element.querySelector('[data-rate="upload"]').getAttribute('aria-valuenow'),'1');
  }finally{restore();}
});
