// Event-tick ownership (engineering note sections 20 and 21): due and window ticks count only after their visit
// arrives, the verifier walks its own event-tick set, and a record at any other tick is refused even when it is
// otherwise consistent.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as h from './helpers/depot-lab-cases.mjs';
import * as m from './helpers/depot-lab-mutate.mjs';
import {verifyDepotRun} from '../src/model/depot-lab-verify/verify.js';

const tape=()=>h.scenario({H:6000,A:5001,positions:[h.position('W1','waiting'),h.position('W2','waiting')],
 workers:[h.worker('L01',h.LEAD,{H:6000,availability:[{start_tick:0,end_tick:1000},{start_tick:2000,end_tick:6000}]}),h.worker('M01',h.MOVER,{H:6000})],
 visits:[h.visit('V1',{windows:[{task_template:'intake',earliest_start_tick:900}]}),h.visit('V2',{arrival:5000,due:5800,windows:[{task_template:'egress',earliest_start_tick:890}]})]});

test('a future visit contributes no event tick before its arrival: no record falls at 890 or at its due time',()=>{
 const L=h.run(tape()).ledger,ticks=new Set(L.records.map(r=>r.tick));
 assert.ok(!ticks.has(890),'the window of a visit arriving at 5,000 is not an event tick at 890');
 assert.equal(verifyDepotRun(tape(),m.clone(L)).status,'VERIFIED');
});

test('a consistent rejection inserted at a tick that is not an event tick is refused as RECORD_ORDER_INVALID',()=>{
 const s=tape(),L=m.clone(h.run(s).ledger),i=L.records.findIndex(r=>r.tick>890);
 const extra=m.record(890,4,'POLICY_DECISION',{accepted:false,action_id:'action:000890:01:000000',blockage_group_id:null,observation_seq:0,
  reasons:[{code:'INSUFFICIENT_SHIFT',holder_visit_ids:[],resource_ids:['worker:L01']},{code:'SCHEDULED_WINDOW',holder_visit_ids:[],resource_ids:[]}],task_id:'task:V1:intake'});
 L.records.splice(i,0,extra);
 const e=verifyDepotRun(s,m.renumber(L));
 assert.equal(e.status,'INVALID');assert.equal(e.primary_violation.code,'RECORD_ORDER_INVALID');assert.equal(e.primary_violation.tick,890);assert.equal(e.projection,null);
});
