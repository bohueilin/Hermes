import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installFakeDom} from './helpers/fake-dom.mjs';
import {runFlowComparison,FLOW_RULES} from '../src/model/depot-flow.js';
import {runCohortComparison} from '../src/model/depot-cohort.js';
import {COHORT_RULES} from '../src/model/depot-cohort-contract.js';
import * as charts from '../src/ui/charts.js';

function build(options={},settings={}){assert.equal(typeof charts.flowLanesCharts,'function');return charts.flowLanesCharts({result:runFlowComparison(settings),rules:FLOW_RULES,...options});}
const all=(chart,sel)=>[...chart.element.querySelectorAll(sel)];

test('one shared axis and cursor draw literal ready/deadline times and rate-proportional service',()=>{
 const restore=installFakeDom();try{
  const c=build();assert.equal(all(c,'[data-role="cursor"]').length,1);assert.equal(all(c,'[data-axis="time"]').length,1);
  assert.equal(all(c,'svg')[0].getAttribute('viewBox'),'0 0 640 336');
  assert.deepEqual(all(c,'[data-flow-mark="ready"]').map(n=>Number(n.getAttribute('data-time'))),[720,780,780,240,780,180]);
  assert.equal(all(c,'[data-flow-mark="deadline"]').length,6);
  const share=all(c,'[data-flow-state="receiving"]').find(n=>n.getAttribute('data-rule')==='nf_equal_uplink'&&n.getAttribute('data-vehicle')==='B');
  assert.equal(share.getAttribute('height'),'10');assert.equal(share.getAttribute('data-end'),'120');
  const fast=all(c,'[data-flow-state="receiving"]').find(n=>n.getAttribute('data-rule')==='nf_departure_deadline'&&n.getAttribute('data-vehicle')==='B');
  assert.equal(fast.getAttribute('height'),'20');assert.equal(fast.getAttribute('data-end'),'60');
  c.setCursor(180);assert.equal(all(c,'[data-role="cursor"]')[0].getAttribute('transform'),'translate(201.6 0)');
  assert.equal(all(c,'[data-view="table"] tbody tr').length,42);assert.doesNotMatch(c.element.textContent,/D1/);
 }finally{restore();}
});

test('20 kW shows readiness after charging, not after upload, and the initial whole-run view survives seeks',()=>{
 const restore=installFakeDom();try{
  const c=build({}, {charger_kw:20});
  const readyA=all(c,'[data-flow-mark="ready"]').filter(n=>n.getAttribute('data-vehicle')==='A');assert.deepEqual(readyA.map(n=>n.getAttribute('data-time')),['1080','1080','1080']);
  c.setCursor(180);assert.ok(readyA.every(n=>n.getAttribute('visibility')!=='hidden'));
  c.setReveal(true);assert.ok(readyA.every(n=>n.getAttribute('visibility')==='hidden'));
  const clip=all(c,'[data-role="flow-clip"]')[0];assert.match(clip.getAttribute('transform'),/scale\(0\.15 1\)/);
  c.setCursor(1080);assert.ok(readyA.every(n=>n.getAttribute('visibility')==='visible'));
  c.setCursor(180);assert.ok(readyA.every(n=>n.getAttribute('visibility')==='hidden'));c.dispose();
 }finally{restore();}
});

test('table selection calls pause hook and leaves the scientific comparison byte-identical',()=>{
 const restore=installFakeDom();try{
  const result=runFlowComparison(),before=JSON.stringify(result),states=[];const c=build({result,onTableChange:on=>states.push(on)});
  all(c,'[data-role="table-toggle"]')[0].click();assert.deepEqual(states,[true]);
  c.setVehicle('A');c.setCursor(300);c.setReveal(true);c.showTable(false);
  assert.equal(JSON.stringify(result),before);assert.ok(all(c,'[data-vehicle="B"]').every(n=>!String(n.getAttribute('style')).includes('opacity')));
 }finally{restore();}
});

test('responsive redraw preserves reveal, cursor and vehicle and disposal disconnects its observer',()=>{
 const restore=installFakeDom();const prior=globalThis.ResizeObserver;let observer;
 globalThis.ResizeObserver=class{constructor(fn){this.fn=fn;this.nodes=[];this.disconnected=false;observer=this;}observe(n){this.nodes.push(n);}disconnect(){this.disconnected=true;}};
 try{
  const c=build();c.setCursor(180);c.setReveal(true);c.setVehicle('B');observer.fn([{target:observer.nodes[0],contentRect:{width:336}}]);
  assert.equal(all(c,'svg')[0].getAttribute('viewBox'),'0 0 336 336');assert.equal(all(c,'[data-role="cursor"]')[0].getAttribute('transform'),'translate(140.8 0)');
  assert.equal(all(c,'[data-flow-mark="ready"]').filter(n=>n.getAttribute('visibility')==='visible').length,1);
  assert.deepEqual(all(c,'[data-axis="time"] text').map(n=>n.textContent),['0','5','10','15 min']);
  c.dispose();assert.equal(observer.disconnected,true);
 }finally{if(prior===undefined)delete globalThis.ResizeObserver;else globalThis.ResizeObserver=prior;restore();}
});

test('ineligible comparison cannot acquire lanes or an accepted timeline',()=>{
 const restore=installFakeDom();try{const result=runFlowComparison();result.comparison_eligible=false;assert.throws(()=>build({result}),/verified|eligible/i);}finally{restore();}
});

test('cohort phone rule filters preserve the shared clock and all end outcomes, with bounded exact allocation runs',()=>{
 const restore=installFakeDom();try{
  for(const time_quantum_ms of [1000,250]){
   const result=runCohortComparison({time_quantum_ms}),before=JSON.stringify(result),c=charts.flowLanesCharts({result,rules:COHORT_RULES});
   assert.equal(all(c,'svg')[0].getAttribute('viewBox'),'0 0 640 588');
   assert.equal(all(c,'[data-flow-mark="ready"]').length,16);
   assert.deepEqual(all(c,'[data-flow-mark="ready"]').slice(0,4).map(n=>Number(n.getAttribute('data-time'))),[600,660,1020,1140]);
   c.setCursor(.25);c.setReveal(true);c.setVehicle('D');c.setRule('cohort_shortest_upload');
   assert.equal(all(c,'svg')[0].getAttribute('viewBox'),'0 0 640 168');
   assert.equal(all(c,'[data-role="cursor"]')[0].getAttribute('transform'),'translate(96.09 0)');
   assert.ok(all(c,'[data-flow-group="cohort_fifo"]').every(n=>n.getAttribute('display')==='none'));
   assert.ok(all(c,'[data-vehicle="D"]').filter(n=>n.tagName.toLowerCase()==='text').every(n=>n.getAttribute('font-weight')==='700'));
   const rows=all(c,'[data-view="table"] tbody tr');assert.ok(rows.length<3000,`Exact contiguous runs should bound the table, got ${rows.length}`);
   assert.ok(rows.some(n=>/intervals 0 to/.test(n.textContent)));assert.equal(JSON.stringify(result),before);c.dispose();
  }
 }finally{restore();}
});

test('continuous cursor frames only write cursor and clip transforms until a ready boundary',()=>{
 const restore=installFakeDom();try{
  const c=build();c.setCursor(120);c.setReveal(true);const writes=[];
  for(const node of all(c,'*')){const original=node.setAttribute.bind(node);node.setAttribute=(key,value)=>{writes.push([node.getAttribute('data-role'),key]);original(key,value);};}
  c.setCursor(121);assert.deepEqual(writes,[['cursor','transform'],['flow-clip','transform']]);
 }finally{restore();}
});
