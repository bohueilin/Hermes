import test from 'node:test';import assert from 'node:assert/strict';
import {ORDER_STUDY} from '../src/data/delivery-order-study.js';import {reconstructOrderStudy} from '../src/runtime/delivery-order-worker.js';
import {createOrderProjection} from '../src/ui/delivery-order-view.js';
test('projection respects interval boundaries and exposes checked assignments, not a new optimum',()=>{
 const s=reconstructOrderStudy(ORDER_STUDY.cases.default).study,p=createOrderProjection(s),o=s.representative_order;
 for(const [time,state]of [[89999,'Not arrived'],[90000,'Waiting'],[96000,'Receiving'],[143999,'Receiving'],[144000,'Checking'],[204000,'Activating'],[234000,'Ready']])assert.equal(p.at(o,time,'V4').state,state);
 assert.equal(p.at(o,240000,'V4').late_ms,0);assert.equal(p.at(o,0,'V4').receive_by_ms,150000);
 for(const row of p.assignment(o)){assert.equal(row.cells.filter(c=>c.selected).length,1);const chosen=row.cells.find(c=>c.selected);assert.equal(chosen.ready_ms,p.outcome(o).vehicles.find(v=>v.id===row.id).ready_ms);}
 assert.throws(()=>p.outcome(['V1']),/checked study/);
});
test('close-target individual harm is preserved at every clock time',()=>{const s=reconstructOrderStudy(ORDER_STUDY.cases.close).study,p=createOrderProjection(s);for(const t of [0,96000,282000,330000,2400000])assert.equal(p.at(s.representative_order,t,'V2').late_ms,50000);});
